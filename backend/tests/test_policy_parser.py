"""Tests for backend/policy_service/parser.py.

The parser is deterministic — converts a policy profile dict into a typed generation
spec with no external dependencies. All tests are pure unit tests.
"""

import pytest
from parser import (
    parse_policy_to_spec,
    _parse_language,
    _parse_framework,
    _parse_toggle_field,
    _parse_naming_pattern,
    _parse_list_field,
    _get_text_value,
)


# ── _parse_language ───────────────────────────────────────────────────────────

def test_language_python_with_version():
    assert _parse_language("Python 3.12") == {"language": "python", "version": "3.12"}


def test_language_python_no_version():
    result = _parse_language("Python")
    assert result["language"] == "python"


def test_language_python_lowercase():
    assert _parse_language("python 3.11") == {"language": "python", "version": "3.11"}


def test_language_java():
    assert _parse_language("Java 21") == {"language": "java", "version": "21"}


def test_language_nodejs_dotjs():
    result = _parse_language("Node.js 20")
    assert result["language"] == "nodejs"
    assert result["version"] == "20"


def test_language_go():
    assert _parse_language("Go 1.22") == {"language": "go", "version": "1.22"}


def test_language_typescript():
    result = _parse_language("TypeScript 5")
    assert result["language"] == "typescript"


def test_language_unknown_defaults_to_python():
    assert _parse_language("COBOL 85") == {"language": "python", "version": "3.12"}


def test_language_empty_defaults_to_python():
    assert _parse_language("") == {"language": "python", "version": "3.12"}


# ── _parse_framework ──────────────────────────────────────────────────────────

def test_framework_fastapi_exact():
    assert _parse_framework("fastapi") == "fastapi"


def test_framework_fast_api_with_space():
    assert _parse_framework("fast api") == "fastapi"


def test_framework_spring_boot_spaced():
    assert _parse_framework("spring boot") == "spring-boot"


def test_framework_springboot_no_space():
    assert _parse_framework("springboot") == "spring-boot"


def test_framework_express_dotjs():
    assert _parse_framework("express.js") == "express"


def test_framework_expressjs():
    assert _parse_framework("expressjs") == "express"


def test_framework_nestjs_dot():
    assert _parse_framework("nest.js") == "nestjs"


def test_framework_unknown_passthrough():
    assert _parse_framework("hono") == "hono"


def test_framework_preserves_case_normalization():
    assert _parse_framework("FastAPI") == "fastapi"


# ── _parse_toggle_field ───────────────────────────────────────────────────────

def test_toggle_true_bool():
    assert _parse_toggle_field({"value": True}) is True


def test_toggle_false_bool():
    assert _parse_toggle_field({"value": False}) is False


def test_toggle_string_true():
    assert _parse_toggle_field({"value": "true"}) is True


def test_toggle_string_false():
    assert _parse_toggle_field({"value": "false"}) is False


def test_toggle_string_enabled():
    assert _parse_toggle_field({"value": "enabled"}) is True


def test_toggle_string_yes():
    assert _parse_toggle_field({"value": "yes"}) is True


def test_toggle_missing_value_defaults_false():
    assert _parse_toggle_field({}) is False


def test_toggle_integer_one():
    assert _parse_toggle_field({"value": 1}) is True


def test_toggle_integer_zero():
    assert _parse_toggle_field({"value": 0}) is False


# ── _parse_naming_pattern ─────────────────────────────────────────────────────

def test_naming_pattern_valid():
    assert _parse_naming_pattern("{name}-api") == "{name}-api"


def test_naming_pattern_with_prefix():
    assert _parse_naming_pattern("svc-{name}") == "svc-{name}"


def test_naming_pattern_missing_placeholder():
    assert _parse_naming_pattern("my-service") == "{name}-api"


def test_naming_pattern_empty_string():
    assert _parse_naming_pattern("") == "{name}-api"


# ── _parse_list_field ─────────────────────────────────────────────────────────

def test_list_field_comma_separated():
    field = {"value": "requestId, userId, timestamp"}
    assert _parse_list_field(field) == ["requestId", "userId", "timestamp"]


def test_list_field_empty():
    assert _parse_list_field({"value": ""}) == []


def test_list_field_single_item():
    assert _parse_list_field({"value": "requestId"}) == ["requestId"]


