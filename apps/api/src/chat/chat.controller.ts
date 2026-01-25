import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { AuthGuard } from '../auth/auth.guard';
import { Permissions, UserId } from '../auth/decorators';

@ApiTags('chat')
@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create a new conversation' })
  @Permissions('chat:write')
  async createConversation(
    @UserId() userId: string,
    @Body() body: {
      title?: string;
      contextRuns?: string[];
      contextFindings?: string[];
    },
  ) {
    return this.chatService.createConversation(
      userId,
      body.title,
      body.contextRuns,
      body.contextFindings,
    );
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @Permissions('chat:read')
  async getConversations(
    @UserId() userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.chatService.getConversations(
      userId,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation with messages' })
  @Permissions('chat:read')
  async getConversation(@Param('id') id: string, @UserId() userId: string) {
    return this.chatService.getConversation(id, userId);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message' })
  @Permissions('chat:write')
  async sendMessage(
    @Param('id') id: string,
    @UserId() userId: string,
    @Body('content') content: string,
  ) {
    return this.chatService.sendMessage(id, userId, content);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @Permissions('chat:write')
  async deleteConversation(@Param('id') id: string, @UserId() userId: string) {
    return this.chatService.deleteConversation(id, userId);
  }
}
