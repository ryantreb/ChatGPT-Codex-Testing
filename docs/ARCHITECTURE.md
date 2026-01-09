# Architecture Overview

## System Architecture

The SecOps AI Agent Platform is built as a modern, cloud-native, multi-tenant SaaS application with a clear separation between frontend, backend, and infrastructure layers.

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │   Chat   │  │  Agents  │  │Detections │  │   Settings   │  │
│  └──────────┘  └──────────┘  └───────────┘  └──────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/WebSocket
┌────────────────────────────┴────────────────────────────────────┐
│                      Backend (NestJS)                            │
│  ┌──────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌───────┐ ┌────────┐ │
│  │ Auth │ │ Agents │ │ Chat │ │  LLM   │ │ Tools │ │ Audit  │ │
│  └──────┘ └────────┘ └──────┘ └────────┘ └───────┘ └────────┘ │
│                              │                                   │
│                       ┌──────┴────────┐                         │
│                       │ Agent Executor│                         │
│                       └───────────────┘                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌─────────────────┐  ┌─────────┐  ┌──────────────┐           │
│  │   PostgreSQL    │  │  Redis  │  │  File Store  │           │
│  │   (+ pgvector)  │  │ (Queue) │  │   (S3/Local) │           │
│  └─────────────────┘  └─────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Technology Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Radix UI components
- **State Management**:
  - TanStack Query for server state
  - Zustand for client state (auth, UI preferences)
- **Real-time**: WebSocket/SSE for chat streaming

### Key Features
1. **Server-Side Rendering**: For optimal performance and SEO
2. **Client-Side Navigation**: Smooth SPA experience
3. **Optimistic Updates**: For immediate user feedback
4. **Real-time Streaming**: WebSocket-based chat streaming

### Page Structure
```
/app
  ├── (auth)
  │   ├── login
  │   └── register
  └── app
      ├── chat
      ├── agents
      │   ├── [id]
      │   └── new
      ├── detections
      │   └── mitre
      ├── audit-logs
      └── settings
```

## Backend Architecture

### Modular Structure
The backend follows NestJS module pattern with clear separation of concerns:

1. **API Server** (`apps/api`): HTTP + WebSocket endpoints
2. **Worker** (`apps/worker`): Background job processing
3. **Libraries** (`libs/*`): Shared modules for domain logic

### Core Modules

#### 1. Auth Module
- JWT-based authentication
- SSO support (SAML, OIDC)
- API key authentication
- Role-based access control (RBAC)

#### 2. Agents Module
- Agent CRUD operations
- System prompt versioning
- Agent configuration management
- Run history tracking

#### 3. Chat Module
- Real-time chat sessions
- WebSocket gateway for streaming
- File attachment handling
- Feedback collection

#### 4. LLM Module
- **Model Provider Abstraction**: Supports multiple LLM providers (Anthropic, OpenAI)
- **Agent Executor**: Orchestrates agent runs with:
  - Planning modes (single_step, plan_and_execute, loop_with_limits)
  - Tool calling with validation
  - RAG (Retrieval-Augmented Generation)
  - Memory management

#### 5. Tools Module
- Integration with external tools (SIEM, EDR, ticketing)
- Tool execution framework
- Generic HTTP tool adapter
- Specific adapters (Splunk, Jira, etc.)

#### 6. Detections Module
- Detection rule management
- MITRE ATT&CK mapping
- Pattern-based detection agents
- Coverage tracking

#### 7. Audit Module
- Comprehensive audit logging
- Event tracking for compliance
- Search and filtering capabilities

## Agent Execution Engine

### Planning Modes

#### Single Step Mode
```
User Input → LLM Call → (Optional Tool Calls) → Response
```
- One main LLM call
- Optional tool calling if needed
- Best for simple queries

#### Plan and Execute Mode
```
User Input → Create Plan → Execute Steps → Response
```
- First LLM call creates a plan
- Subsequent calls execute plan steps
- Good for complex, multi-step tasks

#### Loop with Limits Mode
```
User Input → LLM Call → Tool Call → LLM Call → ... → Response
```
- Iterative loop with max steps
- Agent can call tools multiple times
- Best for exploratory tasks

### RAG (Retrieval-Augmented Generation)

The platform implements RAG for context-aware responses:

1. **Document Ingestion**:
   - Documents chunked into segments
   - Embeddings generated via OpenAI/Anthropic
   - Stored in PostgreSQL with pgvector

