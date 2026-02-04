# Ugo Pentesting - Database Module Outputs
# ========================================

output "endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "address" {
  description = "RDS instance address (hostname)"
  value       = aws_db_instance.main.address
}

output "port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "database_name" {
  description = "Name of the default database"
  value       = aws_db_instance.main.db_name
}

output "username" {
  description = "Master username"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "connection_string" {
  description = "PostgreSQL connection string (without password)"
  value       = "postgresql://${aws_db_instance.main.username}:PASSWORD@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}"
  sensitive   = true
}

output "arn" {
  description = "ARN of the RDS instance"
  value       = aws_db_instance.main.arn
}

output "id" {
  description = "ID of the RDS instance"
  value       = aws_db_instance.main.id
}
