# Ugo Pentesting - Monitoring Module Variables
# ============================================

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

# Alert Configuration
variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = null
}

# ECS Monitoring
variable "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "ecs_cpu_threshold" {
  description = "CPU threshold percentage for ECS alarm"
  type        = number
  default     = 80
}

variable "ecs_memory_threshold" {
  description = "Memory threshold percentage for ECS alarm"
  type        = number
  default     = 85
}

# RDS Monitoring
variable "rds_instance_id" {
  description = "RDS instance identifier"
  type        = string
  default     = null
}

variable "rds_cpu_threshold" {
  description = "CPU threshold percentage for RDS alarm"
  type        = number
  default     = 80
}

variable "rds_connections_threshold" {
  description = "Connections threshold for RDS alarm"
  type        = number
  default     = 80
}

variable "rds_storage_threshold_bytes" {
  description = "Free storage threshold in bytes for RDS alarm"
  type        = number
  default     = 5368709120 # 5 GB
}

# ALB Monitoring
variable "alb_arn_suffix" {
  description = "ARN suffix of the ALB"
  type        = string
  default     = null
}

variable "alb_5xx_threshold" {
  description = "5xx error threshold per minute for ALB alarm"
  type        = number
  default     = 10
}

variable "alb_response_time_threshold" {
  description = "P99 response time threshold in seconds for ALB alarm"
  type        = number
  default     = 2
}

variable "create_alarms" {
  description = "Whether to create CloudWatch alarms (set false on first apply)"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
