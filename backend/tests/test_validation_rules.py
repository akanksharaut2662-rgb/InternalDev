"""Tests for backend/validation_service/rules.py.

All rule checkers are pure functions — no AWS calls, no LLM. Fast and deterministic.
"""

from helpers import make_spec
from rules import validate_generated_output


# ── Helpers ──────────────────────────────────────────────────────────────────

def find_rule(results, name):
    return next((r for r in results if r["rule"] == name), None)


def run(files, **req_overrides):
    return validate_generated_output(files, make_spec(**req_overrides))


FASTAPI_PY = "from fastapi import FastAPI\napp = FastAPI()\nimport jwt\ndef authenticate(token): bearer = token\nfrom prometheus_client import Counter\n@app.get('/health')\ndef health(): pass\nimport json\nlogging_config = {'formatters': {'json': {}}}\naudit_log = True\nstatus = 'success'\ndata = {}\nerror = None"

DOCKERFILE_MULTI = "FROM python:3.12-slim AS builder\nRUN pip install .\nFROM python:3.12-slim\nCOPY --from=builder /app ."

DOCKERFILE_SINGLE = "FROM python:3.12-slim\nRUN pip install .\nCMD ['python', 'main.py']"


# ── Language Match ────────────────────────────────────────────────────────────

def test_language_match_python_passes():
    result = find_rule(run({"main.py": "from fastapi import FastAPI"}), "Language Match")
    assert result["status"] == "PASS"
    assert result["severity"] == "mandatory"


def test_language_match_wrong_extension_fails():
    result = find_rule(run({"main.js": "const express = require('express')"}), "Language Match")
    assert result["status"] == "FAIL"


def test_language_match_typescript_passes():
    files = {"app.ts": "import express from 'express'", "routes.tsx": ""}
    result = find_rule(validate_generated_output(files, make_spec(**{"auth": {"enabled": False, "provider": "jwt"}, "structuredLogging": False, "monitoring": False, "auditLogging": False, "apiResponseFormat": False, "dockerSupport": False})), "Language Match")
    spec = make_spec()
    spec["stack"]["language"] = "typescript"
    result = find_rule(validate_generated_output(files, spec), "Language Match")
    assert result["status"] == "PASS"


def test_language_match_unknown_lang_always_passes():
    spec = make_spec()
    spec["stack"]["language"] = "cobol"
    result = find_rule(validate_generated_output({"main.py": ""}, spec), "Language Match")
    assert result["status"] == "PASS"


# ── Framework Detection ───────────────────────────────────────────────────────

def test_framework_fastapi_detected():
    result = find_rule(run({"main.py": "from fastapi import FastAPI\napp = FastAPI()"}), "Framework Present")
    assert result["status"] == "PASS"


def test_framework_flask_detected():
    spec = make_spec()
    spec["stack"]["framework"] = "flask"
    files = {"app.py": "from flask import Flask\napp = Flask(__name__)"}
    result = find_rule(validate_generated_output(files, spec), "Framework Present")
    assert result["status"] == "PASS"


def test_framework_not_found_fails():
    result = find_rule(run({"main.py": "def hello():\n    return 'world'"}), "Framework Present")
    assert result["status"] == "FAIL"


# ── Auth Scaffolding ──────────────────────────────────────────────────────────

def test_auth_passes_with_multiple_keywords():
    files = {"main.py": "import jwt\ndef authenticate(token): bearer = token\nmiddleware auth"}
    result = find_rule(run(files), "Auth Scaffolding")
    assert result["status"] == "PASS"
    assert result["severity"] == "mandatory"


def test_auth_fails_with_no_keywords():
    files = {"main.py": "def hello():\n    return 'world'"}
    result = find_rule(run(files), "Auth Scaffolding")
    assert result["status"] == "FAIL"


def test_auth_rule_absent_when_disabled():
    files = {"main.py": "def hello(): pass"}
    results = run(files, **{"auth": {"enabled": False, "provider": "jwt"}})
    assert find_rule(results, "Auth Scaffolding") is None


# ── Structured Logging ────────────────────────────────────────────────────────

def test_structured_logging_json_formatter_passes():
    files = {"main.py": "logging_config = {'formatters': {'json': {}}}"}
    result = find_rule(run(files), "Structured Logging")
    assert result["status"] == "PASS"


def test_structured_logging_winston_passes():
    spec = make_spec()
    spec["stack"]["language"] = "javascript"
    files = {"index.js": "const winston = require('winston')"}
    result = find_rule(validate_generated_output(files, spec), "Structured Logging")
    assert result["status"] == "PASS"


def test_structured_logging_fails_plain_code():
    files = {"main.py": "def hello():\n    print('no logging here')"}
    result = find_rule(run(files), "Structured Logging")
    assert result["status"] == "FAIL"


def test_structured_logging_absent_when_disabled():
    files = {"main.py": ""}
    results = run(files, **{"structuredLogging": False})
    assert find_rule(results, "Structured Logging") is None


# ── Health Endpoint ───────────────────────────────────────────────────────────

def test_health_endpoint_path_detected():
    files = {"main.py": "@app.get('/health')\ndef health(): return {'status': 'ok'}"}
    result = find_rule(run(files), "Health Endpoint")
    assert result["status"] == "PASS"
    assert result["severity"] == "warning"


def test_health_endpoint_missing_fails():
    files = {"main.py": "@app.get('/users')\ndef get_users(): pass"}
    result = find_rule(run(files), "Health Endpoint")
    assert result["status"] == "FAIL"


