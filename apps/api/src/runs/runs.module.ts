import { Module } from '@nestjs/common';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { AuthModule } from '../auth/auth.module';
import { ToolsModule } from '../tools/tools.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [AuthModule, ToolsModule, LlmModule],
  controllers: [RunsController],
  providers: [RunsService],
  exports: [RunsService],
})
export class RunsModule {}
