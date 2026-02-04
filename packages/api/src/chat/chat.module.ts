import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { DirectMessageService } from './direct-message.service';
import { DirectMessageController } from './direct-message.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { McpModule } from '../mcp/mcp.module';

@Module({
  imports: [PrismaModule, McpModule],
  controllers: [ChatController, DirectMessageController],
  providers: [ChatService, DirectMessageService],
  exports: [ChatService, DirectMessageService],
})
export class ChatModule {}
