export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolExecutionContext {
  organizationId: string;
  agentId: string;
  userId?: string;
}

export interface ToolExecutor {
  name: string;
  execute(input: any, context: ToolExecutionContext): Promise<any>;
}
