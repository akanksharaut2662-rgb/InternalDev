"""Rule-based parser: converts a Company Policy Profile into a structured Generation Spec.

This is deterministic — no LLM involved. The parser reads each field's value
from the active policy profile and produces a structured spec consumed by the
generation orchestrator.

Handles common input variations (e.g., 'Python 3.12', 'python3.12', 'Python3.12').
Falls back to defaults on unparseable input.
"""

import re
from typing import Any


def _parse_language(raw: str) -> dict[str, str]:
    """Parse language & version from free-text input.

    Supports formats:
        'Python 3.12', 'python3.12', 'Python 3.12', 'Java 21', 'node.js 20'
    """
    raw = raw.strip().lower()

    match = re.match(
        r"(python|java|node\.?js|go|rust|ruby|typescript|javascript)"
        r"\s*(\d+(?:\.\d+)*)?",
        raw,
    )
    if match:
        lang = match.group(1).replace(".", "")
        version = match.group(2) or ""
        lang_map = {
            "python": "python",
            "java": "java",
            "nodejs": "nodejs",
            "node": "nodejs",
            "go": "go",
            "rust": "rust",
            "ruby": "ruby",
            "typescript": "typescript",
            "javascript": "javascript",
        }
        return {"language": lang_map.get(lang, lang), "version": version}

    return {"language": "python", "version": "3.12"}


def _parse_framework(raw: str) -> str:
    """Parse framework name, normalizing common variations."""
    raw = raw.strip().lower()
    framework_map = {
        "fastapi": "fastapi",
        "fast api": "fastapi",
        "flask": "flask",
        "django": "django",
        "express": "express",
        "expressjs": "express",
        "express.js": "express",
        "spring": "spring-boot",
        "spring boot": "spring-boot",
        "springboot": "spring-boot",
        "gin": "gin",
        "fiber": "fiber",
        "actix": "actix",
        "rails": "rails",
        "ruby on rails": "rails",
        "nestjs": "nestjs",
        "nest.js": "nestjs",
        "nest": "nestjs",
        "koa": "koa",
        "hapi": "hapi",
    }
    return framework_map.get(raw, raw)


def _parse_naming_pattern(raw: str) -> str:
    """Validate and normalize naming pattern. Must contain {name}."""
    raw = raw.strip()
    if "{name}" not in raw:
        return "{name}-api"
    return raw


def _parse_toggle_field(field: dict[str, Any]) -> bool:
    """Extract boolean value from a toggle field."""
    val = field.get("value", False)
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("true", "yes", "on", "1", "enabled")
    return bool(val)


def _get_text_value(field: Any, default: str) -> str:
    """Safely extract string value from a field dict or raw value."""
    if isinstance(field, dict):
        return str(field.get("value", default))
    return str(field) if field else default


