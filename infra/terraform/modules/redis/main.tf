# Redis Module (ElastiCache)

variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "ecs_security_group_id" {
  type = string
}

# Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.name_prefix}-redis-subnet"
  subnet_ids = var.private_subnet_ids
}

# Security Group
resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-redis-sg"
  description = "Redis Security Group"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.ecs_security_group_id]
  }
}

# ElastiCache Cluster
resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${var.name_prefix}-redis"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.t3.small"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  snapshot_retention_limit = 7
  snapshot_window          = "02:00-03:00"
  maintenance_window       = "sun:03:00-sun:04:00"

  tags = {
    Name = "${var.name_prefix}-redis"
  }
}

# Outputs
output "endpoint" {
  value = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "redis_url" {
  value = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:6379"
}
