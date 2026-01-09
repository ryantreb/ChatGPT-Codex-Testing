import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { LlmService } from './llm.service';
import { ToolExecutor, ToolExecutionContext } from './interfaces/tool-definition.interface';
import { Message } from './interfaces/model-provider.interface';

export interface AgentExecutionOptions {
  agentId: string;
  organizationId: string;
  userId?: string;
  input: string;
  chatId?: string;
  runId?: string;
  previousMessages?: Message[];
  toolExecutors?: ToolExecutor[];
}

export interface AgentExecutionResult {
  output: string;
  toolCallsExecuted: number;
  steps: AgentExecutionStep[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface AgentExecutionStep {
  type: 'llm_call' | 'tool_call' | 'retrieval';
  timestamp: Date;
  data: any;
}

@Injectable()
export class AgentExecutorService {
  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
  ) {}

  /**
   * Execute an agent with full orchestration: planning, tool calling, RAG
   */
  async execute(options: AgentExecutionOptions): Promise<AgentExecutionResult> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: options.agentId },
      include: {
        systemPrompts: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        tools: {
          include: {
            tool: true,
          },
        },
      },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    const systemPrompt = agent.systemPrompts[0]?.prompt || 'You are a helpful AI assistant for SecOps.';
    const modelAlias = agent.defaultModelAlias || 'claude-3-5-sonnet';
    const planningMode = agent.planningMode;
    const maxSteps = agent.maxSteps || 10;

    // Build tool definitions
    const toolDefinitions = await this.buildToolDefinitions(agent.tools);

    // Retrieve relevant context using RAG
    const retrievedContext = await this.retrieveContext(options.agentId, options.organizationId, options.input);

    // Build enhanced system prompt with context
    const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(systemPrompt, retrievedContext);

