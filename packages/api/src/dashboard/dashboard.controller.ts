import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats() {
    return this.dashboardService.getStats();
  }
}
