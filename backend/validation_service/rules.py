"""Governance validation rules.

Each rule checks whether the LLM-generated output honours a specific constraint
from the resolved generation spec. All checks are deterministic string/pattern
matching — no LLM involved.

Each result includes:
  rule     - human-readable rule name
  status   - "PASS" | "FAIL"
  message  - explanation of what was found / what was missing
  severity - "mandatory" | "warning" | "info"
    mandatory : must pass for full compliance (auth, logging, language)
    warning   : important but non-blocking (monitoring, naming, audit)
    info      : nice-to-have / advisory (k8s, CI, README)
"""

import re
from typing import Any


def validate_generated_output(
    files: dict[str, str],
    spec: dict[str, Any],
) -> list[dict[str, str]]:
    """Run all governance validation rules against generated files.

    Args:
        files: Dict mapping relative file paths to file content.
        spec: The generation spec that was sent to the LLM.

    Returns:
        List of rule results, each with rule, status, message, severity.
    """
    results = []
    stack = spec["stack"]
    reqs = spec["requirements"]

    # 1. Language match (mandatory)
    results.append(_check_language(files, stack))

    # 2. Framework present (mandatory)
    results.append(_check_framework(files, stack))

    # 3. Auth scaffolding (mandatory when auth enabled)
    if reqs["auth"]["enabled"]:
        results.append(_check_auth(files, reqs.get("authType", "JWT")))

    # 4. Structured logging (mandatory when enabled)
    if reqs["structuredLogging"]:
        results.append(_check_structured_logging(files, stack, reqs.get("logFormat", "JSON")))

    # 5. Naming convention (warning)
    results.append(_check_naming(files, reqs["namingPattern"]))

    # 6. Health endpoint (warning when enabled)
    if reqs["healthEndpoint"]["enabled"]:
        results.append(_check_health_endpoint(files, reqs["healthEndpoint"]))

    # 7. Monitoring (warning when enabled)
    if reqs["monitoring"]:
        results.append(_check_monitoring(files, reqs.get("observabilityTool", "Prometheus")))

    # 8. Audit logging (warning when enabled)
    if reqs["auditLogging"]:
        results.append(_check_audit_logging(files))

    # 9. API response format (warning when enabled)
    if reqs.get("apiResponseFormat", False):
        results.append(_check_api_response_format(files))

    # 10. Library compliance (mandatory when forbidden libs defined)
    forbidden = reqs.get("forbiddenLibraries", [])
    if forbidden:
        results.append(_check_library_compliance(files, forbidden))

    # 11. Dockerfile (info)
    if reqs["dockerSupport"]:
        results.append(_check_dockerfile(files))

    # 12. Kubernetes manifests (info)
    selected = spec.get("selectedArtifacts", spec.get("artifacts", []))
    if "k8s-manifests" in selected:
        results.append(_check_k8s_manifests(files))

    # 13. GitHub Actions (info)
    if "github-actions" in selected:
        results.append(_check_github_actions(files))

    # 14. README (info)
    if "readme" in selected:
        results.append(_check_readme(files))

    return results


def _pass(rule: str, message: str, severity: str = "mandatory") -> dict:
    return {"rule": rule, "status": "PASS", "message": message, "severity": severity}


def _fail(rule: str, message: str, severity: str = "mandatory") -> dict:
    return {"rule": rule, "status": "FAIL", "message": message, "severity": severity}


# ---------------------------------------------------------------------------
# Rule checkers
# ---------------------------------------------------------------------------

