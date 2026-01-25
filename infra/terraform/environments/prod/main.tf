# SecureScope Production Environment

terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "securescope-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "securescope-terraform-locks"
  }
}

module "vpc" {
  source = "../../modules/vpc"

  name_prefix = local.name_prefix
  vpc_cidr    = var.vpc_cidr
  azs         = local.azs
}

module "rds" {
  source = "../../modules/rds"

  name_prefix           = local.name_prefix
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  ecs_security_group_id = module.ecs.ecs_security_group_id
}

module "redis" {
  source = "../../modules/redis"

  name_prefix           = local.name_prefix
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  ecs_security_group_id = module.ecs.ecs_security_group_id
}

# Secrets Manager for session secret
resource "aws_secretsmanager_secret" "session_secret" {
  name = "${local.name_prefix}/session-secret"
}

resource "aws_secretsmanager_secret_version" "session_secret" {
  secret_id     = aws_secretsmanager_secret.session_secret.id
  secret_string = random_password.session_secret.result
}

resource "random_password" "session_secret" {
  length  = 64
  special = false
}

# Optional: Anthropic API Key
resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name = "${local.name_prefix}/anthropic-api-key"
}

module "ecs" {
  source = "../../modules/ecs"

  name_prefix           = local.name_prefix
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  public_subnet_ids     = module.vpc.public_subnet_ids
  image_tag             = var.image_tag
  ecr_repository_url    = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
  database_url          = module.rds.database_url
  redis_url             = module.redis.redis_url
  session_secret_arn    = aws_secretsmanager_secret.session_secret.arn
  anthropic_api_key_arn = aws_secretsmanager_secret.anthropic_api_key.arn
}

# Outputs
output "alb_dns_name" {
  value = module.ecs.alb_dns_name
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}
