import { Module, forwardRef } from '@nestjs/common';
import { SmartScanService } from './smart-scan.service';
import { SmartScanController } from './smart-scan.controller';
import { SmartScanEventsService } from './smart-scan-events.service';
import { PrismaModule } from '../prisma/prisma.module';
import { McpModule } from '../mcp/mcp.module';
import { RunsModule } from '../runs/runs.module';

@Module({
  imports: [PrismaModule, McpModule, forwardRef(() => RunsModule)],
  controllers: [SmartScanController],
  providers: [SmartScanService, SmartScanEventsService],
  exports: [SmartScanService, SmartScanEventsService],
})
export class SmartScanModule {}