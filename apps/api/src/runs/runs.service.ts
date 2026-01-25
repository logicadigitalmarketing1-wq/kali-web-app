import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../common/prisma.service';
import { ToolsService } from '../tools/tools.service';
import { LlmService } from '../llm/llm.service';
import { REDIS_CLIENT } from '../common/redis.module';
import { isValidHost, isIPInCIDR, hostMatchesPattern } from '@securescope/tool-schemas';

@Injectable()
export class RunsService {
  private executionQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolsService: ToolsService,
    private readonly llmService: LlmService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.executionQueue = new Queue('tool-execution', {
      connection: redis,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
  }

  async create(data: {
    userId: string;
    toolId: string;
    scopeId: string;
    parameters: Record<string, unknown>;
  }) {
    // Get tool and manifest
    const tool = await this.prisma.tool.findUnique({
      where: { id: data.toolId },
      include: { currentVersion: true },
    });

    if (!tool || !tool.isEnabled) {
      throw new NotFoundException('Tool not found or disabled');
    }

    // Get scope
    const scope = await this.prisma.scope.findUnique({
      where: { id: data.scopeId },
    });

    if (!scope || !scope.isActive) {
      throw new NotFoundException('Scope not found or inactive');
    }

    // Check user has access to scope
    const userScope = await this.prisma.userScope.findUnique({
      where: {
        userId_scopeId: {
          userId: data.userId,
          scopeId: data.scopeId,
        },
      },
    });

    if (!userScope) {
      throw new ForbiddenException('You do not have access to this scope');
    }

    // Validate target is within scope
    const manifest = tool.currentVersion?.manifest as any;
    if (manifest?.requiresScope !== false) {
      this.validateTargetInScope(manifest, data.parameters, scope);
    }

    // Extract target info
    const targetHost = this.extractTargetHost(manifest, data.parameters);
    const targetPort = this.extractTargetPort(manifest, data.parameters);

    // Create run record
    const run = await this.prisma.run.create({
      data: {
        userId: data.userId,
        toolId: data.toolId,
        scopeId: data.scopeId,
        parameters: data.parameters,
        targetHost,
        targetPort,
        status: 'QUEUED',
      },
    });

    // Queue for execution
    await this.executionQueue.add(
      'execute',
      {
        runId: run.id,
        toolId: tool.id,
        toolName: tool.name,
        manifest: tool.currentVersion?.manifest,
        parameters: data.parameters,
        scope: {
          id: scope.id,
          name: scope.name,
          allowedHosts: scope.allowedHosts,
          allowedCidrs: scope.allowedCidrs,
        },
        userId: data.userId,
      },
      {
        jobId: run.id,
      },
    );

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        action: 'run.created',
        userId: data.userId,
        resource: 'run',
        resourceId: run.id,
        details: {
          toolId: tool.id,
          toolName: tool.name,
          scopeId: scope.id,
          targetHost,
        },
        success: true,
      },
    });

    return {
      id: run.id,
      status: run.status,
      tool: { id: tool.id, name: tool.name },
      createdAt: run.createdAt,
    };
  }

  async findAll(userId: string, filters: {
    toolId?: string;
    scopeId?: string;
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
      scopeId: { in: scopeIds },
    };

    if (filters.toolId) where.toolId = filters.toolId;
    if (filters.scopeId) where.scopeId = filters.scopeId;
    if (filters.status) where.status = filters.status.toUpperCase();

    const [runs, total] = await Promise.all([
      this.prisma.run.findMany({
        where,
        include: {
          tool: { select: { id: true, name: true, displayName: true } },
          scope: { select: { id: true, name: true, displayName: true } },
          _count: { select: { findings: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.run.count({ where }),
    ]);

    return {
      runs: runs.map(run => ({
        id: run.id,
        status: run.status.toLowerCase(),
        tool: run.tool,
        scope: run.scope,
        targetHost: run.targetHost,
        findingsCount: run._count.findings,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        durationMs: run.durationMs,
      })),
      total,
    };
  }

  async findOne(runId: string, userId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        tool: { select: { id: true, name: true, displayName: true } },
        scope: { select: { id: true, name: true, displayName: true } },
        findings: true,
        artifacts: true,
      },
    });

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    // Check user has access to scope
    const userScope = await this.prisma.userScope.findUnique({
      where: {
        userId_scopeId: { userId, scopeId: run.scopeId },
      },
    });

    if (!userScope) {
      throw new ForbiddenException('You do not have access to this run');
    }

    return {
      id: run.id,
      status: run.status.toLowerCase(),
      tool: run.tool,
      scope: run.scope,
      parameters: run.parameters,
      targetHost: run.targetHost,
      targetPort: run.targetPort,
      stdout: run.stdout,
      stderr: run.stderr,
      exitCode: run.exitCode,
      interpretation: run.interpretation,
      findings: run.findings.map(f => ({
        id: f.id,
        title: f.title,
        severity: f.severity.toLowerCase(),
        status: f.status.toLowerCase(),
      })),
      artifacts: run.artifacts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        size: a.size,
      })),
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs: run.durationMs,
      errorMessage: run.errorMessage,
    };
  }

  async updateFromExecutor(runId: string, result: {
    success: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    durationMs: number;
    containerId?: string;
    error?: string;
  }) {
    const status = result.error ? 'FAILED' : (result.success ? 'COMPLETED' : 'FAILED');

    const run = await this.prisma.run.update({
      where: { id: runId },
      data: {
        status,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
        containerId: result.containerId,
        completedAt: new Date(),
        errorMessage: result.error,
      },
      include: {
        tool: { include: { currentVersion: true } },
      },
    });

    // If successful, interpret with LLM
    if (result.success && !result.error) {
      try {
        const interpretation = await this.llmService.interpretOutput(
          run.tool.name,
          run.tool.displayName,
          result.stdout,
          result.stderr,
        );

        await this.prisma.run.update({
          where: { id: runId },
          data: {
            interpretation,
            interpretedAt: new Date(),
          },
        });

        // Create findings from interpretation
        if (interpretation.potentialIssues) {
          for (const issue of interpretation.potentialIssues) {
            await this.prisma.finding.create({
              data: {
                runId,
                title: issue.title,
                description: issue.description,
                severity: issue.severity.toUpperCase() as any,
                category: issue.affectedComponent,
                remediation: issue.remediation,
                cweId: issue.cweId,
                owaspId: issue.owaspId,
                references: issue.references || [],
                confidence: 'MEDIUM',
              },
            });
          }
        }
      } catch (error) {
        // Log but don't fail the run
        console.error('LLM interpretation failed:', error);
      }
    }

    return run;
  }

  private validateTargetInScope(
    manifest: any,
    parameters: Record<string, unknown>,
    scope: { allowedHosts: string[]; allowedCidrs: string[] },
  ) {
    if (!manifest?.argsSchema) return;

    for (const arg of manifest.argsSchema) {
      if (arg.type === 'host' || arg.type === 'url' || arg.name === 'target') {
        const value = parameters[arg.name];
        if (!value) continue;

        let targetHost: string;
        if (arg.type === 'url') {
          try {
            targetHost = new URL(String(value)).hostname;
          } catch {
            throw new BadRequestException(`Invalid URL: ${value}`);
          }
        } else {
          targetHost = String(value);
        }

        if (!this.isHostAllowed(targetHost, scope)) {
          throw new ForbiddenException(`Target ${targetHost} is not within the allowed scope`);
        }
      }
    }
  }

  private isHostAllowed(host: string, scope: { allowedHosts: string[]; allowedCidrs: string[] }): boolean {
    for (const pattern of scope.allowedHosts) {
      if (hostMatchesPattern(host, pattern)) return true;
    }

    if (/^[\d.]+$/.test(host)) {
      for (const cidr of scope.allowedCidrs) {
        if (isIPInCIDR(host, cidr)) return true;
      }
    }

    return false;
  }

  private extractTargetHost(manifest: any, parameters: Record<string, unknown>): string | null {
    if (!manifest?.argsSchema) return null;

    for (const arg of manifest.argsSchema) {
      if (arg.type === 'host' || arg.name === 'target') {
        const value = parameters[arg.name];
        if (value) return String(value);
      }
      if (arg.type === 'url') {
        const value = parameters[arg.name];
        if (value) {
          try {
            return new URL(String(value)).hostname;
          } catch {
            return null;
          }
        }
      }
    }

    return null;
  }

  private extractTargetPort(manifest: any, parameters: Record<string, unknown>): number | null {
    if (!manifest?.argsSchema) return null;

    for (const arg of manifest.argsSchema) {
      if (arg.type === 'port') {
        const value = parameters[arg.name];
        if (value) return Number(value);
      }
    }

    return null;
  }
}