def _check_language(files: dict[str, str], stack: dict) -> dict:
    """Check that source files use the correct language extension."""
    lang = stack["language"]
    ext_map = {
        "python": [".py"],
        "java": [".java"],
        "javascript": [".js"],
        "typescript": [".ts", ".tsx"],
        "go": [".go"],
        "rust": [".rs"],
        "ruby": [".rb"],
        "nodejs": [".js", ".ts"],
    }
    expected_exts = ext_map.get(lang, [])
    if not expected_exts:
        return _pass("Language Match", f"Language '{lang}' accepted (no extension check available)", "mandatory")

    found = any(
        any(fp.endswith(ext) for ext in expected_exts)
        for fp in files.keys()
        if not fp.endswith((".yml", ".yaml", ".md", ".txt", ".json", ".toml", ".cfg", ".ini", ".sh"))
        and "Dockerfile" not in fp
    )

    if found:
        return _pass("Language Match", f"Source files use {lang} extensions ({', '.join(expected_exts)})", "mandatory")
    return _fail("Language Match", f"No source files found with expected extensions: {', '.join(expected_exts)}", "mandatory")


def _check_framework(files: dict[str, str], stack: dict) -> dict:
    """Check that the specified framework is imported/required in source files."""
    framework = stack["framework"]
    framework_patterns = {
        "fastapi": [r"from\s+fastapi", r"import\s+fastapi", r"FastAPI\(\)"],
        "flask": [r"from\s+flask", r"import\s+flask", r"Flask\(__name__\)"],
        "django": [r"django", r"DJANGO_SETTINGS_MODULE"],
        "express": [r"require\(['\"]express['\"]\)", r"from\s+['\"]express['\"]"],
        "spring-boot": [r"@SpringBootApplication", r"SpringApplication\.run"],
        "gin": [r"github\.com/gin-gonic/gin"],
        "actix": [r"actix_web", r"actix-web"],
        "rails": [r"Rails\.application"],
        "nestjs": [r"@nestjs", r"@Module"],
        "koa": [r"require\(['\"]koa['\"]\)", r"from\s+['\"]koa['\"]"],
    }

    patterns = framework_patterns.get(framework, [framework])
    all_content = "\n".join(files.values())

    for pattern in patterns:
        if re.search(pattern, all_content, re.IGNORECASE):
            return _pass("Framework Present", f"Framework '{framework}' detected in source code", "mandatory")

    return _fail("Framework Present", f"Framework '{framework}' not found in any source file", "mandatory")


def _check_auth(files: dict[str, str], auth_type: str = "JWT") -> dict:
    """Check for authentication middleware/decorator presence."""
    all_content = "\n".join(files.values()).lower()

    auth_indicators = [
        "auth", "authentication", "authorize", "authorization",
        "token", "jwt", "bearer", "oauth", "middleware",
        "security", "credentials", "login", "session", "api_key", "apikey",
    ]

    found = sum(1 for indicator in auth_indicators if indicator in all_content)
    if found >= 2:
        return _pass("Auth Scaffolding", f"Authentication scaffolding detected ({auth_type})", "mandatory")
    return _fail(
        "Auth Scaffolding",
        f"Insufficient authentication scaffolding for {auth_type} — "
        "expected auth middleware, token validation, and protected endpoints.",
        "mandatory",
    )


def _check_structured_logging(files: dict[str, str], stack: dict, log_format: str = "JSON") -> dict:
    """Check for structured logging configuration."""
    all_content = "\n".join(files.values()).lower()

    logging_indicators = {
        "python": ["structlog", "json_formatter", "jsonformatter", "logging.config", "json_logging", "pythonjsonlogger", "dictconfig"],
        "javascript": ["winston", "pino", "bunyan", "json.*log"],
        "nodejs": ["winston", "pino", "bunyan", "json.*log"],
        "java": ["logback", "log4j", "json.*layout", "slf4j"],
    }

    lang = stack.get("language", "python")
    indicators = logging_indicators.get(lang, ["json", "log", "structured"])
    generic = ["json", "structured.*log", "log.*format.*json", "formatters"]

    found = any(re.search(p, all_content) for p in indicators + generic)
    if found:
        return _pass("Structured Logging", f"Structured {log_format} logging configuration detected", "mandatory")
    return _fail(
        "Structured Logging",
        f"No structured {log_format} logging configuration found — expected JSON formatter setup at service startup.",
        "mandatory",
    )


