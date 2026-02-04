# Ugo Pentesting - Production Variables
# =====================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ca-central-1"
}

# Secrets (passed via environment or tfvars)
variable "anthropic_api_key" {
  description = "Anthropic API key for Claude"
  type        = string
  sensitive   = true
}

# Database
variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.small" # Larger for production
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage (GB)"
  type        = number
  default     = 50 # More storage for production
}

variable "rds_max_allocated_storage" {
  description = "RDS max allocated storage (GB)"
  type        = number
  default     = 200
}

# Cache
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.small" # Larger for production
}

# Compute
variable "ecs_instance_type" {
  description = "ECS EC2 instance type"
  type        = string
  default     = "t3.large" # Larger for production
}

variable "hexstrike_instance_type" {
  description = "HexStrike EC2 instance type"
  type        = string
  default     = "t3.large" # Larger for production
}

# Alerts
variable "alert_email" {
  description = "Email for CloudWatch alerts"
  type        = string
  default     = null
}
