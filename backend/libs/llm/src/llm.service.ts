import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelProvider, GenerateOptions, GenerateResponse, StreamChunk } from './interfaces/model-provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';

@Injectable()
export class LlmService {
  private providers: Map<string, ModelProvider> = new Map();

  constructor(
    private configService: ConfigService,
    private anthropicProvider: AnthropicProvider,
    private openaiProvider: OpenAIProvider,
  ) {
    this.providers.set('anthropic', anthropicProvider);
    this.providers.set('openai', openaiProvider);
  }

  private getProvider(modelAlias?: string): ModelProvider {
    const defaultProvider = this.configService.get<string>('LLM_PROVIDER') || 'anthropic';

    // Map model alias to provider
    // e.g., "claude-3-5-sonnet" -> anthropic, "gpt-4" -> openai
    let providerName = defaultProvider;

    if (modelAlias) {
      if (modelAlias.includes('claude')) {
        providerName = 'anthropic';
      } else if (modelAlias.includes('gpt')) {
        providerName = 'openai';
      }
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not configured`);
    }

    return provider;
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const provider = this.getProvider(options.modelAlias);
    return provider.generate(options);
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const provider = this.getProvider(options.modelAlias);
    yield* provider.stream(options);
  }

  /**
   * Helper to build messages array with system prompt
   */
  buildMessages(systemPrompt: string, userMessage: string, previousMessages: any[] = []): any[] {
    const messages = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push(...previousMessages);

    messages.push({
      role: 'user',
      content: userMessage,
    });

    return messages;
  }
}
