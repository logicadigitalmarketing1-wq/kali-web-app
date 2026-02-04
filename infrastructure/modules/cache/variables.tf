# Ugo Pentesting - Cache Module Variables
# =======================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "ugo-pentesting"
}

variable "subnet_ids" {
  description = "List of subnet IDs for the ElastiCache subnet group"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for ElastiCache"
  type        = string
}

variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.1"
}

variable "node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "num_cache_clusters" {
  description = "Number of cache clusters (nodes)"
  type        = number
  default     = 1
}

variable "transit_encryption_enabled" {
  description = "Enable in-transit encryption (TLS)"
  type        = bool
  default     = false
}

variable "auth_token" {
  description = "Auth token for Redis (required if transit encryption is enabled)"
  type        = string
  default     = null
  sensitive   = true
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain snapshots"
  type        = number
  default     = 1
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
