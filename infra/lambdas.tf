# ─── Common env vars for all Lambdas ─────────────────────────────────────────

locals {
  common_env = {
    TABLE_NAME       = local.table_name
    ARTIFACTS_BUCKET = local.bucket_name
    SQS_QUEUE_URL    = aws_sqs_queue.generation.url
  }
}

# ─── policy_service ───────────────────────────────────────────────────────────

data "archive_file" "policy_service" {
  type        = "zip"
  output_path = "${path.module}/builds/policy_service.zip"

  source {
    content  = file("${path.module}/../backend/policy_service/handler.py")
    filename = "handler.py"
  }
  source {
    content  = file("${path.module}/../backend/policy_service/defaults.py")
    filename = "defaults.py"
  }
  source {
    content  = file("${path.module}/../backend/policy_service/parser.py")
    filename = "parser.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/__init__.py")
    filename = "shared/__init__.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/db.py")
    filename = "shared/db.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/logger.py")
    filename = "shared/logger.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/response.py")
    filename = "shared/response.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/s3_helper.py")
    filename = "shared/s3_helper.py"
  }
}

resource "aws_lambda_function" "policy_service" {
  function_name    = "idp-policy-service"
  role             = data.aws_iam_role.lab_role.arn
  filename         = data.archive_file.policy_service.output_path
  source_code_hash = data.archive_file.policy_service.output_base64sha256
  runtime          = "python3.12"
  handler          = "handler.handler"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = local.common_env
  }
}

# ─── status_service ───────────────────────────────────────────────────────────

data "archive_file" "status_service" {
  type        = "zip"
  output_path = "${path.module}/builds/status_service.zip"

  source {
    content  = file("${path.module}/../backend/status_service/handler.py")
    filename = "handler.py"
  }
  # status_service imports parse_policy_to_spec and DEFAULT_POLICY_PROFILE
  source {
    content  = file("${path.module}/../backend/policy_service/parser.py")
    filename = "parser.py"
  }
  source {
    content  = file("${path.module}/../backend/policy_service/defaults.py")
    filename = "defaults.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/__init__.py")
    filename = "shared/__init__.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/db.py")
    filename = "shared/db.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/logger.py")
    filename = "shared/logger.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/response.py")
    filename = "shared/response.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/s3_helper.py")
    filename = "shared/s3_helper.py"
  }
}

resource "aws_lambda_function" "status_service" {
  function_name    = "idp-status-service"
  role             = data.aws_iam_role.lab_role.arn
  filename         = data.archive_file.status_service.output_path
  source_code_hash = data.archive_file.status_service.output_base64sha256
  runtime          = "python3.12"
  handler          = "handler.handler"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = local.common_env
  }
}

# ─── validation_service ───────────────────────────────────────────────────────

data "archive_file" "validation_service" {
  type        = "zip"
  output_path = "${path.module}/builds/validation_service.zip"

  source {
    content  = file("${path.module}/../backend/validation_service/handler.py")
    filename = "handler.py"
  }
  source {
    content  = file("${path.module}/../backend/validation_service/rules.py")
    filename = "rules.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/__init__.py")
    filename = "shared/__init__.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/db.py")
    filename = "shared/db.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/logger.py")
    filename = "shared/logger.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/response.py")
    filename = "shared/response.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/s3_helper.py")
    filename = "shared/s3_helper.py"
  }
}

resource "aws_lambda_function" "validation_service" {
  function_name    = "idp-validation-service"
  role             = data.aws_iam_role.lab_role.arn
  filename         = data.archive_file.validation_service.output_path
  source_code_hash = data.archive_file.validation_service.output_base64sha256
  runtime          = "python3.12"
  handler          = "handler.handler"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = local.common_env
  }
}

# ─── download_service ─────────────────────────────────────────────────────────

data "archive_file" "download_service" {
  type        = "zip"
  output_path = "${path.module}/builds/download_service.zip"

  source {
    content  = file("${path.module}/../backend/download_service/handler.py")
    filename = "handler.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/__init__.py")
    filename = "shared/__init__.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/db.py")
    filename = "shared/db.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/logger.py")
    filename = "shared/logger.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/response.py")
    filename = "shared/response.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/s3_helper.py")
    filename = "shared/s3_helper.py"
  }
}

resource "aws_lambda_function" "download_service" {
  function_name    = "idp-download-service"
  role             = data.aws_iam_role.lab_role.arn
  filename         = data.archive_file.download_service.output_path
  source_code_hash = data.archive_file.download_service.output_base64sha256
  runtime          = "python3.12"
  handler          = "handler.handler"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = local.common_env
  }
}

# ─── generation_orchestrator (SQS-triggered) ──────────────────────────────────

data "archive_file" "generation_orchestrator" {
  type        = "zip"
  output_path = "${path.module}/builds/generation_orchestrator.zip"

  source {
    content  = file("${path.module}/../backend/generation_orchestrator/handler.py")
    filename = "handler.py"
  }
  source {
    content  = file("${path.module}/../backend/generation_orchestrator/artifact_assembler.py")
    filename = "artifact_assembler.py"
  }
  source {
    content  = file("${path.module}/../backend/generation_orchestrator/groq_client.py")
    filename = "groq_client.py"
  }
  source {
    content  = file("${path.module}/../backend/generation_orchestrator/prompt_builder.py")
    filename = "prompt_builder.py"
  }
  # orchestrator also imports from policy_service and validation_service
  source {
    content  = file("${path.module}/../backend/policy_service/parser.py")
    filename = "parser.py"
  }
  source {
    content  = file("${path.module}/../backend/policy_service/defaults.py")
    filename = "defaults.py"
  }
  source {
    content  = file("${path.module}/../backend/validation_service/rules.py")
    filename = "rules.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/__init__.py")
    filename = "shared/__init__.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/db.py")
    filename = "shared/db.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/logger.py")
    filename = "shared/logger.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/response.py")
    filename = "shared/response.py"
  }
  source {
    content  = file("${path.module}/../backend/shared/s3_helper.py")
    filename = "shared/s3_helper.py"
  }
}

resource "aws_lambda_function" "generation_orchestrator" {
  function_name    = "idp-generation-orchestrator"
  role             = data.aws_iam_role.lab_role.arn
  filename         = data.archive_file.generation_orchestrator.output_path
  source_code_hash = data.archive_file.generation_orchestrator.output_base64sha256
  runtime          = "python3.12"
  handler          = "handler.handler"
  timeout          = 300
  memory_size      = 512

  environment {
    variables = merge(local.common_env, {
      GROQ_API_KEY = var.groq_api_key
    })
  }
}

resource "aws_lambda_event_source_mapping" "sqs_to_orchestrator" {
  event_source_arn = aws_sqs_queue.generation.arn
  function_name    = aws_lambda_function.generation_orchestrator.arn
  batch_size       = 1
  enabled          = true
}

# ─── API Gateway invoke permissions ───────────────────────────────────────────

resource "aws_lambda_permission" "apigw_policy" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.policy_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_status" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.status_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_validation" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.validation_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_download" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.download_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
