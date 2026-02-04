import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    // Run queries in parallel for performance - Global stats (all users)
    const [
      totalRuns,
      completedRuns,
      failedRuns,
      totalFindings,
      criticalFindings,
      highFindings,
      recentRuns,
      findingsBySeverity,
    ] = await Promise.all([
      // Total runs (all users)
      this.prisma.run.count(),

      // Completed runs
      this.prisma.run.count({
        where: { status: 'COMPLETED' },
      }),

      // Failed runs
      this.prisma.run.count({
        where: { status: 'FAILED' },
      }),

      // Total findings
      this.prisma.finding.count(),

      // Critical findings
      this.prisma.finding.count({
        where: { severity: 'CRITICAL' },
      }),

      // High findings
      this.prisma.finding.count({
        where: { severity: 'HIGH' },
      }),

      // Recent runs with tool info
      this.prisma.run.findMany({
        include: {
          tool: {
            select: { id: true, name: true, slug: true },
          },
          user: {
            select: { id: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // Findings grouped by severity
      this.prisma.finding.groupBy({
        by: ['severity'],
        _count: { severity: true },
        orderBy: {
          _count: { severity: 'desc' },
        },
      }),
    ]);

    return {
      totalRuns,
      completedRuns,
      failedRuns,
      totalFindings,
      criticalFindings,
      highFindings,
      recentRuns,
      findingsBySeverity: findingsBySeverity.map((item) => ({
        severity: item.severity,
        count: item._count.severity,
      })),
    };
  }
}
