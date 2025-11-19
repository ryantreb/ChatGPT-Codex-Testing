# Assumptions & Design Decisions

This document lists all assumptions made during the design and implementation of the SecOps AI Agent Platform based on the technical reconstruction prompt.

## Platform Behavior

### Agent Execution

1. **Planning Modes**: Assumed three planning modes based on common LLM agent patterns:
   - `single_step`: One LLM call with optional tool use
   - `plan_and_execute`: Generate plan first, then execute
   - `loop_with_limits`: Iterative execution with max steps

2. **Tool Calling**: Assumed synchronous tool execution where:
   - Agent calls LLM
   - LLM requests tool use
   - Backend executes tool
   - Result fed back to LLM
   - Continues until completion or max steps

3. **RAG Implementation**: Assumed semantic search using pgvector:
   - Documents chunked into ~512-1024 token segments
   - Embeddings generated via OpenAI or Anthropic
   - Top-k retrieval (k=5 by default)
   - Context injected into system prompt

### Multi-Tenancy

4. **Organization Isolation**: Assumed strict row-level isolation:
   - Every query filtered by `organizationId`
   - Users belong to orgs via `OrgMembership`
   - Guards verify org access on every request

5. **Cross-Org Sharing**: Assumed NO sharing between organizations:
   - Agents are org-scoped
   - Context documents can be org-wide or agent-specific
   - No global agent marketplace (future enhancement)

### Authentication & Authorization

6. **JWT Expiration**: Assumed 7-day default expiration with no refresh token:
   - Users must re-login after expiration
   - Simpler implementation, acceptable for MVP

7. **SSO Configuration**: Assumed per-organization SSO:
   - Each org can configure own SAML/OIDC
   - Users authenticated via org's SSO
   - JIT user provisioning enabled

8. **RBAC Permissions**: Assumed permission format `module.action`:
   - Examples: `agents.create`, `detections.view`
   - Permissions assigned to roles
   - Roles assigned to users per organization

### Chat & Streaming

9. **WebSocket Implementation**: Assumed single WebSocket connection per chat:
   - Client connects to `/chat` namespace
   - Server streams chunks as LLM generates
   - Connection closes after completion

10. **Chat History**: Assumed full history stored in database:
    - All events (user, agent, tool calls) stored
    - No summarization (could add for cost reduction)
    - Events retrieved in chronological order

### Detections & MITRE

11. **MITRE ATT&CK Data**: Assumed static MITRE data seeded in database:
    - Techniques table pre-populated
    - Detections reference techniques via IDs
    - No auto-sync with MITRE (manual updates)

12. **Pattern-Based Detections**: Assumed these are scheduled agents:
    - Agent configured to query SIEM/EDR
    - Runs on schedule (e.g., every 6 hours)
    - Produces alerts/artifacts

13. **Detection Coverage**: Assumed coverage computed from:
    - Active detections linked to MITRE techniques
    - Coverage levels: none, partial, full (based on count)
    - Heat-map visualization

### Files & Storage

14. **File Storage**: Assumed configurable storage:
    - Local filesystem for development
    - S3-compatible object storage for production
    - File metadata in database, content in storage

15. **File Processing**: Assumed basic text extraction:
    - PDFs: extract text
    - Images: OCR (future enhancement)
    - Logs: plain text
    - Max file size: 50MB

### Triggers

16. **Webhook Triggers**: Assumed HMAC signature validation:
    - Secret shared with external system
    - Request signature verified
    - Payload passed to agent as input

17. **Email Triggers**: Assumed email forwarding service:
    - Emails forwarded to webhook endpoint
    - Parsed and passed to agent
    - Email body used as input

18. **Cron Triggers**: Assumed cron-style scheduling:
    - Standard cron syntax (e.g., `0 */6 * * *`)
    - Managed by BullMQ scheduler
    - Next run computed after each execution

### Agent Memories

19. **Memory Scope**: Assumed three scope levels:
    - `global`: Shared across all agents in org
    - `agent`: Specific to one agent
    - `run`: Specific to one run (ephemeral)

20. **Memory Retrieval**: Assumed semantic search:
    - Memories embedded like documents
    - Retrieved based on relevance to input
    - Used to inform agent behavior

### Audit Logging

21. **Event Types**: Assumed comprehensive event logging:
    - Auth events: login, logout, SSO
    - Resource events: create, update, delete
    - Execution events: run start, tool call, completion
    - Admin events: user management, settings changes

22. **Audit Retention**: Assumed 1-year default retention:
    - Longer for compliance requirements
    - Old logs archived to cold storage
    - Critical logs never deleted

### Evaluations

23. **Post-Run Evaluations**: Assumed optional LLM-based evaluation:
    - Separate LLM call scores run quality
    - Rubric: correctness, tool use, clarity
    - Score and explanation stored with run

24. **System Prompt Suggestions**: Assumed AI-generated improvements:
    - Evaluation suggests prompt improvements
    - Stored as draft system prompt
    - User reviews and activates if desired

## Technical Stack Choices

### Backend

25. **NestJS**: Chosen for:
    - TypeScript-first framework
    - Modular architecture
    - Built-in OpenAPI support
    - Dependency injection

26. **Prisma ORM**: Chosen for:
    - Type-safe database access
    - Migration management
    - pgvector support
    - Developer experience

27. **BullMQ**: Chosen for:
    - Robust job queue
    - Redis-based
    - Retry logic
    - Rate limiting

### Frontend

