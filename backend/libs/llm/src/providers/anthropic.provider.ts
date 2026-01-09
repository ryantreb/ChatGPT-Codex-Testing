import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  ModelProvider,
  GenerateOptions,
  GenerateResponse,
  StreamChunk,
  Message,
} from '../interfaces/model-provider.interface';

@Injectable()
export class AnthropicProvider implements ModelProvider {
  private client: Anthropic;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const model = this.getModel(options.modelAlias);

    // Extract system prompt
    const systemPrompt = options.systemPrompt || this.extractSystemPrompt(options.messages);
    const messages = this.filterSystemMessages(options.messages);

    const params: any = {
      model,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      messages: this.convertMessages(messages),
    };

    if (systemPrompt) {
      params.system = systemPrompt;
    }

    if (options.tools && options.tools.length > 0) {
      params.tools = this.convertTools(options.tools);
    }

    const response = await this.client.messages.create(params);

    // Parse response
    let content = '';
    const toolCalls: any[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.mapFinishReason(response.stop_reason),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const model = this.getModel(options.modelAlias);

    const systemPrompt = options.systemPrompt || this.extractSystemPrompt(options.messages);
    const messages = this.filterSystemMessages(options.messages);

    const params: any = {
      model,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      messages: this.convertMessages(messages),
      stream: true,
    };

    if (systemPrompt) {
      params.system = systemPrompt;
    }

    if (options.tools && options.tools.length > 0) {
      params.tools = this.convertTools(options.tools);
    }

    const stream = await this.client.messages.create(params);

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield {
            type: 'content',
            content: event.delta.text,
          };
        }
      } else if (event.type === 'message_start') {
        inputTokens = event.message.usage.input_tokens;
      } else if (event.type === 'message_delta') {
        outputTokens = event.usage.output_tokens;
      }
    }

    yield {
      type: 'done',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    };
  }

  private getModel(alias?: string): string {
    if (!alias) {
      return 'claude-3-5-sonnet-20241022';
    }
    // Map aliases to actual model IDs
    const modelMap: Record<string, string> = {
      'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
      'claude-3-opus': 'claude-3-opus-20240229',
      'claude-3-haiku': 'claude-3-haiku-20240307',
    };
    return modelMap[alias] || alias;
  }

  private extractSystemPrompt(messages: Message[]): string {
    const systemMessage = messages.find((m) => m.role === 'system');
    return systemMessage?.content || '';
  }

  private filterSystemMessages(messages: Message[]): Message[] {
    return messages.filter((m) => m.role !== 'system');
  }

  private convertMessages(messages: Message[]): any[] {
    return messages.map((msg) => ({
      role: msg.role === 'tool' ? 'user' : msg.role,
      content: msg.content,
    }));
  }

  private convertTools(tools: any[]): any[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  private mapFinishReason(reason: string): 'stop' | 'tool_calls' | 'length' | 'error' {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }
}
