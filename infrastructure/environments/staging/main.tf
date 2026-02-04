# Ugo Pentesting - Staging Environment
# =====================================

terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "ugo-pentesting-terraform-state"
    key            = "environments/staging/terraform.tfstate"
    region         = "ca-central-1"
    dynamodb_table = "ugo-pentesting-terraform-locks"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ugo-pentesting"
      Environment = "staging"
      ManagedBy   = "terraform"
    }
  }
}

# Provider for CloudFront certificates (us-east-1)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "ugo-pentesting"
      Environment = "staging"
      ManagedBy   = "terraform"
    }
  }
}

# =============================================
# Local Variables
# =============================================
locals {
  project_name = "ugo-pentesting"
  environment  = "staging"
  domain_name  = "ugopentesting.ca"

  common_tags = {
    Project     = local.project_name
    Environment = local.environment
  }
}

# =============================================
# Random Password for Database
# =============================================
resource "random_password" "db_password" {
  length  = 24
  special = true
}

resource "random_password" "session_secret" {
  length  = 32
  special = false
}

# =============================================
# Modules
# =============================================

# ECR (shared across environments)
module "ecr" {
  source = "../../modules/ecr"

  project_name     = local.project_name
  repository_names = ["web", "api", "executor", "hexstrike"]
  tags             = local.common_tags
}

# Networking
module "networking" {
  source = "../../modules/networking"

  project_name         = "${local.project_name}-${local.environment}"
  vpc_cidr             = "10.0.0.0/16"
  availability_zones   = ["ca-central-1a", "ca-central-1b"]
  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]
  enable_nat_gateway   = true
  tags                 = local.common_tags
}

# DNS
module "dns" {
  source = "../../modules/dns"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  domain_name            = local.domain_name
  create_cloudfront_cert = false
  create_alb_records     = !var.first_apply
  staging_alb_dns_name   = module.loadbalancer.alb_dns_name
  staging_alb_zone_id    = module.loadbalancer.alb_zone_id
  tags                   = local.common_tags
}

# Database
module "database" {
  source = "../../modules/database"

  project_name          = "${local.project_name}-${local.environment}"
  subnet_ids            = module.networking.private_subnet_ids
  security_group_id     = module.networking.rds_security_group_id
  instance_class        = var.rds_instance_class
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage
  multi_az              = false
  master_password       = random_password.db_password.result
  deletion_protection   = false
  skip_final_snapshot   = true
  tags                  = local.common_tags
}

# Cache
module "cache" {
  source = "../../modules/cache"

  project_name       = "${local.project_name}-${local.environment}"
  subnet_ids         = module.networking.private_subnet_ids
  security_group_id  = module.networking.redis_security_group_id
  node_type          = var.redis_node_type
  num_cache_clusters = 1
  tags               = local.common_tags
}

# Load Balancer
module "loadbalancer" {
  source = "../../modules/loadbalancer"

  project_name        = "${local.project_name}-${local.environment}"
  vpc_id              = module.networking.vpc_id
  public_subnet_ids   = module.networking.public_subnet_ids
  security_group_id   = module.networking.alb_security_group_id
  certificate_arn     = module.dns.certificate_arn
  deletion_protection = false
  api_subdomain       = "api.staging.${local.domain_name}"
  tags                = local.common_tags
}

# Secrets
module "secrets" {
  source = "../../modules/secrets"

  project_name      = local.project_name
  environment       = local.environment
  db_username       = module.database.username
  db_password       = random_password.db_password.result
  db_host           = module.database.address
  db_port           = module.database.port
  db_name           = module.database.database_name
  session_secret    = random_password.session_secret.result
  anthropic_api_key = var.anthropic_api_key
  tags              = local.common_tags
}

# Compute
module "compute" {
  source = "../../modules/compute"

  project_name                = local.project_name
  environment                 = local.environment
  aws_region                  = var.aws_region
  private_subnet_ids          = module.networking.private_subnet_ids
  ecs_security_group_id       = module.networking.ecs_security_group_id
  hexstrike_security_group_id = module.networking.hexstrike_security_group_id
  ecr_registry                = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
  ecr_repository_urls         = module.ecr.repository_urls
  web_target_group_arn        = module.loadbalancer.web_target_group_arn
  api_target_group_arn        = module.loadbalancer.api_target_group_arn
  secrets_read_policy_arn     = module.secrets.secrets_read_policy_arn
  db_credentials_arn          = module.secrets.db_credentials_arn
  app_secrets_arn             = module.secrets.app_secrets_arn
  api_url                     = "https://api.staging.${local.domain_name}"
  redis_url                   = module.cache.connection_string
  ecs_instance_type           = var.ecs_instance_type
  ecs_desired_capacity        = 1
  hexstrike_instance_type     = var.hexstrike_instance_type
  tags                        = local.common_tags

  depends_on = [module.secrets]
}

# Monitoring
module "monitoring" {
  source = "../../modules/monitoring"

  project_name     = local.project_name
  environment      = local.environment
  aws_region       = var.aws_region
  ecs_cluster_name = module.compute.ecs_cluster_name
  rds_instance_id  = module.database.id
  alb_arn_suffix   = split("/", module.loadbalancer.alb_arn)[2]
  alert_email      = var.alert_email
  create_alarms    = !var.first_apply
  tags             = local.common_tags
}

# =============================================
# Data Sources
# =============================================
data "aws_caller_identity" "current" {}

# =============================================
# Outputs
# =============================================
output "vpc_id" {
  value = module.networking.vpc_id
}

output "alb_dns_name" {
  value = module.loadbalancer.alb_dns_name
}

output "database_endpoint" {
  value     = module.database.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value = module.cache.primary_endpoint
}

output "hexstrike_instance_id" {
  value = module.compute.hexstrike_instance_id
}

output "name_servers" {
  value       = module.dns.name_servers
  description = "Update these in GoDaddy"
}

output "staging_url" {
  value = "https://staging.${local.domain_name}"
}

output "api_staging_url" {
  value = "https://api.staging.${local.domain_name}"
}