28. **Next.js App Router**: Chosen for:
    - Server-side rendering
    - File-based routing
    - API routes (not used, prefer dedicated backend)
    - React 18 features

29. **TanStack Query**: Chosen for:
    - Server state management
    - Caching and invalidation
    - Optimistic updates
    - Devtools

30. **Zustand**: Chosen for:
    - Lightweight client state
    - Simple API
    - Persistence support
    - TypeScript support

### LLM Providers

31. **Provider Abstraction**: Assumed unified interface:
    - Common interface for all providers
    - Model alias maps to actual model ID
    - Tool calling format normalized

32. **Anthropic as Default**: Assumed Claude 3.5 Sonnet as default:
    - Strong reasoning capabilities
    - Large context window
    - Function calling support

33. **OpenAI Support**: Assumed GPT-4 as alternative:
    - Function calling support
    - Common embeddings provider

### Database

34. **PostgreSQL with pgvector**: Chosen for:
    - Relational data + vector search
    - ACID transactions
    - Mature tooling
    - Cost-effective

35. **No Separate Vector DB**: Assumed pgvector sufficient:
    - Simpler architecture
    - Good performance for MVP scale
    - Can migrate to Pinecone/Weaviate later

## Deployment

36. **Docker Compose for Local Dev**: Assumed standard local setup:
    - Postgres, Redis, backend, worker, frontend
    - All services in one compose file
    - Easy one-command startup

37. **Kubernetes for Production**: Assumed cloud-native deployment:
    - Scalable replicas
    - StatefulSets for databases
    - Ingress for routing
    - Secrets for sensitive data

38. **No Auto-Scaling**: Assumed manual scaling:
    - Replica counts configured in manifests
    - HPA (Horizontal Pod Autoscaler) as future enhancement

## Data Model

39. **UUID Primary Keys**: Assumed UUIDs for all entities:
    - Better for distributed systems
    - No sequence collisions
    - Obscures record count

40. **Soft Deletes**: Assumed NO soft deletes:
    - Hard deletes with cascade
    - Audit logs preserve deletion events
    - Simpler query logic

41. **JSON Fields**: Assumed JSON for flexible data:
    - Tool configs
    - Agent run input/output
    - Trigger definitions
    - Allows schema evolution

## Security

42. **Password Hashing**: Assumed bcrypt with 10 rounds:
    - Industry standard
    - Configurable work factor
    - Sufficient for current threat model

43. **No 2FA**: Assumed 2FA not required for MVP:
    - Single-factor authentication sufficient
    - Future enhancement for enterprise tier

44. **API Rate Limiting**: Assumed simple rate limit:
    - 100 req/15min per org
    - No tiered limits
    - Can customize per org later

## UI/UX

45. **No Dark Mode**: Assumed light mode only:
    - Simpler implementation
    - Future enhancement
    - CSS variables allow easy addition

46. **No Internationalization**: Assumed English only:
    - Single language for MVP
    - i18n framework can be added later

47. **Minimal Mobile Optimization**: Assumed desktop-first:
    - Responsive layout
    - Not optimized for mobile workflows
    - Future enhancement

## Integrations

48. **Generic HTTP Tool**: Assumed catch-all tool adapter:
    - Supports any HTTP API
    - User provides URL, method, auth
    - Response parsed as JSON

49. **Stub Integrations**: Assumed specific adapters as placeholders:
    - Splunk, Jira, Sentinel mentioned but not fully implemented
    - Can be built on generic HTTP tool
    - Require user credentials

## Performance

50. **No Caching Layer**: Assumed database queries sufficiently fast:
    - Prisma query caching
    - No Redis cache for API responses
    - Can add Redis caching if needed

51. **Synchronous Agent Execution**: Assumed runs queue to BullMQ:
    - API returns immediately with run ID
    - Worker processes asynchronously
    - User polls for status or uses WebSocket

## Testing

52. **Manual Testing Focus**: Assumed limited automated testing for MVP:
    - Unit tests for critical paths
    - Integration tests for auth and agent execution
    - Manual E2E testing
    - Full test suite as future enhancement

## Future Enhancements Assumed Out of Scope

53. **Advanced RAG**: Hybrid search, reranking, multi-hop reasoning
54. **Agent Marketplace**: Share and discover agent templates
55. **Custom LLM Providers**: Self-hosted models, local LLMs
56. **Advanced Analytics**: Dashboards, metrics, usage tracking
57. **Multi-Region**: Global deployment, data residency
58. **GraphQL API**: Alternative to REST
59. **Real-Time Collaboration**: Multiple users editing agents
60. **Version Control for Agents**: Git-like branching/merging
61. **Agent Playground**: Test agents in sandbox
62. **Fine-Tuned Models**: Custom model training
63. **Budget Controls**: Per-org token/cost limits
64. **Alerting**: Slack/PagerDuty for agent failures

## Open Questions (Would Clarify with Stakeholders)

65. **Data Retention Policy**: How long to keep chats, runs, audit logs?
66. **Pricing Model**: Free tier? Per-seat? Per-token?
67. **Enterprise Features**: SAML required? Audit log export?
68. **Compliance**: SOC 2? GDPR? HIPAA?
69. **SLA Targets**: Uptime? Response time?
70. **Backup Strategy**: RPO/RTO targets?

## Conclusion

All assumptions are documented to ensure transparency and facilitate future refinement. These can be validated with stakeholders or adjusted based on user feedback and evolving requirements.
