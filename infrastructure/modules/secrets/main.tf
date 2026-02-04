# Ugo Pentesting - Secrets Module
# ================================
# AWS Secrets Manager for sensitive configuration

# =============================================
# Database Credentials Secret
# =============================================
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.project_name}/${var.environment}/db-credentials"
  description = "PostgreSQL database credentials for ${var.project_name} ${var.environment}"

  recovery_window_in_days = var.recovery_window_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}/${var.environment}/db-credentials"
    Environment = var.environment
  })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
    host     = var.db_host
    port     = var.db_port
    database = var.db_name
  })
}

# =============================================
# Application Secrets
# =============================================
resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${var.project_name}/${var.environment}/app-secrets"
  description = "Application secrets for ${var.project_name} ${var.environment}"

  recovery_window_in_days = var.recovery_window_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}/${var.environment}/app-secrets"
    Environment = var.environment
  })
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    SESSION_SECRET    = var.session_secret
    ANTHROPIC_API_KEY = var.anthropic_api_key
    TOTP_ISSUER       = "UgoPentesting"
  })
}

# =============================================
# Redis Auth Token (if using TLS)
# =============================================
resource "aws_secretsmanager_secret" "redis_auth" {
  count = var.redis_auth_token != null ? 1 : 0

  name        = "${var.project_name}/${var.environment}/redis-auth"
  description = "Redis auth token for ${var.project_name} ${var.environment}"

  recovery_window_in_days = var.recovery_window_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}/${var.environment}/redis-auth"
    Environment = var.environment
  })
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  count = var.redis_auth_token != null ? 1 : 0

  secret_id     = aws_secretsmanager_secret.redis_auth[0].id
  secret_string = var.redis_auth_token
}

# =============================================
# IAM Policy for Reading Secrets
# =============================================
resource "aws_iam_policy" "secrets_read" {
  name        = "${var.project_name}-${var.environment}-secrets-read"
  description = "Policy to read secrets for ${var.project_name} ${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.db_credentials.arn,
          aws_secretsmanager_secret.app_secrets.arn,
        ]
      }
    ]
  })
}
