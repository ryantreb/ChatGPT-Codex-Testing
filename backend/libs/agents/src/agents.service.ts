import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CreateSystemPromptDto } from './dto/create-system-prompt.dto';

@Injectable()
export class AgentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, userId: string) {
    // Check access
    await this.checkOrgAccess(userId, organizationId);

    return this.prisma.agent.findMany({
      where: { organizationId },
      include: {
        systemPrompts: {
          where: { status: 'active' },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        triggers: {
          where: { enabled: true },
        },
        _count: {
          select: {
            runs: true,
            chats: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string, userId: string) {
    await this.checkOrgAccess(userId, organizationId);

    const agent = await this.prisma.agent.findFirst({
      where: { id, organizationId },
      include: {
        systemPrompts: {
          orderBy: { createdAt: 'desc' },
        },
        tools: {
          include: {
            tool: true,
          },
        },
        triggers: true,
        contextDocs: true,
        _count: {
          select: {
            runs: true,
            chats: true,
            memories: true,
          },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return agent;
  }

  async create(createAgentDto: CreateAgentDto, organizationId: string, userId: string) {
    await this.checkOrgAccess(userId, organizationId);

    const agent = await this.prisma.agent.create({
      data: {
        organizationId,
        createdByUserId: userId,
        name: createAgentDto.name,
        description: createAgentDto.description,
        type: createAgentDto.type,
        planningMode: createAgentDto.planningMode || 'single_step',
        status: 'draft',
        defaultModelAlias: createAgentDto.defaultModelAlias,
        maxSteps: createAgentDto.maxSteps,
        maxDuration: createAgentDto.maxDuration,
      },
      include: {
        systemPrompts: true,
      },
    });

    // Create initial system prompt if provided
    if (createAgentDto.systemPrompt) {
      await this.createSystemPrompt(
        agent.id,
        {
          description: 'Initial system prompt',
          prompt: createAgentDto.systemPrompt,
        },
        organizationId,
        userId,
      );
    }

    return agent;
  }

  async update(id: string, updateAgentDto: UpdateAgentDto, organizationId: string, userId: string) {
    await this.checkOrgAccess(userId, organizationId);

    const agent = await this.prisma.agent.findFirst({
      where: { id, organizationId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return this.prisma.agent.update({
      where: { id },
      data: updateAgentDto,
    });
  }

  async delete(id: string, organizationId: string, userId: string) {
    await this.checkOrgAccess(userId, organizationId);

    const agent = await this.prisma.agent.findFirst({
      where: { id, organizationId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    await this.prisma.agent.delete({
      where: { id },
    });

    return { success: true };
  }

  async getSystemPrompts(agentId: string, organizationId: string, userId: string) {
    await this.checkOrgAccess(userId, organizationId);

    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, organizationId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return this.prisma.agentSystemPrompt.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSystemPrompt(
    agentId: string,
    createDto: CreateSystemPromptDto,
    organizationId: string,
    userId: string,
  ) {
    await this.checkOrgAccess(userId, organizationId);

    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, organizationId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    return this.prisma.agentSystemPrompt.create({
      data: {
        agentId,
        description: createDto.description,
        prompt: createDto.prompt,
        status: 'draft',
        changedByUserId: userId,
        changedByEmail: user.email,
      },
    });
  }

  async activateSystemPrompt(
    agentId: string,
    promptId: string,
    organizationId: string,
    userId: string,
  ) {
    await this.checkOrgAccess(userId, organizationId);

    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, organizationId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Deactivate all other prompts
    await this.prisma.agentSystemPrompt.updateMany({
      where: { agentId, status: 'active' },
      data: { status: 'archived' },
    });

    // Activate this one
    return this.prisma.agentSystemPrompt.update({
      where: { id: promptId },
      data: { status: 'active' },
    });
  }

  async getRuns(agentId: string, organizationId: string, userId: string, limit = 20, offset = 0) {
    await this.checkOrgAccess(userId, organizationId);

    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, organizationId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const [runs, total] = await Promise.all([
      this.prisma.agentRun.findMany({
        where: { agentId },
        include: {
          trigger: true,
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.agentRun.count({
        where: { agentId },
      }),
    ]);

    return {
      data: runs,
      total,
      offset,
      limit,
    };
  }

  async manualRun(agentId: string, input: any, organizationId: string, userId: string) {
    await this.checkOrgAccess(userId, organizationId);

    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, organizationId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Create a run record
    const run = await this.prisma.agentRun.create({
      data: {
        agentId,
        userId,
        status: 'queued',
        input,
      },
    });

    // In a real implementation, this would enqueue the run to BullMQ
    // For now, return the run ID
    return {
      runId: run.id,
      status: 'queued',
      message: 'Run queued for execution',
    };
  }

  private async checkOrgAccess(userId: string, organizationId: string) {
    const hasAccess = await this.prisma.checkOrgAccess(userId, organizationId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this organization');
    }
  }
}
