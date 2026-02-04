# Ugo Pentesting - DNS Module Variables
# =====================================

variable "domain_name" {
  description = "Domain name for the hosted zone"
  type        = string
  default     = "ugopentesting.ca"
}

variable "create_cloudfront_cert" {
  description = "Create ACM certificate in us-east-1 for CloudFront"
  type        = bool
  default     = false
}

# Production ALB
variable "alb_dns_name" {
  description = "DNS name of the production ALB"
  type        = string
  default     = null
}

variable "alb_zone_id" {
  description = "Zone ID of the production ALB"
  type        = string
  default     = null
}

# Staging ALB
variable "staging_alb_dns_name" {
  description = "DNS name of the staging ALB"
  type        = string
  default     = null
}

variable "staging_alb_zone_id" {
  description = "Zone ID of the staging ALB"
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
