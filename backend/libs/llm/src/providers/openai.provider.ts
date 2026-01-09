import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ModelProvider,
  GenerateOptions,
  GenerateResponse,
  StreamChunk,
} from '../interfaces/model-provider.interface';

@Injectable()
export class OpenAIProvider implements ModelProvider {
  private client: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const model = this.getModel(options.modelAlias);

    const params: any = {
      model,
      messages: options.messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    };

    if (options.tools && options.tools.length > 0) {
      params.tools = this.convertTools(options.tools);
      if (options.toolChoice) {
        params.tool_choice = options.toolChoice;
      }
    }

    const response = await this.client.chat.completions.create(params);

    const choice = response.choices[0];

    return {
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls,
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const model = this.getModel(options.modelAlias);

    const params: any = {
      model,
      messages: options.messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      stream: true,
    };

    if (options.tools && options.tools.length > 0) {
      params.tools = this.convertTools(options.tools);
      if (options.toolChoice) {
        params.tool_choice = options.toolChoice;
      }
    }

    const stream = await this.client.chat.completions.create(params);

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        yield {
          type: 'content',
          content: delta.content,
        };
      }

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          yield {
            type: 'tool_call',
            toolCall: toolCall as any,
          };
        }
      }

      if (chunk.choices[0]?.finish_reason) {
        yield {
          type: 'done',
          usage: {
            inputTokens: 0, // Not available in streaming
            outputTokens: 0,
            totalTokens: 0,
          },
        };
      }
    }
  }

  private getModel(alias?: string): string {
    if (!alias) {
      return 'gpt-4-turbo-preview';
    }
    // Map aliases to actual model IDs
    const modelMap: Record<string, string> = {
      'gpt-4': 'gpt-4-turbo-preview',
      'gpt-4-turbo': 'gpt-4-turbo-preview',
      'gpt-3.5': 'gpt-3.5-turbo',
    };
    return modelMap[alias] || alias;
  }

  private convertTools(tools: any[]): any[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  private mapFinishReason(reason: string): 'stop' | 'tool_calls' | 'length' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
        return 'tool_calls';
      case 'length':
        return 'length';
      default:
        return 'stop';
    }
  }
}
