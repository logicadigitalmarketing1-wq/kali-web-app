# Ugo Pentesting - Staging Variables
# ===================================

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
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage (GB)"
  type        = number
  default     = 20
}

variable "rds_max_allocated_storage" {
  description = "RDS max allocated storage (GB)"
  type        = number
  default     = 100
}

# Cache
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

# Compute
variable "ecs_instance_type" {
  description = "ECS EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "hexstrike_instance_type" {
  description = "HexStrike EC2 instance type"
  type        = string
  default     = "t3.medium"
}

# Alerts
variable "alert_email" {
  description = "Email for CloudWatch alerts"
  type        = string
  default     = null
}
