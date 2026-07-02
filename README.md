# PolicyCraft - Internal Developer Platform

A web-based Internal Developer Platform that lets organizations define company-wide engineering standards in plain language, then automatically generates standardized, compliance-validated microservice code for developers to download as a ZIP.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────────────┐
│  React SPA  │────▶│ API Gateway  │────▶│  Lambda Functions (Python)  │
│ (CloudFront)│     │  (REST API)  │     │  ┌─────────────────────┐    │
└─────────────┘     └──────────────┘     │  │  policy-service     │    │
                                         │  │  status-service     │    │
                                         │  │  gen-orchestrator   │◀─SQS
                                         │  │  validation-service │    │
                                         │  │  download-service   │    │
                                         │  └─────────────────────┘    │
                                         └──────┬──────┬───────┬───────┘
                                                │      │       │
                                          DynamoDB    S3    Groq API
                                         (policies) (ZIPs) (LLM gen)
```

## Monorepo Structure

```
├── frontend/    # React SPA (Vite)
├── backend/     # Python Lambda functions
├── infra/       # Terraform IaC
├── scripts/     # Build & deploy helpers
└── .github/     # CI/CD workflows
```

## AWS Services Used

| Category | Service | Purpose |
|----------|---------|---------|
| Compute | Lambda | 5 functions (policy, status, generation, validation, download) |
| API | API Gateway | REST API entry point |
| Storage | DynamoDB | Policies, request history, validation results |
| Storage | S3 | Frontend hosting + generated ZIP artifacts |
| CDN | CloudFront | Frontend distribution |
| Messaging | SQS | Async generation queue |
| Monitoring | CloudWatch + X-Ray | Logs, metrics, alarms, tracing |
| AI (external) | Groq API | LLM code generation (llama-3.3-70b-versatile) |

## AWS Academy Learner Lab Constraints

- **IAM**: All Lambdas use the pre-existing `LabRole` as no custom IAM roles can be created. In production, each Lambda would have a least-privilege role scoped to its specific resource needs.
- **Bedrock**: Model access provisioning restricted: Groq API used as external alternative. AWS 3+ service category requirement still met via Lambda/SQS/API Gateway/CloudWatch/DynamoDB/S3.

## Prerequisites

- AWS CLI configured with Learner Lab credentials
- Terraform >= 1.5
- Node.js >= 18 (frontend build)
- Python >= 3.12 (backend development)
- Groq API key (https://console.groq.com)

## Quick Start

```bash
# 1. Set up infrastructure
cd infra
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your LabRole ARN and Groq API key
terraform init
terraform apply

# 2. Deploy frontend
cd ../frontend
npm install
VITE_API_URL=$(cd ../infra && terraform output -raw api_gateway_url) npm run build
aws s3 sync dist/ s3://$(cd ../infra && terraform output -raw frontend_bucket_name) --delete

# 3. Access the platform
echo "Frontend: $(cd infra && terraform output -raw cloudfront_url)"
echo "API: $(cd infra && terraform output -raw api_gateway_url)"
```

## Teardown

```bash
cd infra
terraform destroy
```

All resources use randomized suffixes, no collisions on re-deploy.

## License

Internal use only.
