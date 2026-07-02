"""Download Service Lambda handler.

Endpoints:
    GET /requests/{id}/download — Generate and return a pre-signed S3 URL for the ZIP artifact
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.logger import get_logger
from shared.response import success, not_found, bad_request, server_error, cors_preflight
from shared.db import get_request
from shared.s3_helper import get_presigned_url, check_object_exists

logger = get_logger("download-service")


def handler(event, context):
    """Lambda entry point for the download service."""
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")

    logger.info(f"Download service: {http_method} {path}")

    if http_method == "OPTIONS":
        return cors_preflight()

    try:
        if http_method == "GET":
            path_params = event.get("pathParameters", {}) or {}
            request_id = path_params.get("id")
            if not request_id:
                return not_found("Missing request ID")
            return _get_download_url(request_id)

        return not_found(f"Unknown route: {http_method} {path}")

    except Exception as e:
        logger.exception("Unhandled error in download service")
        return server_error(str(e))


def _get_download_url(request_id: str):
    """Generate a pre-signed S3 URL for the request's ZIP artifact."""
    item = get_request(request_id)
    if not item:
        return not_found(f"Request {request_id} not found")

    status = item.get("status")
    if status != "COMPLETED":
        return bad_request(f"Request is not completed (current status: {status})")

    s3_key = item.get("s3Key")
    if not s3_key:
        return not_found(f"No artifact found for request {request_id}")

    # Generate pre-signed URL (15 minute expiry)
    download_url = get_presigned_url(s3_key, expires_in=900)

    resolved_name = item.get("resolvedName", "generated-service")
    filename = f"{resolved_name}.zip"

    logger.info(f"Generated download URL for request {request_id}: {s3_key}")

    return success({
        "requestId": request_id,
        "downloadUrl": download_url,
        "filename": filename,
        "s3Key": s3_key,
    })