def test_list_field_strips_whitespace():
    assert _parse_list_field({"value": "  a  ,  b  ,  c  "}) == ["a", "b", "c"]


# ── parse_policy_to_spec (integration) ───────────────────────────────────────

def _minimal_profile():
    """Minimal profile using the same structure as DEFAULT_POLICY_PROFILE."""
    return {
        "language":         {"value": "Python 3.12", "type": "text"},
        "framework":        {"value": "FastAPI",      "type": "text"},
        "namingConvention": {"value": "{name}-api",   "type": "text"},
        "auth":             {"value": True,            "type": "toggle"},
        "authType":         {"value": "JWT",           "type": "select"},
        "jwtExpiry":        {"value": "3600",          "type": "text"},
        "rbac":             {"value": True,            "type": "toggle"},
        "logging":          {"value": True,            "type": "toggle"},
        "logFormat":        {"value": "JSON",          "type": "select"},
        "logRequiredFields":{"value": "requestId",    "type": "text"},
        "logLevel":         {"value": "INFO",          "type": "select"},
        "monitoring":       {"value": True,            "type": "toggle"},
        "observabilityTool":{"value": "Prometheus",    "type": "select"},
        "healthEndpoint":   {"value": True,            "type": "toggle"},
        "auditLogging":     {"value": True,            "type": "toggle"},
        "dockerSupport":    {"value": True,            "type": "toggle"},
        "codeNamingClasses":{"value": "PascalCase",   "type": "select"},
        "codeNamingVariables":{"value": "snake_case", "type": "select"},
        "allowedLibraries": {"value": "",             "type": "text"},
        "forbiddenLibraries":{"value": "",            "type": "text"},
        "architecturePattern":{"value": "Controller → Service → Repository", "type": "select"},
        "apiResponseFormat":{"value": True,            "type": "toggle"},
    }


def test_spec_has_required_top_level_keys():
    spec = parse_policy_to_spec(_minimal_profile())
    assert "stack" in spec
    assert "artifacts" in spec
    assert "requirements" in spec


def test_spec_stack_python_fastapi():
    spec = parse_policy_to_spec(_minimal_profile())
    assert spec["stack"]["language"] == "python"
    assert spec["stack"]["framework"] == "fastapi"


def test_spec_artifacts_includes_source():
    spec = parse_policy_to_spec(_minimal_profile())
    assert "source" in spec["artifacts"]
    assert "api-skeleton" in spec["artifacts"]
    assert "readme" in spec["artifacts"]


def test_spec_dockerfile_in_artifacts_when_enabled():
    spec = parse_policy_to_spec(_minimal_profile())
    assert "dockerfile" in spec["artifacts"]


def test_spec_dockerfile_absent_when_disabled():
    profile = _minimal_profile()
    profile["dockerSupport"] = {"value": False, "type": "toggle"}
    spec = parse_policy_to_spec(profile)
    assert "dockerfile" not in spec["artifacts"]


def test_spec_auth_enabled():
    spec = parse_policy_to_spec(_minimal_profile())
    assert spec["requirements"]["auth"]["enabled"] is True
    assert spec["requirements"]["authType"] == "JWT"


def test_spec_jwt_expiry_parsed_as_int():
    spec = parse_policy_to_spec(_minimal_profile())
    assert isinstance(spec["requirements"]["jwtExpiry"], int)
    assert spec["requirements"]["jwtExpiry"] == 3600


def test_spec_jwt_expiry_invalid_defaults_to_3600():
    profile = _minimal_profile()
    profile["jwtExpiry"] = {"value": "not-a-number", "type": "text"}
    spec = parse_policy_to_spec(profile)
    assert spec["requirements"]["jwtExpiry"] == 3600


def test_spec_forbidden_libraries_as_list():
    profile = _minimal_profile()
    profile["forbiddenLibraries"] = {"value": "pickle5, eval, exec", "type": "text"}
    spec = parse_policy_to_spec(profile)
    assert "pickle5" in spec["requirements"]["forbiddenLibraries"]
    assert "eval" in spec["requirements"]["forbiddenLibraries"]


def test_spec_empty_profile_uses_defaults():
    spec = parse_policy_to_spec({})
    assert spec["stack"]["language"] == "python"
    assert spec["stack"]["framework"] == "fastapi"
    assert "source" in spec["artifacts"]
