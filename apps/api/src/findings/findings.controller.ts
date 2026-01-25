import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FindingsService } from './findings.service';
import { AuthGuard } from '../auth/auth.guard';
import { Permissions, UserId } from '../auth/decorators';

@ApiTags('findings')
@Controller('findings')
@UseGuards(AuthGuard)
export class FindingsController {
  constructor(private readonly findingsService: FindingsService) {}

  @Get()
  @ApiOperation({ summary: 'List findings' })
  @ApiQuery({ name: 'runId', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @Permissions('findings:read')
  async findAll(
    @UserId() userId: string,
    @Query('runId') runId?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.findingsService.findAll(userId, {
      runId,
      severity,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get severity statistics' })
  @Permissions('findings:read')
  async getStats(@UserId() userId: string) {
    return this.findingsService.getSeverityStats(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get finding details' })
  @Permissions('findings:read')
  async findOne(@Param('id') id: string, @UserId() userId: string) {
    return this.findingsService.findOne(id, userId);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update finding status' })
  @Permissions('findings:write')
  async updateStatus(
    @Param('id') id: string,
    @UserId() userId: string,
    @Body('status') status: string,
  ) {
    return this.findingsService.updateStatus(id, userId, status);
  }

  @Post(':id/tags')
  @ApiOperation({ summary: 'Add tag to finding' })
  @Permissions('findings:write')
  async addTag(
    @Param('id') id: string,
    @UserId() userId: string,
    @Body('tag') tag: string,
  ) {
    return this.findingsService.addTag(id, userId, tag);
  }

  @Delete(':id/tags/:tag')
  @ApiOperation({ summary: 'Remove tag from finding' })
  @Permissions('findings:write')
  async removeTag(
    @Param('id') id: string,
    @Param('tag') tag: string,
    @UserId() userId: string,
  ) {
    return this.findingsService.removeTag(id, userId, tag);
  }
}