def _check_naming(files: dict[str, str], pattern: str) -> dict:
    """Check that the naming convention pattern was applied."""
    all_content = "\n".join(files.values()).lower()

    fixed_parts = pattern.replace("{name}", "").split("-")
    fixed_parts = [p.strip() for p in fixed_parts if p.strip()]

    if not fixed_parts:
        return _pass("Naming Convention", "Naming pattern applied (pattern has no fixed parts to verify)", "warning")

    found = all(part.lower() in all_content for part in fixed_parts)
    if found:
        return _pass("Naming Convention", f"Service name follows pattern '{pattern}'", "warning")
    return _fail(
        "Naming Convention",
        f"Service name does not follow pattern '{pattern}' — expected fixed parts: {fixed_parts}",
        "warning",
    )


def _check_health_endpoint(files: dict[str, str], health_config: dict) -> dict:
    """Check for health check endpoint definition."""
    path = health_config.get("path", "/health")
    all_content = "\n".join(files.values())

    health_patterns = [re.escape(path), r"health", r"healthz", r"readiness", r"liveness"]
    found = any(re.search(p, all_content, re.IGNORECASE) for p in health_patterns)

    if found:
        return _pass("Health Endpoint", f"Health check endpoint found (path: {path})", "warning")
    return _fail("Health Endpoint", f"No health check endpoint found — expected route at '{path}'", "warning")


def _check_monitoring(files: dict[str, str], obs_tool: str = "Prometheus") -> dict:
    """Check for metrics/monitoring setup."""
    all_content = "\n".join(files.values()).lower()

    if obs_tool == "CloudWatch":
        indicators = ["cloudwatch", "emf", "put_metric_data", "aws_embedded_metrics", "metric_scope"]
    elif obs_tool == "OpenTelemetry":
        indicators = ["opentelemetry", "otel", "tracer", "meter", "otlp"]
    else:
        indicators = [
            "prometheus", "metrics", "/metrics", "histogram",
            "counter", "gauge", "instrumentator", "starlette_exporter",
            "prometheus_client", "prom-client", "micrometer",
        ]

    found = sum(1 for ind in indicators if ind in all_content)
    if found >= 2:
        return _pass("Monitoring & Metrics", f"{obs_tool}-compatible metrics setup detected", "warning")
    return _fail(
        "Monitoring & Metrics",
        f"Insufficient {obs_tool} monitoring setup — expected client library, metric instruments, and /metrics endpoint.",
        "warning",
    )


def _check_audit_logging(files: dict[str, str]) -> dict:
    """Check for audit logging middleware/decorator."""
    all_content = "\n".join(files.values()).lower()

    audit_indicators = ["audit", "audit_log", "audit_trail", "auditlog", "request.*log", "access.*log", "mutation.*log"]
    found = any(re.search(ind, all_content) for ind in audit_indicators)

    if found:
        return _pass("Audit Logging", "Audit logging capability detected", "warning")
    return _fail(
        "Audit Logging",
        "No audit logging found — expected request/mutation audit trail middleware covering all endpoints.",
        "warning",
    )


def _check_api_response_format(files: dict[str, str]) -> dict:
    """Check that the standard response envelope is used."""
    all_content = "\n".join(files.values())

    envelope_patterns = [
        r'"status"\s*:',
        r"'status'\s*:",
        r'"data"\s*:',
        r"'data'\s*:",
        r'"error"\s*:',
        r"status.*success|success.*status",
    ]

    found = sum(1 for p in envelope_patterns if re.search(p, all_content, re.IGNORECASE))
    if found >= 3:
        return _pass(
            "API Response Envelope",
            'Standard response envelope detected ({"data": …, "status": …, "error": …})',
            "warning",
        )
    return _fail(
        "API Response Envelope",
        'Standard response envelope not found — expected {"data": {}, "status": "success", "error": null} on all responses.',
        "warning",
    )


