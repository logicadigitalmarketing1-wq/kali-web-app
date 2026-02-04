import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Severity, Prisma } from '@prisma/client';

@Injectable()
export class FindingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: {
    severity?: Severity;
    status?: string;
    userId?: string;
    toolId?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.prisma.finding.findMany({
      where: {
        ...(filters?.severity ? { severity: filters.severity } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.userId ? { run: { userId: filters.userId } } : {}),
        ...(filters?.toolId ? { run: { toolId: filters.toolId } } : {}),
      },
      include: {
        run: {
          select: {
            id: true,
            target: true,
            tool: { select: { name: true, slug: true } },
          },
        },
        tags: true,
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
      take: filters?.limit || 100,
      skip: filters?.offset || 0,
    });
  }

  async getStats(userId?: string) {
    const where = userId ? { run: { userId } } : {};

    const [total, bySeverity] = await Promise.all([
      this.prisma.finding.count({ where }),
      this.prisma.finding.groupBy({
        by: ['severity'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      bySeverity: bySeverity.reduce(
        (acc, item) => ({ ...acc, [item.severity]: item._count }),
        {} as Record<Severity, number>,
      ),
    };
  }

  async create(data: {
    runId: string;
    title: string;
    description: string;
    severity: Severity;
    confidence?: number;
    cweId?: string;
    owaspId?: string;
    evidence?: string;
    remediation?: string;
    references?: string[];
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.finding.create({
      data: {
        runId: data.runId,
        title: data.title,
        description: data.description,
        severity: data.severity,
        confidence: data.confidence,
        cweId: data.cweId,
        owaspId: data.owaspId,
        evidence: data.evidence,
        remediation: data.remediation,
        references: data.references || [],
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.finding.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string, userId: string) {
    // Verify that the finding belongs to a run owned by this user
    const finding = await this.prisma.finding.findUnique({
      where: { id },
      include: { run: { select: { userId: true } } },
    });

    if (!finding) {
      throw new Error('Finding not found');
    }

    if (finding.run.userId !== userId) {
      throw new Error('Unauthorized: You can only delete your own findings');
    }

    await this.prisma.finding.delete({ where: { id } });

    return { success: true, message: 'Finding deleted successfully' };
  }
}
