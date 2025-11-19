import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { AgentExecutorService } from '@app/llm';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private agentExecutor: AgentExecutorService,
  ) {}

  async listChats(organizationId: string, userId: string, limit = 20, offset = 0) {
    const [chats, total] = await Promise.all([
      this.prisma.chat.findMany({
        where: {
          organizationId,
          userId,
        },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.chat.count({
        where: {
          organizationId,
          userId,
        },
      }),
    ]);

    return {
      data: chats,
      total,
      offset,
      limit,
    };
  }

  async getChatHistory(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findFirst({
      where: {
        id: chatId,
        userId,
      },
      include: {
        events: {
          include: {
            attachments: {
              include: {
                file: true,
              },
            },
            feedback: true,
          },
          orderBy: { timestamp: 'asc' },
        },
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Format events for response
    const events = chat.events.map((event) => ({
      id: event.id,
      type: 'chat',
      timestamp: Number(event.timestamp),
      chatId: event.chatId,
      sender: event.sender,
      messageType: event.messageType,
      content: event.content,
      modelAlias: event.modelAlias,
      toolCalls: event.toolCalls,
      attachments: event.attachments.map((att) => ({
        fileId: att.file.id,
        fileName: att.file.fileName,
        mimeType: att.file.mimeType,
        size: att.file.size,
        fileType: att.file.fileType,
        previewText: att.file.previewText,
      })),
    }));

    // Build feedback map
    const feedbackByEvent = {};
    chat.events.forEach((event) => {
      if (event.feedback.length > 0) {
        feedbackByEvent[event.id] = event.feedback[0];
      }
    });

    return {
      events,
      chat: {
        id: chat.id,
        userId: chat.userId,
        agentId: chat.agentId,
        organizationId: chat.organizationId,
        title: chat.title,
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
        experience: chat.experience,
        modelAlias: chat.modelAlias,
        triggerId: chat.triggerId,
        triggerName: chat.triggerName,
        triggerSource: chat.triggerSource,
        triggerDescription: chat.triggerDescription,
        isStreaming: chat.isStreaming,
        result: chat.result,
        error: chat.error,
        inputTokens: chat.inputTokens,
        outputTokens: chat.outputTokens,
        totalTokens: chat.totalTokens,
        evalScore: chat.evalScore,
        evalExplanation: chat.evalExplanation,
        evalBulletSummary: chat.evalBulletSummary,
      },
      feedbackByEvent,
    };
  }

  async sendMessage(
    chatId: string | undefined,
    organizationId: string,
    userId: string,
    message: string,
    agentId?: string,
    attachments?: string[],
  ) {
    // Create or get chat
    let chat;
    if (chatId) {
      chat = await this.prisma.chat.findFirst({
        where: {
          id: chatId,
          userId,
          organizationId,
        },
      });

      if (!chat) {
        throw new NotFoundException('Chat not found');
      }
    } else {
      // Create new chat
      chat = await this.prisma.chat.create({
        data: {
          organizationId,
          userId,
          agentId,
          title: message.substring(0, 100),
          experience: agentId ? 'copilot' : 'chat',
          isStreaming: true,
        },
      });
    }

    // Create user message event
    const userEvent = await this.prisma.chatEvent.create({
      data: {
        chatId: chat.id,
        timestamp: BigInt(Date.now()),
        sender: 'user',
        messageType: 'text',
        content: message,
      },
    });

    // Create attachments if any
    if (attachments && attachments.length > 0) {
      await this.prisma.chatAttachment.createMany({
        data: attachments.map((fileId) => ({
          chatEventId: userEvent.id,
          fileId,
        })),
      });
    }

    return {
      chatId: chat.id,
      eventId: userEvent.id,
      status: 'accepted',
      streamUrl: `/chat/${chat.id}/stream`,
    };
  }

  async processMessage(chatId: string, agentId?: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        events: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Get previous messages
    const previousMessages = chat.events
      .filter((e) => e.sender !== 'system')
      .map((e) => ({
        role: e.sender === 'user' ? 'user' : 'assistant',
        content: e.content,
      }));

    const lastMessage = previousMessages[previousMessages.length - 1];

    // Execute agent if specified
    if (agentId || chat.agentId) {
      const effectiveAgentId = agentId || chat.agentId;

      const result = await this.agentExecutor.execute({
        agentId: effectiveAgentId,
        organizationId: chat.organizationId,
        userId: chat.userId,
        input: lastMessage.content,
        chatId: chat.id,
        previousMessages: previousMessages.slice(0, -1), // Exclude the last message as it's the input
      });

      // Create assistant response event
      await this.prisma.chatEvent.create({
        data: {
          chatId: chat.id,
          timestamp: BigInt(Date.now()),
          sender: 'agent',
          messageType: 'text',
          content: result.output,
          modelAlias: chat.modelAlias,
        },
      });

      // Update chat
      await this.prisma.chat.update({
        where: { id: chat.id },
        data: {
          isStreaming: false,
          inputTokens: { increment: result.usage.inputTokens },
          outputTokens: { increment: result.usage.outputTokens },
          totalTokens: { increment: result.usage.totalTokens },
          updatedAt: new Date(),
        },
      });

      return result;
    }

    return null;
  }

  async submitFeedback(eventId: string, userId: string, feedbackType: string, comment?: string) {
    const event = await this.prisma.chatEvent.findUnique({
      where: { id: eventId },
      include: {
        chat: true,
      },
    });

    if (!event || event.chat.userId !== userId) {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.chatFeedback.upsert({
      where: {
        chatEventId_userId: {
          chatEventId: eventId,
          userId,
        },
      },
      create: {
        chatEventId: eventId,
        userId,
        feedbackType,
        comment,
      },
      update: {
        feedbackType,
        comment,
      },
    });
  }

  async deleteChat(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findFirst({
      where: {
        id: chatId,
        userId,
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    await this.prisma.chat.delete({
      where: { id: chatId },
    });

    return { success: true };
  }
}