2. **Retrieval**:
   - User query embedded
   - Semantic search via vector similarity
   - Top-k relevant chunks retrieved

3. **Augmentation**:
   - Retrieved context injected into system prompt
   - LLM generates response with context

### Tool Calling Framework

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

interface ToolExecutor {
  execute(input: any, context: ExecutionContext): Promise<any>;
}
```

Tools are:
- Defined with JSON schema for validation
- Executed server-side with access control
- Results fed back to LLM for continued reasoning

## Data Architecture

### Database Schema

**Key Tables**:
- Organizations, Users, Roles (multi-tenancy + RBAC)
- Agents, AgentSystemPrompts (agent configuration)
- AgentRuns, AgentTriggers (execution)
- Chat, ChatEvents (conversations)
- Tools, Detections (integrations & security)
- AuditLogs (compliance)

**Row-Level Security**: All queries scoped by organizationId to ensure multi-tenant isolation.

### Embeddings with pgvector

```sql
CREATE EXTENSION vector;

-- Example: Document chunks with embeddings
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  document_id UUID,
  content TEXT,
  embedding vector(1536),
  metadata JSONB
);

-- Similarity search
SELECT content FROM document_chunks
ORDER BY embedding <=> query_embedding
LIMIT 5;
```

### Queue System (BullMQ + Redis)

**Queues**:
- `agent-runs`: Scheduled and triggered agent executions
- `evaluations`: Post-run evaluations
- `notifications`: Slack, email, ticketing alerts

**Benefits**:
- Asynchronous processing
- Retry logic with exponential backoff
- Job prioritization
- Distributed worker support

## Security Architecture

### Authentication Flow

```
1. User submits credentials
2. Backend validates & generates JWT
3. JWT stored in client localStorage
4. Subsequent requests include JWT in Authorization header
5. Backend validates JWT on each request
```

### Multi-Tenancy Isolation

Every request is scoped to an organization:
- User → OrgMembership → Organization
- All queries filtered by organizationId
- Guards prevent cross-org access

### Audit Logging

All sensitive operations logged:
- Who (user/system)
- What (action)
- When (timestamp)
- Where (IP address)
- Context (agent, run, chat, etc.)

## Deployment Architecture

### Docker Compose (Local Development)
```
- PostgreSQL (with pgvector)
- Redis
- Backend API
- Worker
- Frontend
```

### Kubernetes (Production)
```
- Namespace: secops-ai
- StatefulSets: postgres, redis
- Deployments: api (3 replicas), worker (2 replicas), frontend (2 replicas)
- Services: ClusterIP for internal communication
- Ingress: NGINX for external traffic with TLS
```

### Scaling Strategy

**Horizontal Scaling**:
- API: Scale replicas based on HTTP traffic
- Worker: Scale based on queue depth
- Frontend: CDN + multiple replicas

**Vertical Scaling**:
- Database: Increase resources for large datasets
- Redis: Increase memory for queue throughput

**Database Scaling**:
- Read replicas for analytics queries
- Connection pooling (PgBouncer)
- Query optimization with indexes

## CI/CD Pipeline

### Stages

1. **Lint**: ESLint + Prettier
2. **Test**: Unit + Integration tests
3. **Build**: Compile TypeScript, bundle Next.js
4. **Docker**: Build and push images
5. **Deploy**: Update k8s manifests (optional)

### Environments

- **Development**: Local docker-compose
- **Staging**: K8s cluster with test data
- **Production**: K8s cluster with production data

## Monitoring & Observability

### Recommended Tools

- **Metrics**: Prometheus + Grafana
- **Logging**: ELK Stack or Loki
- **Tracing**: Jaeger or OpenTelemetry
- **Error Tracking**: Sentry
- **Uptime**: Pingdom or UptimeRobot

### Key Metrics

- API response times
- Agent execution duration
- LLM token usage
- Queue depth
- Error rates
- User activity

## Future Enhancements

1. **Advanced RAG**: Hybrid search (vector + keyword), reranking
2. **Agent Marketplace**: Share and discover agent templates
3. **Advanced Analytics**: Detection coverage metrics, agent performance
4. **Custom LLM Providers**: Support for self-hosted models
5. **Multi-region Deployment**: Global availability
6. **GraphQL API**: Alternative to REST for complex queries
