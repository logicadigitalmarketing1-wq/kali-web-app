import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { McpService } from '../mcp/mcp.service';
import { HexStrikeService } from '../mcp/hexstrike.service';
import { SmartScanEventsService } from './smart-scan-events.service';
import { RunsEventsService } from '../runs/runs-events.service';
import { CreateSmartScanDto } from './dto/create-smart-scan.dto';
import {
  extractFirstCveId,
  extractFirstCweId,
  extractLocation,
  computeErrorImpact,
  generateErrorSolution,
} from '../common/utils/cve-extractor';

// Define SmartScan enums locally since they're not exported by Prisma
enum SmartScanPhase {
  INTELLIGENCE_PLANNING = 'INTELLIGENCE_PLANNING',
  AUTOMATED_SCAN = 'AUTOMATED_SCAN',
  DEEP_RECONNAISSANCE = 'DEEP_RECONNAISSANCE',
  VULNERABILITY_SCANNING = 'VULNERABILITY_SCANNING',
  EXPLOITATION_CHAIN = 'EXPLOITATION_CHAIN',
  FINAL_REPORT = 'FINAL_REPORT',
}

enum SmartScanStatus {
  CREATED = 'CREATED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT',
}

enum SmartScanStepStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  TIMEOUT = 'TIMEOUT',
}

@Injectable()
export class SmartScanService {
  private readonly logger = new Logger(SmartScanService.name);

  constructor(
    private prisma: PrismaService,
    private mcpService: McpService,
    private hexstrikeService: HexStrikeService,
    private eventsService: SmartScanEventsService,
    private runsEventsService: RunsEventsService,
  ) {}

  async createScan(userId: string, createScanDto: CreateSmartScanDto) {
    this.logger.log(`Creating new SmartScan for target: ${createScanDto.target}`);

    // Create the scan session
    const session = await this.prisma.smartScanSession.create({
      data: {
        userId,
        target: createScanDto.target,
        objective: createScanDto.objective,
        maxTools: createScanDto.maxTools,
        name: createScanDto.name,
        status: SmartScanStatus.CREATED,
      },
    });

    // Initialize the scan steps
    await this.initializeScanSteps(session.id);

    // Get or create infrastructure (tool, manifest, scope) for Smart Scan
    const { tool, manifest, scope } = await this.getOrCreateSmartScanInfrastructure();

    // Create entry in Runs table with PENDING status so it appears in Runs list
    await this.prisma.run.create({
      data: {
        userId,
        toolId: tool.id,
        manifestId: manifest.id,
        scopeId: scope.id,
        target: createScanDto.target,
        status: 'PENDING' as any,
        params: {
          smartScanSessionId: session.id,
          objective: createScanDto.objective,
          maxTools: createScanDto.maxTools,
        },
      },
    });

    return session;
  }

  /**
   * Get or create the default category, tool, manifest, and scope for Smart Scan
   */
  private async getOrCreateSmartScanInfrastructure() {
    let category = await this.prisma.toolCategory.findFirst({
      where: { slug: 'smart-scan' }
    });

    if (!category) {
      category = await this.prisma.toolCategory.create({
        data: {
          name: 'Smart Scan',
          slug: 'smart-scan',
          description: 'AI-powered comprehensive security scans',
        }
      });
    }

    let scope = await this.prisma.scope.findFirst({
      where: { name: 'Smart Scan Default' }
    });

    if (!scope) {
      scope = await this.prisma.scope.create({
        data: {
          name: 'Smart Scan Default',
          description: 'Default scope for Smart Scan operations',
          cidrs: ['0.0.0.0/0'],
          hosts: ['*'],
        }
      });
    }

    let tool = await this.prisma.tool.findFirst({
      where: { slug: 'smart-scan' }
    });

    if (!tool) {
      tool = await this.prisma.tool.create({
        data: {
          name: 'Smart Scan',
          slug: 'smart-scan',
          description: 'AI-powered comprehensive security scan',
          categoryId: category.id,
        }
      });
    }

    let manifest = await this.prisma.toolManifestVersion.findFirst({
      where: { toolId: tool.id }
    });

    if (!manifest) {
      manifest = await this.prisma.toolManifestVersion.create({
        data: {
          toolId: tool.id,
          version: 1,
          binary: 'smart-scan',
          argsSchema: {},
          commandTemplate: ['smart-scan', '{{target}}'],
        }
      });
    }

    return { category, tool, manifest, scope };
  }