    const steps: AgentExecutionStep[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let toolCallsExecuted = 0;

    // Build initial messages
    const messages: Message[] = options.previousMessages || [];

    // Add user input
    messages.push({
      role: 'user',
      content: options.input,
    });

    // Execute based on planning mode
    if (planningMode === 'single_step') {
      const result = await this.executeSingleStep({
        systemPrompt: enhancedSystemPrompt,
        modelAlias,
        messages,
        toolDefinitions,
        toolExecutors: options.toolExecutors || [],
        context: {
          organizationId: options.organizationId,
          agentId: options.agentId,
          userId: options.userId,
        },
      });

      steps.push(...result.steps);
      totalInputTokens += result.usage.inputTokens;
      totalOutputTokens += result.usage.outputTokens;
      toolCallsExecuted += result.toolCallsExecuted;

      return {
        output: result.output,
        toolCallsExecuted,
        steps,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
        },
      };
    } else if (planningMode === 'loop_with_limits') {
      return this.executeLoop({
        systemPrompt: enhancedSystemPrompt,
        modelAlias,
        messages,
        toolDefinitions,
        toolExecutors: options.toolExecutors || [],
        maxSteps,
        context: {
          organizationId: options.organizationId,
          agentId: options.agentId,
          userId: options.userId,
        },
      });
    } else {
      // plan_and_execute mode
      return this.executePlanAndExecute({
        systemPrompt: enhancedSystemPrompt,
        modelAlias,
        messages,
        toolDefinitions,
        toolExecutors: options.toolExecutors || [],
        maxSteps,
        context: {
          organizationId: options.organizationId,
          agentId: options.agentId,
          userId: options.userId,
        },
      });
    }
  }

  private async executeSingleStep(options: {
    systemPrompt: string;
    modelAlias: string;
    messages: Message[];
    toolDefinitions: any[];
    toolExecutors: ToolExecutor[];
    context: ToolExecutionContext;
  }): Promise<AgentExecutionResult> {
    const steps: AgentExecutionStep[] = [];

    // Single LLM call with optional tool use
    const response = await this.llmService.generate({
      modelAlias: options.modelAlias,
      systemPrompt: options.systemPrompt,
      messages: options.messages,
      tools: options.toolDefinitions,
      toolChoice: 'auto',
    });

    steps.push({
      type: 'llm_call',
      timestamp: new Date(),
      data: {
        input: options.messages[options.messages.length - 1],
        output: response.content,
        toolCalls: response.toolCalls,
      },
    });

    let output = response.content;
    let toolCallsExecuted = 0;

    // Execute tool calls if any
    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolResults = await this.executeToolCalls(
        response.toolCalls,
        options.toolExecutors,
        options.context,
      );

      steps.push({
        type: 'tool_call',
        timestamp: new Date(),
        data: toolResults,
      });

      toolCallsExecuted = response.toolCalls.length;

      // Make another LLM call with tool results
      const messagesWithToolResults = [
        ...options.messages,
        {
          role: 'assistant' as const,
          content: response.content,
          tool_calls: response.toolCalls,
        },
        ...toolResults.map((result: any) => ({
          role: 'tool' as const,
          content: JSON.stringify(result.output),
          tool_call_id: result.toolCallId,
        })),
      ];

      const finalResponse = await this.llmService.generate({
        modelAlias: options.modelAlias,
        systemPrompt: options.systemPrompt,
        messages: messagesWithToolResults,
      });

      output = finalResponse.content;

      steps.push({
        type: 'llm_call',
        timestamp: new Date(),
        data: {
          input: 'Tool results',
          output: finalResponse.content,
        },
      });
    }

    return {
      output,
      toolCallsExecuted,
      steps,
      usage: response.usage,
    };
  }

  private async executeLoop(options: {
    systemPrompt: string;
    modelAlias: string;
    messages: Message[];
    toolDefinitions: any[];
    toolExecutors: ToolExecutor[];
    maxSteps: number;
    context: ToolExecutionContext;
  }): Promise<AgentExecutionResult> {
    const steps: AgentExecutionStep[] = [];
    let currentMessages = [...options.messages];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let toolCallsExecuted = 0;
    let iteration = 0;
    let finalOutput = '';

    while (iteration < options.maxSteps) {
      iteration++;

      const response = await this.llmService.generate({
        modelAlias: options.modelAlias,
        systemPrompt: options.systemPrompt,
        messages: currentMessages,
        tools: options.toolDefinitions,
        toolChoice: 'auto',
      });

      totalInputTokens += response.usage.inputTokens;
      totalOutputTokens += response.usage.outputTokens;

      steps.push({
        type: 'llm_call',
        timestamp: new Date(),
        data: {
          iteration,
          output: response.content,
          toolCalls: response.toolCalls,
        },
      });

      finalOutput = response.content;

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        break;
      }

      // Execute tool calls
      const toolResults = await this.executeToolCalls(
        response.toolCalls,
        options.toolExecutors,
        options.context,
      );

      toolCallsExecuted += response.toolCalls.length;

      steps.push({
        type: 'tool_call',
        timestamp: new Date(),
        data: toolResults,
      });

      // Add assistant message and tool results to conversation
      currentMessages.push({
        role: 'assistant',
        content: response.content,
        tool_calls: response.toolCalls,
      });

      for (const result of toolResults) {
        currentMessages.push({
          role: 'tool',
          content: JSON.stringify(result.output),
          tool_call_id: result.toolCallId,
        });
      }
    }

    return {
      output: finalOutput,
      toolCallsExecuted,
      steps,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
    };
  }

  private async executePlanAndExecute(options: {
    systemPrompt: string;
    modelAlias: string;
    messages: Message[];
    toolDefinitions: any[];
    toolExecutors: ToolExecutor[];
    maxSteps: number;
    context: ToolExecutionContext;
  }): Promise<AgentExecutionResult> {
    // First, create a plan
    const planningPrompt = `${options.systemPrompt}\n\nCreate a step-by-step plan to accomplish the user's request. List the steps clearly.`;

    const planResponse = await this.llmService.generate({
      modelAlias: options.modelAlias,
      systemPrompt: planningPrompt,
      messages: options.messages,
    });

    const steps: AgentExecutionStep[] = [
      {
        type: 'llm_call',
        timestamp: new Date(),
        data: {
          phase: 'planning',
          plan: planResponse.content,
        },
      },
    ];

    // Then execute the plan with loop
    return this.executeLoop({
      ...options,
      messages: [
        ...options.messages,
        {
          role: 'assistant',
          content: `Plan:\n${planResponse.content}\n\nNow executing this plan...`,
        },
      ],
    });
  }

  private async executeToolCalls(
    toolCalls: any[],
    toolExecutors: ToolExecutor[],
    context: ToolExecutionContext,
  ): Promise<any[]> {
    const results = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const toolInput = JSON.parse(toolCall.function.arguments);

      const executor = toolExecutors.find((e) => e.name === toolName);

      if (!executor) {
        results.push({
          toolCallId: toolCall.id,
          toolName,
          error: `Tool executor not found: ${toolName}`,
        });
        continue;
      }

      try {
        const output = await executor.execute(toolInput, context);
        results.push({
          toolCallId: toolCall.id,
          toolName,
          input: toolInput,
          output,
        });
      } catch (error) {
        results.push({
          toolCallId: toolCall.id,
          toolName,
          input: toolInput,
          error: error.message,
        });
      }
    }

    return results;
  }

  private async buildToolDefinitions(agentTools: any[]): Promise<any[]> {
    // Build tool definitions from agent's configured tools
    // This would be expanded with actual tool schemas
    return agentTools.map((at) => ({
      name: at.tool.name,
      description: at.tool.description || `Execute ${at.tool.name}`,
      inputSchema: at.tool.config?.inputSchema || {
        type: 'object',
        properties: {},
      },
    }));
  }

  private async retrieveContext(
    agentId: string,
    organizationId: string,
    query: string,
  ): Promise<string[]> {
    // RAG: Retrieve relevant context documents and memories
    // This is a simplified version - full implementation would use embeddings
    const contextDocs = await this.prisma.contextDocument.findMany({
      where: {
        OR: [{ agentId }, { organizationId, agentId: null }],
      },
      take: 5,
    });

    const memories = await this.prisma.agentMemory.findMany({
      where: {
        agentId,
        scope: { in: ['agent', 'global'] },
      },
      take: 5,
    });

    const contexts: string[] = [];

    for (const doc of contextDocs) {
      if (doc.content) {
        contexts.push(`[Document: ${doc.title}]\n${doc.content.substring(0, 1000)}`);
      }
    }

    for (const memory of memories) {
      contexts.push(`[Memory: ${memory.key}]\n${memory.value}`);
    }

    return contexts;
  }

  private buildEnhancedSystemPrompt(basePrompt: string, contexts: string[]): string {
    if (contexts.length === 0) {
      return basePrompt;
    }

    const contextSection = contexts.join('\n\n---\n\n');

    return `${basePrompt}\n\n## Relevant Context\n\nThe following context documents and memories may be helpful:\n\n${contextSection}\n\n---\n\nUse the above context when relevant to answer the user's query.`;
  }
}
