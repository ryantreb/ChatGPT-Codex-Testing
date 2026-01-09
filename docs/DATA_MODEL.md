# Data Model

## Entity Relationship Overview

```
Organization
├── Users (via OrgMembership)
├── Roles
├── Agents
├── Chats
├── Tools
├── Detections
├── Files
└── AuditLogs

Agent
├── SystemPrompts
├── Triggers
├── Runs
├── Tools (via AgentTool)
├── ContextDocuments
└── Memories

Chat
├── Events
└── Artifacts
```

## Core Entities

### Organization
Multi-tenant organization entity.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Organization name |
| slug | String | URL-friendly identifier (unique) |
| defaultModelAlias | String | Default LLM model |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships**:
- Has many Users (via OrgMembership)
- Has many Agents
- Has many Chats
- Has many Tools
- Has many Detections

### User
User account entity.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| email | String | Email (unique) |
| name | String | Full name |
| passwordHash | String | Bcrypt hashed password |
| lastLoginAt | DateTime | Last login timestamp |
| ssoProvider | String | SSO provider (optional) |
| ssoProviderId | String | External SSO ID (optional) |

**Relationships**:
- Belongs to many Organizations (via OrgMembership)
- Has many Chats
- Has many uploaded Files

### OrgMembership
Junction table for User-Organization relationship with role.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | Foreign key to Organization |
| userId | UUID | Foreign key to User |
| roleId | UUID | Foreign key to Role |

**Unique constraint**: (organizationId, userId)

### Role
RBAC role entity.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | Foreign key to Organization |
| name | String | Role name (e.g., "OrgAdmin") |
| description | String | Role description |
| isSystem | Boolean | System role (cannot be deleted) |

**Relationships**:
- Has many Permissions (via RolePermission)

**Unique constraint**: (organizationId, name)

### Permission
Permission definition.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| key | String | Permission key (e.g., "agents.create") |
| module | String | Module name |
| action | String | Action (create, read, update, delete, run) |

**Standard Permissions**:
- `agents.create`, `agents.read`, `agents.update`, `agents.delete`, `agents.run`
- `detections.create`, `detections.read`, `detections.update`, `detections.delete`
- `audit.view`
- `settings.manage_users`, `settings.manage_roles`

### Agent
AI agent configuration.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | Foreign key to Organization |
| name | String | Agent name |
| description | String | Agent description |
| type | Enum | "copilot", "scheduled", "webhook", "email", "manual" |
| planningMode | Enum | "single_step", "plan_and_execute", "loop_with_limits" |
| status | Enum | "draft", "active", "paused", "archived" |
| defaultModelAlias | String | Default LLM model |
| maxSteps | Integer | Max iterations for loop mode |
| maxDuration | Integer | Max duration in seconds |
| createdByUserId | UUID | Foreign key to User |

**Relationships**:
- Has many SystemPrompts
- Has many Triggers
- Has many Runs
- Has many Tools (via AgentTool)
- Has many ContextDocuments
- Has many Memories

### AgentSystemPrompt
Versioned system prompts for agents.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| agentId | UUID | Foreign key to Agent |
| description | String | Version description |
| prompt | Text | System prompt content |
| status | Enum | "draft", "active", "archived" |
| changedByUserId | UUID | Foreign key to User |
| changedByEmail | String | Email of user who created |

**Behavior**: Only one system prompt can be "active" per agent.

### AgentTrigger
Trigger configuration for agents.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| agentId | UUID | Foreign key to Agent |
| name | String | Trigger name |
| type | Enum | "cron", "webhook", "email", "integration" |
| source | String | Source system (e.g., "jira", "slack") |
| definition | JSON | Trigger configuration |
| enabled | Boolean | Enable/disable trigger |
| secret | String | Webhook secret |
| lastRunAt | DateTime | Last execution timestamp |
| nextRunAt | DateTime | Next scheduled execution |

**definition examples**:
```json
// Cron trigger
{
  "schedule": "0 */6 * * *"
}

// Webhook trigger
{
  "url": "https://...",
  "method": "POST"
}

// Email trigger
{
  "emailAddress": "agent@example.com"
}
```

### AgentRun
Execution run of an agent.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| agentId | UUID | Foreign key to Agent |
| triggerId | UUID | Foreign key to AgentTrigger (optional) |
| chatId | UUID | Foreign key to Chat (optional) |
| userId | UUID | Foreign key to User (optional) |
| status | Enum | "queued", "running", "succeeded", "failed", "cancelled" |
| startedAt | DateTime | Start timestamp |
| finishedAt | DateTime | Finish timestamp |
| input | JSON | Input data |
| output | JSON | Output data |
| error | Text | Error message (if failed) |
| inputTokens | Integer | LLM input tokens |
| outputTokens | Integer | LLM output tokens |
| totalTokens | Integer | Total LLM tokens |
| evalScore | Float | Evaluation score (0-1) |
| evalExplanation | Text | Evaluation explanation |

### Chat
Chat session entity.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | Foreign key to Organization |
| userId | UUID | Foreign key to User |
| agentId | UUID | Foreign key to Agent (optional) |
| title | String | Chat title |
| experience | Enum | "chat", "copilot", "builder" |
| modelAlias | String | LLM model used |
| isStreaming | Boolean | Currently streaming |
| inputTokens | Integer | Total input tokens |
| outputTokens | Integer | Total output tokens |
| totalTokens | Integer | Total tokens |

### ChatEvent
Individual message/event in a chat.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| chatId | UUID | Foreign key to Chat |
| timestamp | BigInt | Unix timestamp (milliseconds) |
| sender | Enum | "user", "agent", "system" |
| messageType | Enum | "text", "tool-call", "tool-result", "system" |
| content | Text | Message content |
| modelAlias | String | LLM model used |
| toolCalls | JSON | Tool calls made |

