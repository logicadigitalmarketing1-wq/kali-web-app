import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HexStrikeService } from '../mcp/hexstrike.service';
import { Public } from '../common/decorators';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hexstrikeService: HexStrikeService,
  ) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async check() {
    const dbHealthy = await this.checkDatabase();
    const hexstrikeHealth = await this.checkHexStrike();

    return {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'up' : 'down',
      },
      hexstrike: hexstrikeHealth,
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkHexStrike(): Promise<{ status: string; tools_available: number }> {
    try {
      return await this.hexstrikeService.getHealth();
    } catch {
      return { status: 'disconnected', tools_available: 0 };
    }
  }
}
