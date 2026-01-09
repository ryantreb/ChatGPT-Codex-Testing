import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser, JwtAuthGuard, PaginationDto } from '@app/common';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('list')
  @ApiOperation({ summary: 'List all chats for a user' })
  async listChats(
    @Query('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: any,
  ) {
    return this.chatService.listChats(
      organizationId,
      user.userId,
      pagination.limit,
      pagination.offset,
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Get chat history with events' })
  async getChatHistory(@Query('chatId') chatId: string, @CurrentUser() user: any) {
    return this.chatService.getChatHistory(chatId, user.userId);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send a message in a chat' })
  async sendMessage(@Body() sendMessageDto: SendMessageDto, @CurrentUser() user: any) {
    return this.chatService.sendMessage(
      sendMessageDto.chatId,
      sendMessageDto.organizationId,
      user.userId,
      sendMessageDto.message,
      sendMessageDto.agentId,
      sendMessageDto.attachments,
    );
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Submit feedback for a chat event' })
  async submitFeedback(
    @Body() body: { eventId: string; feedbackType: string; comment?: string },
    @CurrentUser() user: any,
  ) {
    return this.chatService.submitFeedback(
      body.eventId,
      user.userId,
      body.feedbackType,
      body.comment,
    );
  }

  @Delete(':chatId')
  @ApiOperation({ summary: 'Delete a chat' })
  async deleteChat(@Param('chatId') chatId: string, @CurrentUser() user: any) {
    return this.chatService.deleteChat(chatId, user.userId);
  }
}
