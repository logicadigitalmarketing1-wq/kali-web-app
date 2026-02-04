# Ugo Pentesting - Database Module
# =================================
# RDS PostgreSQL with Prisma ORM support

# =============================================
# DB Subnet Group
# =============================================
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, {
    Name = "${var.project_name}-db-subnet-group"
  })
}

# =============================================
# RDS Parameter Group
# =============================================
resource "aws_db_parameter_group" "main" {
  name   = "${var.project_name}-pg16-params"
  family = "postgres16"

  # Optimizations for application workload
  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking > 1 second
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-pg16-params"
  })
}

# =============================================
# RDS Instance
# =============================================
resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-postgres"

  # Engine
  engine               = "postgres"
  engine_version       = var.engine_version
  instance_class       = var.instance_class
  parameter_group_name = aws_db_parameter_group.main.name

  # Storage
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  # Credentials
  db_name  = var.database_name
  username = var.master_username
  password = var.master_password

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = false
  port                   = 5432

  # Availability
  multi_az = var.multi_az

  # Backups
  backup_retention_period = var.backup_retention_days
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Monitoring
  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? 7 : null

  # Deletion protection
  deletion_protection      = var.deletion_protection
  skip_final_snapshot      = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.project_name}-final-snapshot"

  # Copy tags to snapshots
  copy_tags_to_snapshot = true

  tags = merge(var.tags, {
    Name = "${var.project_name}-postgres"
  })
}
