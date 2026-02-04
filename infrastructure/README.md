# Ugo Pentesting - Infrastructure

AWS infrastructure managed with Terraform for the Ugo Pentesting Security Platform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Cloud (ca-central-1)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐     ┌─────────────────────────────────────┐   │
│   │   Route53   │────▶│        Application Load Balancer    │   │
│   │ ugopentesting.ca │ │         (HTTPS:443)                │   │
│   └─────────────┘     └──────────────┬──────────────────────┘   │
│                                      │                           │
│                       ┌──────────────┴──────────────┐           │
│                       │                              │           │
│   ┌───────────────────▼──────────────────┐   ┌──────▼───────┐   │
│   │         ECS Cluster (EC2)            │   │  HexStrike   │   │
│   │  ┌─────┐  ┌─────┐  ┌──────────┐     │   │  Dedicated   │   │
│   │  │ Web │  │ API │  │ Executor │     │   │    EC2       │   │
│   │  │:3000│  │:4000│  │ (worker) │     │   │   :8888      │   │
│   │  └─────┘  └─────┘  └──────────┘     │   └──────────────┘   │
│   └────────────────────┬─────────────────┘          │           │
│                        │                             │           │
│   ┌────────────────────┴─────────────────────────────┤           │
│   │                  VPC Private Subnets             │           │
│   │  ┌────────────────┐  ┌────────────────────────┐ │           │
│   │  │ RDS PostgreSQL │  │   ElastiCache Redis    │ │           │
│   │  │   (Multi-AZ)   │  │      (Replica)         │ │           │
│   │  └────────────────┘  └────────────────────────┘ │           │
│   └──────────────────────────────────────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform >= 1.5.0
- Domain registered (ugopentesting.ca)
- GoDaddy account access (for nameserver updates)

## Directory Structure

```
infrastructure/
├── bootstrap/              # Terraform state backend (run first)
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── modules/                # Reusable Terraform modules
│   ├── networking/         # VPC, subnets, security groups
│   ├── dns/                # Route53, ACM certificates
│   ├── compute/            # ECS on EC2, HexStrike EC2
│   ├── database/           # RDS PostgreSQL
│   ├── cache/              # ElastiCache Redis
│   ├── loadbalancer/       # ALB with target groups
│   ├── secrets/            # Secrets Manager
│   ├── ecr/                # Container registry
│   └── monitoring/         # CloudWatch alarms & dashboard
├── environments/
│   ├── staging/            # Staging environment
│   └── production/         # Production environment
├── versions.tf             # Provider version constraints
└── README.md               # This file
```

## Quick Start

### 1. Bootstrap Terraform State

First, create the S3 bucket and DynamoDB table for Terraform state:

```bash
cd infrastructure/bootstrap
terraform init
terraform apply
```

Note the output - you'll need the bucket name for the next steps.

### 2. Configure GoDaddy Nameservers

After deploying DNS module, update GoDaddy nameservers:

1. Go to GoDaddy > My Products > ugopentesting.ca > Manage DNS
2. Click "Nameservers" > "Change" > "Enter my own nameservers"
3. Enter the 4 NS records from Terraform output
4. Wait 24-48 hours for propagation
5. Verify: `dig NS ugopentesting.ca`

### 3. Deploy Staging Environment

```bash
cd infrastructure/environments/staging

# Copy and edit tfvars
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

terraform init
terraform plan
terraform apply
```

### 4. Deploy Production Environment

```bash
cd infrastructure/environments/production

cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

terraform init
terraform plan
terraform apply
```

## Environment Configuration

### Staging

| Resource | Size | Multi-AZ |
|----------|------|----------|
| ECS Instance | t3.medium | No |
| RDS | db.t3.micro | No |
| Redis | cache.t3.micro | No |
| HexStrike | t3.medium | N/A |

### Production

| Resource | Size | Multi-AZ |
|----------|------|----------|
| ECS Instance | t3.large | Yes |
| RDS | db.t3.small | Yes |
| Redis | cache.t3.small | Yes |
| HexStrike | t3.large | N/A |

## Secrets Management

Secrets are stored in AWS Secrets Manager:

- `ugo-pentesting/<env>/db-credentials` - Database credentials
- `ugo-pentesting/<env>/app-secrets` - SESSION_SECRET, ANTHROPIC_API_KEY

ECS tasks automatically pull secrets at runtime.

## Security Groups

| Security Group | Inbound | Purpose |
|----------------|---------|---------|
| sg-alb | 80, 443 from 0.0.0.0/0 | Public ALB |
| sg-ecs | 3000, 4000 from sg-alb | ECS tasks |
| sg-hexstrike | 8888 from sg-ecs only | HexStrike (isolated) |
| sg-rds | 5432 from sg-ecs | PostgreSQL |
| sg-redis | 6379 from sg-ecs | Redis |

## Monitoring

CloudWatch Dashboard: `ugo-pentesting-dashboard`

### Alarms

- ECS CPU > 80%
- ECS Memory > 85%
- RDS CPU > 80%
- RDS Connections > 80%
- RDS Storage < 20% free
- ALB 5xx errors > 10/min
- ALB p99 latency > 2s

Alerts are sent to the configured email via SNS.

## Rollback Procedures

### ECS Service Rollback

```bash
# List task definition revisions
aws ecs list-task-definitions --family-prefix ugo-pentesting-api

# Update service to previous revision
aws ecs update-service \
  --cluster ugo-pentesting-cluster \
  --service api \
  --task-definition ugo-pentesting-api:PREVIOUS_REVISION
```

### HexStrike Rollback

```bash
# Connect via SSM
aws ssm start-session --target <instance-id>

# Pull previous image
docker pull <ecr-url>/ugo-pentesting/hexstrike:previous-tag
docker stop hexstrike
docker rm hexstrike
docker run -d --name hexstrike ... <ecr-url>/ugo-pentesting/hexstrike:previous-tag
```

## Terraform Commands

```bash
# Format all files
terraform fmt -recursive

# Validate configuration
terraform validate

# Plan changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan

# Destroy (DANGER!)
terraform destroy
```

## Costs Estimate (USD/month)

### Staging (~$150-200)
- ECS (1x t3.medium): ~$30
- RDS (db.t3.micro): ~$15
- ElastiCache (cache.t3.micro): ~$15
- ALB: ~$20
- NAT Gateway: ~$35
- Data transfer: ~$20-50

### Production (~$400-600)
- ECS (2x t3.large): ~$120
- RDS (db.t3.small, Multi-AZ): ~$50
- ElastiCache (cache.t3.small, 2 nodes): ~$50
- ALB: ~$25
- NAT Gateway: ~$35
- Data transfer: ~$50-100

## Troubleshooting

### ECS Tasks Failing to Start

1. Check CloudWatch Logs: `/ecs/ugo-pentesting/<service>`
2. Verify secrets exist and task role has access
3. Check security group allows egress to ECR

### Database Connection Issues

1. Verify security group allows ECS → RDS
2. Check DATABASE_URL secret format
3. Ensure Prisma migrations have run

### HexStrike Not Responding

1. SSM into instance: `aws ssm start-session --target <id>`
2. Check Docker: `docker logs hexstrike`
3. Verify security group allows ECS → HexStrike:8888

## Support

For issues, create a ticket in the GitHub repository.
