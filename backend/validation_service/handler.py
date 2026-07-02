"""Validation Service Lambda handler.

Endpoints:
    GET /requests/{id}/validation — Get governance validation results for a request
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.logger import get_logger
from shared.response import success, not_found, server_error, cors_preflight
from shared.db import get_validation_results

logger = get_logger("validation-service")


def handler(event, context):
    """Lambda entry point for the validation service."""
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")

    logger.info(f"Validation service: {http_method} {path}")

    if http_method == "OPTIONS":
        return cors_preflight()

    try:
        if http_method == "GET":
            # Extract request ID from path: /requests/{id}/validation
            path_params = event.get("pathParameters", {}) or {}
            request_id = path_params.get("id")
            if not request_id:
                return not_found("Missing request ID")
            return _get_validation(request_id)

        return not_found(f"Unknown route: {http_method} {path}")

    except Exception as e:
        logger.exception("Unhandled error in validation service")
        return server_error(str(e))


def _get_validation(request_id: str):
    """Return governance validation results for a request."""
    item = get_validation_results(request_id)
    if not item:
        return not_found(f"No validation results found for request {request_id}")

    results = item.get("results", [])
    passed = sum(1 for r in results if r["status"] == "PASS")
    total = len(results)

    return success({
        "requestId": request_id,
        "results": results,
        "summary": {
            "passed": passed,
            "failed": total - passed,
            "total": total,
            "allPassed": passed == total,
        },
    })
