import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/prisma.service';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Users =====
  async getUsers(limit = 50, offset = 0) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        include: {
          role: { select: { name: true, displayName: true } },
          _count: { select: { runs: true, scopes: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count(),
    ]);

    return {
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        username: u.username,
        role: u.role,
        isActive: u.isActive,
        isLocked: u.isLocked,
        totpEnabled: u.totpEnabled,
        runsCount: u._count.runs,
        scopesCount: u._count.scopes,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })),
      total,
    };
  }

  async createUser(data: {
    email: string;
    username: string;
    password: string;
    roleName: string;
    createdBy: string;
  }) {
    const role = await this.prisma.role.findUnique({ where: { name: data.roleName } });
    if (!role) throw new BadRequestException('Invalid role');

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] },
    });
    if (existing) throw new BadRequestException('Email or username already exists');

    const passwordHash = await argon2.hash(data.password, ARGON2_OPTIONS);

    const user = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        username: data.username,
        passwordHash,
        roleId: role.id,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'admin.user.created',
        userId: data.createdBy,
        resource: 'user',
        resourceId: user.id,
        details: { email: user.email, username: user.username, role: data.roleName },
        success: true,
      },
    });

    return { id: user.id, email: user.email, username: user.username };
  }

  async updateUser(userId: string, updates: {
    isActive?: boolean;
    roleId?: string;
  }, updatedBy: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updates,
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'admin.user.updated',
        userId: updatedBy,
        resource: 'user',
        resourceId: userId,
        details: updates,
        success: true,
      },
    });

    return updated;
  }

  async unlockUser(userId: string, unlockedBy: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isLocked: false, lockedAt: null, lockReason: null, failedAttempts: 0 },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'admin.user.unlocked',
        userId: unlockedBy,
        resource: 'user',
        resourceId: userId,
        details: {},
        success: true,
      },
    });

    return { success: true };
  }

  // ===== Scopes =====
  async getScopes() {
    const scopes = await this.prisma.scope.findMany({
      include: {
        _count: { select: { users: true, runs: true } },
      },
      orderBy: { name: 'asc' },
    });

    return scopes.map(s => ({
      id: s.id,
      name: s.name,
      displayName: s.displayName,
      description: s.description,
      allowedHosts: s.allowedHosts,
      allowedCidrs: s.allowedCidrs,
      isDefault: s.isDefault,
      isActive: s.isActive,
      usersCount: s._count.users,
      runsCount: s._count.runs,
    }));
  }

  async createScope(data: {
    name: string;
    displayName: string;
    description?: string;
    allowedHosts: string[];
    allowedCidrs: string[];
    createdBy: string;
  }) {
    const existing = await this.prisma.scope.findUnique({ where: { name: data.name } });
    if (existing) throw new BadRequestException('Scope name already exists');

    const scope = await this.prisma.scope.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        allowedHosts: data.allowedHosts,
        allowedCidrs: data.allowedCidrs,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'admin.scope.created',
        userId: data.createdBy,
        resource: 'scope',
        resourceId: scope.id,
        details: { name: scope.name },
        success: true,
      },
    });

    return scope;
  }

  async updateScope(scopeId: string, updates: {
    displayName?: string;
    description?: string;
    allowedHosts?: string[];
    allowedCidrs?: string[];
    isActive?: boolean;
  }, updatedBy: string) {
    const scope = await this.prisma.scope.findUnique({ where: { id: scopeId } });
    if (!scope) throw new NotFoundException('Scope not found');

    const updated = await this.prisma.scope.update({
      where: { id: scopeId },
      data: updates,
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'admin.scope.updated',
        userId: updatedBy,
        resource: 'scope',
        resourceId: scopeId,
        details: updates,
        success: true,
      },
    });

    return updated;
  }

  async assignScopeToUser(userId: string, scopeId: string, assignedBy: string) {
    await this.prisma.userScope.upsert({
      where: { userId_scopeId: { userId, scopeId } },
      update: {},
      create: { userId, scopeId, assignedBy },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'admin.scope.assigned',
        userId: assignedBy,
        resource: 'user_scope',
        details: { userId, scopeId },
        success: true,
      },
    });

    return { success: true };
  }

  async removeScopeFromUser(userId: string, scopeId: string, removedBy: string) {
    await this.prisma.userScope.delete({
      where: { userId_scopeId: { userId, scopeId } },
    }).catch(() => {});

    await this.prisma.auditLog.create({
      data: {
        action: 'admin.scope.removed',
        userId: removedBy,
        resource: 'user_scope',
        details: { userId, scopeId },
        success: true,
      },
    });

    return { success: true };
  }

  // ===== Audit Logs =====
  async getAuditLogs(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = { contains: filters.action };
    if (filters.resource) where.resource = filters.resource;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  // ===== Roles =====
  async getRoles() {
    return this.prisma.role.findMany({
      include: { _count: { select: { users: true } } },
    });
  }
}
