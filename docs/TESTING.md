# Testing Strategy

## Overview

The SecOps AI Platform employs a comprehensive testing strategy covering unit tests, integration tests, end-to-end tests, and non-functional testing.

## Test Pyramid

```
          /\
         /E2E\
        /------\
       /  API   \
      /----------\
     / Integration\
    /--------------\
   /      Unit      \
  /------------------\
```

## Unit Tests

### Backend Unit Tests

**Framework**: Jest + NestJS Testing utilities

**Coverage Goals**:
- Services: 80%+
- Controllers: 70%+
- Guards/Interceptors: 90%+

**Example: Agent Service Test**:
```typescript
describe('AgentsService', () => {
  let service: AgentsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentsService,
        {
          provide: PrismaService,
          useValue: {
            agent: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findAll', () => {
    it('should return agents for organization', async () => {
      const mockAgents = [{ id: 'uuid', name: 'Test Agent' }];
      jest.spyOn(prisma.agent, 'findMany').mockResolvedValue(mockAgents);

      const result = await service.findAll('org-id', 'user-id');

      expect(result).toEqual(mockAgents);
      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-id' },
        include: expect.any(Object),
      });
    });
  });
});
```

### Frontend Unit Tests

**Framework**: Jest + React Testing Library

**Coverage Goals**:
- Components: 70%+
- Hooks: 80%+
- Utilities: 90%+

**Example: API Client Test**:
```typescript
describe('ApiClient', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient();
  });

  it('should login and store token', async () => {
    const mockResponse = {
      access_token: 'token123',
      user: { email: 'test@example.com' },
    };

    jest.spyOn(axios, 'post').mockResolvedValue({ data: mockResponse });

    const result = await apiClient.login('test@example.com', 'password');

    expect(result).toEqual(mockResponse);
    expect(localStorage.getItem('auth_token')).toBe('token123');
  });
});
```

## Integration Tests

### Backend Integration Tests

**Framework**: Jest + Supertest

**Scope**:
- HTTP endpoints with real database (test DB)
- Tool adapters with mocked external services
- Agent execution with mocked LLM
- Queue processing

**Setup**:
```typescript
describe('AgentsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LlmService)
      .useValue(mockLlmService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Clean database
    await prisma.agent.deleteMany();
    await prisma.organization.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/agents (POST) should create agent', () => {
    return request(app.getHttpServer())
      .post('/agents')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        organizationId: 'org-id',
        name: 'Test Agent',
        type: 'copilot',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.name).toBe('Test Agent');
      });
  });
});
```

### Database Integration Tests

**Test Database**:
- Separate test database
- Migrations applied before tests
- Cleaned between tests

**Example: Prisma Service Test**:
```typescript
describe('PrismaService - Multi-tenancy', () => {
  it('should enforce organization scoping', async () => {
    const org1 = await prisma.organization.create({ data: { name: 'Org 1' } });
    const org2 = await prisma.organization.create({ data: { name: 'Org 2' } });

    const agent1 = await prisma.agent.create({
      data: { organizationId: org1.id, name: 'Agent 1' },
    });

    // User from org2 should not see agent1
    const result = await prisma.agent.findFirst({
      where: { id: agent1.id, organizationId: org2.id },
    });

    expect(result).toBeNull();
  });
});
```

## End-to-End Tests

### Framework

**Playwright** (recommended) or **Cypress**

**Scope**:
- Critical user flows
- Cross-page interactions
- Real browser testing

### Key Flows to Test

1. **Authentication Flow**:
   - User registration
   - Login
   - Logout
   - SSO login

2. **Agent Creation Flow**:
   - Navigate to Agents page
   - Click "Create Agent"
   - Fill in form
   - Create system prompt
   - Save agent
   - Verify agent appears in list

3. **Chat Flow**:
   - Navigate to Chat page
   - Send message
   - Receive streamed response
   - Provide feedback (thumbs up/down)

4. **Agent Execution Flow**:
   - Manually trigger agent run
   - View run status
   - View run results
   - Check audit logs

**Example: Playwright Test**:
```typescript
test('create and run agent', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Create agent
  await page.goto('http://localhost:3000/app/agents');
  await page.click('text=Create Agent');
  await page.fill('input[name="name"]', 'Test Agent');
  await page.fill('textarea[name="description"]', 'Test description');
  await page.selectOption('select[name="type"]', 'copilot');
  await page.click('button:has-text("Save")');

  // Verify agent created
  await expect(page.locator('text=Test Agent')).toBeVisible();

  // Run agent
  await page.click('text=Test Agent');
  await page.click('button:has-text("Run Agent")');
  await page.fill('textarea[name="input"]', 'Test input');
  await page.click('button:has-text("Execute")');

  // Verify run started
  await expect(page.locator('text=queued')).toBeVisible();
});
```

## Load & Performance Testing

### Tools

- **k6**: Load testing
- **Artillery**: API load testing
- **Lighthouse**: Frontend performance