**toolCalls example**:
```json
[
  {
    "type": "tool-call",
    "toolCallId": "call_123",
    "toolName": "query_siem",
    "input": {"query": "..."}
  }
]
```

### ChatAttachment
File attachments in chat messages.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| chatEventId | UUID | Foreign key to ChatEvent |
| fileId | UUID | Foreign key to File |

### File
Uploaded file entity.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | Foreign key to Organization |
| uploaderUserId | UUID | Foreign key to User |
| fileName | String | Original filename |
| mimeType | String | MIME type |
| size | Integer | File size in bytes |
| storagePath | String | Storage location |
| fileType | Enum | "image", "document", "log", "other" |
| previewText | Text | Text preview/OCR |

### Tool
Integration tool configuration.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | Foreign key to Organization |
| name | String | Tool name |
| type | Enum | "http", "splunk", "jira", "sentinel", "edr", "custom" |
| description | String | Tool description |
| config | JSON | Tool configuration |
| enabled | Boolean | Enable/disable tool |

**config example**:
```json
{
  "baseUrl": "https://splunk.example.com",
  "apiKey": "encrypted-key",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {"type": "string"}
    }
  }
}
```

### Detection
Security detection rule/agent.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | Foreign key to Organization |
| title | String | Detection title |
| description | Text | Detection description |
| type | Enum | "rule", "pattern-agent" |
| status | Enum | "draft", "active", "archived" |
| linkedAgentId | UUID | Foreign key to Agent (optional) |
| ruleRef | String | External rule reference |
| mitreTechniqueIds | String[] | MITRE ATT&CK technique IDs |
| severity | Enum | "low", "medium", "high", "critical" |

### MitreTechnique
MITRE ATT&CK technique reference.

| Field | Type | Description |
|-------|------|-------------|
| id | String | MITRE ID (e.g., "T1566") |
| name | String | Technique name |
| tactic | String | MITRE tactic |
| description | Text | Technique description |
| url | String | MITRE reference URL |

### ContextDocument
Context document for RAG.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | Foreign key to Organization |
| agentId | UUID | Foreign key to Agent (optional, null = org-wide) |
| title | String | Document title |
| sourceType | Enum | "url", "file", "doc", "manual" |
| sourceRef | String | Source reference |
| content | Text | Document content |
| createdByUserId | UUID | Foreign key to User |

**Relationships**:
- Has many DocumentChunks

### DocumentChunk
Chunked document segment with embedding.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| documentId | UUID | Foreign key to ContextDocument |
| chunkIndex | Integer | Chunk order |
| content | Text | Chunk text |
| embedding | Vector(1536) | Text embedding vector |
| metadata | JSON | Additional metadata |

**Vector Search**:
```sql
SELECT content FROM document_chunks
ORDER BY embedding <=> query_embedding
LIMIT 5;
```

### AgentMemory
Agent memory/state storage.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| agentId | UUID | Foreign key to Agent |
| organizationId | UUID | Foreign key to Organization |
| scope | Enum | "global", "agent", "run" |
| key | String | Memory key |
| value | Text | Memory value |
| embedding | Vector(1536) | Value embedding (optional) |
| metadata | JSON | Additional metadata |

### AuditLog
Audit log entry.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| timestamp | DateTime | Event timestamp |
| organizationId | UUID | Foreign key to Organization |
| event | String | Event type (e.g., "agent.create") |
| actor | String | Actor identifier |
| userId | UUID | Foreign key to User (optional) |
| ipAddress | String | IP address |
| agentId | UUID | Foreign key to Agent (optional) |
| runId | UUID | Foreign key to AgentRun (optional) |
| triggerId | UUID | Foreign key to AgentTrigger (optional) |
| data | JSON | Event data |

**Indexes**:
- (organizationId, timestamp)
- (event)
- (userId)

## Indexes and Performance

### Critical Indexes

```sql
-- Org membership lookup
CREATE INDEX idx_org_membership_user ON org_memberships(user_id);
CREATE INDEX idx_org_membership_org ON org_memberships(organization_id);

-- Agent lookups
CREATE INDEX idx_agents_org ON agents(organization_id);
CREATE INDEX idx_agents_status ON agents(status);

-- Chat lookups
CREATE INDEX idx_chats_user ON chats(user_id, updated_at DESC);
CREATE INDEX idx_chats_org ON chats(organization_id);

-- Audit log queries
CREATE INDEX idx_audit_logs_org_timestamp ON audit_logs(organization_id, timestamp DESC);
CREATE INDEX idx_audit_logs_event ON audit_logs(event);

-- Vector similarity search
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);
```

### Query Patterns

**List agents for organization**:
```sql
SELECT * FROM agents
WHERE organization_id = $1
ORDER BY created_at DESC;
```

**Get chat with events**:
```sql
SELECT c.*, e.*
FROM chats c
LEFT JOIN chat_events e ON e.chat_id = c.id
WHERE c.id = $1 AND c.user_id = $2
ORDER BY e.timestamp ASC;
```

**Semantic search**:
```sql
SELECT c.content, c.document_id
FROM document_chunks c
WHERE c.document_id IN (
  SELECT id FROM context_documents
  WHERE organization_id = $1 AND (agent_id = $2 OR agent_id IS NULL)
)
ORDER BY c.embedding <=> $3
LIMIT 5;
```

## Data Retention

**Default Retention Policies**:
- Chats: 90 days (configurable per org)
- Agent Runs: 30 days
- Audit Logs: 1 year (or indefinitely for compliance)
- Metrics: Aggregated after 90 days

**Archival Strategy**:
- Old data moved to cold storage (S3 Glacier)
- Summarized metrics retained in database
- Critical audit logs never deleted