  async getScan(sessionId: string, userId?: string) {
    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        findings: {
          orderBy: { severity: 'desc' },
        },
      },
    });

    if (!session) {
      throw new Error('SmartScan session not found');
    }

    if (userId && session.userId !== userId) {
      throw new Error('Unauthorized access to SmartScan session');
    }

    return session;
  }

  async getUserScans(
    userId: string,
    options?: { limit?: number; offset?: number; status?: string },
  ) {
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;

    // Build the where clause for status filtering
    const statusFilter = options?.status === 'FAILED'
      ? { status: { in: [SmartScanStatus.FAILED, SmartScanStatus.TIMEOUT] } }
      : options?.status && options.status !== 'all'
        ? { status: options.status as SmartScanStatus }
        : {};

    const finalWhere = { userId, ...statusFilter };

    const [sessions, total] = await Promise.all([
      this.prisma.smartScanSession.findMany({
        where: finalWhere,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { findings: true },
          },
        },
      }),
      this.prisma.smartScanSession.count({ where: finalWhere }),
    ]);

    const data = sessions.map((session) => ({
      id: session.id,
      name: session.name,
      target: session.target,
      objective: session.objective,
      status: session.status,
      progress: session.progress,
      currentPhase: session.currentPhase,
      totalVulnerabilities: session.totalVulnerabilities,
      criticalVulnerabilities: session.criticalVulnerabilities,
      highVulnerabilities: session.highVulnerabilities,
      riskScore: session.riskScore,
      findingsCount: session._count.findings,
      createdAt: session.createdAt,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    }));

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    };
  }

  /**
   * Get status counts for filter chips (without pagination)
   */
  async getStatusCounts(userId: string) {
    const [all, created, running, completed, failed, cancelled] = await Promise.all([
      this.prisma.smartScanSession.count({ where: { userId } }),
      this.prisma.smartScanSession.count({ where: { userId, status: SmartScanStatus.CREATED } }),
      this.prisma.smartScanSession.count({ where: { userId, status: SmartScanStatus.RUNNING } }),
      this.prisma.smartScanSession.count({ where: { userId, status: SmartScanStatus.COMPLETED } }),
      this.prisma.smartScanSession.count({ where: { userId, status: { in: [SmartScanStatus.FAILED, SmartScanStatus.TIMEOUT] } } }),
      this.prisma.smartScanSession.count({ where: { userId, status: SmartScanStatus.CANCELLED } }),
    ]);

    return {
      all,
      CREATED: created,
      RUNNING: running,
      COMPLETED: completed,
      FAILED: failed,
      CANCELLED: cancelled,
    };
  }

  /**
   * Check if there's already a running scan for any user
   */
  async hasRunningScan(): Promise<boolean> {
    const runningScans = await this.prisma.smartScanSession.count({
      where: { status: SmartScanStatus.RUNNING },
    });
    return runningScans > 0;
  }

  /**
   * Get the queue position for a pending scan
   */
  async getQueuePosition(sessionId: string): Promise<number> {
    const pendingScans = await this.prisma.smartScanSession.findMany({
      where: { status: SmartScanStatus.CREATED },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const position = pendingScans.findIndex((s) => s.id === sessionId);
    return position >= 0 ? position + 1 : 0;
  }

  /**
   * Get the next pending scan to process
   */
  async getNextPendingScan(): Promise<{ id: string; userId: string } | null> {
    const pendingScan = await this.prisma.smartScanSession.findFirst({
      where: { status: SmartScanStatus.CREATED },
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true },
    });
    return pendingScan;
  }

  /**
   * Process the next pending scan if no scan is currently running
   */
  async processNextPendingScan(): Promise<void> {
    const hasRunning = await this.hasRunningScan();
    if (hasRunning) {
      this.logger.log('A scan is still running, waiting before processing next');
      return;
    }

    const nextScan = await this.getNextPendingScan();
    if (nextScan) {
      this.logger.log(`Processing next pending scan: ${nextScan.id}`);
      await this.startScan(nextScan.id, nextScan.userId);
    }
  }

  async startScan(sessionId: string, userId: string) {
    const session = await this.getScan(sessionId, userId);

    if (session.status !== SmartScanStatus.CREATED) {
      throw new Error('Scan is already running or completed');
    }

    // Check if there's already a running scan
    const hasRunning = await this.hasRunningScan();
    if (hasRunning) {
      this.logger.log(`Scan ${sessionId} queued - another scan is already running`);
      this.eventsService.emitLog(sessionId, 'Scan queued - waiting for current scan to complete...');
      return {
        message: 'Scan queued - waiting for current scan to complete',
        status: 'PENDING',
        position: await this.getQueuePosition(sessionId),
      };
    }

    // Clear HexStrike cache and prepare before starting
    this.logger.log('Preparing HexStrike before starting scan...');
    const prepResult = await this.hexstrikeService.clearCacheAndPrepare();
    if (!prepResult.success) {
      this.logger.warn(`HexStrike preparation warning: ${prepResult.message}`);
      this.eventsService.emitLog(sessionId, `Warning: ${prepResult.message}`);
    } else {
      this.eventsService.emitLog(sessionId, prepResult.message);
    }

    // Find the existing Run (created when SmartScan was created) and update to RUNNING
    const run = await this.prisma.run.findFirst({
      where: {
        params: {
          path: ['smartScanSessionId'],
          equals: sessionId,
        },
      },
    });

    if (!run) {
      throw new Error('Associated Run not found for SmartScan session');
    }

    // Update the Run status to RUNNING
    await this.prisma.run.update({
      where: { id: run.id },
      data: {
        status: 'RUNNING' as any,
        startedAt: new Date(),
      },
    });

    // Update session status
    await this.prisma.smartScanSession.update({
      where: { id: sessionId },
      data: {
        status: SmartScanStatus.RUNNING,
        currentPhase: SmartScanPhase.INTELLIGENCE_PLANNING,
        startedAt: new Date(),
      },
    });

    // Start the scan workflow (async) - pass runId for artifact storage
    this.executeScanWorkflow(sessionId, run.id).catch((error) => {
      this.logger.error(`Scan workflow failed: ${error.message}`, error.stack);
      this.handleScanFailure(sessionId, error);
    });

    return { message: 'SmartScan started successfully', runId: run.id };
  }

  async getScanStatus(sessionId: string, userId?: string) {
    const session = await this.getScan(sessionId, userId);
    
    // Calculate progress
    const totalSteps = session.steps.length;
    const completedSteps = session.steps.filter(step => 
      step.status === SmartScanStepStatus.COMPLETED
    ).length;
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    return {
      ...session,
      progress,
    };
  }

  async cancelScan(sessionId: string, userId: string) {
    const session = await this.getScan(sessionId, userId);

    // Allow cancelling already cancelled scans (idempotent)
    if (session.status === SmartScanStatus.CANCELLED) {
      return { message: 'SmartScan already cancelled' };
    }

    if (session.status === SmartScanStatus.COMPLETED || session.status === SmartScanStatus.FAILED) {
      throw new Error('Cannot cancel completed or failed scan');
    }

    this.logger.log(`Cancelling SmartScan session: ${sessionId}`);

    // Update session status
    await this.prisma.smartScanSession.update({
      where: { id: sessionId },
      data: {
        status: SmartScanStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    // Mark any running steps as skipped
    await this.prisma.smartScanStep.updateMany({
      where: {
        sessionId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: {
        status: 'SKIPPED',
      },
    });

    // Update associated Run status if exists
    const run = await this.prisma.run.findFirst({
      where: {
        params: {
          path: ['smartScanSessionId'],
          equals: sessionId,
        },
      },
    });

    if (run && run.status !== 'CANCELLED' && run.status !== 'COMPLETED' && run.status !== 'FAILED') {
      await this.prisma.run.update({
        where: { id: run.id },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      });
      // Emit SSE event for the Run cancellation
      this.runsEventsService.emitFailed(run.id, 'Scan cancelled by user');
    }

    // Emit scan cancelled event
    this.eventsService.emitScanFailed(sessionId, 'Scan cancelled by user');

    // Reset HexStrike
    try {
      await this.hexstrikeService.clearCacheAndPrepare();
      this.logger.log('HexStrike cache cleared after cancelling scan');
    } catch (error) {
      this.logger.warn(`Failed to reset HexStrike: ${error}`);
    }

    return { message: 'SmartScan cancelled successfully' };
  }

  async deleteScan(sessionId: string, userId: string) {
    this.logger.log(`Deleting SmartScan session: ${sessionId}`);

    const session = await this.getScan(sessionId, userId);

    // If scan is still running, cancel it first
    if (session.status === SmartScanStatus.RUNNING || session.status === SmartScanStatus.CREATED) {
      this.logger.log(`Cancelling running scan before deletion: ${sessionId}`);
      await this.cancelScan(sessionId, userId);
    }

    // Find the associated Run
    const run = await this.prisma.run.findFirst({
      where: {
        params: {
          path: ['smartScanSessionId'],
          equals: sessionId,
        },
      },
    });

    // Use a transaction to ensure all deletions succeed or none do
    await this.prisma.$transaction(async (tx) => {
      // Delete Run-related records first (they have cascade but we need to ensure order)
      if (run) {
        this.logger.log(`Deleting associated Run: ${run.id}`);
        // Delete RunAnalysis if exists
        await tx.runAnalysis.deleteMany({ where: { runId: run.id } });
        // Delete RunArtifacts
        await tx.runArtifact.deleteMany({ where: { runId: run.id } });
        // Delete Findings from Run table
        await tx.finding.deleteMany({ where: { runId: run.id } });
        // Delete the Run itself
        await tx.run.delete({ where: { id: run.id } });
      }

      // Delete SmartScan findings
      const findingsDeleted = await tx.smartScanFinding.deleteMany({
        where: { sessionId },
      });
      this.logger.log(`Deleted ${findingsDeleted.count} SmartScan findings`);

      // Delete SmartScan steps
      const stepsDeleted = await tx.smartScanStep.deleteMany({
        where: { sessionId },
      });
      this.logger.log(`Deleted ${stepsDeleted.count} SmartScan steps`);

      // Delete the SmartScan session
      await tx.smartScanSession.delete({
        where: { id: sessionId },
      });
      this.logger.log(`Deleted SmartScan session: ${sessionId}`);
    });

    // Reset HexStrike (non-critical, don't fail if this fails)
    try {
      await this.hexstrikeService.clearCacheAndPrepare();
    } catch (error) {
      this.logger.warn(`Failed to reset HexStrike: ${error}`);
    }

    return { success: true, message: 'SmartScan deleted successfully' };
  }

  private async initializeScanSteps(sessionId: string) {
    const steps = [
      {
        phase: SmartScanPhase.INTELLIGENCE_PLANNING,
        stepNumber: 1,
        name: 'Target Intelligence Analysis',
        description: 'Analyze target to gather intelligence and plan the attack',
      },
      {
        phase: SmartScanPhase.AUTOMATED_SCAN,
        stepNumber: 2,
        name: 'Automated Security Scan',
        description: 'Execute comprehensive automated security scanning',
      },
      {
        phase: SmartScanPhase.DEEP_RECONNAISSANCE,
        stepNumber: 3,
        name: 'Deep Reconnaissance',
        description: 'Perform in-depth reconnaissance on discovered assets',
      },
      {
        phase: SmartScanPhase.VULNERABILITY_SCANNING,
        stepNumber: 4,
        name: 'Vulnerability Assessment',
        description: 'Identify and validate security vulnerabilities',
      },
      {
        phase: SmartScanPhase.EXPLOITATION_CHAIN,
        stepNumber: 5,
        name: 'Attack Chain Analysis',
        description: 'Analyze potential attack chains and exploitation paths',
      },
      {
        phase: SmartScanPhase.FINAL_REPORT,
        stepNumber: 6,
        name: 'Generate Security Report',
        description: 'Compile findings and generate comprehensive security report',
      },
    ];

    await this.prisma.smartScanStep.createMany({
      data: steps.map(step => ({
        sessionId,
        ...step,
      })),
    });
  }

  // Track accumulated output and artifact for a run
  private runOutputs: Map<string, { output: string; artifactId: string | null }> = new Map();

  private async updateRunArtifact(runId: string, content: string) {
    let state = this.runOutputs.get(runId);
    if (!state) {
      state = { output: '', artifactId: null };
      this.runOutputs.set(runId, state);
    }

    state.output += content;

    // Emit SSE event for real-time streaming
    this.runsEventsService.emitOutput(runId, content);

    if (state.artifactId) {
      await this.prisma.runArtifact.update({
        where: { id: state.artifactId },
        data: {
          content: state.output,
          size: Buffer.byteLength(state.output, 'utf8'),
        },
      });
    } else {
      const artifact = await this.prisma.runArtifact.create({
        data: {
          runId,
          type: 'stdout',
          content: state.output,
          mimeType: 'text/plain',
          size: Buffer.byteLength(state.output, 'utf8'),
        },
      });
      state.artifactId = artifact.id;
    }
  }

  private async executeScanWorkflow(sessionId: string, runId: string) {
    try {
      // Emit init event for SSE clients
      this.runsEventsService.emitInit(runId);

      const logAndSave = async (message: string) => {
        this.eventsService.emitLog(sessionId, message);
        await this.updateRunArtifact(runId, message + '\n');
      };

      await logAndSave('Starting Smart Scan workflow...');

      // Phase 1: Intelligence & Planning
      await logAndSave('Phase 1: Intelligence Planning');
      await this.executeIntelligencePlanning(sessionId, runId);

      // Phase 2: Automated Scan
      await logAndSave('Phase 2: Automated Security Scan');
      await this.executeAutomatedScan(sessionId, runId);

      // Phase 3: Deep Reconnaissance
      await logAndSave('Phase 3: Deep Reconnaissance');
      await this.executeDeepReconnaissance(sessionId, runId);

      // Phase 4: Vulnerability Scanning
      await logAndSave('Phase 4: Vulnerability Scanning');
      await this.executeVulnerabilityScanning(sessionId, runId);

      // Phase 5: Exploitation Chain
      await logAndSave('Phase 5: Attack Chain Analysis');
      await this.executeExploitationChain(sessionId, runId);

      // Phase 6: Final Report
      await logAndSave('Phase 6: Generating Final Report');
      await this.generateFinalReport(sessionId, runId);

      // Mark scan as completed
      await this.prisma.smartScanSession.update({
        where: { id: sessionId },
        data: {
          status: SmartScanStatus.COMPLETED,
          currentPhase: null,
          completedAt: new Date(),
        },
      });

      // Update run status
      await this.prisma.run.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Calculate duration
      const run = await this.prisma.run.findUnique({ where: { id: runId } });
      const duration = run?.startedAt
        ? Math.round((Date.now() - new Date(run.startedAt).getTime()) / 1000)
        : 0;

      // Cleanup
      this.runOutputs.delete(runId);

      this.eventsService.emitScanCompleted(sessionId);
      this.runsEventsService.emitCompleted(runId, duration);
      await logAndSave('Smart Scan completed successfully!');

      // Process next pending scan if any
      this.processNextPendingScan().catch((err) => {
        this.logger.error(`Failed to process next pending scan: ${err.message}`);
      });
    } catch (error) {
      this.logger.error(`Scan workflow execution failed: ${error.message}`, error.stack);
      // Emit failed event for SSE clients
      this.runsEventsService.emitFailed(runId, error instanceof Error ? error.message : 'Unknown error');
      // Update run status on failure
      await this.prisma.run.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      this.runOutputs.delete(runId);

      // Process next pending scan even on failure
      this.processNextPendingScan().catch((err) => {
        this.logger.error(`Failed to process next pending scan: ${err.message}`);
      });

      throw error;
    }
  }

  private async executeIntelligencePlanning(sessionId: string, runId: string) {
    await this.updateStepStatus(sessionId, 1, SmartScanStepStatus.RUNNING);

    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    await this.updateRunArtifact(runId, `[Intelligence Planning] Analyzing target: ${session.target}\n`);

    // Simulate target intelligence analysis
    await new Promise(resolve => setTimeout(resolve, 2000));

    await this.updateRunArtifact(runId, `[Intelligence Planning] Target analysis complete\n`);

    // Update session with intelligence data
    await this.prisma.smartScanSession.update({
      where: { id: sessionId },
      data: {
        currentPhase: SmartScanPhase.AUTOMATED_SCAN,
      },
    });

    await this.updateStepStatus(sessionId, 1, SmartScanStepStatus.COMPLETED);
  }

  private async executeAutomatedScan(sessionId: string, runId: string) {
    await this.updateStepStatus(sessionId, 2, SmartScanStepStatus.RUNNING, 'Starting automated network scan');

    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Execute network scan via Claude MCP - Claude chooses the best approach
    try {
      this.logger.log(`Executing automated network scan via Claude MCP for target: ${session.target}`);
      const logMessage = `[Automated Scan] Executing network scan on ${session.target}...`;
      this.eventsService.emitLog(sessionId, logMessage);
      await this.updateRunArtifact(runId, logMessage + '\n');

      const result = await this.mcpService.executeToolWithClaude(
        'nmap_scan', // Suggested tool, but Claude can use others
        { target: session.target },
        session.target,
        {
          task: `Perform a comprehensive network reconnaissance on ${session.target}.
                 Objective: ${session.objective || 'comprehensive security assessment'}

                 Tasks:
                 1. Identify open ports and running services
                 2. Detect service versions and technologies
                 3. Identify potential security issues in the network configuration

                 Use appropriate network scanning tools (nmap, masscan, or rustscan) based on the target type.
                 Analyze the results and identify any security concerns.`,
          maxIterations: 5,
        },
      );

      // Store all findings from Claude's analysis
      const completedMessage = `[Automated Scan] Network scan completed. Processing ${result.toolsUsed.length} tool results...`;
      this.eventsService.emitLog(sessionId, completedMessage);
      await this.updateRunArtifact(runId, completedMessage + '\n');

      // Save tool outputs
      if (result.stdout) {
        await this.updateRunArtifact(runId, `[Automated Scan] Output:\n${result.stdout}\n`);
      }
      if (result.analysis) {
        await this.updateRunArtifact(runId, `[Automated Scan] Analysis:\n${result.analysis}\n`);
      }

      await this.processClaudeResults(sessionId, result, 'NETWORK', 'Automated Network Scan');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Automated scan failed: ${errorMessage}`);
      const errorLog = `[Automated Scan] Error: ${errorMessage}`;
      this.eventsService.emitLog(sessionId, errorLog);
      await this.updateRunArtifact(runId, errorLog + '\n');
      await this.createFinding(sessionId, {
        title: 'Automated Scan Error',
        description: `Automated network scan encountered an error: ${errorMessage}`,
        severity: 'LOW',
        category: 'NETWORK',
        tool: 'Claude MCP',
      });
    }

    await this.prisma.smartScanSession.update({
      where: { id: sessionId },
      data: {
        currentPhase: SmartScanPhase.DEEP_RECONNAISSANCE,
      },
    });

    await this.updateStepStatus(sessionId, 2, SmartScanStepStatus.COMPLETED);
  }

  private async executeDeepReconnaissance(sessionId: string, runId: string) {
    await this.updateStepStatus(sessionId, 3, SmartScanStepStatus.RUNNING, 'Starting deep reconnaissance');

    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Execute reconnaissance via Claude MCP - Claude chooses the best approach
    try {
      this.logger.log(`Executing deep reconnaissance via Claude MCP for target: ${session.target}`);
      const logMessage = `[Deep Reconnaissance] Discovering subdomains and endpoints for ${session.target}...`;
      this.eventsService.emitLog(sessionId, logMessage);
      await this.updateRunArtifact(runId, logMessage + '\n');

      const result = await this.mcpService.executeToolWithClaude(
        'subfinder_scan', // Suggested tool, but Claude can use others
        { domain: session.target },
        session.target,
        {
          task: `Perform deep reconnaissance on ${session.target}.
                 Objective: ${session.objective || 'comprehensive security assessment'}

                 Tasks:
                 1. Enumerate subdomains and related assets
                 2. Discover hidden endpoints and directories
                 3. Identify technologies and frameworks in use
                 4. Map the attack surface

                 Use appropriate reconnaissance tools based on the target type:
                 - For domains: subfinder, amass, httpx
                 - For web apps: gobuster, feroxbuster, katana, hakrawler
                 - For technology detection: wafw00f, httpx with tech-detect

                 Analyze all discovered assets and identify security implications.`,
          maxIterations: 5,
        },
      );

      // Process Claude's analysis and create findings
      const completedMessage = `[Deep Reconnaissance] Reconnaissance completed. Processing results...`;
      this.eventsService.emitLog(sessionId, completedMessage);
      await this.updateRunArtifact(runId, completedMessage + '\n');

      // Save tool outputs
      if (result.stdout) {
        await this.updateRunArtifact(runId, `[Deep Reconnaissance] Output:\n${result.stdout}\n`);
      }
      if (result.analysis) {
        await this.updateRunArtifact(runId, `[Deep Reconnaissance] Analysis:\n${result.analysis}\n`);
      }

      await this.processClaudeResults(sessionId, result, 'RECONNAISSANCE', 'Deep Reconnaissance');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Deep reconnaissance failed: ${errorMessage}`);
      const errorLog = `[Deep Reconnaissance] Error: ${errorMessage}`;
      this.eventsService.emitLog(sessionId, errorLog);
      await this.updateRunArtifact(runId, errorLog + '\n');
      await this.createFinding(sessionId, {
        title: 'Reconnaissance Error',
        description: `Deep reconnaissance encountered an error: ${errorMessage}`,
        severity: 'LOW',
        category: 'RECONNAISSANCE',
        tool: 'Claude MCP',
      });
    }

    await this.prisma.smartScanSession.update({
      where: { id: sessionId },
      data: {
        currentPhase: SmartScanPhase.VULNERABILITY_SCANNING,
      },
    });

    await this.updateStepStatus(sessionId, 3, SmartScanStepStatus.COMPLETED);
  }

  private async executeVulnerabilityScanning(sessionId: string, runId: string) {
    await this.updateStepStatus(sessionId, 4, SmartScanStepStatus.RUNNING, 'Starting vulnerability scanning');

    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Execute vulnerability scanning via Claude MCP - Claude chooses the best approach
    try {
      this.logger.log(`Executing vulnerability scanning via Claude MCP for target: ${session.target}`);
      const logMessage = `[Vulnerability Scanning] Scanning for vulnerabilities on ${session.target}...`;
      this.eventsService.emitLog(sessionId, logMessage);
      await this.updateRunArtifact(runId, logMessage + '\n');

      const result = await this.mcpService.executeToolWithClaude(
        'nuclei_scan', // Suggested tool, but Claude can use others
        { target: session.target },
        session.target,
        {
          task: `Perform comprehensive vulnerability scanning on ${session.target}.
                 Objective: ${session.objective || 'identify security vulnerabilities'}

                 Tasks:
                 1. Scan for known CVEs and security vulnerabilities
                 2. Test for common web vulnerabilities (SQL injection, XSS, etc.)
                 3. Check for misconfigurations and security issues
                 4. Identify outdated software versions with known vulnerabilities

                 Use appropriate vulnerability scanning tools:
                 - For web applications: nikto, nuclei, sqlmap, dalfox, wpscan
                 - For general scanning: nuclei with CVE templates
                 - For specific tests: sqlmap for SQL injection, xsser for XSS

                 Prioritize critical and high severity findings.
                 Provide detailed analysis of each vulnerability found.`,
          maxIterations: 5,
        },
      );

      // Process Claude's analysis and create findings
      const completedMessage = `[Vulnerability Scanning] Vulnerability scan completed. Analyzing findings...`;
      this.eventsService.emitLog(sessionId, completedMessage);
      await this.updateRunArtifact(runId, completedMessage + '\n');

      // Save tool outputs
      if (result.stdout) {
        await this.updateRunArtifact(runId, `[Vulnerability Scanning] Output:\n${result.stdout}\n`);
      }
      if (result.analysis) {
        await this.updateRunArtifact(runId, `[Vulnerability Scanning] Analysis:\n${result.analysis}\n`);
      }

      await this.processClaudeResults(sessionId, result, 'VULNERABILITY', 'Vulnerability Scanning');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Vulnerability scanning failed: ${errorMessage}`);
      const errorLog = `[Vulnerability Scanning] Error: ${errorMessage}`;
      this.eventsService.emitLog(sessionId, errorLog);
      await this.updateRunArtifact(runId, errorLog + '\n');
      await this.createFinding(sessionId, {
        title: 'Vulnerability Scanning Error',
        description: `Vulnerability scanning encountered an error: ${errorMessage}`,
        severity: 'MEDIUM',
        category: 'VULNERABILITY',
        tool: 'Claude MCP',
      });
    }

    await this.prisma.smartScanSession.update({
      where: { id: sessionId },
      data: {
        currentPhase: SmartScanPhase.EXPLOITATION_CHAIN,
      },
    });

    await this.updateStepStatus(sessionId, 4, SmartScanStepStatus.COMPLETED);
  }

  private async executeExploitationChain(sessionId: string, runId: string) {
    await this.updateStepStatus(sessionId, 5, SmartScanStepStatus.RUNNING, 'Analyzing attack chains');

    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
      include: {
        findings: true,
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Use Claude to analyze findings and identify attack chains
    try {
      this.logger.log(`Analyzing attack chains via Claude MCP for target: ${session.target}`);
      const logMessage = `[Attack Chain Analysis] Analyzing ${session.findings.length} findings for attack chains...`;
      this.eventsService.emitLog(sessionId, logMessage);
      await this.updateRunArtifact(runId, logMessage + '\n');

      // Prepare findings summary for Claude
      const findingsSummary = session.findings
        .map(f => `- ${f.title} (${f.severity}): ${f.description?.substring(0, 200)}`)
        .join('\n');

      const result = await this.mcpService.executeToolWithClaude(
        'intelligent_smart_scan', // Suggested tool
        { target: session.target },
        session.target,
        {
          task: `Analyze potential attack chains and exploitation paths for ${session.target}.

                 PREVIOUS FINDINGS FROM THIS ASSESSMENT:
                 ${findingsSummary || 'No previous findings yet'}

                 Tasks:
                 1. Analyze how discovered vulnerabilities could be chained together
                 2. Identify the most critical attack paths
                 3. Assess the potential impact of successful exploitation
                 4. Prioritize remediation based on risk

                 If additional testing would help identify attack chains, you may use
                 appropriate tools to gather more information. Focus on understanding
                 how an attacker could leverage multiple vulnerabilities together.

                 Provide a comprehensive attack chain analysis with remediation priorities.`,
          maxIterations: 3,
        },
      );

      // Process Claude's analysis
      const completedMessage = `[Attack Chain Analysis] Attack chain analysis completed.`;
      this.eventsService.emitLog(sessionId, completedMessage);
      await this.updateRunArtifact(runId, completedMessage + '\n');

      // Save tool outputs
      if (result.stdout) {
        await this.updateRunArtifact(runId, `[Attack Chain Analysis] Output:\n${result.stdout}\n`);
      }
      if (result.analysis) {
        await this.updateRunArtifact(runId, `[Attack Chain Analysis] Analysis:\n${result.analysis}\n`);
      }

      await this.processClaudeResults(sessionId, result, 'EXPLOITATION', 'Attack Chain Analysis');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Attack chain analysis failed: ${errorMessage}`);
      const errorLog = `[Attack Chain Analysis] Error: ${errorMessage}`;
      this.eventsService.emitLog(sessionId, errorLog);
      await this.updateRunArtifact(runId, errorLog + '\n');

      await this.createFinding(sessionId, {
        title: 'Attack Chain Analysis Error',
        description: `Attack chain analysis encountered an error: ${errorMessage}`,
        severity: 'LOW',
        category: 'EXPLOITATION',
        tool: 'Claude MCP',
      });
    }

    await this.prisma.smartScanSession.update({
      where: { id: sessionId },
      data: {
        currentPhase: SmartScanPhase.FINAL_REPORT,
      },
    });

    await this.updateStepStatus(sessionId, 5, SmartScanStepStatus.COMPLETED);
  }

  private async generateFinalReport(sessionId: string, runId: string) {
    await this.updateStepStatus(sessionId, 6, SmartScanStepStatus.RUNNING, 'Generating security report');
    const logMessage = '[Final Report] Compiling findings and generating security report...';
    this.eventsService.emitLog(sessionId, logMessage);
    await this.updateRunArtifact(runId, logMessage + '\n');

    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
      include: {
        findings: true,
      },
    });

    if (!session) {
      throw new Error(`SmartScan session not found: ${sessionId}`);
    }

    // Calculate statistics
    const findings = session.findings;
    const totalVulnerabilities = findings.length;
    const highVulnerabilities = findings.filter(f => f.severity === 'HIGH').length;
    const criticalVulnerabilities = findings.filter(f => f.severity === 'CRITICAL').length;
    
    // Calculate risk score
    let riskScore = 0;
    findings.forEach(finding => {
      switch (finding.severity) {
        case 'CRITICAL':
          riskScore += 10;
          break;
        case 'HIGH':
          riskScore += 7;
          break;
        case 'MEDIUM':
          riskScore += 4;
          break;
        case 'LOW':
          riskScore += 1;
          break;
      }
    });

    // Generate report
    const report = {
      summary: {
        target: session.target,
        totalVulnerabilities,
        highVulnerabilities,
        criticalVulnerabilities,
        riskScore: Math.min(riskScore, 100),
        scanDuration: session.completedAt && session.startedAt
          ? session.completedAt.getTime() - session.startedAt.getTime()
          : 0,
      },
      findings: findings.map(finding => ({
        title: finding.title,
        severity: finding.severity,
        category: finding.category,
        description: finding.description,
        remediation: finding.remediation,
      })),
      recommendations: [
        'Address all critical and high severity vulnerabilities immediately',
        'Implement proper input validation to prevent injection attacks',
        'Regularly update and patch all systems and applications',
        'Conduct regular security assessments and penetration testing',
      ],
    };

    await this.prisma.smartScanSession.update({
      where: { id: sessionId },
      data: {
        report,
        totalVulnerabilities,
        highVulnerabilities,
        criticalVulnerabilities,
        riskScore: Math.min(riskScore, 100),
      },
    });

    // Save report summary to artifact
    const reportSummary = `
[Final Report] ============================================
Target: ${session.target}
Total Vulnerabilities: ${totalVulnerabilities}
  - Critical: ${criticalVulnerabilities}
  - High: ${highVulnerabilities}
  - Medium: ${findings.filter(f => f.severity === 'MEDIUM').length}
  - Low: ${findings.filter(f => f.severity === 'LOW').length}
  - Info: ${findings.filter(f => f.severity === 'INFO').length}
Risk Score: ${Math.min(riskScore, 100)}/100
============================================
`;
    await this.updateRunArtifact(runId, reportSummary);

    // Create RunAnalysis record for the AI Analysis tab
    const analysisSummary = `Smart Scan Security Assessment for ${session.target}

Risk Score: ${Math.min(riskScore, 100)}/100

Vulnerabilities Found:
- Critical: ${criticalVulnerabilities}
- High: ${highVulnerabilities}
- Medium: ${findings.filter(f => f.severity === 'MEDIUM').length}
- Low: ${findings.filter(f => f.severity === 'LOW').length}
- Info: ${findings.filter(f => f.severity === 'INFO').length}

Total: ${totalVulnerabilities} findings`;

    const observations = findings.slice(0, 10).map(f =>
      `[${f.severity}] ${f.title}: ${f.description?.substring(0, 100) || 'No description'}...`
    );

    if (findings.length > 10) {
      observations.push(`... and ${findings.length - 10} more findings`);
    }

    await this.prisma.runAnalysis.create({
      data: {
        runId,
        summary: analysisSummary,
        observations: observations.length > 0 ? observations : ['No significant findings detected'],
        recommendations: report.recommendations,
        rawResponse: JSON.parse(JSON.stringify(report)),
        modelUsed: 'Smart Scan AI Engine',
        tokensUsed: 0,
        processingTime: session.startedAt
          ? Date.now() - new Date(session.startedAt).getTime()
          : 0,
      },
    });

    // Sync SmartScanFindings to the Finding table for the runs/findings pages
    // First delete any existing findings for this run to avoid duplicates
    await this.prisma.finding.deleteMany({
      where: { runId },
    });

    // Create Finding records from SmartScanFindings
    for (const finding of findings) {
      await this.prisma.finding.create({
        data: {
          runId,
          title: finding.title,
          description: finding.description || '',
          severity: finding.severity as 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
          confidence: finding.confidence || 0.8,
          cweId: null,
          owaspId: null,
          evidence: finding.evidence || null,
          remediation: finding.remediation || null,
          references: finding.references || [],
        },
      });
    }

    this.logger.log(`Synced ${findings.length} findings to Finding table for run ${runId}`);

    await this.updateStepStatus(sessionId, 6, SmartScanStepStatus.COMPLETED);
  }

  private async updateStepStatus(
    sessionId: string,
    stepNumber: number,
    status: SmartScanStepStatus,
    message?: string,
  ) {
    // Get the step to access phase information
    const step = await this.prisma.smartScanStep.findFirst({
      where: { sessionId, stepNumber },
    });

    const updateData: {
      status: SmartScanStepStatus;
      startedAt?: Date;
      completedAt?: Date;
      error?: string;
      errorImpact?: string;
      errorSolution?: string;
    } = { status };

    if (status === SmartScanStepStatus.RUNNING) {
      updateData.startedAt = new Date();
    } else if (status === SmartScanStepStatus.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (status === SmartScanStepStatus.FAILED || status === SmartScanStepStatus.TIMEOUT) {
      updateData.completedAt = new Date();
      if (message) {
        updateData.error = message;
      }
      // Compute error impact and solution
      if (step) {
        updateData.errorImpact = computeErrorImpact(step.phase, status, step.tool || undefined);
        updateData.errorSolution = generateErrorSolution(status, message || null, step.tool || undefined);
      }
    }

    await this.prisma.smartScanStep.updateMany({
      where: {
        sessionId,
        stepNumber,
      },
      data: updateData,
    });

    // Emit step update event
    this.eventsService.emitStepUpdate(sessionId, stepNumber, status, message);

    // Update overall progress
    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
      include: {
        steps: true,
      },
    });

    if (!session) {
      throw new Error(`SmartScan session not found: ${sessionId}`);
    }

    const totalSteps = session.steps.length;
    const completedSteps = session.steps.filter(step =>
      step.status === SmartScanStepStatus.COMPLETED
    ).length;
    const progress = (completedSteps / totalSteps) * 100;

    await this.prisma.smartScanSession.update({
      where: { id: sessionId },
      data: { progress },
    });

    // Emit progress update event
    this.eventsService.emitProgressUpdate(
      sessionId,
      progress,
      session.currentPhase || '',
    );
  }

  private async createFinding(sessionId: string, findingData: {
    title: string;
    description: string;
    severity: string;
    category?: string;
    tool?: string;
    target?: string;
    evidence?: string;
    exploitation?: string;
    remediation?: string;
    verification?: string;
    cveId?: string | null;
    cweId?: string | null;
    location?: string | null;
    references?: string[];
  }) {
    // Try to extract CVE/CWE from evidence or description if not provided
    const combinedText = `${findingData.description || ''} ${findingData.evidence || ''}`;
    const cveId = findingData.cveId ?? extractFirstCveId(combinedText);
    const cweId = findingData.cweId ?? extractFirstCweId(combinedText);
    const location = findingData.location ?? extractLocation(findingData.evidence || '', findingData.target || '');

    const finding = await this.prisma.smartScanFinding.create({
      data: {
        sessionId,
        title: findingData.title,
        description: findingData.description,
        severity: findingData.severity as 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        category: findingData.category,
        tool: findingData.tool,
        target: findingData.target,
        evidence: findingData.evidence,
        exploitation: findingData.exploitation,
        remediation: findingData.remediation,
        verification: findingData.verification,
        cveId,
        cweId,
        location,
        references: findingData.references || [],
      },
    });

    // Emit finding added event
    this.eventsService.emitFindingAdded(sessionId, {
      title: findingData.title,
      severity: findingData.severity,
      category: findingData.category || 'GENERAL',
    });

    return finding;
  }

  /**
   * Process Claude's MCP tool execution results and create findings
   */
  private async processClaudeResults(
    sessionId: string,
    result: { analysis: string; toolsUsed: Array<{ name: string; params: Record<string, unknown>; result: string; duration: number }>; tokensUsed: number; stdout: string; stderr: string },
    category: string,
    phaseTitle: string,
  ) {
    // Get session target for findings
    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
      select: { target: true },
    });
    const target = session?.target || '';

    // Determine severity based on analysis content
    const analysisLower = result.analysis.toLowerCase();
    let maxSeverity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'INFO';

    if (analysisLower.includes('critical') || analysisLower.includes('rce') || analysisLower.includes('remote code')) {
      maxSeverity = 'CRITICAL';
    } else if (analysisLower.includes('high') || analysisLower.includes('sql injection') || analysisLower.includes('xss')) {
      maxSeverity = 'HIGH';
    } else if (analysisLower.includes('medium') || analysisLower.includes('open port') || analysisLower.includes('vulnerability')) {
      maxSeverity = 'MEDIUM';
    } else if (analysisLower.includes('low') || analysisLower.includes('information disclosure')) {
      maxSeverity = 'LOW';
    }

    // Create main finding with Claude's analysis
    if (result.analysis && result.analysis.trim()) {
      await this.createFinding(sessionId, {
        title: `${phaseTitle} - Security Analysis`,
        description: result.analysis.substring(0, 2000),
        severity: maxSeverity,
        category,
        tool: 'Claude AI with HexStrike MCP',
        target,
        evidence: result.stdout.substring(0, 5000),
        exploitation: this.extractExploitation(result.analysis),
        remediation: this.extractRemediation(result.analysis),
        verification: this.extractVerification(result.analysis),
      });
    }

    // Log tools used
    if (result.toolsUsed.length > 0) {
      this.logger.log(`${phaseTitle}: Used ${result.toolsUsed.length} tools - ${result.toolsUsed.map(t => t.name).join(', ')}`);

      // Create a finding for each tool's specific output if it contains important info
      for (const tool of result.toolsUsed) {
        if (tool.result && tool.result.length > 100) {
          const toolResultLower = tool.result.toLowerCase();
          if (toolResultLower.includes('vulnerable') || toolResultLower.includes('critical') || toolResultLower.includes('warning')) {
            await this.createFinding(sessionId, {
              title: `${tool.name} - Findings`,
              description: `Tool ${tool.name} detected potential issues`,
              severity: toolResultLower.includes('critical') ? 'CRITICAL' : toolResultLower.includes('vulnerable') ? 'HIGH' : 'MEDIUM',
              category,
              tool: tool.name,
              target,
              evidence: tool.result.substring(0, 3000),
              exploitation: this.extractExploitation(tool.result),
              remediation: this.extractRemediation(tool.result),
              verification: this.extractVerification(tool.result),
            });
          }
        }
      }
    }
  }

  /**
   * Extract remediation advice from Claude's analysis
   */
  private extractRemediation(analysis: string): string {
    const remediationPatterns = [
      /remediation[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /recommendation[s]?[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /fix[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /mitigation[:\s]*([\s\S]*?)(?:\n\n|$)/i,
    ];

    for (const pattern of remediationPatterns) {
      const match = analysis.match(pattern);
      if (match && match[1]) {
        return match[1].trim().substring(0, 1000);
      }
    }

    return 'Review the findings and apply appropriate security controls based on the analysis.';
  }

  /**
   * Extract exploitation details from Claude's analysis
   */
  private extractExploitation(analysis: string): string {
    const exploitationPatterns = [
      /exploitation[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /attack vector[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /how to exploit[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /poc[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /proof of concept[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /exploit[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /impact[:\s]*([\s\S]*?)(?:\n\n|$)/i,
    ];

    for (const pattern of exploitationPatterns) {
      const match = analysis.match(pattern);
      if (match && match[1]) {
        return match[1].trim().substring(0, 1500);
      }
    }

    return '';
  }

  /**
   * Extract verification commands from Claude's analysis
   */
  private extractVerification(analysis: string): string {
    const verificationPatterns = [
      /verification[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /verify[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /test command[s]?[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /validation[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /check[:\s]*([\s\S]*?)(?:\n\n|$)/i,
      /confirm[:\s]*([\s\S]*?)(?:\n\n|$)/i,
    ];

    for (const pattern of verificationPatterns) {
      const match = analysis.match(pattern);
      if (match && match[1]) {
        return match[1].trim().substring(0, 1500);
      }
    }

    return '';
  }

  private async handleScanFailure(sessionId: string, error: Error) {
    await this.prisma.smartScanSession.update({
      where: { id: sessionId },
      data: {
        status: SmartScanStatus.FAILED,
        completedAt: new Date(),
      },
    });

    // Also update the associated Run status to keep them in sync
    const run = await this.prisma.run.findFirst({
      where: {
        params: {
          path: ['smartScanSessionId'],
          equals: sessionId,
        },
      },
    });

    if (run && run.status !== 'FAILED' && run.status !== 'COMPLETED') {
      await this.prisma.run.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: error.message,
        },
      });
      this.runsEventsService.emitFailed(run.id, error.message);
    }

    // Mark current step as failed
    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
      include: {
        steps: {
          where: { status: SmartScanStepStatus.RUNNING },
        },
      },
    });

    if (!session) {
      throw new Error(`SmartScan session not found: ${sessionId}`);
    }

    if (session.steps.length > 0) {
      await this.prisma.smartScanStep.update({
        where: { id: session.steps[0].id },
        data: {
          status: SmartScanStepStatus.FAILED,
          error: error.message,
        },
      });

      // Emit step failure event
      this.eventsService.emitStepUpdate(
        sessionId,
        session.steps[0].stepNumber,
        SmartScanStepStatus.FAILED,
        error.message,
      );
    }

    // Emit scan failed event
    this.eventsService.emitScanFailed(sessionId, error.message);
    this.eventsService.emitLog(sessionId, `Scan failed: ${error.message}`);
  }

  /**
   * Delete a specific finding from a scan session
   */
  async deleteFinding(sessionId: string, findingId: string, userId: string) {
    // Verify ownership
    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session) {
      throw new Error('SmartScan session not found');
    }

    if (session.userId !== userId) {
      throw new Error('Unauthorized access to SmartScan session');
    }

    // Verify the finding belongs to this session
    const finding = await this.prisma.smartScanFinding.findFirst({
      where: {
        id: findingId,
        sessionId,
      },
    });

    if (!finding) {
      throw new Error('Finding not found in this session');
    }

    // Delete the finding
    await this.prisma.smartScanFinding.delete({
      where: { id: findingId },
    });

    // Recalculate session statistics
    await this.recalculateSessionStats(sessionId);

    this.logger.log(`Deleted finding ${findingId} from session ${sessionId}`);

    return { success: true, message: 'Finding deleted successfully' };
  }

  /**
   * Delete all findings from a specific tool in a scan session
   */
  async deleteToolResults(sessionId: string, tool: string, userId: string) {
    // Verify ownership
    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session) {
      throw new Error('SmartScan session not found');
    }

    if (session.userId !== userId) {
      throw new Error('Unauthorized access to SmartScan session');
    }

    // Delete all findings from the specified tool
    const deleteResult = await this.prisma.smartScanFinding.deleteMany({
      where: {
        sessionId,
        tool,
      },
    });

    // Recalculate session statistics
    await this.recalculateSessionStats(sessionId);

    this.logger.log(`Deleted ${deleteResult.count} findings from tool ${tool} in session ${sessionId}`);

    return {
      success: true,
      message: `Deleted ${deleteResult.count} findings from ${tool}`,
      deletedCount: deleteResult.count,
    };
  }

  /**
   * Generate AI-powered security recommendations for a smart scan session
   */
  async generateRecommendations(sessionId: string, userId: string) {
    const session = await this.getScan(sessionId, userId);

    if (session.status !== SmartScanStatus.COMPLETED) {
      throw new Error('Cannot generate recommendations for incomplete scan');
    }

    // Check if we have cached recommendations
    const report = session.report as {
      summary?: {
        target?: string;
        totalVulnerabilities?: number;
        criticalVulnerabilities?: number;
        highVulnerabilities?: number;
        riskScore?: number;
      };
      recommendations?: string[];
      aiRecommendations?: {
        recommendations: Array<{
          id: string;
          priority: string;
          title: string;
          description: string;
          category: string;
          affectedFindings: string[];
          steps: string[];
          effort: string;
          impact: string;
        }>;
        executiveSummary: string;
        generatedAt: string;
      };
    } | null;

    // Return cached recommendations if they exist
    if (report?.aiRecommendations) {
      this.logger.log(`Returning cached AI recommendations for session ${sessionId}`);
      return report.aiRecommendations;
    }

    // Generate new recommendations using Claude
    const findings = session.findings.map((f) => ({
      title: f.title,
      description: f.description || '',
      severity: f.severity,
      category: f.category || undefined,
      tool: f.tool || undefined,
      remediation: f.remediation || undefined,
    }));

    const scanSummary = {
      totalVulnerabilities: session.totalVulnerabilities || session.findings.length,
      criticalVulnerabilities: session.criticalVulnerabilities || 0,
      highVulnerabilities: session.highVulnerabilities || 0,
      riskScore: session.riskScore || 0,
    };

    this.logger.log(`Generating AI recommendations for session ${sessionId}`);

    try {
      // Access ClaudeService through McpService
      const claudeService = (this.mcpService as unknown as { claude: { generateRecommendations: (target: string, findings: Array<{ title: string; description: string; severity: string; category?: string; tool?: string; remediation?: string }>, summary: { totalVulnerabilities: number; criticalVulnerabilities: number; highVulnerabilities: number; riskScore: number }) => Promise<{ recommendations: Array<{ id: string; priority: string; title: string; description: string; category: string; affectedFindings: string[]; steps: string[]; effort: string; impact: string }>; executiveSummary: string; tokensUsed: number }> } }).claude;

      const result = await claudeService.generateRecommendations(
        session.target,
        findings,
        scanSummary,
      );

      const aiRecommendations = {
        recommendations: result.recommendations,
        executiveSummary: result.executiveSummary,
        generatedAt: new Date().toISOString(),
      };

      // Cache the recommendations in the session report
      const updatedReport = {
        ...(report || {}),
        aiRecommendations,
      };

      await this.prisma.smartScanSession.update({
        where: { id: sessionId },
        data: { report: updatedReport },
      });

      this.logger.log(`AI recommendations generated and cached for session ${sessionId}`);

      return aiRecommendations;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to generate AI recommendations: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Recalculate session statistics after findings are modified
   */
  private async recalculateSessionStats(sessionId: string) {
    const findings = await this.prisma.smartScanFinding.findMany({
      where: { sessionId },
    });

    const totalVulnerabilities = findings.length;
    const highVulnerabilities = findings.filter(f => f.severity === 'HIGH').length;
    const criticalVulnerabilities = findings.filter(f => f.severity === 'CRITICAL').length;

    // Recalculate risk score
    let riskScore = 0;
    findings.forEach(finding => {
      switch (finding.severity) {
        case 'CRITICAL':
          riskScore += 10;
          break;
        case 'HIGH':
          riskScore += 7;
          break;
        case 'MEDIUM':
          riskScore += 4;
          break;
        case 'LOW':
          riskScore += 1;
          break;
      }
    });

    // Update session statistics
    await this.prisma.smartScanSession.update({
      where: { id: sessionId },
      data: {
        totalVulnerabilities,
        highVulnerabilities,
        criticalVulnerabilities,
        riskScore: Math.min(riskScore, 100),
      },
    });

    // Update report if it exists
    const session = await this.prisma.smartScanSession.findUnique({
      where: { id: sessionId },
      select: { report: true },
    });

    if (session?.report) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const report = session.report as any;
      if (report.summary) {
        report.summary.totalVulnerabilities = totalVulnerabilities;
        report.summary.highVulnerabilities = highVulnerabilities;
        report.summary.criticalVulnerabilities = criticalVulnerabilities;
        report.summary.riskScore = Math.min(riskScore, 100);
      }
      report.findings = findings.map(f => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        category: f.category,
        description: f.description,
        remediation: f.remediation,
        tool: f.tool,
      }));

      await this.prisma.smartScanSession.update({
        where: { id: sessionId },
        data: { report: JSON.parse(JSON.stringify(report)) },
      });
    }

    // Also sync to the Finding table for the runs/findings pages
    const run = await this.prisma.run.findFirst({
      where: {
        params: {
          path: ['smartScanSessionId'],
          equals: sessionId,
        },
      },
    });

    if (run) {
      // Delete existing findings and recreate
      await this.prisma.finding.deleteMany({
        where: { runId: run.id },
      });

      for (const finding of findings) {
        await this.prisma.finding.create({
          data: {
            runId: run.id,
            title: finding.title,
            description: finding.description || '',
            severity: finding.severity as 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
            confidence: finding.confidence || 0.8,
            cweId: null,
            owaspId: null,
            evidence: finding.evidence || null,
            remediation: finding.remediation || null,
            references: finding.references || [],
          },
        });
      }

      this.logger.log(`Synced ${findings.length} findings to Finding table after stats recalculation`);
    }
  }
}