### Load Test Scenarios

**Scenario 1: API Endpoints**:
```javascript
// k6 script
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100,              // 100 virtual users
  duration: '5m',        // Run for 5 minutes
};

export default function () {
  const res = http.get('http://api.example.com/agents', {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

**Scenario 2: WebSocket Streaming**:
- Concurrent chat sessions
- Streaming message throughput
- Connection stability

**Performance Targets**:
- API response time: p95 < 500ms
- Chat streaming latency: < 100ms
- Page load time: < 2 seconds
- Database queries: < 100ms

## Security Testing

### Automated Security Scans

**Tools**:
- **npm audit**: Dependency vulnerabilities
- **Snyk**: Container & code scanning
- **OWASP ZAP**: Web application scanning

**CI Integration**:
```yaml
# GitHub Actions
- name: Run security audit
  run: |
    cd backend && npm audit --audit-level=moderate
    cd frontend && npm audit --audit-level=moderate

- name: Snyk scan
  uses: snyk/actions/node@master
  with:
    args: --severity-threshold=high
```

### Manual Security Testing

**Test Cases**:

1. **Authentication**:
   - [ ] Weak password rejection
   - [ ] Brute force protection
   - [ ] JWT expiration
   - [ ] Invalid token rejection

2. **Authorization**:
   - [ ] Cross-org access prevention
   - [ ] Role-based access enforcement
   - [ ] API endpoint permissions

3. **Input Validation**:
   - [ ] SQL injection attempts
   - [ ] XSS payloads
   - [ ] Large file uploads
   - [ ] Invalid JSON/data types

4. **Session Management**:
   - [ ] Token theft prevention
   - [ ] Concurrent session handling
   - [ ] Logout invalidation

## Test Data Management

### Test Fixtures

**Backend**:
```typescript
// test/fixtures/organizations.fixture.ts
export const testOrganization = {
  id: 'test-org-id',
  name: 'Test Organization',
  slug: 'test-org',
};

export const testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
};
```

**Seeding Test Data**:
```typescript
beforeEach(async () => {
  const org = await prisma.organization.create({
    data: testOrganization,
  });

  const user = await prisma.user.create({
    data: testUser,
  });

  await prisma.orgMembership.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: adminRole.id,
    },
  });
});
```

### Mocking External Services

**LLM Provider Mock**:
```typescript
const mockLlmService = {
  generate: jest.fn().mockResolvedValue({
    content: 'Mocked LLM response',
    toolCalls: [],
    finishReason: 'stop',
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
  }),
};
```

**Tool Executor Mock**:
```typescript
const mockToolExecutor = {
  name: 'query_siem',
  execute: jest.fn().mockResolvedValue({
    results: [{ event: 'test event' }],
  }),
};
```

## Continuous Testing

### CI Pipeline

```yaml
# GitHub Actions workflow
test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: ankane/pgvector:latest
      env:
        POSTGRES_PASSWORD: postgres
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
    redis:
      image: redis:7-alpine

  steps:
    - uses: actions/checkout@v4

    - name: Install dependencies
      run: npm ci

    - name: Run unit tests
      run: npm run test:unit

    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

### Test Coverage Reports

**Tools**:
- Istanbul/nyc for coverage
- Codecov for reporting

**Coverage Thresholds**:
```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 75,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

## Testing Best Practices

1. **Arrange-Act-Assert Pattern**:
   ```typescript
   it('should create agent', async () => {
     // Arrange
     const dto = { name: 'Test' };

     // Act
     const result = await service.create(dto);

     // Assert
     expect(result.name).toBe('Test');
   });
   ```

2. **Test Isolation**:
   - Each test should be independent
   - Use database cleanup between tests
   - Avoid shared mutable state

3. **Descriptive Test Names**:
   ```typescript
   // Good
   it('should reject duplicate organization names', ...);

   // Bad
   it('test organization', ...);
   ```

4. **Test Edge Cases**:
   - Null/undefined inputs
   - Empty arrays/objects
   - Boundary values
   - Error conditions

5. **Mock External Dependencies**:
   - LLM providers
   - Email services
   - External APIs
   - File systems

6. **Keep Tests Fast**:
   - Unit tests: < 50ms each
   - Integration tests: < 500ms each
   - E2E tests: < 5s each

## Manual Testing Checklist

### Pre-Release Testing

- [ ] User registration and login
- [ ] Create, update, delete agents
- [ ] Execute agent runs (manual, scheduled, webhook)
- [ ] Chat with agent (streaming)
- [ ] File upload in chat
- [ ] Create detection rules
- [ ] View MITRE coverage
- [ ] Search audit logs
- [ ] Manage users and roles
- [ ] Configure SSO
- [ ] API key creation and usage
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsiveness
- [ ] Accessibility (screen readers, keyboard navigation)

### Regression Testing

After each major change, verify:
- [ ] No existing functionality broken
- [ ] Performance not degraded
- [ ] Security controls intact
- [ ] Audit logging still working
