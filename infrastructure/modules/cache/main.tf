# Ugo Pentesting - Cache Module
# ==============================
# ElastiCache Redis for session storage and BullMQ queues

# =============================================
# ElastiCache Subnet Group
# =============================================
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-redis-subnet-group"
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, {
    Name = "${var.project_name}-redis-subnet-group"
  })
}

# =============================================
# ElastiCache Parameter Group
# =============================================
resource "aws_elasticache_parameter_group" "main" {
  name   = "${var.project_name}-redis7-params"
  family = "redis7"

  # Optimizations for session and queue workloads
  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-redis7-params"
  })
}

# =============================================
# ElastiCache Replication Group
# =============================================
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project_name}-redis"
  description          = "Redis cluster for ${var.project_name}"

  # Engine
  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  parameter_group_name = aws_elasticache_parameter_group.main.name

  # Cluster configuration
  num_cache_clusters         = var.num_cache_clusters
  automatic_failover_enabled = var.num_cache_clusters > 1
  multi_az_enabled           = var.num_cache_clusters > 1

  # Network
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [var.security_group_id]
  port               = 6379

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = var.transit_encryption_enabled
  auth_token                 = var.transit_encryption_enabled ? var.auth_token : null

  # Maintenance
  maintenance_window       = "Mon:05:00-Mon:06:00"
  snapshot_retention_limit = var.snapshot_retention_limit
  snapshot_window          = "04:00-05:00"

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  tags = merge(var.tags, {
    Name = "${var.project_name}-redis"
  })
}
