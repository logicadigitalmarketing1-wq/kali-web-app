# Ugo Pentesting - Compute Module Variables
# =========================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "ugo-pentesting"
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ca-central-1"
}

# Networking
variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

variable "hexstrike_security_group_id" {
  description = "Security group ID for HexStrike EC2"
  type        = string
}

# ECR
variable "ecr_registry" {
  description = "ECR registry URL"
  type        = string
}

variable "ecr_repository_urls" {
  description = "Map of ECR repository URLs"
  type        = map(string)
}

# Load Balancer
variable "web_target_group_arn" {
  description = "ARN of the web target group"
  type        = string
}

variable "api_target_group_arn" {
  description = "ARN of the API target group"
  type        = string
}

# Secrets
variable "secrets_read_policy_arn" {
  description = "ARN of the secrets read policy"
  type        = string
}

variable "db_credentials_arn" {
  description = "ARN of the database credentials secret"
  type        = string
}

variable "app_secrets_arn" {
  description = "ARN of the application secrets"
  type        = string
}

# Configuration
variable "api_url" {
  description = "API URL for frontend"
  type        = string
}

variable "redis_url" {
  description = "Redis connection URL"
  type        = string
}

variable "hexstrike_private_ip" {
  description = "Private IP of HexStrike instance (set after creation)"
  type        = string
  default     = ""
}

# ECS Instance Configuration
variable "ecs_instance_type" {
  description = "Instance type for ECS cluster"
  type        = string
  default     = "t3.medium"
}

variable "ecs_min_size" {
  description = "Minimum number of ECS instances"
  type        = number
  default     = 1
}

variable "ecs_max_size" {
  description = "Maximum number of ECS instances"
  type        = number
  default     = 3
}

variable "ecs_desired_capacity" {
  description = "Desired number of ECS instances"
  type        = number
  default     = 1
}

# Task Configuration
variable "web_cpu" {
  description = "CPU units for web task"
  type        = number
  default     = 256
}

variable "web_memory" {
  description = "Memory for web task (MB)"
  type        = number
  default     = 512
}

variable "web_desired_count" {
  description = "Desired count of web tasks"
  type        = number
  default     = 1
}

variable "api_cpu" {
  description = "CPU units for API task"
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memory for API task (MB)"
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "Desired count of API tasks"
  type        = number
  default     = 1
}

variable "executor_cpu" {
  description = "CPU units for executor task"
  type        = number
  default     = 256
}

variable "executor_memory" {
  description = "Memory for executor task (MB)"
  type        = number
  default     = 512
}

variable "executor_desired_count" {
  description = "Desired count of executor tasks"
  type        = number
  default     = 1
}

# HexStrike Configuration
variable "hexstrike_instance_type" {
  description = "Instance type for HexStrike EC2"
  type        = string
  default     = "t3.medium"
}

# Logging
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
