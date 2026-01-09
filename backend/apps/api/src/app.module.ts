import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '@app/auth';
import { AgentsModule } from '@app/agents';
import { ChatModule } from '@app/chat';
import { TriggersModule } from '@app/triggers';
import { RunsModule } from '@app/runs';
import { ToolsModule } from '@app/tools';
import { DetectionsModule } from '@app/detections';
import { AuditModule } from '@app/audit';
import { MetricsModule } from '@app/metrics';
import { NotificationsModule } from '@app/notifications';
import { LlmModule } from '@app/llm';
import { EmbeddingsModule } from '@app/embeddings';
import { FilesModule } from '@app/files';
import { CommonModule } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    CommonModule,
    AuthModule,
    AgentsModule,
    ChatModule,
    TriggersModule,
    RunsModule,
    ToolsModule,
    DetectionsModule,
    AuditModule,
    MetricsModule,
    NotificationsModule,
    LlmModule,
    EmbeddingsModule,
    FilesModule,
  ],
})
export class AppModule {}
