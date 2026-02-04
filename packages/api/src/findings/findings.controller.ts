import { Controller, Get, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { FindingsService } from './findings.service';
import { Severity } from '@prisma/client';
import { SessionGuard } from '../common/guards/session.guard';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Controller('findings')
@UseGuards(SessionGuard)
export class FindingsController {
  constructor(private readonly findingsService: FindingsService) {}

  @Get()
  async findAll(
    @Query('severity') severity?: Severity,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('toolId') toolId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.findingsService.findAll({
      severity,
      status,
      userId,
      toolId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('stats')
  async getStats(@Query('userId') userId?: string) {
    return this.findingsService.getStats(userId);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.findingsService.updateStatus(id, status);
  }

  @Delete(':id')
  async deleteFinding(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.findingsService.delete(id, req.user.id);
  }
}
