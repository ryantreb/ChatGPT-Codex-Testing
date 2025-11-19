# API Documentation

## Base URL

```
Development: http://localhost:3001
Production: https://api.secops-ai.example.com
```

## Authentication

All protected endpoints require authentication via JWT token or API key.

### JWT Authentication
```http
Authorization: Bearer <token>
```

### API Key Authentication
```http
Authorization: Bearer sk_<api_key>
```

## Core Endpoints

### Authentication

#### POST /auth/register
Register a new user and organization.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "organizationName": "Acme Corp"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "organizations": [
      {
        "id": "uuid",
        "name": "Acme Corp",
        "slug": "acme-corp",
        "role": "OrgAdmin"
      }
    ]
  }
}
```

#### POST /auth/login
Login with email and password.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**: Same as register

#### POST /auth/api-keys
Create an API key.

**Request**:
```json
{
  "organizationId": "uuid",
  "name": "Production Key"
}
```

**Response**:
```json
{
  "id": "uuid",
  "name": "Production Key",
  "key": "sk_AbCdEf1234567890",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### Agents

#### GET /agents
List all agents for an organization.

**Query Parameters**:
- `organizationId` (required): UUID of organization

**Response**:
```json
[
  {
    "id": "uuid",
    "name": "Alert Enrichment Agent",
    "description": "Enriches security alerts with context",
    "type": "webhook",
    "status": "active",
    "planningMode": "single_step",
    "createdAt": "2024-01-15T10:00:00Z",
    "systemPrompts": [
      {
        "id": "uuid",
        "prompt": "You are a security analyst...",
        "status": "active"
      }
    ],
    "triggers": [
      {
        "id": "uuid",
        "type": "webhook",
        "enabled": true
      }
    ],
    "_count": {
      "runs": 150,
      "chats": 50
    }
  }
]
```

#### GET /agents/:id
Get agent details.

**Query Parameters**:
- `organizationId` (required)

**Response**: Single agent object with full details

#### POST /agents
Create a new agent.

**Request**:
```json
{
  "organizationId": "uuid",
  "name": "New Agent",
  "description": "Agent description",
  "type": "copilot",
  "planningMode": "single_step",
  "defaultModelAlias": "claude-3-5-sonnet",
  "maxSteps": 10,
  "systemPrompt": "You are a helpful security assistant..."
}
```

**Response**: Created agent object

#### PUT /agents/:id
Update an agent.

**Query Parameters**:
- `organizationId` (required)

**Request**: Partial agent object

**Response**: Updated agent object

#### DELETE /agents/:id
Delete an agent.

**Response**:
```json
{
  "success": true
}
```

#### GET /agents/:id/system-prompts
Get all system prompt versions.

**Response**:
```json
[
  {
    "id": "uuid",
    "agentId": "uuid",
    "description": "Updated with better context",
    "prompt": "You are a security analyst...",
    "status": "active",
    "changedByEmail": "user@example.com",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
]
```

#### POST /agents/:agentId/system-prompts
Create a new system prompt version.

**Request**:
```json
{
  "description": "Improved prompt with examples",
  "prompt": "You are a security analyst..."
}
```

**Response**: Created system prompt object

#### POST /agents/:agentId/system-prompts/:promptId/activate
Activate a system prompt version.

**Response**: Updated system prompt object

#### GET /agents/:id/runs
Get agent run history.

**Query Parameters**:
- `organizationId` (required)
- `limit` (optional, default: 20)
- `offset` (optional, default: 0)

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "agentId": "uuid",
      "status": "succeeded",
      "startedAt": "2024-01-15T10:00:00Z",
      "finishedAt": "2024-01-15T10:05:00Z",
      "input": {},
      "output": {},
      "inputTokens": 1500,
      "outputTokens": 500,
      "totalTokens": 2000
    }
  ],
  "total": 150,
  "offset": 0,
  "limit": 20
}
```

#### POST /agents/:id/run
Manually trigger an agent run.

**Request**:
```json
{
  "organizationId": "uuid",
  "input": {
    "message": "Investigate this alert",
    "alertId": "12345"
  }
}
```

**Response**:
```json
{
  "runId": "uuid",
  "status": "queued",
  "message": "Run queued for execution"
}
```

### Chat

#### GET /chat/list
List all chats for a user.

**Query Parameters**:
- `organizationId` (required)
- `limit` (optional, default: 20)
- `offset` (optional, default: 0)

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Security Investigation",
      "experience": "copilot",
      "agentId": "uuid",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T11:00:00Z",
      "inputTokens": 2000,
      "outputTokens": 1000,
      "totalTokens": 3000
    }
  ],
  "total": 50,
  "offset": 0,
  "limit": 20
}
```

#### GET /chat/history
Get chat history with all events.

**Query Parameters**:
- `chatId` (required)

