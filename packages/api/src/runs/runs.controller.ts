import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Res,
  Logger,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Subscription } from 'rxjs';
import { RunsService } from './runs.service';
import { RunsEventsService, RunStreamEvent } from './runs-events.service';
import { ToolsService } from '../tools/tools.service';
import { McpService } from '../mcp/mcp.service';
import { CreateRunDto, QueryRunsDto, RunIdParamDto } from './dto';
import { ScopeGuard } from '../common/guards';
import { CurrentUser, AuthenticatedUser, Roles } from '../common/decorators';

@Controller('runs')
export class RunsController {
  private readonly logger = new Logger(RunsController.name);

  constructor(
    private readonly runsService: RunsService,
    private readonly runsEventsService: RunsEventsService,
    private readonly toolsService: ToolsService,
    private readonly mcpService: McpService,
  ) {}

  @Post()
  @UseGuards(ScopeGuard)
  @Roles('ENGINEER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateRunDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Resolve tool from slug
    const tool = await this.toolsService.findBySlug(dto.toolSlug);
    if (!tool) {
      throw new NotFoundException(`Tool "${dto.toolSlug}" not found`);
    }

    if (!tool.isEnabled) {
      throw new BadRequestException(`Tool "${dto.toolSlug}" is currently disabled`);
    }

    // Get active manifest
    const manifest = tool.manifests?.[0];
    if (!manifest) {
      throw new BadRequestException(`Tool "${dto.toolSlug}" has no active manifest`);
    }

    return this.runsService.create({
      userId: user.id,
      toolId: tool.id,
      manifestId: manifest.id,
      scopeId: dto.scopeId,
      params: dto.params,
      target: dto.target,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findByUser(
    @Query() query: QueryRunsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Admin can see all runs, others see only their own
    const userId = user.role === 'ADMIN' ? undefined : user.id;

    return this.runsService.findByUser(userId, {
      limit: query.limit,
      offset: query.offset,
      status: query.status,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(
    @Param() params: RunIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const run = await this.runsService.findById(params.id);

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    // Check ownership (Admin can see all)
    if (user.role !== 'ADMIN' && run.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this run');
    }

    return run;
  }

  /**
   * Manual SSE implementation for Fastify compatibility.
   * The @Sse decorator has issues with Fastify, so we handle SSE manually.
   */
  @Get(':id/stream')
  async streamRun(
    @Param() params: RunIdParamDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const runId = params.id;
    this.logger.log(`[SSE] Client connecting to stream for run ${runId}`);

    // Set SSE headers manually on the raw response
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'http://localhost:3253',
      'Access-Control-Allow-Credentials': 'true',
    });

    // Track if stream is still writable
    let isStreamClosed = false;

    // Helper to send SSE event (only if stream is open)
    const sendEvent = (data: unknown) => {
      if (isStreamClosed) return;
      try {
        const jsonData = JSON.stringify(data);
        raw.write(`data: ${jsonData}\n\n`);
      } catch (err) {
        this.logger.warn(`[SSE] Failed to write to stream for run ${runId}: ${err}`);
        isStreamClosed = true;
      }
    };

    // Subscribe to real-time events
    let eventSubscription: Subscription | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let isCompleted = false;

    const cleanup = () => {
      this.logger.log(`[SSE] Cleaning up stream for run ${runId}`);
      if (eventSubscription) {
        eventSubscription.unsubscribe();
        eventSubscription = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    // Handle client disconnect
    raw.on('close', () => {
      this.logger.log(`[SSE] Client disconnected from run ${runId}`);
      isStreamClosed = true;
      cleanup();
    });

    // Subscribe to real-time events from RunsEventsService
    const events$ = this.runsEventsService.getEvents(runId);
    eventSubscription = events$.subscribe({
      next: (event: RunStreamEvent) => {
        this.logger.debug(`[SSE] Sending ${event.type} event to client for run ${runId}`);
        sendEvent(event);

        // Close stream on terminal events
        if (event.type === 'completed' || event.type === 'failed') {
          isCompleted = true;
          isStreamClosed = true;
          this.logger.log(`[SSE] Run ${runId} finished, closing stream`);
          cleanup();
          raw.end();
        }
      },
      error: (err) => {
        this.logger.error(`[SSE] Error in event stream for run ${runId}:`, err);
        sendEvent({ type: 'error', data: { error: err.message } });
        isStreamClosed = true;
        cleanup();
        raw.end();
      },
    });

    // Poll for status every 2 seconds (backup mechanism)
    pollInterval = setInterval(async () => {
      if (isCompleted) {
        cleanup();
        return;
      }

      try {
        const run = await this.runsService.findById(runId);
        if (run) {
          sendEvent({ type: 'status', run: { id: run.id, status: run.status } });

          // Stop polling if run is complete
          if (run.status !== 'RUNNING' && run.status !== 'PENDING') {
            isCompleted = true;
            isStreamClosed = true;
            this.logger.log(`[SSE] Run ${runId} status is ${run.status}, closing stream`);
            cleanup();
            raw.end();
          }
        }
      } catch (err) {
        this.logger.error(`[SSE] Error polling status for run ${runId}:`, err);
      }
    }, 2000);

    // Send initial connection event
    sendEvent({ type: 'connected', runId });
    this.logger.log(`[SSE] Stream established for run ${runId}`);
  }

  /**
   * Trigger reanalysis of a completed run using Claude AI.
   * This regenerates the AI analysis and findings for a run.
   */
  @Post(':id/reanalyze')
  @Roles('ENGINEER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async reanalyze(
    @Param() params: RunIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const run = await this.runsService.findById(params.id);

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    // Check ownership (Admin can reanalyze all)
    if (user.role !== 'ADMIN' && run.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this run');
    }

    if (run.status !== 'COMPLETED') {
      throw new BadRequestException('Can only reanalyze completed runs');
    }

    // Get stdout artifact
    const stdout = run.artifacts?.find((a) => a.type === 'stdout');
    if (!stdout || !stdout.content) {
      throw new BadRequestException('No output available for analysis');
    }

    this.logger.log(`[Reanalyze] Starting reanalysis for run ${params.id}`);

    // Call Claude to analyze
    await this.mcpService.analyzeResults(params.id);

    this.logger.log(`[Reanalyze] Completed reanalysis for run ${params.id}`);

    // Return the updated run with new analysis
    return this.runsService.findById(params.id);
  }

  /**
   * Stop a running or pending run.
   * This cancels the job and resets HexStrike for a clean state.
   */
  @Post(':id/stop')
  @Roles('ENGINEER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async stopRun(
    @Param() params: RunIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const run = await this.runsService.findById(params.id);

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    // Check ownership (Admin can stop all)
    if (user.role !== 'ADMIN' && run.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this run');
    }

    if (run.status !== 'PENDING' && run.status !== 'RUNNING') {
      throw new BadRequestException(`Cannot stop run with status ${run.status}`);
    }

    this.logger.log(`[Stop] Stopping run ${params.id}`);

    return this.runsService.stop(params.id, user.id);
  }

  /**
   * Generate AI recommendations for a completed run.
   * Uses Claude AI to analyze findings and generate actionable recommendations.
   */
  @Get(':id/recommendations')
  @Roles('ENGINEER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async getRecommendations(
    @Param() params: RunIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const run = await this.runsService.findById(params.id);

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    // Check ownership (Admin can see all)
    if (user.role !== 'ADMIN' && run.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this run');
    }

    if (run.status !== 'COMPLETED') {
      throw new BadRequestException('Can only generate recommendations for completed runs');
    }

    this.logger.log(`[Recommendations] Generating AI recommendations for run ${params.id}`);

    return this.runsService.generateRecommendations(params.id, user.id);
  }

  /**
   * Delete a run and all its associated data (artifacts, findings, analysis).
   * If the run is still active, it will be stopped first.
   */
  @Delete(':id')
  @Roles('ENGINEER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async deleteRun(
    @Param() params: RunIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const run = await this.runsService.findById(params.id);

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    // Check ownership (Admin can delete all)
    if (user.role !== 'ADMIN' && run.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this run');
    }

    this.logger.log(`[Delete] Deleting run ${params.id}`);

    return this.runsService.delete(params.id, user.id, user.role === 'ADMIN');
  }
}
