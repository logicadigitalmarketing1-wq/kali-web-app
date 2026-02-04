import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { DirectMessageService } from './direct-message.service';
import { SessionGuard } from '../common/guards/session.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators';
import { CreateDMConversationDto } from './dto/create-dm-conversation.dto';
import { SendDirectMessageDto } from './dto/send-dm.dto';

@Controller('dm')
@UseGuards(SessionGuard)
export class DirectMessageController {
  constructor(private readonly dmService: DirectMessageService) {}

  @Post('conversations')
  async createConversation(
    @Body() dto: CreateDMConversationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dmService.createConversation(
      user.id,
      dto.participantIds,
      dto.initialMessage,
    );
  }

  @Get('conversations')
  async getConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.dmService.getConversations(user.id);
  }

  @Get('conversations/:id')
  async getConversation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dmService.getConversation(id, user.id);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() dto: SendDirectMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dmService.sendMessage(conversationId, user.id, dto.content);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.dmService.getUnreadCount(user.id) };
  }

  @Get('users')
  async getMessageableUsers(@CurrentUser() user: AuthenticatedUser) {
    return this.dmService.getMessageableUsers(user.id);
  }
}
