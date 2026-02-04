# Ugo Pentesting - ECR Module Variables
# ======================================

variable "project_name" {
  description = "Project name prefix for repository names"
  type        = string
  default     = "ugo-pentesting"
}

variable "repository_names" {
  description = "List of repository names to create"
  type        = list(string)
  default     = ["web", "api", "executor", "hexstrike"]
}

variable "image_tag_mutability" {
  description = "Tag mutability setting (MUTABLE or IMMUTABLE)"
  type        = string
  default     = "MUTABLE"
}

variable "scan_on_push" {
  description = "Enable image scanning on push"
  type        = bool
  default     = true
}

variable "keep_tagged_images" {
  description = "Number of tagged images to keep"
  type        = number
  default     = 10
}

variable "untagged_retention_days" {
  description = "Days to keep untagged images before deletion"
  type        = number
  default     = 7
}

variable "allow_cross_account_access" {
  description = "Whether to allow cross-account access"
  type        = bool
  default     = false
}

variable "cross_account_arns" {
  description = "List of ARNs that can pull images (if cross-account access is enabled)"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
