# Ugo Pentesting - Load Balancer Module Outputs
# =============================================

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer (for Route53 alias)"
  value       = aws_lb.main.zone_id
}

output "web_target_group_arn" {
  description = "ARN of the web target group"
  value       = aws_lb_target_group.web.arn
}

output "api_target_group_arn" {
  description = "ARN of the API target group"
  value       = aws_lb_target_group.api.arn
}

output "https_listener_arn" {
  description = "ARN of the HTTPS listener"
  value       = aws_lb_listener.https.arn
}

output "target_groups" {
  description = "Map of target group ARNs"
  value = {
    web = aws_lb_target_group.web.arn
    api = aws_lb_target_group.api.arn
  }
}
