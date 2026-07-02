"""Prompt builder for the code generation LLM call.

Constructs a system prompt (role, constraints, output format) and user prompt
(developer's service request) from the resolved generation spec.
"""


def build_system_prompt(spec: dict) -> str:
    """Build the system prompt from a generation spec."""
    stack = spec["stack"]
    reqs = spec["requirements"]
    artifacts = spec.get("selectedArtifacts", spec.get("artifacts", []))

    constraints = []

    # ── Stack ────────────────────────────────────────────────────────────────
    constraints.append(
        f"- Language: {stack['language']} {stack.get('version', '')}".strip()
    )
    constraints.append(f"- Framework: {stack['framework']}")

    # ── Architecture ─────────────────────────────────────────────────────────
    arch_pattern = reqs.get("architecturePattern", "")
    if arch_pattern and arch_pattern.lower() != "none":
        constraints.append(
            f"- Architecture: Follow the '{arch_pattern}' layering pattern. "
            "Separate concerns clearly — each layer has a single responsibility. "
            "Never mix business logic with HTTP handling or data access."
        )

    if reqs.get("apiResponseFormat", False):
        constraints.append(
            '- API Response Format: ALL endpoint responses MUST use this standard envelope: '
            '{"data": <payload or null>, "status": "success" | "error", "error": null | "<message>"}. '
            'Never return a raw object directly — always wrap in this structure.'
        )

    # ── Security ─────────────────────────────────────────────────────────────
    auth_type = reqs.get("authType", "JWT")
    jwt_expiry = reqs.get("jwtExpiry", 3600)
    rbac = reqs.get("rbac", False)

    if reqs["auth"]["enabled"]:
        rbac_clause = (
            " Include RBAC: define at least admin, user, and viewer roles; "
            "enforce role checks with a decorator or dependency on protected endpoints."
            if rbac else ""
        )
        constraints.append(
            f"- Authentication: REQUIRED using {auth_type}. "
            f"Token expiry: {jwt_expiry} seconds. "
            f"Include auth middleware/decorators, token validation, and protect all endpoints.{rbac_clause}"
        )
    else:
        constraints.append("- Authentication: NOT required. No auth middleware needed.")

    # ── Logging ──────────────────────────────────────────────────────────────
    if reqs["structuredLogging"]:
        log_format = reqs.get("logFormat", "JSON")
        log_fields = reqs.get("logRequiredFields", ["requestId", "userId", "serviceName", "timestamp"])
        log_level = reqs.get("logLevel", "INFO")
        constraints.append(
            f"- Logging: Use {log_format} structured logging. Minimum level: {log_level}. "
            f"Every log entry MUST include these fields: {', '.join(log_fields)}. "
            "Configure the logger at startup so all output follows this format."
        )

    # ── Naming ───────────────────────────────────────────────────────────────
    naming = reqs["namingPattern"]
    constraints.append(f"- Service Naming: Apply pattern '{naming}' for the service name (replace {{name}} with the derived name).")

    # ── Health endpoint ───────────────────────────────────────────────────────
    if reqs["healthEndpoint"]["enabled"]:
        path = reqs["healthEndpoint"]["path"]
        constraints.append(
            f"- Health Endpoint: REQUIRED at '{path}'. "
            f'Must return HTTP 200 with {{"status": "healthy", "service": "<name>", "timestamp": "<iso>"}}. '
            "Include readiness checks (e.g., DB connectivity)."
        )

    # ── Observability ─────────────────────────────────────────────────────────
    if reqs["monitoring"]:
        obs_tool = reqs.get("observabilityTool", "Prometheus")
        if obs_tool == "CloudWatch":
            constraints.append(
                "- Monitoring: Emit CloudWatch-style structured metric logs (EMF format). "
                "Track request count, latency (p50/p99), and error rate per endpoint."
            )
        elif obs_tool == "OpenTelemetry":
            constraints.append(
                "- Monitoring: Use OpenTelemetry SDK. Include OTEL exporter config, "
                "span tracing per request, and metric instruments for request count, latency, and errors."
            )
        else:
            constraints.append(
                "- Monitoring: Include Prometheus-compatible metrics via prometheus_client or equivalent. "
                "Expose a /metrics endpoint. Instrument request count (Counter), "
                "latency (Histogram), and error rate (Counter) per endpoint."
            )

    # ── Audit logging ─────────────────────────────────────────────────────────
    if reqs["auditLogging"]:
        constraints.append(
            "- Audit Logging: Log every API request and data mutation in a dedicated audit log. "
            "Each audit entry must include: caller identity (user/token), timestamp, HTTP method, "
            "path, request body (sanitised), status code, and response time. "
            "Use middleware so no endpoint can bypass audit logging."
        )

    # ── Docker ────────────────────────────────────────────────────────────────
    if reqs["dockerSupport"]:
        constraints.append(
            "- Docker: Generate a production-ready Dockerfile with multi-stage build "
            "(builder stage + minimal runtime stage). Include a docker-compose.yml for local development."
        )

    # ── Code Style ────────────────────────────────────────────────────────────
    code_naming = reqs.get("codeNaming", {})
    class_naming = code_naming.get("classes", "PascalCase")
    var_naming = code_naming.get("variables", "snake_case")
    constraints.append(
        f"- Code Style: Class names must use {class_naming}. "
        f"Variables and function names must use {var_naming}. "
        "Follow language idioms strictly — no mixed conventions."
    )

    forbidden_libs = reqs.get("forbiddenLibraries", [])
    allowed_libs = reqs.get("allowedLibraries", [])
    if forbidden_libs:
        constraints.append(
            f"- Forbidden Libraries: NEVER use these packages: {', '.join(forbidden_libs)}. "
            "Use alternatives from the standard library or approved packages."
        )
    if allowed_libs:
        constraints.append(
            f"- Approved Libraries: Only use packages from this allowlist (plus standard library): "
            f"{', '.join(allowed_libs)}. Do not introduce any other third-party dependencies."
        )

    # ── Artifact list ─────────────────────────────────────────────────────────
    artifact_descriptions = {
        "source": "Main application source code with all business logic",
        "api-skeleton": "API route definitions, request/response models, and endpoint handlers",
        "readme": "Comprehensive README.md with setup instructions, API documentation, and architecture overview",
        "dockerfile": "Production Dockerfile (multi-stage) and docker-compose.yml",
        "github-actions": "GitHub Actions CI/CD workflow (.github/workflows/ci.yml) with build, test, lint, and deploy stages",
        "k8s-manifests": "Kubernetes deployment.yaml and service.yaml with health checks, resource limits, and labels",
    }

    artifact_list = "\n".join(
        f"  - {a}: {artifact_descriptions.get(a, a)}"
        for a in artifacts
    )

    system_prompt = f"""You are a code generation engine for an Internal Developer Platform. Your job is to generate production-quality microservice code that strictly adheres to the following company engineering standards.

## Technology Stack & Constraints
{chr(10).join(constraints)}

## Artifacts to Generate
{artifact_list}

## Output Format
For each file you generate, use this exact format:

### FILE: <relative/path/to/file>
```
<file content>
```

Rules:
1. Every file MUST start with the ### FILE: marker followed by the relative path.
2. File content MUST be inside a fenced code block (triple backticks).
3. Generate ONLY the requested artifacts — nothing extra.
4. All code must be production-quality: proper error handling, type hints (if applicable), docstrings, and clean structure.
5. Do NOT include placeholder comments like "TODO" or "implement here" — generate complete, working code.
6. Include a requirements.txt (or equivalent dependency file) listing all packages used.
7. For the naming convention pattern, replace {{name}} with the service name derived from the user's request.
8. Ensure all generated code is consistent — imports match actual file paths, config references are correct.

IMPORTANT: Generate complete, working, production-ready code. Every file should be functional out of the box."""

    return system_prompt


def build_user_prompt(service_request: str, service_name: str) -> str:
    """Build the user prompt from the developer's service request."""
    return f"""Generate a complete microservice project for the following request:

Service Request: {service_request}
Service Name: {service_name}

Generate all requested artifacts as complete, production-ready files. The service should implement reasonable business logic based on the request description — include appropriate data models, API endpoints, error handling, and configuration.

Remember to follow ALL company engineering standards specified in the system prompt."""
