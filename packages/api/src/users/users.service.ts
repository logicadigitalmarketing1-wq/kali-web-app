import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        totpSecret: {
          select: {
            verified: true,
          },
        },
        scopes: {
          include: {
            scope: true,
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        totpSecret: {
          select: {
            verified: true,
          },
        },
        scopes: {
          include: {
            scope: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            scopes: true,
            runs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: { role?: Role; isActive?: boolean }) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async delete(id: string) {
    // Soft delete by deactivating
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async create(data: {
    email: string;
    password: string;
    name?: string;
    role?: Role;
  }) {
    const passwordHash = await argon2.hash(data.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role ?? 'VIEWER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }
}
