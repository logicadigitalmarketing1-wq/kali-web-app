# Ugo Pentesting - DNS Module Outputs
# ====================================

output "zone_id" {
  description = "ID of the Route53 hosted zone"
  value       = aws_route53_zone.main.zone_id
}

output "zone_name" {
  description = "Name of the Route53 hosted zone"
  value       = aws_route53_zone.main.name
}

output "name_servers" {
  description = "Name servers for the hosted zone (update in GoDaddy)"
  value       = aws_route53_zone.main.name_servers
}

output "certificate_arn" {
  description = "ARN of the ACM certificate (ca-central-1)"
  value       = aws_acm_certificate.main.arn
}

output "certificate_validation_status" {
  description = "Status of the certificate validation"
  value       = aws_acm_certificate_validation.main.id != null ? "ISSUED" : "PENDING"
}

output "cloudfront_certificate_arn" {
  description = "ARN of the CloudFront ACM certificate (us-east-1)"
  value       = var.create_cloudfront_cert ? aws_acm_certificate.cloudfront[0].arn : null
}

output "godaddy_instructions" {
  description = "Instructions for updating GoDaddy nameservers"
  value       = <<-EOT
    =====================================
    GoDaddy Nameserver Update Instructions
    =====================================

    1. Log in to your GoDaddy account
    2. Go to My Products > Domains > ${var.domain_name}
    3. Click on "DNS" or "Manage DNS"
    4. Find "Nameservers" section and click "Change"
    5. Select "Enter my own nameservers (advanced)"
    6. Replace existing nameservers with:

    ${join("\n       ", aws_route53_zone.main.name_servers)}

    7. Save changes
    8. Wait 24-48 hours for propagation
    9. Verify with: dig NS ${var.domain_name}
  EOT
}
