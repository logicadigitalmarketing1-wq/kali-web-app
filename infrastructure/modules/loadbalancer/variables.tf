# Ugo Pentesting - Load Balancer Module Variables
# ===============================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "ugo-pentesting"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for the ALB"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for the ALB"
  type        = string
}

variable "certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS"
  type        = string
}

variable "deletion_protection" {
  description = "Enable deletion protection for the ALB"
  type        = bool
  default     = false
}

variable "access_logs_bucket" {
  description = "S3 bucket name for ALB access logs (optional)"
  type        = string
  default     = null
}

variable "api_subdomain" {
  description = "API subdomain for host-based routing (e.g., api.ugopentesting.ca)"
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
