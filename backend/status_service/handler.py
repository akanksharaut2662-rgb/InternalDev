"""Status Service Lambda handler.

Endpoints:
    POST /requests              — Create a new generation request
    GET  /requests              — List all generation requests
    GET  /requests/{id}/status  — Get status of a specific request
    GET  /requests/{id}/plan    — Get generation plan (resolved spec + artifact list)
    POST /requests/{id}/generate — Confirm plan and trigger generation via SQS
"""

import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.logger import get_logger
from shared.response import success, created, bad_request, not_found, server_error, cors_preflight
from shared.db import (
    save_request,
    get_request,
    update_request_status,
    list_requests,
    get_policy_profile,
)

# Import policy parser from sibling package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'policy_service'))
from parser import parse_policy_to_spec
from defaults import DEFAULT_POLICY_PROFILE

import boto3

logger = get_logger("status-service")

SQS_QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")
sqs_client = boto3.client("sqs")


def handler(event, context):
    """Lambda entry point for the status service."""
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")
    resource = event.get("resource", "")
    path_params = event.get("pathParameters", {}) or {}

    logger.info(f"Status service: {http_method} {path} (resource={resource})")

    if http_method == "OPTIONS":
        return cors_preflight()

    try:
        # Route matching
        request_id = path_params.get("id")

        # POST /requests — create new request
        if http_method == "POST" and not request_id:
            return _create_request(event)

        # GET /requests — list all requests
        if http_method == "GET" and not request_id:
            return _list_requests()

        # Routes that require a request ID
        if not request_id:
            return not_found("Missing request ID")

        # GET /requests/{id}/status
        if http_method == "GET" and (path.endswith("/status") or resource.endswith("/status")):
            return _get_status(request_id)

        # GET /requests/{id}/plan
        if http_method == "GET" and (path.endswith("/plan") or resource.endswith("/plan")):
            return _get_plan(request_id)

        # POST /requests/{id}/generate
        if http_method == "POST" and (path.endswith("/generate") or resource.endswith("/generate")):
            return _trigger_generation(request_id, event)

        # GET /requests/{id} — get full request details
        if http_method == "GET":
            return _get_request_details(request_id)

        return not_found(f"Unknown route: {http_method} {path}")

    except Exception as e:
        logger.exception("Unhandled error in status service")
        return server_error(str(e))


def _create_request(event):
    """Create a new generation request."""
    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return bad_request("Invalid JSON body")

    service_request = body.get("serviceRequest", "").strip()
    if not service_request:
        return bad_request("Missing 'serviceRequest' field")

    request_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()

    # Extract a clean service name
    service_name = _extract_service_name(service_request)

    # Resolve the generation plan from the current policy profile
    policy_item = get_policy_profile()
    profile = policy_item.get("profile", DEFAULT_POLICY_PROFILE) if policy_item else DEFAULT_POLICY_PROFILE
    spec = parse_policy_to_spec(profile)

    # Apply naming convention
    naming_pattern = spec["requirements"]["namingPattern"]
    resolved_name = naming_pattern.replace("{name}", service_name)

    save_request(request_id, {
        "requestId": request_id,
        "serviceRequest": service_request,
        "serviceName": service_name,
        "resolvedName": resolved_name,
        "status": "PENDING",
        "step": "Awaiting artifact selection",
        "createdAt": now,
        "GSI1PK": "STATUS#PENDING",
        "GSI1SK": now,
    })

    logger.info(f"Created request {request_id}: '{service_request}' -> {resolved_name}")

    return created({
        "requestId": request_id,
        "serviceName": service_name,
        "resolvedName": resolved_name,
        "status": "PENDING",
        "plan": {
            "spec": spec,
            "artifacts": _build_artifact_options(spec),
        },
    })


def _list_requests():
    """List all generation requests."""
    items = list_requests(limit=50)
    requests = []
    for item in items:
        requests.append({
            "requestId": item.get("requestId"),
            "serviceRequest": item.get("serviceRequest"),
            "serviceName": item.get("serviceName"),
            "resolvedName": item.get("resolvedName"),
            "status": item.get("status"),
            "step": item.get("step"),
            "createdAt": item.get("createdAt"),
            "completedAt": item.get("completedAt"),
            "validationSummary": item.get("validationSummary"),
        })
    return success({"requests": requests})


def _get_status(request_id: str):
    """Get the status of a generation request."""
    item = get_request(request_id)
    if not item:
        return not_found(f"Request {request_id} not found")

    return success({
        "requestId": request_id,
        "status": item.get("status"),
        "step": item.get("step"),
        "createdAt": item.get("createdAt"),
        "completedAt": item.get("completedAt"),
        "error": item.get("error"),
        "generationTimeSeconds": item.get("generationTimeSeconds"),
        "validationSummary": item.get("validationSummary"),
    })


