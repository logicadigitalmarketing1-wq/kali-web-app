import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { HexStrikeService } from './hexstrike.service';
import { ClaudeService } from './claude.service';

@Module({
  providers: [McpService, HexStrikeService, ClaudeService],
  exports: [McpService, HexStrikeService, ClaudeService],
})
export class McpModule {}