def _parse_list_field(field: Any, default: str = "") -> list[str]:
    """Parse a comma-separated text field into a list of stripped strings."""
    raw = _get_text_value(field, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def parse_policy_to_spec(profile: dict[str, Any]) -> dict[str, Any]:
    """Convert a Company Policy Profile into a structured Generation Spec.

    Args:
        profile: The policy profile dict (field_key -> field_data).

    Returns:
        Generation spec dict consumed by the orchestrator/prompt builder.
    """
    # ── Stack ────────────────────────────────────────────────────────────────
    lang_raw = _get_text_value(profile.get("language", {}), "Python 3.12")
    stack = _parse_language(lang_raw)
    stack["framework"] = _parse_framework(_get_text_value(profile.get("framework", {}), "FastAPI"))

    naming_raw = _get_text_value(profile.get("namingConvention", {}), "{name}-api")
    naming_pattern = _parse_naming_pattern(naming_raw)

    # ── Architecture ─────────────────────────────────────────────────────────
    arch_pattern = _get_text_value(
        profile.get("architecturePattern", {}),
        "Controller → Service → Repository",
    )

    api_format_field = profile.get("apiResponseFormat", {})
    api_response_format = (
        _parse_toggle_field(api_format_field) if isinstance(api_format_field, dict) else True
    )

    # ── Security ─────────────────────────────────────────────────────────────
    auth_field = profile.get("auth", {})
    auth_enabled = _parse_toggle_field(auth_field) if isinstance(auth_field, dict) else True

    auth_type = _get_text_value(profile.get("authType", {}), "JWT")

    jwt_expiry_raw = _get_text_value(profile.get("jwtExpiry", {}), "3600")
    try:
        jwt_expiry = int(jwt_expiry_raw)
    except (ValueError, TypeError):
        jwt_expiry = 3600

    rbac_field = profile.get("rbac", {})
    rbac_enabled = _parse_toggle_field(rbac_field) if isinstance(rbac_field, dict) else True

    # ── Logging ──────────────────────────────────────────────────────────────
    logging_field = profile.get("logging", {})
    logging_enabled = _parse_toggle_field(logging_field) if isinstance(logging_field, dict) else True

    log_format = _get_text_value(profile.get("logFormat", {}), "JSON")

    log_required_fields = _parse_list_field(
        profile.get("logRequiredFields", {}),
        "requestId, userId, serviceName, timestamp",
    )

    log_level = _get_text_value(profile.get("logLevel", {}), "INFO")

    # ── Observability ────────────────────────────────────────────────────────
    monitoring_field = profile.get("monitoring", {})
    monitoring_enabled = _parse_toggle_field(monitoring_field) if isinstance(monitoring_field, dict) else True

    observability_tool = _get_text_value(profile.get("observabilityTool", {}), "Prometheus")

    health_field = profile.get("healthEndpoint", {})
    health_enabled = _parse_toggle_field(health_field) if isinstance(health_field, dict) else True
    health_path = "/health"
    if health_enabled and isinstance(health_field.get("options"), dict):
        path_field = health_field["options"].get("path", {})
        health_path = path_field.get("value", "/health") if isinstance(path_field, dict) else "/health"

    # ── Code Style ───────────────────────────────────────────────────────────
    class_naming = _get_text_value(profile.get("codeNamingClasses", {}), "PascalCase")
    var_naming = _get_text_value(profile.get("codeNamingVariables", {}), "snake_case")

    allowed_libraries = [
        lib.strip().lower()
        for lib in _parse_list_field(profile.get("allowedLibraries", {}), "")
    ]
    forbidden_libraries = [
        lib.strip().lower()
        for lib in _parse_list_field(profile.get("forbiddenLibraries", {}), "")
    ]

    # ── Compliance ───────────────────────────────────────────────────────────
    audit_field = profile.get("auditLogging", {})
    audit_enabled = _parse_toggle_field(audit_field) if isinstance(audit_field, dict) else True

    docker_field = profile.get("dockerSupport", {})
    docker_enabled = _parse_toggle_field(docker_field) if isinstance(docker_field, dict) else True

    # ── Artifacts ────────────────────────────────────────────────────────────
    artifacts = ["source", "api-skeleton", "readme"]
    if docker_enabled:
        artifacts.append("dockerfile")
    artifacts.append("github-actions")
    artifacts.append("k8s-manifests")

    return {
        "stack": stack,
        "artifacts": artifacts,
        "requirements": {
            # Stack
            "namingPattern": naming_pattern,
            # Architecture
            "architecturePattern": arch_pattern,
            "apiResponseFormat": api_response_format,
            # Security
            "auth": {
                "enabled": auth_enabled,
                "provider": auth_type.lower(),  # backward-compat alias
            },
            "authType": auth_type,
            "jwtExpiry": jwt_expiry,
            "rbac": rbac_enabled,
            # Logging
            "structuredLogging": logging_enabled,
            "logFormat": log_format,
            "logRequiredFields": log_required_fields,
            "logLevel": log_level,
            # Observability
            "monitoring": monitoring_enabled,
            "observabilityTool": observability_tool,
            "healthEndpoint": {
                "enabled": health_enabled,
                "path": health_path,
            },
            # Code style
            "codeNaming": {
                "classes": class_naming,
                "variables": var_naming,
            },
            "allowedLibraries": allowed_libraries,
            "forbiddenLibraries": forbidden_libraries,
            # Compliance
            "auditLogging": audit_enabled,
            "dockerSupport": docker_enabled,
        },
    }
