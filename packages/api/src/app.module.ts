import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ToolsModule } from './tools/tools.module';
import { RunsModule } from './runs/runs.module';
import { FindingsModule } from './findings/findings.module';
import { ChatModule } from './chat/chat.module';
import { McpModule } from './mcp/mcp.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ScopesModule } from './scopes/scopes.module';
import { SmartScanModule } from './smart-scan/smart-scan.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Job queue
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),

    // Core modules
    PrismaModule,
    CommonModule, // Global guards, filters, interceptors
    HealthModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ToolsModule,
    RunsModule,
    FindingsModule,
    ChatModule,
    McpModule,
    DashboardModule,
    ScopesModule,
    SmartScanModule,
  ],
})
export class AppModule {}