def test_health_endpoint_absent_when_disabled():
    files = {"main.py": ""}
    results = run(files, **{"healthEndpoint": {"enabled": False, "path": "/health"}})
    assert find_rule(results, "Health Endpoint") is None


# ── Monitoring ────────────────────────────────────────────────────────────────

def test_monitoring_prometheus_passes():
    files = {"main.py": "from prometheus_client import Counter, Gauge\ncounter = Counter('requests', 'Total requests')"}
    result = find_rule(run(files), "Monitoring & Metrics")
    assert result["status"] == "PASS"
    assert result["severity"] == "warning"


def test_monitoring_cloudwatch_passes():
    files = {"main.py": "import boto3\ncw = boto3.client('cloudwatch')\ncw.put_metric_data(Namespace='App', MetricData=[])"}
    result = find_rule(run(files, **{"observabilityTool": "CloudWatch"}), "Monitoring & Metrics")
    assert result["status"] == "PASS"


def test_monitoring_fails_with_no_setup():
    files = {"main.py": "def hello(): pass"}
    result = find_rule(run(files), "Monitoring & Metrics")
    assert result["status"] == "FAIL"


# ── Audit Logging ─────────────────────────────────────────────────────────────

def test_audit_logging_passes():
    files = {"main.py": "audit_log = []\ndef log_audit_trail(event): audit_log.append(event)"}
    result = find_rule(run(files), "Audit Logging")
    assert result["status"] == "PASS"
    assert result["severity"] == "warning"


def test_audit_logging_fails_no_audit_keywords():
    files = {"main.py": "def hello(): return 'world'"}
    result = find_rule(run(files), "Audit Logging")
    assert result["status"] == "FAIL"


# ── API Response Envelope ─────────────────────────────────────────────────────

def test_api_response_envelope_passes():
    files = {"main.py": "def response(data):\n    return {'status': 'success', 'data': data, 'error': None}"}
    result = find_rule(run(files), "API Response Envelope")
    assert result["status"] == "PASS"


def test_api_response_envelope_fails():
    files = {"main.py": "def handler(): return []"}
    result = find_rule(run(files), "API Response Envelope")
    assert result["status"] == "FAIL"


# ── Library Compliance ────────────────────────────────────────────────────────

def test_library_compliance_no_forbidden_passes():
    files = {"requirements.txt": "fastapi==0.110.0\npydantic==2.0.0"}
    result = find_rule(run(files), "Library Compliance")
    # Rule not run when forbiddenLibraries is empty — no result expected
    assert result is None


def test_library_compliance_detects_forbidden():
    files = {"requirements.txt": "fastapi==0.110.0\npickle5==0.0.11"}
    result = find_rule(run(files, **{"forbiddenLibraries": ["pickle5"]}), "Library Compliance")
    assert result["status"] == "FAIL"
    assert result["severity"] == "mandatory"


def test_library_compliance_passes_no_violation():
    files = {"requirements.txt": "fastapi==0.110.0\npydantic==2.0.0"}
    result = find_rule(run(files, **{"forbiddenLibraries": ["pickle5", "eval"]}), "Library Compliance")
    assert result["status"] == "PASS"


def test_library_compliance_no_dep_file_passes():
    files = {"main.py": "import pickle5"}
    result = find_rule(run(files, **{"forbiddenLibraries": ["pickle5"]}), "Library Compliance")
    assert result["status"] == "PASS"


# ── Dockerfile ────────────────────────────────────────────────────────────────

def test_dockerfile_multi_stage_passes():
    files = {"Dockerfile": DOCKERFILE_MULTI}
    result = find_rule(run(files), "Dockerfile")
    assert result["status"] == "PASS"
    assert result["severity"] == "info"


def test_dockerfile_single_stage_passes():
    files = {"Dockerfile": DOCKERFILE_SINGLE}
    result = find_rule(run(files), "Dockerfile")
    assert result["status"] == "PASS"


def test_dockerfile_missing_fails():
    files = {"main.py": "from fastapi import FastAPI"}
    result = find_rule(run(files), "Dockerfile")
    assert result["status"] == "FAIL"


# ── README ────────────────────────────────────────────────────────────────────

def test_readme_substantial_passes():
    content = " ".join(["word"] * 60)
    files = {"README.md": content}
    result = find_rule(run(files), "README")
    assert result["status"] == "PASS"


def test_readme_missing_fails():
    files = {"main.py": "from fastapi import FastAPI"}
    result = find_rule(run(files), "README")
    assert result["status"] == "FAIL"


# ── Full integration ──────────────────────────────────────────────────────────

def test_full_run_returns_expected_rule_names():
    files = {"main.py": FASTAPI_PY, "Dockerfile": DOCKERFILE_MULTI, "README.md": " ".join(["w"] * 60), ".github/workflows/ci.yml": "on:\n  push:\njobs:\n  test:"}
    results = validate_generated_output(files, make_spec())
    rule_names = {r["rule"] for r in results}
    assert "Language Match" in rule_names
    assert "Framework Present" in rule_names
    assert "Auth Scaffolding" in rule_names
    assert "Structured Logging" in rule_names
    assert "Health Endpoint" in rule_names
    assert "Monitoring & Metrics" in rule_names
    assert "Audit Logging" in rule_names


def test_all_results_have_required_fields():
    results = validate_generated_output({"main.py": FASTAPI_PY}, make_spec())
    for r in results:
        assert "rule" in r
        assert "status" in r
        assert "message" in r
        assert "severity" in r
        assert r["status"] in ("PASS", "FAIL")
        assert r["severity"] in ("mandatory", "warning", "info")
