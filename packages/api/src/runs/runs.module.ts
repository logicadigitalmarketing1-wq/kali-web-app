import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RunsService } from './runs.service';
import { RunsController } from './runs.controller';
import { RunsProcessor } from './runs.processor';
import { RunsEventsService } from './runs-events.service';
import { McpModule } from '../mcp/mcp.module';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'runs',
    }),
    McpModule,
    ToolsModule,
  ],
  controllers: [RunsController],
  providers: [RunsService, RunsProcessor, RunsEventsService],
  exports: [RunsService, RunsEventsService],
})
export class RunsModule {}
