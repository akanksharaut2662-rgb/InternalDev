# ─── HTTP API ─────────────────────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "main" {
  name          = "idp-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}

# ─── Integrations (one per Lambda) ────────────────────────────────────────────

resource "aws_apigatewayv2_integration" "policy" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.policy_service.invoke_arn
  payload_format_version = "1.0"
}

resource "aws_apigatewayv2_integration" "status" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.status_service.invoke_arn
  payload_format_version = "1.0"
}

resource "aws_apigatewayv2_integration" "validation" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.validation_service.invoke_arn
  payload_format_version = "1.0"
}

resource "aws_apigatewayv2_integration" "download" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.download_service.invoke_arn
  payload_format_version = "1.0"
}

# ─── Routes ───────────────────────────────────────────────────────────────────

# Policy routes
resource "aws_apigatewayv2_route" "get_policy" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /policies"
  target    = "integrations/${aws_apigatewayv2_integration.policy.id}"
}

resource "aws_apigatewayv2_route" "put_policy" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /policies"
  target    = "integrations/${aws_apigatewayv2_integration.policy.id}"
}

resource "aws_apigatewayv2_route" "get_policy_defaults" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /policies/defaults"
  target    = "integrations/${aws_apigatewayv2_integration.policy.id}"
}

# Request / status routes
resource "aws_apigatewayv2_route" "post_requests" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /requests"
  target    = "integrations/${aws_apigatewayv2_integration.status.id}"
}

resource "aws_apigatewayv2_route" "get_requests" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /requests"
  target    = "integrations/${aws_apigatewayv2_integration.status.id}"
}

resource "aws_apigatewayv2_route" "get_request_by_id" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /requests/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.status.id}"
}

resource "aws_apigatewayv2_route" "get_request_status" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /requests/{id}/status"
  target    = "integrations/${aws_apigatewayv2_integration.status.id}"
}

resource "aws_apigatewayv2_route" "get_request_plan" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /requests/{id}/plan"
  target    = "integrations/${aws_apigatewayv2_integration.status.id}"
}

resource "aws_apigatewayv2_route" "post_generate" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /requests/{id}/generate"
  target    = "integrations/${aws_apigatewayv2_integration.status.id}"
}

# Validation route
resource "aws_apigatewayv2_route" "get_validation" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /requests/{id}/validation"
  target    = "integrations/${aws_apigatewayv2_integration.validation.id}"
}

# Download route
resource "aws_apigatewayv2_route" "get_download" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /requests/{id}/download"
  target    = "integrations/${aws_apigatewayv2_integration.download.id}"
}
