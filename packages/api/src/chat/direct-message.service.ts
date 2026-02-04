import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DirectMessageService {
  constructor(private prisma: PrismaService) {}

  async createConversation(creatorId: string, participantIds: string[], initialMessage?: string) {
    // Ensure creator is included in participants
    const allParticipants = [...new Set([creatorId, ...participantIds])];

    // Check if a DM conversation already exists between these exact users (for 2-person DMs)
    if (allParticipants.length === 2) {
      const existing = await this.findExistingDM(allParticipants[0], allParticipants[1]);
      if (existing) {
        // If there's an initial message, send it
        if (initialMessage) {
          await this.sendMessage(existing.id, creatorId, initialMessage);
        }
        return this.getConversation(existing.id, creatorId);
      }
    }

    // Create new conversation
    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'DIRECT_MESSAGE',
        participants: {
          create: allParticipants.map(userId => ({
            userId,
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, email: true, name: true, role: true },
            },
          },
        },
      },
    });

    // Send initial message if provided
    if (initialMessage) {
      await this.sendMessage(conversation.id, creatorId, initialMessage);
    }

    return conversation;
  }

  private async findExistingDM(userId1: string, userId2: string) {
    return this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT_MESSAGE',
        AND: [
          { participants: { some: { userId: userId1 } } },
          { participants: { some: { userId: userId2 } } },
        ],
        participants: {
          every: {
            userId: { in: [userId1, userId2] },
          },
        },
      },
    });
  }

  async getConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        type: 'DIRECT_MESSAGE',
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, email: true, name: true, role: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, email: true, name: true, role: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Verify user is a participant
    const isParticipant = conversation.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    // Update last read timestamp
    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { lastReadAt: new Date() },
    });

    return conversation;
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    // Verify sender is a participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId: senderId },
      },
    });

    if (!participant) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        role: 'user',
        content,
      },
      include: {
        sender: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getUnreadCount(userId: string) {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      select: {
        conversationId: true,
        lastReadAt: true,
      },
    });

    let totalUnread = 0;

    for (const p of participations) {
      const count = await this.prisma.message.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: userId },
          createdAt: p.lastReadAt ? { gt: p.lastReadAt } : undefined,
        },
      });
      totalUnread += count;
    }

    return totalUnread;
  }

  // Get all users who can be messaged (bidirectional - everyone can message everyone)
  async getMessageableUsers(currentUserId: string) {
    return this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
      orderBy: [
        { role: 'asc' }, // Admins first
        { name: 'asc' },
      ],
    });
  }
}
