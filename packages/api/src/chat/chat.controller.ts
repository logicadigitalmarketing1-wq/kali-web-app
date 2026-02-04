import { Controller, Post, Get, Delete, Param, Body, UseGuards, Request, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ChatService } from './chat.service';
import { SessionGuard } from '../common/guards/session.guard';

interface RequestWithUser {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  headers?: {
    origin?: string;
    [key: string]: string | string[] | undefined;
  };
}

interface SendMessageDto {
  conversationId?: string;
  message: string;
  context?: string;
}

@Controller('chat')
@UseGuards(SessionGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async sendMessage(
    @Body() dto: SendMessageDto,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.sendMessage(
      req.user.id,
      dto.conversationId || null,
      dto.message,
    );
  }

  @Post('stream')
  async streamMessage(
    @Body() dto: SendMessageDto,
    @Request() req: RequestWithUser,
    @Res() reply: FastifyReply,
  ) {
    const origin = req.headers?.origin || 'http://localhost:3000';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    });

    try {
      const stream = this.chatService.sendMessageStream(
        req.user.id,
        dto.conversationId || null,
        dto.message,
      );

      for await (const chunk of stream) {
        const data = JSON.stringify(chunk);
        reply.raw.write(`data: ${data}\n\n`);
      }

      reply.raw.write('data: [DONE]\n\n');
    } catch (error) {
      const errorData = JSON.stringify({ type: 'error', message: error.message });
      reply.raw.write(`data: ${errorData}\n\n`);
    } finally {
      reply.raw.end();
    }
  }

  @Get('conversations')
  async getConversations(@Request() req: RequestWithUser) {
    return this.chatService.getConversations(req.user.id);
  }

  @Get('conversations/:id')
  async getConversation(
    @Param('id') conversationId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.getConversation(req.user.id, conversationId);
  }

  @Delete('conversations/:id')
  async deleteConversation(
    @Param('id') conversationId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.chatService.deleteConversation(req.user.id, conversationId);
  }
}
