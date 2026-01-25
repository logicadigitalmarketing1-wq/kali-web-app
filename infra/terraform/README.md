# SecureScope Terraform Infrastructure

This directory contains Terraform configurations for deploying SecureScope to AWS.

## Architecture

The infrastructure includes:

- **VPC**: Multi-AZ VPC with public and private subnets
- **ECS Fargate**: Container orchestration for API, Web, and Executor services
- **RDS PostgreSQL**: Managed database with Multi-AZ deployment
- **ElastiCache Redis**: Managed Redis for sessions and job queue
- **ALB**: Application Load Balancer with TLS termination
- **WAF**: Web Application Firewall (optional)
- **Secrets Manager**: Secure storage for credentials
- **CloudWatch**: Logging and monitoring

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform 1.5+
3. S3 bucket for Terraform state
4. DynamoDB table for state locking

### Create State Backend

```bash
# Create S3 bucket
aws s3 mb s3://securescope-terraform-state --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket securescope-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for locking
aws dynamodb create-table \
  --table-name securescope-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Deployment

### Initialize

```bash
cd environments/prod
terraform init
```

### Plan

```bash
terraform plan -out=tfplan
```

### Apply

```bash
terraform apply tfplan
```

## Environments

| Environment | Description |
|-------------|-------------|
| prod | Production environment |
| staging | Staging/testing environment |
| dev | Development environment |

## Variables

| Variable | Description | Default |
|----------|-------------|---------|
| aws_region | AWS region | us-east-1 |
| environment | Environment name | prod |
| vpc_cidr | VPC CIDR block | 10.0.0.0/16 |
| image_tag | Docker image tag | latest |
| domain_name | Custom domain | "" |

## Outputs

| Output | Description |
|--------|-------------|
| alb_dns_name | ALB DNS name |
| vpc_id | VPC ID |
| ecs_cluster_name | ECS cluster name |

## Security Considerations

1. All data encrypted at rest (RDS, Redis, S3)
2. TLS 1.2+ enforced for all connections
3. Private subnets for all compute resources
4. Security groups with least privilege
5. Secrets stored in AWS Secrets Manager
6. CloudWatch logging enabled
7. WAF rules for common attacks

## Cost Optimization

For development/staging:
- Use smaller instance types
- Single-AZ deployments
- Reduce redundancy

For production:
- Multi-AZ for high availability
- Auto-scaling policies
- Reserved instances for predictable workloads

## Cleanup

```bash
terraform destroy
```

**Warning**: This will destroy all resources including the database. Make sure to backup important data first.
