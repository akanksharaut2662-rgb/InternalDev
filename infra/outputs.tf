output "api_url" {
  description = "Base URL for the API Gateway — set this as VITE_API_URL in the frontend"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}"
}

output "s3_bucket" {
  description = "S3 bucket where generated ZIPs are stored"
  value       = aws_s3_bucket.artifacts.bucket
}

output "dynamodb_table" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.idp.name
}

output "sqs_queue_url" {
  description = "SQS queue URL for the generation orchestrator"
  value       = aws_sqs_queue.generation.url
}

output "frontend_bucket" {
  description = "S3 bucket name — upload the built dist/ folder here"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_url" {
  description = "S3 static website URL for the frontend"
  value       = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
}
