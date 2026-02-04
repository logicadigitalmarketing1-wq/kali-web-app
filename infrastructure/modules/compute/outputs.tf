# Ugo Pentesting - Compute Module Outputs
# =======================================

# ECS Cluster
output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

# ECS Services
output "web_service_name" {
  description = "Name of the web ECS service"
  value       = aws_ecs_service.web.name
}

output "api_service_name" {
  description = "Name of the API ECS service"
  value       = aws_ecs_service.api.name
}

output "executor_service_name" {
  description = "Name of the executor ECS service"
  value       = aws_ecs_service.executor.name
}

# HexStrike
output "hexstrike_instance_id" {
  description = "Instance ID of the HexStrike EC2"
  value       = aws_instance.hexstrike.id
}

output "hexstrike_private_ip" {
  description = "Private IP of the HexStrike EC2"
  value       = aws_instance.hexstrike.private_ip
}

# IAM Roles
output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task.arn
}

# Auto Scaling Group
output "ecs_asg_name" {
  description = "Name of the ECS Auto Scaling Group"
  value       = aws_autoscaling_group.ecs.name
}
