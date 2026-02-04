import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, RunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HexStrikeService } from '../mcp/hexstrike.service';
import { ClaudeService } from '../mcp/claude.service';

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('runs') private readonly runsQueue: Queue,
    private readonly hexstrikeService: HexStrikeService,
    private readonly claudeService: ClaudeService,
  ) {}

  async create(data: {
    userId: string;
    toolId: string;
    manifestId: string;
    scopeId: string;
    params: Record<string, unknown>;
    target: string;
  }) {
    const run = await this.prisma.run.create({
      data: {
        userId: data.userId,
        toolId: data.toolId,
        manifestId: data.manifestId,
        scopeId: data.scopeId,
        params: data.params as Prisma.InputJsonValue,
        target: data.target,
        status: 'PENDING',
      },
    });

    // Add job to queue
    await this.runsQueue.add('execute', {
      runId: run.id,
    });

    return run;
  }

  async findById(id: string) {
    return this.prisma.run.findUnique({
      where: { id },
      include: {
        tool: true,
        manifest: true,
        scope: true,
        artifacts: true,
        findings: true,
        analysis: true,
      },
    });
  }

  async findByUser(
    userId: string | undefined,
    options?: { limit?: number; offset?: number; status?: string },
  ) {
    const where = {
      ...(userId && { userId }),
      ...(options?.status && { status: options.status as RunStatus }),
    };

    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const [runs, total] = await Promise.all([
      this.prisma.run.findMany({
        where,
        include: {
          tool: { select: { name: true, slug: true } },
          _count: { select: { findings: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.run.count({ where }),
    ]);

    return {
      data: runs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + runs.length < total,
      },
    };
  }

  async updateStatus(
    id: string,
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED',
    extra?: { exitCode?: number; error?: string; duration?: number },
  ) {
    const completedStatuses = ['COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED'];
    return this.prisma.run.update({
      where: { id },
      data: {
        status,
        ...(status === 'RUNNING' ? { startedAt: new Date() } : {}),
        ...(completedStatuses.includes(status) ? { completedAt: new Date() } : {}),
        ...extra,
      },
    });
  }

  async addArtifact(runId: string, type: string, content: string, mimeType = 'text/plain') {
    return this.prisma.runArtifact.create({
      data: {
        runId,
        type,
        content,
        mimeType,
        size: Buffer.byteLength(content, 'utf8'),
      },
    });
  }

  async stop(id: string, userId: string) {
    // Get full run with params to check for smart scan
    const run = await this.prisma.run.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, params: true },
    });

    if (!run) {
      throw new Error('Run not found');
    }

    if (run.userId !== userId) {
      throw new Error('Unauthorized: You can only stop your own runs');
    }

    // Only stop runs that are PENDING or RUNNING
    if (run.status !== 'PENDING' && run.status !== 'RUNNING') {
      throw new Error(`Cannot stop run with status ${run.status}`);
    }

    this.logger.log(`Stopping run ${id}`);

    // Try to remove the job from the queue
    try {
      const jobs = await this.runsQueue.getJobs(['waiting', 'active', 'delayed']);
      for (const job of jobs) {
        if (job.data?.runId === id) {
          await job.remove();
          this.logger.log(`Removed job ${job.id} from queue`);
          break;
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to remove job from queue: ${error}`);
    }

    // Update status to CANCELLED
    await this.updateStatus(id, 'CANCELLED');

    // Check if this is a Smart Scan and cancel it too
    const params = run.params as Record<string, unknown> | null;
    const smartScanSessionId = params?.smartScanSessionId as string | undefined;

    if (smartScanSessionId) {
      this.logger.log(`Run ${id} is linked to SmartScan ${smartScanSessionId}, cancelling...`);
      try {
        await this.prisma.smartScanSession.update({
          where: { id: smartScanSessionId },
          data: {
            status: 'CANCELLED',
            completedAt: new Date(),
          },
        });

        // Mark any running steps as cancelled
        await this.prisma.smartScanStep.updateMany({
          where: {
            sessionId: smartScanSessionId,
            status: { in: ['PENDING', 'RUNNING'] },
          },
          data: {
            status: 'SKIPPED',
          },
        });

        this.logger.log(`SmartScan ${smartScanSessionId} cancelled`);
      } catch (error) {
        this.logger.warn(`Failed to cancel SmartScan: ${error}`);
      }
    }

    // Reset HexStrike to ensure clean state for future runs
    try {
      await this.hexstrikeService.clearCacheAndPrepare();
      this.logger.log('HexStrike cache cleared after stopping run');
    } catch (error) {
      this.logger.warn(`Failed to reset HexStrike: ${error}`);
    }

    return { success: true, message: 'Run stopped successfully' };
  }

  async delete(id: string, userId: string, isAdmin = false) {
    // Get full run with params to check for smart scan
    const run = await this.prisma.run.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, params: true },
    });

    if (!run) {
      throw new Error('Run not found');
    }

    if (!isAdmin && run.userId !== userId) {
      throw new Error('Unauthorized: You can only delete your own runs');
    }

    // If run is still active, stop it first
    if (run.status === 'PENDING' || run.status === 'RUNNING') {
      await this.stop(id, userId);
    }

    this.logger.log(`Deleting run ${id}`);

    // Check if this is a Smart Scan and delete it too
    const params = run.params as Record<string, unknown> | null;
    const smartScanSessionId = params?.smartScanSessionId as string | undefined;

    if (smartScanSessionId) {
      this.logger.log(`Run ${id} is linked to SmartScan ${smartScanSessionId}, deleting...`);
      try {
        // Delete SmartScan findings first (cascade should handle this but let's be explicit)
        await this.prisma.smartScanFinding.deleteMany({
          where: { sessionId: smartScanSessionId },
        });

        // Delete SmartScan steps
        await this.prisma.smartScanStep.deleteMany({
          where: { sessionId: smartScanSessionId },
        });

        // Delete the SmartScan session
        await this.prisma.smartScanSession.delete({
          where: { id: smartScanSessionId },
        });

        this.logger.log(`SmartScan ${smartScanSessionId} and all related data deleted`);
      } catch (error) {
        this.logger.warn(`Failed to delete SmartScan: ${error}`);
      }
    }

    // Delete the run (cascade will handle artifacts, findings, analysis)
    await this.prisma.run.delete({ where: { id } });

    return { success: true, message: 'Run deleted successfully' };
  }

  /**
   * Generate AI recommendations for a completed run
   */
  async generateRecommendations(runId: string, _userId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        findings: true,
        analysis: true,
        tool: true,
      },
    });

    if (!run) {
      throw new Error('Run not found');
    }

    // Authorization is handled in the controller (Admin can access all runs)

    // Check if we already have cached recommendations in analysis
    if (run.analysis?.recommendations && Array.isArray(run.analysis.recommendations) && run.analysis.recommendations.length > 0) {
      // Check if it's the new format with technical details
      const firstRec = run.analysis.recommendations[0] as Record<string, unknown>;
      if (firstRec && typeof firstRec === 'object' && 'id' in firstRec && 'technicalDetails' in firstRec) {
        this.logger.log(`[Recommendations] Returning cached recommendations for run ${runId}`);
        const rawResponse = run.analysis.rawResponse as Record<string, unknown> || {};
        return {
          recommendations: run.analysis.recommendations,
          executiveSummary: (rawResponse.executiveSummary as string) || 'Analyse de sécurité complétée.',
        };
      }
    }

    // Prepare findings for Claude
    const findings = run.findings.map((f) => ({
      title: f.title,
      description: f.description,
      severity: f.severity,
      category: f.cweId || 'General',
      tool: run.tool?.name || 'Unknown',
      remediation: f.remediation || undefined,
    }));

    // Calculate scan summary
    const scanSummary = {
      totalVulnerabilities: findings.length,
      criticalVulnerabilities: findings.filter((f) => f.severity === 'CRITICAL').length,
      highVulnerabilities: findings.filter((f) => f.severity === 'HIGH').length,
      riskScore: this.calculateRiskScore(findings),
    };

    this.logger.log(`[Recommendations] Generating AI recommendations for run ${runId} with ${findings.length} findings`);

    // If no findings, return empty recommendations
    if (findings.length === 0) {
      this.logger.log(`[Recommendations] No findings for run ${runId}, returning empty recommendations`);
      return {
        recommendations: [],
        executiveSummary: 'Aucune vulnérabilité détectée lors de ce scan. Le système semble sécurisé selon les tests effectués.',
      };
    }

    // Call Claude to generate recommendations
    let result;
    try {
      result = await this.claudeService.generateRecommendations(
        run.target,
        findings,
        scanSummary,
      );
    } catch (error) {
      this.logger.error(`[Recommendations] Claude API error for run ${runId}: ${error}`);
      throw new Error(`Erreur lors de la génération des recommandations: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }

    // Cache the recommendations in the analysis record
    if (run.analysis) {
      await this.prisma.runAnalysis.update({
        where: { id: run.analysis.id },
        data: {
          recommendations: result.recommendations as unknown as Prisma.InputJsonValue,
          rawResponse: {
            ...(run.analysis.rawResponse as Record<string, unknown> || {}),
            executiveSummary: result.executiveSummary,
            recommendationsGeneratedAt: new Date().toISOString(),
            recommendationsTokensUsed: result.tokensUsed,
          },
        },
      });
    }

    this.logger.log(`[Recommendations] Generated ${result.recommendations.length} recommendations for run ${runId}`);

    return {
      recommendations: result.recommendations,
      executiveSummary: result.executiveSummary,
    };
  }

  private calculateRiskScore(findings: Array<{ severity: string }>): number {
    let score = 0;
    for (const finding of findings) {
      switch (finding.severity) {
        case 'CRITICAL':
          score += 10;
          break;
        case 'HIGH':
          score += 7;
          break;
        case 'MEDIUM':
          score += 4;
          break;
        case 'LOW':
          score += 2;
          break;
        case 'INFO':
          score += 1;
          break;
      }
    }
    return Math.min(100, score);
  }
}