**Response**:
```json
{
  "chat": {
    "id": "uuid",
    "title": "Security Investigation",
    "experience": "copilot",
    "agentId": "uuid",
    "createdAt": "2024-01-15T10:00:00Z",
    "isStreaming": false,
    "totalTokens": 3000
  },
  "events": [
    {
      "id": "uuid",
      "type": "chat",
      "timestamp": 1705315200000,
      "sender": "user",
      "messageType": "text",
      "content": "What is this alert about?",
      "attachments": []
    },
    {
      "id": "uuid",
      "type": "chat",
      "timestamp": 1705315205000,
      "sender": "agent",
      "messageType": "text",
      "content": "This alert indicates...",
      "modelAlias": "claude-3-5-sonnet",
      "toolCalls": [
        {
          "type": "tool-call",
          "toolCallId": "call_123",
          "toolName": "query_siem",
          "input": {"query": "..."}
        }
      ]
    }
  ],
  "feedbackByEvent": {}
}
```

#### POST /chat/send
Send a message in a chat.

**Request**:
```json
{
  "chatId": "uuid",
  "organizationId": "uuid",
  "agentId": "uuid",
  "message": "What is this alert about?",
  "attachments": ["file-uuid-1", "file-uuid-2"]
}
```

**Response**:
```json
{
  "chatId": "uuid",
  "eventId": "uuid",
  "status": "accepted",
  "streamUrl": "/chat/uuid/stream"
}
```

#### POST /chat/feedback
Submit feedback for a chat event.

**Request**:
```json
{
  "eventId": "uuid",
  "feedbackType": "thumbs_up",
  "comment": "Very helpful response"
}
```

**Response**: Feedback object

#### DELETE /chat/:chatId
Delete a chat.

**Response**:
```json
{
  "success": true
}
```

### Agent Triggers

#### GET /agents/:agentId/triggers
Get all triggers for an agent.

**Response**: Array of trigger objects

#### POST /agents/:agentId/triggers
Create a new trigger.

**Request**:
```json
{
  "name": "Jira Webhook",
  "type": "webhook",
  "source": "jira",
  "definition": {
    "url": "https://api.example.com/webhook/xyz",
    "secret": "webhook-secret"
  },
  "enabled": true
}
```

**Response**: Created trigger object

#### PATCH /agents/:agentId/trigger/:triggerId/status
Enable or disable a trigger.

**Request**:
```json
{
  "enabled": true
}
```

#### GET /agents/:agentId/trigger/:source/fields
Get trigger configuration fields (webhook URL, secrets, etc.).

**Response**:
```json
{
  "success": true,
  "data": {
    "secret": "webhook-secret-xyz",
    "webhookUrl": "https://api.example.com/agents/uuid/trigger/webhook",
    "additionalFields": {
      "type": "jira",
      "jiraUrl": "https://acme.atlassian.net"
    }
  }
}
```

#### POST /agents/:agentId/trigger/webhook
Webhook endpoint to invoke agent (called externally).

**Request**: Arbitrary JSON payload

**Response**: Run ID

#### POST /agents/:agentId/trigger/email
Email webhook endpoint (called by email forwarding service).

**Request**: Email data

**Response**: Run ID

### Audit Logs

#### GET /audit-logs
Query audit logs.

**Query Parameters**:
- `organizationId` (required)
- `eventType` (optional)
- `userId` (optional)
- `agentId` (optional)
- `runId` (optional)
- `startDate` (optional)
- `endDate` (optional)
- `limit` (optional, default: 20)
- `offset` (optional, default: 0)

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "timestamp": "2024-01-15T10:00:00Z",
      "event": "agent.create",
      "actor": "user@example.com",
      "userId": "uuid",
      "ipAddress": "192.168.1.1",
      "agentId": "uuid",
      "data": {},
      "user": {
        "email": "user@example.com"
      },
      "agent": {
        "name": "Alert Enrichment Agent"
      }
    }
  ],
  "total": 500,
  "offset": 0,
  "limit": 20
}
```

## WebSocket API

### Chat Streaming

**Endpoint**: `ws://localhost:3001/chat` or `wss://api.example.com/chat`

**Events**:

**Client → Server**:
```json
{
  "event": "streamChat",
  "data": {
    "chatId": "uuid",
    "agentId": "uuid"
  }
}
```

**Server → Client**:
```json
// Stream start
{
  "event": "streamStart",
  "data": {
    "chatId": "uuid"
  }
}

// Content chunks
{
  "event": "streamChunk",
  "data": {
    "chatId": "uuid",
    "type": "content",
    "content": "This is a security alert..."
  }
}

// Tool call
{
  "event": "streamChunk",
  "data": {
    "chatId": "uuid",
    "type": "tool_call",
    "toolCall": {
      "id": "call_123",
      "toolName": "query_siem",
      "input": {}
    }
  }
}

// Stream complete
{
  "event": "streamComplete",
  "data": {
    "chatId": "uuid",
    "usage": {
      "inputTokens": 1500,
      "outputTokens": 500,
      "totalTokens": 2000
    }
  }
}

// Error
{
  "event": "streamError",
  "data": {
    "chatId": "uuid",
    "error": "Error message"
  }
}
```

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

**Common Status Codes**:
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `500` Internal Server Error

## Rate Limiting

API requests are rate-limited per organization:
- **Default**: 100 requests per 15-minute window
- **Burst**: Up to 200 requests in short bursts

Headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705315800
```

## OpenAPI/Swagger Documentation

Interactive API documentation is available at:
```
http://localhost:3001/api/docs
```

This provides:
- All endpoints with request/response schemas
- Try-it-out functionality
- Authentication setup
- Model schemas
