import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tool.findMany({
      where: { isEnabled: true },
      include: {
        category: true,
        manifests: {
          where: { isActive: true },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.tool.findUnique({
      where: { slug },
      include: {
        category: true,
        manifests: {
          where: { isActive: true },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
  }

  async getCategories() {
    return this.prisma.toolCategory.findMany({
      include: {
        tools: {
          where: { isEnabled: true },
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
