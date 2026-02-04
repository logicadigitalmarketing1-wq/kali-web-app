# Ugo Pentesting - ECR Module
# ============================
# Creates ECR repositories for container images

# =============================================
# ECR Repositories
# =============================================
resource "aws_ecr_repository" "repos" {
  for_each = toset(var.repository_names)

  name                 = "${var.project_name}/${each.value}"
  image_tag_mutability = var.image_tag_mutability

  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}/${each.value}"
  })
}

# =============================================
# Lifecycle Policy (Keep last N images, delete old untagged)
# =============================================
resource "aws_ecr_lifecycle_policy" "repos" {
  for_each = toset(var.repository_names)

  repository = aws_ecr_repository.repos[each.value].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.keep_tagged_images} tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "latest"]
          countType     = "imageCountMoreThan"
          countNumber   = var.keep_tagged_images
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Delete untagged images older than ${var.untagged_retention_days} days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = var.untagged_retention_days
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# =============================================
# Repository Policy (Allow cross-account access if needed)
# =============================================
resource "aws_ecr_repository_policy" "repos" {
  for_each = var.allow_cross_account_access ? toset(var.repository_names) : toset([])

  repository = aws_ecr_repository.repos[each.value].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowPull"
        Effect = "Allow"
        Principal = {
          AWS = var.cross_account_arns
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
      }
    ]
  })
}
