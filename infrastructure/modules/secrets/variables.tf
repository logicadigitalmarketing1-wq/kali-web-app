# Ugo Pentesting - Secrets Module Variables
# =========================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "ugo-pentesting"
}

variable "environment" {
  description = "Environment name (staging/production)"
  type        = string
}

variable "recovery_window_days" {
  description = "Number of days for secret recovery window"
  type        = number
  default     = 7
}

# Database credentials
variable "db_username" {
  description = "Database username"
  type        = string
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "db_host" {
  description = "Database host"
  type        = string
}

variable "db_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "ugopentesting"
}

# Application secrets
variable "session_secret" {
  description = "Session secret for authentication"
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude"
  type        = string
  sensitive   = true
}

# Redis auth (optional)
variable "redis_auth_token" {
  description = "Redis auth token (if using TLS)"
  type        = string
  default     = null
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
