def make_spec(**requirement_overrides):
    """Return a minimal but complete generation spec for testing validators."""
    spec = {
        "stack": {"language": "python", "framework": "fastapi", "version": "3.12"},
        "artifacts": ["source", "api-skeleton", "readme", "dockerfile", "github-actions", "k8s-manifests"],
        "requirements": {
            "namingPattern": "{name}-api",
            "architecturePattern": "Controller → Service → Repository",
            "apiResponseFormat": True,
            "auth": {"enabled": True, "provider": "jwt"},
            "authType": "JWT",
            "jwtExpiry": 3600,
            "rbac": True,
            "structuredLogging": True,
            "logFormat": "JSON",
            "logRequiredFields": ["requestId", "userId"],
            "logLevel": "INFO",
            "monitoring": True,
            "observabilityTool": "Prometheus",
            "healthEndpoint": {"enabled": True, "path": "/health"},
            "codeNaming": {"classes": "PascalCase", "variables": "snake_case"},
            "allowedLibraries": [],
            "forbiddenLibraries": [],
            "auditLogging": True,
            "dockerSupport": True,
        },
    }
    spec["requirements"].update(requirement_overrides)
    return spec
