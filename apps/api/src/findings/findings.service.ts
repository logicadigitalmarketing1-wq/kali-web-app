import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { FindingStatus, Severity } from '@prisma/client';

@Injectable()
export class FindingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, filters: {
    runId?: string;
    severity?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    // Get user's accessible scopes
    const userScopes = await this.prisma.userScope.findMany({
      where: { userId },
      select: { scopeId: true },
    });
    const scopeIds = userScopes.map(s => s.scopeId);

    const where: any = {
      run: {
        scopeId: { in: scopeIds },
      },
    };

    if (filters.runId) where.runId = filters.runId;
    if (filters.severity) where.severity = filters.severity.toUpperCase();
    if (filters.status) where.status = filters.status.toUpperCase();

    const [findings, total] = await Promise.all([
      this.prisma.finding.findMany({
        where,
        include: {
          run: {
            select: {
              id: true,
              tool: { select: { id: true, name: true, displayName: true } },
              targetHost: true,
              createdAt: true,
            },
          },
          tags: true,
        },
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' },
        ],
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.finding.count({ where }),
    ]);

    return {
      findings: findings.map(f => ({
        id: f.id,
        title: f.title,
        severity: f.severity.toLowerCase(),
        status: f.status.toLowerCase(),
        category: f.category,
        run: {
          id: f.run.id,
          tool: f.run.tool,
          targetHost: f.run.targetHost,
          createdAt: f.run.createdAt,
        },
        tags: f.tags.map(t => t.tag),
        createdAt: f.createdAt,
      })),
      total,
    };
  }

  async findOne(findingId: string, userId: string) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: {
        run: {
          select: {
            id: true,
            scopeId: true,
            tool: { select: { id: true, name: true, displayName: true } },
            targetHost: true,
            createdAt: true,
          },
        },
        tags: true,
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    // Check user has access to scope
    const userScope = await this.prisma.userScope.findUnique({
      where: {
        userId_scopeId: { userId, scopeId: finding.run.scopeId },
      },
    });

    if (!userScope) {
      throw new ForbiddenException('You do not have access to this finding');
    }

    return {
      id: finding.id,
      title: finding.title,
      description: finding.description,
      severity: finding.severity.toLowerCase(),
      status: finding.status.toLowerCase(),
      category: finding.category,
      cweId: finding.cweId,
      owaspId: finding.owaspId,
      cveId: finding.cveId,
      remediation: finding.remediation,
      references: finding.references,
      evidence: finding.evidence,
      confidence: finding.confidence.toLowerCase(),
      isManual: finding.isManual,
      run: {
        id: finding.run.id,
        tool: finding.run.tool,
        targetHost: finding.run.targetHost,
        createdAt: finding.run.createdAt,
      },
      tags: finding.tags.map(t => t.tag),
      createdAt: finding.createdAt,
      updatedAt: finding.updatedAt,
    };
  }

  async updateStatus(findingId: string, userId: string, status: string) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { run: { select: { scopeId: true } } },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    // Check user has access
    const userScope = await this.prisma.userScope.findUnique({
      where: {
        userId_scopeId: { userId, scopeId: finding.run.scopeId },
      },
    });

    if (!userScope) {
      throw new ForbiddenException('You do not have access to this finding');
    }

    const updatedFinding = await this.prisma.finding.update({
      where: { id: findingId },
      data: { status: status.toUpperCase() as FindingStatus },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'finding.status.updated',
        userId,
        resource: 'finding',
        resourceId: findingId,
        details: { oldStatus: finding.status, newStatus: status },
        success: true,
      },
    });

    return updatedFinding;
  }

  async addTag(findingId: string, userId: string, tag: string) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { run: { select: { scopeId: true } } },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    // Check user has access
    const userScope = await this.prisma.userScope.findUnique({
      where: {
        userId_scopeId: { userId, scopeId: finding.run.scopeId },
      },
    });

    if (!userScope) {
      throw new ForbiddenException('You do not have access to this finding');
    }

    await this.prisma.findingTag.upsert({
      where: { findingId_tag: { findingId, tag } },
      update: {},
      create: { findingId, tag },
    });

    return { success: true };
  }

  async removeTag(findingId: string, userId: string, tag: string) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { run: { select: { scopeId: true } } },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    // Check user has access
    const userScope = await this.prisma.userScope.findUnique({
      where: {
        userId_scopeId: { userId, scopeId: finding.run.scopeId },
      },
    });

    if (!userScope) {
      throw new ForbiddenException('You do not have access to this finding');
    }

    await this.prisma.findingTag.delete({
      where: { findingId_tag: { findingId, tag } },
    }).catch(() => {});

    return { success: true };
  }

  async getSeverityStats(userId: string) {
    const userScopes = await this.prisma.userScope.findMany({
      where: { userId },
      select: { scopeId: true },
    });
    const scopeIds = userScopes.map(s => s.scopeId);

    const stats = await this.prisma.finding.groupBy({
      by: ['severity'],
      where: {
        run: { scopeId: { in: scopeIds } },
        status: { not: 'REMEDIATED' },
      },
      _count: true,
    });

    return stats.reduce((acc, s) => {
      acc[s.severity.toLowerCase()] = s._count;
      return acc;
    }, {} as Record<string, number>);
  }
}
