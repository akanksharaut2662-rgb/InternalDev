"""Policy Service Lambda handler.

Endpoints:
    GET  /policies          — Get current policy profile (or default if none saved)
    PUT  /policies          — Save/update the policy profile
    GET  /policies/defaults — Get the default template (for reset)
"""

import json
from datetime import datetime, timezone

import sys
import os

# Add shared module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.logger import get_logger
from shared.response import success, bad_request, not_found, server_error, cors_preflight
from shared.db import get_policy_profile, save_policy_profile
from defaults import DEFAULT_POLICY_PROFILE

logger = get_logger("policy-service")


def handler(event, context):
    """Lambda entry point for the policy service."""
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")
    resource = event.get("resource", "")

    logger.info(f"Policy service: {http_method} {path}")

    # CORS preflight
    if http_method == "OPTIONS":
        return cors_preflight()

    try:
        # GET /policies/defaults — return the default template
        if http_method == "GET" and (path.endswith("/defaults") or resource.endswith("/defaults")):
            return _get_defaults()

        # GET /policies — return current profile
        if http_method == "GET":
            return _get_profile()

        # PUT /policies — update profile
        if http_method == "PUT":
            return _update_profile(event)

        return not_found(f"Unknown route: {http_method} {path}")

    except Exception as e:
        logger.exception("Unhandled error in policy service")
        return server_error(str(e))


def _get_defaults():
    """Return the default policy profile template."""
    return success({"profile": DEFAULT_POLICY_PROFILE})


def _get_profile():
    """Get the active policy profile, falling back to defaults."""
    item = get_policy_profile()
    if item:
        # Remove DynamoDB key attributes before returning
        profile = {k: v for k, v in item.items() if k not in ("PK", "SK")}
        return success({"profile": profile.get("profile", DEFAULT_POLICY_PROFILE), "updatedAt": profile.get("updatedAt")})

    # No saved profile — return defaults
    return success({"profile": DEFAULT_POLICY_PROFILE, "updatedAt": None})


def _update_profile(event):
    """Save an updated policy profile."""
    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return bad_request("Invalid JSON body")

    profile = body.get("profile")
    if not profile:
        return bad_request("Missing 'profile' in request body")

    # Validate that all required fields are present
    required_fields = {"language", "framework", "auth", "logging",
                       "namingConvention", "healthEndpoint", "monitoring",
                       "auditLogging", "dockerSupport"}
    missing = required_fields - set(profile.keys())
    if missing:
        return bad_request(f"Missing required fields: {', '.join(missing)}")

    now = datetime.now(timezone.utc).isoformat()
    save_policy_profile({
        "profile": profile,
        "updatedAt": now,
    })

    logger.info("Policy profile updated successfully")
    return success({"profile": profile, "updatedAt": now})