def _check_library_compliance(files: dict[str, str], forbidden_libraries: list[str]) -> dict:
    """Check requirements.txt against the forbidden library list."""
    req_keys = [k for k in files.keys() if "requirements" in k.lower() and k.endswith(".txt")]
    pkg_files = [k for k in files.keys() if k in ("package.json", "go.mod", "Cargo.toml", "pom.xml", "build.gradle")]

    dependency_content = ""
    for key in req_keys + pkg_files:
        dependency_content += files[key].lower() + "\n"

    if not dependency_content.strip():
        return _pass("Library Compliance", "No dependency file found to check (allowlist not enforced)", "mandatory")

    violations = [lib for lib in forbidden_libraries if lib in dependency_content]
    if violations:
        return _fail(
            "Library Compliance",
            f"Forbidden libraries detected in dependencies: {', '.join(violations)}",
            "mandatory",
        )
    return _pass(
        "Library Compliance",
        f"No forbidden libraries found in dependencies (checked: {', '.join(forbidden_libraries)})",
        "mandatory",
    )


def _check_dockerfile(files: dict[str, str]) -> dict:
    """Check for Dockerfile presence and quality."""
    dockerfile_keys = [k for k in files.keys() if "dockerfile" in k.lower()]

    if not dockerfile_keys:
        return _fail("Dockerfile", "No Dockerfile found in generated output", "info")

    dockerfile_content = files[dockerfile_keys[0]]
    from_count = len(re.findall(r"^FROM\s+", dockerfile_content, re.MULTILINE | re.IGNORECASE))

    if from_count >= 2:
        return _pass("Dockerfile", f"Dockerfile found with multi-stage build ({from_count} stages)", "info")
    elif from_count == 1:
        return _pass("Dockerfile", "Dockerfile found (single stage — consider multi-stage for production)", "info")
    return _fail("Dockerfile", "Dockerfile found but appears invalid (no FROM instruction)", "info")


def _check_k8s_manifests(files: dict[str, str]) -> dict:
    """Check for Kubernetes deployment and service manifests."""
    all_keys = " ".join(files.keys()).lower()
    all_content = "\n".join(files.values()).lower()

    has_deployment = "deployment" in all_keys or "kind: deployment" in all_content
    has_service = ("service.y" in all_keys) or ("kind: service" in all_content)

    if has_deployment and has_service:
        return _pass("K8s Manifests", "Kubernetes Deployment and Service manifests found", "info")
    missing = []
    if not has_deployment:
        missing.append("Deployment")
    if not has_service:
        missing.append("Service")
    return _fail("K8s Manifests", f"Missing Kubernetes manifests: {', '.join(missing)}", "info")


def _check_github_actions(files: dict[str, str]) -> dict:
    """Check for GitHub Actions workflow file."""
    workflow_keys = [
        k for k in files.keys()
        if ".github" in k.lower() and (".yml" in k.lower() or ".yaml" in k.lower())
    ]
    all_content = "\n".join(files.values())
    has_workflow_content = "on:" in all_content and "jobs:" in all_content

    if workflow_keys:
        return _pass("GitHub Actions", f"GitHub Actions workflow found: {', '.join(workflow_keys)}", "info")
    if has_workflow_content:
        return _pass("GitHub Actions", "GitHub Actions workflow content detected (path may differ)", "info")
    return _fail("GitHub Actions", "No GitHub Actions workflow file found — expected .github/workflows/*.yml", "info")


def _check_readme(files: dict[str, str]) -> dict:
    """Check for README.md presence and substance."""
    readme_keys = [k for k in files.keys() if "readme" in k.lower()]

    if readme_keys:
        content = files[readme_keys[0]]
        word_count = len(content.split())
        if word_count >= 50:
            return _pass("README", f"README.md found ({word_count} words)", "info")
        return _pass("README", f"README.md found but brief ({word_count} words — consider expanding)", "info")
    return _fail("README", "No README.md found in generated output", "info")
