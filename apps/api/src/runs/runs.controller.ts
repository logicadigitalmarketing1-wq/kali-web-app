import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RunsService } from './runs.service';
import { AuthGuard } from '../auth/auth.guard';
import { Permissions, CurrentUser, UserId } from '../auth/decorators';

@ApiTags('runs')
@Controller('runs')
@UseGuards(AuthGuard)
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post()
  @ApiOperation({ summary: 'Execute a tool' })
  @Permissions('runs:write')
  async create(
    @UserId() userId: string,
    @Body() body: {
      toolId: string;
      scopeId: string;
      parameters: Record<string, unknown>;
    },
  ) {
    return this.runsService.create({
      userId,
      toolId: body.toolId,
      scopeId: body.scopeId,
      parameters: body.parameters,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List runs' })
  @ApiQuery({ name: 'toolId', required: false })
  @ApiQuery({ name: 'scopeId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @Permissions('runs:read')
  async findAll(
    @UserId() userId: string,
    @Query('toolId') toolId?: string,
    @Query('scopeId') scopeId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.runsService.findAll(userId, {
      toolId,
      scopeId,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get run details' })
  @Permissions('runs:read')
  async findOne(@Param('id') id: string, @UserId() userId: string) {
    return this.runsService.findOne(id, userId);
  }

  @Post(':id/callback')
  @ApiOperation({ summary: 'Callback from executor (internal)' })
  async executorCallback(
    @Param('id') id: string,
    @Body() result: {
      success: boolean;
      exitCode: number | null;
      stdout: string;
      stderr: string;
      durationMs: number;
      containerId?: string;
      error?: string;
    },
  ) {
    // TODO: Add authentication for executor callback
    return this.runsService.updateFromExecutor(id, result);
  }
}
