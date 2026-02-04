# Ugo Pentesting - Secrets Module Outputs
# =======================================

output "db_credentials_arn" {
  description = "ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "db_credentials_name" {
  description = "Name of the database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.name
}

output "app_secrets_arn" {
  description = "ARN of the application secrets"
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "app_secrets_name" {
  description = "Name of the application secrets"
  value       = aws_secretsmanager_secret.app_secrets.name
}

output "redis_auth_arn" {
  description = "ARN of the Redis auth token secret"
  value       = var.redis_auth_token != null ? aws_secretsmanager_secret.redis_auth[0].arn : null
}

output "secrets_read_policy_arn" {
  description = "ARN of the IAM policy for reading secrets"
  value       = aws_iam_policy.secrets_read.arn
}

output "secret_arns" {
  description = "Map of all secret ARNs"
  value = {
    db_credentials = aws_secretsmanager_secret.db_credentials.arn
    app_secrets    = aws_secretsmanager_secret.app_secrets.arn
    redis_auth     = var.redis_auth_token != null ? aws_secretsmanager_secret.redis_auth[0].arn : null
  }
}
