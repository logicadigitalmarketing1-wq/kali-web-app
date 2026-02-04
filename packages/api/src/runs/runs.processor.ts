import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { McpService } from '../mcp/mcp.service';
import { RunsEventsService } from './runs-events.service';

@Processor('runs')
export class RunsProcessor extends WorkerHost {
  private readonly logger = new Logger(RunsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mcpService: McpService,
    private readonly runsEventsService: RunsEventsService,
  ) {
    super();
  }

  async process(job: Job<{ runId: string }>) {
    const { runId } = job.data;

    // Get run details
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        manifest: true,
        scope: true,
        tool: true,
      },
    });

    if (!run || !run.manifest) {
      throw new Error('Run or manifest not found');
    }

    // Update status to running
    await this.prisma.run.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    // Emit init event for streaming clients
    this.runsEventsService.emitInit(runId);

    // Accumulate output for real-time updates
    let accumulatedOutput = '';
    let artifactId: string | null = null;
    let lastUpdateTime = Date.now();

    // Helper to update/create stdout artifact
    const updateOutputArtifact = async (output: string) => {
      if (artifactId) {
        await this.prisma.runArtifact.update({
          where: { id: artifactId },
          data: {
            content: output,
            size: Buffer.byteLength(output, 'utf8'),
          },
        });
      } else {
        const artifact = await this.prisma.runArtifact.create({
          data: {
            runId,
            type: 'stdout',
            content: output,
            mimeType: 'text/plain',
            size: Buffer.byteLength(output, 'utf8'),
          },
        });
        artifactId = artifact.id;
      }
    };

    try {
      this.logger.log(`Executing tool ${run.manifest.binary} via Claude MCP for run ${runId}`);

      // Execute via Claude with HexStrike MCP tools (streaming version)
      const startTime = Date.now();
      const result = await this.mcpService.executeToolWithClaudeStreaming(
        run.manifest.binary,
        run.params as Record<string, unknown>,
        run.target,
        {
          commandTemplate: run.manifest.commandTemplate,
          timeout: run.manifest.timeout,
        },
        {
          onOutput: async (chunk) => {
            accumulatedOutput += chunk;
            this.runsEventsService.emitOutput(runId, chunk);

            // Update artifact every 500ms or when we get significant output
            const now = Date.now();
            if (now - lastUpdateTime > 500 || chunk.length > 1000) {
              lastUpdateTime = now;
              await updateOutputArtifact(accumulatedOutput);
            }
          },
          onToolStart: (toolName, toolIndex, totalTools) => {
            this.runsEventsService.emitToolStart(runId, toolName, toolIndex, totalTools);
          },
          onToolComplete: (toolName, duration) => {
            this.runsEventsService.emitToolComplete(runId, toolName, duration);
          },
          onProgress: (progress, phase) => {
            this.runsEventsService.emitProgress(runId, progress, phase);
          },
        },
        {
          task: `Execute ${run.tool?.name || run.manifest.binary} security scan on target ${run.target}`,
          maxIterations: 5,
        },
      );
      const duration = Math.round((Date.now() - startTime) / 1000);

      // Final update to stdout artifact with complete output
      if (result.stdout || accumulatedOutput) {
        const finalOutput = result.stdout || accumulatedOutput;
        await updateOutputArtifact(finalOutput);
      }

      // Store stderr artifact
      if (result.stderr) {
        await this.prisma.runArtifact.create({
          data: {
            runId,
            type: 'stderr',
            content: result.stderr,
            mimeType: 'text/plain',
            size: Buffer.byteLength(result.stderr, 'utf8'),
          },
        });
      }

      // Store Claude analysis as artifact
      if (result.analysis) {
        await this.prisma.runArtifact.create({
          data: {
            runId,
            type: 'analysis',
            content: result.analysis,
            mimeType: 'text/markdown',
            size: Buffer.byteLength(result.analysis, 'utf8'),
          },
        });
      }

      // Store tools used metadata
      if (result.toolsUsed.length > 0) {
        await this.prisma.runArtifact.create({
          data: {
            runId,
            type: 'tools_metadata',
            content: JSON.stringify(result.toolsUsed, null, 2),
            mimeType: 'application/json',
            size: Buffer.byteLength(JSON.stringify(result.toolsUsed), 'utf8'),
          },
        });
      }

      // Determine exit code based on tool results
      const hasErrors = result.toolsUsed.some(t => t.result.includes('Error:'));
      const exitCode = hasErrors ? 1 : 0;

      // Update run status
      await this.prisma.run.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          exitCode,
          duration,
        },
      });

      // Store Claude analysis in RunAnalysis table (even if Claude was unavailable)
      if (result.analysis && result.analysis !== 'Analysis not available') {
        await this.prisma.runAnalysis.create({
          data: {
            runId,
            summary: result.analysis.substring(0, 500),
            observations: result.toolsUsed.map(t => `${t.name}: executed in ${t.duration}ms`),
            recommendations: ['Review the analysis above for detailed findings'],
            rawResponse: JSON.parse(JSON.stringify({
              analysis: result.analysis,
              toolsUsed: result.toolsUsed,
            })),
            modelUsed: result.tokensUsed > 0
              ? (process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514')
              : 'none (Claude unavailable)',
            tokensUsed: result.tokensUsed,
            processingTime: duration * 1000,
          },
        });
      }

      this.logger.log(`Run ${runId} completed: ${result.toolsUsed.length} tools used, ${result.tokensUsed} tokens`);

      // Emit completed event for streaming clients
      this.runsEventsService.emitCompleted(runId, duration);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Run ${runId} failed: ${errorMessage}`);

      // Emit failed event for streaming clients
      this.runsEventsService.emitFailed(runId, errorMessage);
      await this.prisma.run.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }
}
