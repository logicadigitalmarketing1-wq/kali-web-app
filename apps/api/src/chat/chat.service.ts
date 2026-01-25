import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { LlmService } from '../llm/llm.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
  ) {}

  async createConversation(userId: string, title?: string, contextRuns?: string[], contextFindings?: string[]) {
    // Validate user has access to referenced runs/findings
    if (contextRuns?.length) {
      await this.validateRunAccess(userId, contextRuns);
    }
    if (contextFindings?.length) {
      await this.validateFindingAccess(userId, contextFindings);
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        userId,
        title: title || 'New Conversation',
        contextRuns: contextRuns || [],
        contextFindings: contextFindings || [],
      },
    });

    return conversation;
  }

  async getConversations(userId: string, limit = 20, offset = 0) {
    const conversations = await this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        _count: { select: { messages: true } },
      },
    });

    return conversations.map(c => ({
      id: c.id,
      title: c.title,
      messageCount: c._count.messages,
      updatedAt: c.updatedAt,
    }));
  }

  async getConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    return {
      id: conversation.id,
      title: conversation.title,
      contextRuns: conversation.contextRuns,
      contextFindings: conversation.contextFindings,
      messages: conversation.messages.map(m => ({
        id: m.id,
        role: m.role.toLowerCase(),
        content: m.content,
        createdAt: m.createdAt,
      })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  async sendMessage(conversationId: string, userId: string, content: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20, // Last 20 messages for context
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    // Create user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'USER',
        content,
      },
    });

    // Build context from runs/findings
    const context = await this.buildContext(userId, conversation.contextRuns, conversation.contextFindings);

    // Get conversation history
    const history = conversation.messages.map(m => ({
      role: m.role.toLowerCase() as 'user' | 'assistant',
      content: m.content,
    }));

    // Call LLM
    const response = await this.llmService.chat(content, history, context);

    // Create assistant message
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: response.content,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      userMessage: {
        id: userMessage.id,
        role: 'user',
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: 'assistant',
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
    };
  }

  async deleteConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    await this.prisma.conversation.delete({
      where: { id: conversationId },
    });

    return { success: true };
  }

  private async validateRunAccess(userId: string, runIds: string[]) {
    const userScopes = await this.prisma.userScope.findMany({
      where: { userId },
      select: { scopeId: true },
    });
    const scopeIds = userScopes.map(s => s.scopeId);

    const runs = await this.prisma.run.findMany({
      where: {
        id: { in: runIds },
        scopeId: { in: scopeIds },
      },
      select: { id: true },
    });

    if (runs.length !== runIds.length) {
      throw new ForbiddenException('You do not have access to some of the referenced runs');
    }
  }

  private async validateFindingAccess(userId: string, findingIds: string[]) {
    const userScopes = await this.prisma.userScope.findMany({
      where: { userId },
      select: { scopeId: true },
    });
    const scopeIds = userScopes.map(s => s.scopeId);

    const findings = await this.prisma.finding.findMany({
      where: {
        id: { in: findingIds },
        run: { scopeId: { in: scopeIds } },
      },
      select: { id: true },
    });

    if (findings.length !== findingIds.length) {
      throw new ForbiddenException('You do not have access to some of the referenced findings');
    }
  }

  private async buildContext(userId: string, runIds: string[], findingIds: string[]): Promise<string> {
    const contextParts: string[] = [];

    if (runIds.length > 0) {
      const runs = await this.prisma.run.findMany({
        where: { id: { in: runIds } },
        include: {
          tool: { select: { name: true, displayName: true } },
          findings: { select: { title: true, severity: true } },
        },
      });

      for (const run of runs) {
        contextParts.push(`
Run: ${run.tool.displayName} on ${run.targetHost}
Status: ${run.status}
Findings: ${run.findings.length}
${run.interpretation ? `Interpretation: ${JSON.stringify(run.interpretation)}` : ''}
`);
      }
    }

    if (findingIds.length > 0) {
      const findings = await this.prisma.finding.findMany({
        where: { id: { in: findingIds } },
      });

      for (const finding of findings) {
        contextParts.push(`
Finding: ${finding.title}
Severity: ${finding.severity}
Description: ${finding.description}
Remediation: ${finding.remediation || 'Not specified'}
`);
      }
    }

    return this.llmService.redactSecrets(contextParts.join('\n---\n'));
  }
}
