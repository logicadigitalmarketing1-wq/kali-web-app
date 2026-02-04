# Ugo Pentesting - Networking Module Outputs
# ==========================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "nat_gateway_ip" {
  description = "Public IP of the NAT gateway"
  value       = var.enable_nat_gateway ? aws_eip.nat[0].public_ip : null
}

# Security Group IDs
output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "ID of the ECS security group"
  value       = aws_security_group.ecs.id
}

output "hexstrike_security_group_id" {
  description = "ID of the HexStrike security group"
  value       = aws_security_group.hexstrike.id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

output "bastion_security_group_id" {
  description = "ID of the bastion security group"
  value       = var.create_bastion_sg ? aws_security_group.bastion[0].id : null
}

# For use in other modules
output "security_groups" {
  description = "Map of all security group IDs"
  value = {
    alb       = aws_security_group.alb.id
    ecs       = aws_security_group.ecs.id
    hexstrike = aws_security_group.hexstrike.id
    rds       = aws_security_group.rds.id
    redis     = aws_security_group.redis.id
    bastion   = var.create_bastion_sg ? aws_security_group.bastion[0].id : null
  }
}
