import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScopesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string) {
    // Get scopes assigned to the user
    const userScopes = await this.prisma.userScope.findMany({
      where: { userId },
      include: {
        scope: true,
      },
    });

    return userScopes
      .filter((us) => us.scope.isActive)
      .map((us) => us.scope);
  }

  async findAll() {
    return this.prisma.scope.findMany({
      where: { isActive: true },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.scope.findUnique({
      where: { id },
    });
  }

  async create(data: {
    name: string;
    description?: string;
    cidrs: string[];
    hosts: string[];
  }) {
    return this.prisma.scope.create({
      data: {
        ...data,
        isActive: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      cidrs?: string[];
      hosts?: string[];
      isActive?: boolean;
    },
  ) {
    return this.prisma.scope.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.scope.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async assignToUser(userId: string, scopeId: string) {
    return this.prisma.userScope.upsert({
      where: { userId_scopeId: { userId, scopeId } },
      update: {},
      create: { userId, scopeId },
    });
  }

  async removeFromUser(userId: string, scopeId: string) {
    return this.prisma.userScope.delete({
      where: { userId_scopeId: { userId, scopeId } },
    });
  }
}
