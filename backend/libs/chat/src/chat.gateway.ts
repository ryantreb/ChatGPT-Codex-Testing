import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { LlmService } from '@app/llm';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private chatService: ChatService,
    private llmService: LlmService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('streamChat')
  async handleStreamChat(client: Socket, payload: { chatId: string; agentId?: string }) {
    try {
      const { chatId, agentId } = payload;

      // Process the message asynchronously and stream responses
      await this.processAndStream(client, chatId, agentId);
    } catch (error) {
      client.emit('error', {
        message: error.message,
      });
    }
  }

  private async processAndStream(client: Socket, chatId: string, agentId?: string) {
    // This is a simplified streaming implementation
    // In a full implementation, this would integrate with the agent executor
    // and stream tokens as they're generated

    try {
      // Emit start event
      client.emit('streamStart', { chatId });

      // Process the message (this would be async in real implementation)
      const result = await this.chatService.processMessage(chatId, agentId);

      if (result) {
        // Simulate streaming by chunking the output
        const chunks = this.chunkText(result.output, 20);
        for (const chunk of chunks) {
          client.emit('streamChunk', {
            chatId,
            type: 'content',
            content: chunk,
          });
          // Small delay to simulate streaming
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Emit completion
      client.emit('streamComplete', {
        chatId,
        usage: result?.usage || {},
      });
    } catch (error) {
      client.emit('streamError', {
        chatId,
        error: error.message,
      });
    }
  }

  private chunkText(text: string, chunkSize: number): string[] {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }
}
