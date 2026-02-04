# Ugo Pentesting - Monitoring Module Outputs
# ==========================================

output "sns_topic_arn" {
  description = "ARN of the SNS alerts topic"
  value       = aws_sns_topic.alerts.arn
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "dashboard_url" {
  description = "URL of the CloudWatch dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "alarm_arns" {
  description = "Map of alarm ARNs"
  value = {
    ecs_cpu       = aws_cloudwatch_metric_alarm.ecs_cpu.arn
    ecs_memory    = aws_cloudwatch_metric_alarm.ecs_memory.arn
    rds_cpu       = var.rds_instance_id != null ? aws_cloudwatch_metric_alarm.rds_cpu[0].arn : null
    alb_5xx       = var.alb_arn_suffix != null ? aws_cloudwatch_metric_alarm.alb_5xx[0].arn : null
  }
}
