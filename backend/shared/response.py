"""HTTP response builders with CORS headers for API Gateway Lambda proxy integration."""

import json
from typing import Any


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Content-Type": "application/json",
}


def _build_response(status_code: int, body: Any) -> dict:
    """Build an API Gateway proxy integration response."""
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=str),
    }


def success(body: Any) -> dict:
    """200 OK response."""
    return _build_response(200, body)


def created(body: Any) -> dict:
    """201 Created response."""
    return _build_response(201, body)


def bad_request(message: str) -> dict:
    """400 Bad Request response."""
    return _build_response(400, {"error": "Bad Request", "message": message})


def not_found(message: str = "Resource not found") -> dict:
    """404 Not Found response."""
    return _build_response(404, {"error": "Not Found", "message": message})


def server_error(message: str = "Internal server error") -> dict:
    """500 Internal Server Error response."""
    return _build_response(500, {"error": "Internal Server Error", "message": message})


def cors_preflight() -> dict:
    """200 response for OPTIONS preflight requests."""
    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": "",
    }
