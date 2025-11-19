import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';

export class CreateAgentDto {
  @ApiProperty()
  @IsString()
  organizationId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['copilot', 'scheduled', 'webhook', 'email', 'manual'] })
  @IsEnum(['copilot', 'scheduled', 'webhook', 'email', 'manual'])
  type: string;

  @ApiPropertyOptional({ enum: ['single_step', 'plan_and_execute', 'loop_with_limits'] })
  @IsOptional()
  @IsEnum(['single_step', 'plan_and_execute', 'loop_with_limits'])
  planningMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultModelAlias?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxSteps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3600)
  maxDuration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  systemPrompt?: string;
}
