import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { McpModule } from '../mcp/mcp.module';

@Module({
  imports: [McpModule],
  controllers: [HealthController],
})
export class HealthModule {}
