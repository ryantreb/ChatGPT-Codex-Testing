import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CreateSystemPromptDto } from './dto/create-system-prompt.dto';
import { CurrentUser, JwtAuthGuard, RequirePermissions, RbacGuard, PaginationDto } from '@app/common';

@ApiTags('agents')
@ApiBearerAuth()
@Controller('agents')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all agents in an organization' })
  async findAll(@Query('organizationId') organizationId: string, @CurrentUser() user: any) {
    return this.agentsService.findAll(organizationId, user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent details' })
  async findOne(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.agentsService.findOne(id, organizationId, user.userId);
  }

  @Post()
  @RequirePermissions('agents.create')
  @ApiOperation({ summary: 'Create a new agent' })
  async create(@Body() createAgentDto: CreateAgentDto, @CurrentUser() user: any) {
    return this.agentsService.create(
      createAgentDto,
      createAgentDto.organizationId,
      user.userId,
    );
  }

  @Put(':id')
  @RequirePermissions('agents.update')
  @ApiOperation({ summary: 'Update an agent' })
  async update(
    @Param('id') id: string,
    @Body() updateAgentDto: UpdateAgentDto,
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.agentsService.update(id, updateAgentDto, organizationId, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('agents.delete')
  @ApiOperation({ summary: 'Delete an agent' })
  async delete(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.agentsService.delete(id, organizationId, user.userId);
  }

  @Get(':id/system-prompts')
  @ApiOperation({ summary: 'Get all system prompt versions for an agent' })
  async getSystemPrompts(
    @Param('id') agentId: string,
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.agentsService.getSystemPrompts(agentId, organizationId, user.userId);
  }

  @Post(':id/system-prompts')
  @RequirePermissions('agents.update')
  @ApiOperation({ summary: 'Create a new system prompt version' })
  async createSystemPrompt(
    @Param('id') agentId: string,
    @Body() createDto: CreateSystemPromptDto,
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.agentsService.createSystemPrompt(agentId, createDto, organizationId, user.userId);
  }

  @Post(':agentId/system-prompts/:promptId/activate')
  @RequirePermissions('agents.update')
  @ApiOperation({ summary: 'Activate a system prompt version' })
  async activateSystemPrompt(
    @Param('agentId') agentId: string,
    @Param('promptId') promptId: string,
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.agentsService.activateSystemPrompt(agentId, promptId, organizationId, user.userId);
  }

  @Get(':id/runs')
  @ApiOperation({ summary: 'Get agent run history' })
  async getRuns(
    @Param('id') agentId: string,
    @Query('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: any,
  ) {
    return this.agentsService.getRuns(
      agentId,
      organizationId,
      user.userId,
      pagination.limit,
      pagination.offset,
    );
  }

  @Post(':id/run')
  @RequirePermissions('agents.run')
  @ApiOperation({ summary: 'Manually trigger an agent run' })
  async manualRun(
    @Param('id') agentId: string,
    @Body() body: { organizationId: string; input: any },
    @CurrentUser() user: any,
  ) {
    return this.agentsService.manualRun(agentId, body.input, body.organizationId, user.userId);
  }
}
