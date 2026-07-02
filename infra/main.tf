terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# ─── Current account identity ─────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

data "aws_iam_role" "lab_role" {
  name = "LabRole"
}

locals {
  account_id  = data.aws_caller_identity.current.account_id
  bucket_name = "idp-artifacts-${local.account_id}"
  table_name  = "idp-table"
  queue_name  = "idp-generation-queue"
}

# ─── DynamoDB ─────────────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "idp" {
  name         = local.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "GSI1PK"
    type = "S"
  }
  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }
}

# ─── S3 ───────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "artifacts" {
  bucket        = local.bucket_name
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── SQS ──────────────────────────────────────────────────────────────────────

resource "aws_sqs_queue" "generation" {
  name                       = local.queue_name
  visibility_timeout_seconds = 360
  message_retention_seconds  = 3600
}
