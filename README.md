# SecOps AI Agent Platform

A multi-tenant SaaS platform for security teams featuring AI agents for SecOps workflows, detection engineering, and MITRE ATT&CK coverage mapping.

## Features

- **Copilot Chat**: Interactive AI agents for ad-hoc investigations and workflows
- **Autonomous Agents**: Configurable agents triggered by webhooks, email, schedules, or API calls
- **Detection Engineering**: Pattern-based behavioral detection with MITRE ATT&CK mapping
- **Multi-tenancy**: Organizations, users, roles, and comprehensive RBAC
- **Audit Logging**: Full audit trail of all system activities
- **Tool Integrations**: SIEM, EDR, ticketing systems, and custom tools

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + Radix UI
- TanStack Query
- Zustand
- WebSocket/SSE for streaming

### Backend
- NestJS
- PostgreSQL with Prisma ORM
- pgvector for embeddings (RAG)
- Redis + BullMQ
- OpenAPI 3 specification

### Infrastructure
- Docker & docker-compose
- Kubernetes manifests
- GitHub Actions CI/CD

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+ (with pgvector extension)
- Redis 7+

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd secops-ai-platform
```

2. Install dependencies:
```bash
npm install
cd frontend && npm install
cd ../backend && npm install
```

3. Set up environment variables:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

4. Start infrastructure with Docker:
```bash
npm run docker:up
```

5. Run database migrations:
```bash
npm run prisma:migrate
```

6. Seed the database (optional):
```bash
npm run seed
```

7. Start development servers:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000` and the backend API at `http://localhost:3001`.

## Project Structure

```
/
├── frontend/          # Next.js frontend application
├── backend/           # NestJS backend API and worker
├── infra/             # Docker and Kubernetes configurations
└── docs/              # Documentation
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API.md)
- [Data Model](./docs/DATA_MODEL.md)
- [Security](./docs/SECURITY.md)
- [Testing](./docs/TESTING.md)
- [Assumptions](./docs/ASSUMPTIONS.md)

## Development

### Running Tests
```bash
npm run test
```

### Linting
```bash
npm run lint
```

### Building for Production
```bash
npm run build
```

## Deployment

See [infra/k8s/README.md](./infra/k8s/README.md) for Kubernetes deployment instructions.

## License

Proprietary - All rights reserved