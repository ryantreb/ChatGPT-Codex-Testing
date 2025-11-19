import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmService } from './llm.service';
import { AgentExecutorService } from './agent-executor.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';

@Module({
  imports: [ConfigModule],
  providers: [LlmService, AgentExecutorService, AnthropicProvider, OpenAIProvider],
  exports: [LlmService, AgentExecutorService],
})
export class LlmModule {}
