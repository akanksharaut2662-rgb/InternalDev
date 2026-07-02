"""Default Company Policy Profile template.

Each field has a plain-language label and description (so the UI reads as
"describe your standards in plain language") plus a structured value and type
used by the rule-based parser.

Types: "text" | "toggle" | "select"
  - select fields include a "choices" list
  - toggle fields may include an "options" dict of sub-fields

Sections: "stack" | "architecture" | "security" | "logging" |
          "observability" | "codestyle" | "compliance"
"""

DEFAULT_POLICY_PROFILE = {

    # ── Stack & Conventions ──────────────────────────────────────────────────
    "language": {
        "label": "Language & Runtime",
        "description": "Primary programming language and version for generated services (e.g., Python 3.12, Java 21, Node.js 20)",
        "value": "Python 3.12",
        "type": "text",
        "section": "stack",
    },
    "framework": {
        "label": "Web Framework",
        "description": "Application framework for HTTP/API handling (e.g., FastAPI, Spring Boot, Express)",
        "value": "FastAPI",
        "type": "text",
        "section": "stack",
    },
    "namingConvention": {
        "label": "Service Naming Pattern",
        "description": "Pattern for naming generated services. Use {name} as placeholder (e.g., {name}-api, svc-{name})",
        "value": "{name}-api",
        "type": "text",
        "section": "stack",
    },

    # ── Architecture Standards ───────────────────────────────────────────────
    "architecturePattern": {
        "label": "Layering Pattern",
        "description": "Enforce a structural layering pattern so every service looks identical internally",
        "value": "Controller → Service → Repository",
        "type": "select",
        "choices": ["Controller → Service → Repository", "MVC", "Hexagonal", "None"],
        "section": "architecture",
    },
    "apiResponseFormat": {
        "label": "Standard Response Envelope",
        "description": 'Wrap all API responses: {"data": {}, "status": "success", "error": null}',
        "value": True,
        "type": "toggle",
        "section": "architecture",
    },

    # ── Security Policy ──────────────────────────────────────────────────────
    "auth": {
        "label": "Authentication Required",
        "description": "Enforce authentication on all service endpoints",
        "value": True,
        "type": "toggle",
        "section": "security",
    },
    "authType": {
        "label": "Authentication Mechanism",
        "description": "Token standard or protocol to use for authentication",
        "value": "JWT",
        "type": "select",
        "choices": ["JWT", "OAuth2", "API Key", "Session"],
        "section": "security",
    },
    "jwtExpiry": {
        "label": "Token Expiry (seconds)",
        "description": "Access token lifetime in seconds (3600 = 1 hour, 86400 = 24 hours)",
        "value": "3600",
        "type": "text",
        "section": "security",
    },
    "rbac": {
        "label": "Role-Based Access Control (RBAC)",
        "description": "Enforce user role definitions and role checks on protected endpoints",
        "value": True,
        "type": "toggle",
        "section": "security",
    },

    # ── Logging Policy ───────────────────────────────────────────────────────
    "logging": {
        "label": "Structured Logging",
        "description": "Use structured logging for all service output, making logs machine-parseable",
        "value": True,
        "type": "toggle",
        "section": "logging",
    },
    "logFormat": {
        "label": "Log Format",
        "description": "Output format for all log entries",
        "value": "JSON",
        "type": "select",
        "choices": ["JSON", "Plain"],
        "section": "logging",
    },
    "logRequiredFields": {
        "label": "Required Log Fields",
        "description": "Comma-separated list of fields every log entry must contain",
        "value": "requestId, userId, serviceName, timestamp",
        "type": "text",
        "section": "logging",
    },
    "logLevel": {
        "label": "Minimum Log Level",
        "description": "Minimum severity level for log output in production",
        "value": "INFO",
        "type": "select",
        "choices": ["DEBUG", "INFO", "WARN", "ERROR"],
        "section": "logging",
    },

    # ── Observability ────────────────────────────────────────────────────────
    "monitoring": {
        "label": "Monitoring & Metrics",
        "description": "Include instrumentation for request counts, latency histograms, and error rates",
        "value": True,
        "type": "toggle",
        "section": "observability",
    },
    "observabilityTool": {
        "label": "Observability Stack",
        "description": "Metrics collection style to use in generated services",
        "value": "Prometheus",
        "type": "select",
        "choices": ["Prometheus", "CloudWatch", "OpenTelemetry"],
        "section": "observability",
    },
    "healthEndpoint": {
        "label": "Health Check Endpoint",
        "description": "Include a health check endpoint for liveness and readiness probes",
        "value": True,
        "type": "toggle",
        "section": "observability",
        "options": {
            "path": {
                "label": "Health Check Path",
                "description": "URL path for the health endpoint",
                "value": "/health",
                "type": "text",
            }
        },
    },

    # ── Code Style ───────────────────────────────────────────────────────────
    "codeNamingClasses": {
        "label": "Class Naming Convention",
        "description": "Naming style for class and type definitions",
        "value": "PascalCase",
        "type": "select",
        "choices": ["PascalCase", "camelCase"],
        "section": "codestyle",
    },
    "codeNamingVariables": {
        "label": "Variable & Function Naming",
        "description": "Naming style for variables, functions, and method names",
        "value": "snake_case",
        "type": "select",
        "choices": ["snake_case", "camelCase"],
        "section": "codestyle",
    },
    "allowedLibraries": {
        "label": "Allowed Libraries (allowlist)",
        "description": "Comma-separated list of approved packages. Leave blank to allow all.",
        "value": "",
        "type": "text",
        "section": "codestyle",
    },
    "forbiddenLibraries": {
        "label": "Forbidden Libraries (blocklist)",
        "description": "Comma-separated list of prohibited packages that must not appear in dependencies",
        "value": "",
        "type": "text",
        "section": "codestyle",
    },

    # ── Compliance & Deployment ──────────────────────────────────────────────
    "auditLogging": {
        "label": "Audit Logging",
        "description": "Log all API requests and data mutations with caller identity, timestamp, and action for compliance audit trail",
        "value": True,
        "type": "toggle",
        "section": "compliance",
    },
    "dockerSupport": {
        "label": "Docker Support",
        "description": "Generate Dockerfile and docker-compose.yml for containerised deployment with multi-stage builds",
        "value": True,
        "type": "toggle",
        "section": "compliance",
    },
}
