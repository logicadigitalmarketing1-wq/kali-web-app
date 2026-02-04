import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { McpService } from '../mcp/mcp.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatContext {
  conversationId?: string;
  userId: string;
  messages: ChatMessage[];
}

export interface ChatResponse {
  conversationId: string;
  response: string;
  tokensUsed?: number;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private mcpService: McpService,
  ) {}

  async sendMessage(userId: string, conversationId: string | null, message: string): Promise<ChatResponse> {
    try {
      // Get or create conversation
      let conversation;
      if (conversationId) {
        conversation = await this.prisma.conversation.findUnique({
          where: { id: conversationId, userId },
        });
        
        if (!conversation) {
          throw new Error('Conversation not found');
        }
      } else {
        // Create new conversation with a title based on the first message
        const title = message.length > 50 ? message.substring(0, 50) + '...' : message;
        conversation = await this.prisma.conversation.create({
          data: {
            userId,
            title,
            context: {}, // Initialize empty context
          },
        });
        conversationId = conversation.id;
      }

      // Save user message
      await this.prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: message,
          tokensUsed: null, // Will be calculated by AI
        },
      });

      // Get conversation history for context
      const messages = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });

      // Prepare context for Claude AI
      const chatContext: ChatContext = {
        conversationId,
        userId,
        messages: messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      };

      // Get response from Claude AI with HexStrike MCP tools
      const aiResponse = await this.getClaudeResponse(chatContext);

      // Save assistant response
      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: aiResponse.content,
          tokensUsed: aiResponse.tokensUsed,
        },
      });

      // Update conversation title if it's the first exchange
      if (messages.length <= 2) { // user message + assistant response
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: {
            title: message.length > 50 ? message.substring(0, 50) + '...' : message,
          },
        });
      }

      return {
        conversationId,
        response: aiResponse.content,
        tokensUsed: aiResponse.tokensUsed,
      };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ...conversation,
      messages,
    };
  }

  async deleteConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Delete all messages first
    await this.prisma.message.deleteMany({
      where: { conversationId },
    });

    // Delete the conversation
    await this.prisma.conversation.delete({
      where: { id: conversationId },
    });

    return { success: true, message: 'Conversation deleted successfully' };
  }

  async *sendMessageStream(
    userId: string,
    conversationId: string | null,
    message: string,
  ): AsyncGenerator<{
    type: 'init' | 'text' | 'tool_start' | 'tool_output' | 'tool_complete' | 'done';
    conversationId?: string;
    content?: string;
    toolName?: string;
    toolParams?: Record<string, unknown>;
    duration?: number;
    tokensUsed?: number;
  }> {
    try {
      // Get or create conversation
      let conversation;
      if (conversationId) {
        conversation = await this.prisma.conversation.findUnique({
          where: { id: conversationId, userId },
        });
        if (!conversation) {
          throw new Error('Conversation not found');
        }
      } else {
        const title = message.length > 50 ? message.substring(0, 50) + '...' : message;
        conversation = await this.prisma.conversation.create({
          data: { userId, title, context: {} },
        });
        conversationId = conversation.id;
      }

      // Send conversation ID immediately
      yield { type: 'init', conversationId };

      // Save user message
      await this.prisma.message.create({
        data: { conversationId, role: 'user', content: message, tokensUsed: null },
      });

      // Get conversation history
      const messages = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });

      const systemPrompt = `You are HexStrike AI Security Assistant, an expert cybersecurity professional with access to security tools.
Your role is to provide expert guidance on security vulnerabilities, penetration testing, CVE analysis, OWASP Top 10, and remediation.
When the user asks you to scan or analyze a target, USE YOUR TOOLS to perform real security assessments.
Be precise, technical, and practical. Focus on actionable security advice.`;

      const chatMessages = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Stream the response with tool support
      let fullContent = '';
      let tokensUsed = 0;

      for await (const chunk of this.mcpService.chatWithToolsStream(chatMessages, systemPrompt)) {
        if (chunk.type === 'text' && chunk.content) {
          fullContent += chunk.content;
          yield { type: 'text', content: chunk.content };
        } else if (chunk.type === 'tool_start') {
          yield { type: 'tool_start', toolName: chunk.toolName, toolParams: chunk.toolParams };
        } else if (chunk.type === 'tool_output') {
          yield { type: 'tool_output', toolName: chunk.toolName, content: chunk.content };
        } else if (chunk.type === 'tool_complete') {
          yield { type: 'tool_complete', toolName: chunk.toolName, duration: chunk.duration };
        } else if (chunk.type === 'done') {
          tokensUsed = chunk.tokensUsed || 0;
        }
      }

      // Save assistant response
      await this.prisma.message.create({
        data: { conversationId, role: 'assistant', content: fullContent, tokensUsed },
      });

      // Update conversation title if first exchange
      if (messages.length <= 2) {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { title: message.length > 50 ? message.substring(0, 50) + '...' : message },
        });
      }

      yield { type: 'done', tokensUsed };
    } catch (error) {
      this.logger.error(`Error in stream: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async getClaudeResponse(context: ChatContext): Promise<{ content: string; tokensUsed?: number }> {
    try {
      // Prepare the system prompt for Claude as a security assistant
      const systemPrompt = `You are HexStrike AI Security Assistant, an expert cybersecurity professional with access to various security tools through MCP (Model Context Protocol).

Your role is to provide expert guidance on:
- Security vulnerabilities and their remediation
- Penetration testing methodologies
- Security tool usage and interpretation
- CVE analysis and impact assessment
- OWASP Top 10 and other security frameworks
- Network security assessments
- Incident response procedures

You have access to real security tools through the HexStrike MCP, including:
- Nmap for network scanning
- Subfinder for subdomain discovery
- Nuclei for vulnerability scanning
- And other security assessment tools

When appropriate, you can offer to run security scans using these tools to provide practical, actionable insights. Always explain what you're doing and why, and interpret the results in a way that's helpful for security professionals.

Be precise, technical, and practical in your responses. Focus on providing actionable security advice.`;

      // Convert conversation history to Claude format
      // context.messages already includes all messages including the latest user message
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = context.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      this.logger.log(`Sending ${messages.length} messages to Claude for chat`);

      const response = await this.mcpService.chat(messages, systemPrompt);

      this.logger.log(`Received response from Claude: ${response.content?.substring(0, 100)}...`);

      return {
        content: response.content,
        tokensUsed: response.tokensUsed,
      };
    } catch (error) {
      this.logger.error(`Error getting Claude response: ${error.message}`, error.stack);

      // Fallback response if Claude is unavailable
      return {
        content: "I apologize, but I'm currently unable to process your request. The AI service or security tools might be temporarily unavailable. Please try again later.",
        tokensUsed: 0,
      };
    }
  }
}
