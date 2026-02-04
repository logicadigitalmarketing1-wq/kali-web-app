# Ugo Pentesting - Bootstrap Variables
# =====================================

variable "aws_region" {
  description = "AWS region for the state resources"
  type        = string
  default     = "ca-central-1"
}

variable "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state"
  type        = string
  default     = "ugo-pentesting-terraform-state"
}

variable "lock_table_name" {
  description = "Name of the DynamoDB table for state locking"
  type        = string
  default     = "ugo-pentesting-terraform-locks"
}

variable "create_ci_cd_user" {
  description = "Whether to create an IAM user for CI/CD (set to false if using OIDC)"
  type        = bool
  default     = false
}