def _get_request_details(request_id: str):
    """Get full details of a generation request."""
    item = get_request(request_id)
    if not item:
        return not_found(f"Request {request_id} not found")

    # Strip DynamoDB key attributes
    details = {k: v for k, v in item.items() if k not in ("PK", "SK", "GSI1PK", "GSI1SK")}
    return success(details)


def _get_plan(request_id: str):
    """Get the generation plan for a request."""
    item = get_request(request_id)
    if not item:
        return not_found(f"Request {request_id} not found")

    # Re-resolve the spec from current policy profile
    policy_item = get_policy_profile()
    profile = policy_item.get("profile", DEFAULT_POLICY_PROFILE) if policy_item else DEFAULT_POLICY_PROFILE
    spec = parse_policy_to_spec(profile)

    naming_pattern = spec["requirements"]["namingPattern"]
    service_name = item.get("serviceName", "service")
    resolved_name = naming_pattern.replace("{name}", service_name)

    return success({
        "requestId": request_id,
        "serviceRequest": item.get("serviceRequest"),
        "resolvedName": resolved_name,
        "spec": spec,
        "artifacts": _build_artifact_options(spec),
        "policyProfile": profile,
    })


def _trigger_generation(request_id: str, event):
    """Confirm the generation plan and send to SQS for async processing."""
    item = get_request(request_id)
    if not item:
        return not_found(f"Request {request_id} not found")

    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return bad_request("Invalid JSON body")

    selected_artifacts = body.get("selectedArtifacts", [])
    if not selected_artifacts:
        return bad_request("No artifacts selected")

    # Update status
    now = datetime.now(timezone.utc).isoformat()
    update_request_status(
        request_id, "QUEUED",
        step="Queued for generation",
        selectedArtifacts=selected_artifacts,
        queuedAt=now,
        GSI1PK="STATUS#QUEUED",
        GSI1SK=now,
    )

    # Send SQS message
    message = {
        "requestId": request_id,
        "serviceRequest": item.get("serviceRequest", ""),
        "serviceName": item.get("serviceName", "service"),
        "selectedArtifacts": selected_artifacts,
    }

    if SQS_QUEUE_URL:
        send_kwargs = {
            "QueueUrl": SQS_QUEUE_URL,
            "MessageBody": json.dumps(message),
        }
        if ".fifo" in SQS_QUEUE_URL:
            send_kwargs["MessageGroupId"] = request_id
        sqs_client.send_message(**send_kwargs)
        logger.info(f"Sent request {request_id} to SQS queue")
    else:
        logger.warning("SQS_QUEUE_URL not set — message not queued")

    return success({
        "requestId": request_id,
        "status": "QUEUED",
        "selectedArtifacts": selected_artifacts,
    })


def _build_artifact_options(spec: dict) -> list[dict]:
    """Build the artifact checkbox options for the generation plan UI."""
    artifact_info = {
        "source": {
            "name": "Application Source Code",
            "description": "Main application code with business logic, models, and configuration",
            "defaultSelected": True,
        },
        "api-skeleton": {
            "name": "API Skeleton",
            "description": "API route definitions, request/response models, and endpoint handlers",
            "defaultSelected": True,
        },
        "readme": {
            "name": "README Documentation",
            "description": "Project README with setup instructions, API docs, and architecture overview",
            "defaultSelected": True,
        },
        "dockerfile": {
            "name": "Docker Configuration",
            "description": "Production Dockerfile with multi-stage build and docker-compose.yml",
            "defaultSelected": True,
        },
        "github-actions": {
            "name": "GitHub Actions Workflow",
            "description": "CI/CD pipeline with build, test, lint, and deploy stages",
            "defaultSelected": True,
        },
        "k8s-manifests": {
            "name": "Kubernetes Manifests",
            "description": "Deployment and Service YAML with health checks and resource limits",
            "defaultSelected": True,
        },
    }

    options = []
    for artifact_key in spec.get("artifacts", []):
        info = artifact_info.get(artifact_key, {
            "name": artifact_key,
            "description": artifact_key,
            "defaultSelected": True,
        })
        options.append({
            "key": artifact_key,
            **info,
        })

    return options


def _extract_service_name(service_request: str) -> str:
    """Extract a clean kebab-case service name from the developer's request."""
    text = service_request.strip()
    for prefix in ["create", "build", "generate", "make", "new"]:
        if text.lower().startswith(prefix):
            text = text[len(prefix):].strip()

    for suffix in ["microservice", "service", "api", "application", "app", "project"]:
        if text.lower().endswith(suffix):
            text = text[:len(text) - len(suffix)].strip()

    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text)
    text = text.strip("-")

    return text or "service"
