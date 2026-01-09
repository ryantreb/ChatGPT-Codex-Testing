# Deployment Guide

This guide covers deploying the SecOps AI Agent Platform in various environments.

## Table of Contents

1. [Local Development](#local-development)
2. [Production Deployment (Kubernetes)](#production-deployment-kubernetes)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
6. [Scaling & Performance](#scaling--performance)

---

## Local Development

### Prerequisites

- **Node.js** 18 or higher
- **Docker** and **Docker Compose**
- **Git**

### Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd secops-ai-platform

# 2. Install root dependencies
npm install

# 3. Install backend dependencies
cd backend
npm install
cd ..

# 4. Install frontend dependencies
cd frontend
npm install
cd ..

# 5. Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit backend/.env and add your API keys:
# ANTHROPIC_API_KEY=your-key-here
# OPENAI_API_KEY=your-key-here

# 6. Start infrastructure with Docker Compose
docker-compose -f infra/docker-compose.yml up -d postgres redis

# 7. Run database migrations
cd backend
npx prisma migrate dev
npx prisma generate

# 8. Seed the database (optional but recommended)
npm run seed

# 9. Start the development servers
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api/docs
- **Prisma Studio** (Database GUI): `cd backend && npx prisma studio`

### Demo Credentials

```
Email: demo@example.com
Password: demo123
```

### Development Workflow

```bash
# Run linting
npm run lint

# Run tests
npm run test

# Build for production
npm run build

# View database with Prisma Studio
cd backend && npx prisma studio

# Reset database (WARNING: deletes all data)
cd backend
npx prisma migrate reset
npm run seed
```

---

## Production Deployment (Kubernetes)

### Prerequisites

- **Kubernetes cluster** (GKE, EKS, AKS, or self-managed)
- **kubectl** configured to access your cluster
- **Docker registry** (Docker Hub, GCR, ECR, etc.)
- **Domain name** with DNS configured
- **SSL certificate** (Let's Encrypt via cert-manager recommended)

### Step 1: Build and Push Docker Images

```bash
# 1. Build images
docker build -t your-registry/secops-ai-backend:latest -f infra/Dockerfile.backend .
docker build -t your-registry/secops-ai-worker:latest -f infra/Dockerfile.worker .
docker build -t your-registry/secops-ai-frontend:latest -f infra/Dockerfile.frontend .

# 2. Push to registry
docker push your-registry/secops-ai-backend:latest
docker push your-registry/secops-ai-worker:latest
docker push your-registry/secops-ai-frontend:latest
```

### Step 2: Create Kubernetes Secrets

```bash
# Create namespace
kubectl create namespace secops-ai

# Create database secret
kubectl create secret generic postgres-secret \
  --from-literal=password='your-strong-password' \
  -n secops-ai

# Create application secrets
kubectl create secret generic app-secrets \
  --from-literal=database-url='postgresql://postgres:your-strong-password@postgres:5432/secops_ai?schema=public' \
  --from-literal=jwt-secret='your-jwt-secret-min-32-chars' \
  --from-literal=anthropic-api-key='your-anthropic-key' \
  --from-literal=openai-api-key='your-openai-key' \
  -n secops-ai

# Optional: Create SMTP secrets for email notifications
kubectl create secret generic smtp-secrets \
  --from-literal=host='smtp.sendgrid.net' \
  --from-literal=port='587' \
  --from-literal=user='apikey' \
  --from-literal=password='your-sendgrid-api-key' \
  -n secops-ai
```

### Step 3: Deploy Infrastructure

```bash
# Apply all Kubernetes manifests
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/postgres-statefulset.yaml
kubectl apply -f infra/k8s/redis-statefulset.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n secops-ai --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n secops-ai --timeout=300s
```

### Step 4: Run Database Migrations

```bash
# Create a one-time job to run migrations
kubectl run prisma-migrate \
  --image=your-registry/secops-ai-backend:latest \
  --rm -it --restart=Never \
  --env="DATABASE_URL=postgresql://postgres:your-password@postgres:5432/secops_ai?schema=public" \
  -n secops-ai \
  -- npx prisma migrate deploy

# Seed the database (optional)
kubectl run prisma-seed \
  --image=your-registry/secops-ai-backend:latest \
  --rm -it --restart=Never \
  --env="DATABASE_URL=postgresql://postgres:your-password@postgres:5432/secops_ai?schema=public" \
  -n secops-ai \
  -- npm run seed
```

### Step 5: Deploy Applications

Update image references in deployment files, then:

```bash
# Deploy backend services
kubectl apply -f infra/k8s/api-deployment.yaml
kubectl apply -f infra/k8s/worker-deployment.yaml

# Deploy frontend
kubectl apply -f infra/k8s/frontend-deployment.yaml

# Wait for deployments to be ready
kubectl wait --for=condition=available deployment/api -n secops-ai --timeout=300s
kubectl wait --for=condition=available deployment/worker -n secops-ai --timeout=300s
kubectl wait --for=condition=available deployment/frontend -n secops-ai --timeout=300s
```

### Step 6: Set Up Ingress

#### Install NGINX Ingress Controller (if not already installed)

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```

#### Install cert-manager for SSL (if not already installed)

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create Let's Encrypt issuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

#### Update and Apply Ingress

Edit `infra/k8s/ingress.yaml` to use your domain:

```yaml
spec:
  tls:
    - hosts:
        - secops-ai.yourdomain.com
        - api.secops-ai.yourdomain.com
      secretName: secops-ai-tls
  rules:
    - host: secops-ai.yourdomain.com
      # ... frontend rules
    - host: api.secops-ai.yourdomain.com
      # ... api rules
```

Then apply:

```bash
kubectl apply -f infra/k8s/ingress.yaml
```

### Step 7: Configure DNS

Point your DNS records to the Ingress LoadBalancer IP:

```bash
# Get the LoadBalancer IP
kubectl get ingress secops-ai-ingress -n secops-ai

# Create A records:
# secops-ai.yourdomain.com -> LoadBalancer IP
# api.secops-ai.yourdomain.com -> LoadBalancer IP
```

### Step 8: Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n secops-ai

# Check services
kubectl get svc -n secops-ai

# Check ingress
kubectl get ingress -n secops-ai

# View logs
kubectl logs -f deployment/api -n secops-ai
kubectl logs -f deployment/worker -n secops-ai
kubectl logs -f deployment/frontend -n secops-ai

# Test the application
curl https://api.secops-ai.yourdomain.com/health
```

---

## Database Setup

### PostgreSQL Configuration

#### Production Database Recommendations

```yaml
# postgres-statefulset.yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "2000m"

# Storage
volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi  # Adjust based on needs
      storageClassName: ssd  # Use SSD for better performance
```

#### Enable pgvector Extension

The extension is enabled automatically in the Prisma migrations, but you can verify:

```sql
-- Connect to database
psql -h postgres-host -U postgres -d secops_ai

-- Check extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- If not installed
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Backup Strategy

```bash
# Create a CronJob for daily backups
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: secops-ai
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -h postgres -U postgres secops_ai | gzip > /backup/secops_ai_\$(date +%Y%m%d_%H%M%S).sql.gz
              # Upload to S3 or cloud storage here
            volumeMounts:
            - name: backup-volume
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: backup-volume
            persistentVolumeClaim:
              claimName: backup-pvc
EOF
```

#### Connection Pooling (Optional but Recommended)

Use PgBouncer for connection pooling:

```bash
# Add PgBouncer deployment
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer
  namespace: secops-ai
spec:
  replicas: 2
  selector:
    matchLabels:
      app: pgbouncer
  template:
    metadata:
      labels:
        app: pgbouncer
    spec:
      containers:
      - name: pgbouncer
        image: edoburu/pgbouncer:1.21.0
        env:
        - name: DATABASE_URL
          value: "postgres://postgres:password@postgres:5432/secops_ai"
        - name: MAX_CLIENT_CONN
          value: "1000"
        - name: DEFAULT_POOL_SIZE
          value: "25"
        ports:
        - containerPort: 5432
---
apiVersion: v1
kind: Service
metadata:
  name: pgbouncer
  namespace: secops-ai
spec:
  selector:
    app: pgbouncer
  ports:
  - port: 5432
    targetPort: 5432
EOF

# Update DATABASE_URL in app-secrets to use pgbouncer:5432
```

---

## Environment Configuration

### Backend Environment Variables

#### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/db?schema=public

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRES_IN=7d

# LLM Providers
LLM_PROVIDER=anthropic  # or openai
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Application
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://secops-ai.yourdomain.com
BACKEND_URL=https://api.secops-ai.yourdomain.com
```

#### Optional Variables

```bash
# Embeddings
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# File Storage
STORAGE_TYPE=s3  # or local
STORAGE_PATH=/app/uploads
AWS_S3_BUCKET=secops-ai-uploads
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Email (SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=noreply@secops-ai.example.com

# SSO (Optional)
SAML_ENTRY_POINT=https://sso.example.com/saml
SAML_ISSUER=secops-ai
SAML_CALLBACK_URL=https://api.secops-ai.yourdomain.com/auth/saml/callback
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_ISSUER=https://accounts.google.com

# Security
BCRYPT_ROUNDS=10
API_RATE_LIMIT_WINDOW=15m
API_RATE_LIMIT_MAX=100

# Worker
WORKER_CONCURRENCY=5
```

### Frontend Environment Variables

```bash
NEXT_PUBLIC_API_URL=https://api.secops-ai.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.secops-ai.yourdomain.com
```

---

## Monitoring & Troubleshooting

### Health Checks

```bash
# API health check
curl https://api.secops-ai.yourdomain.com/health

# Check pod status
kubectl get pods -n secops-ai

# Check pod logs
kubectl logs -f deployment/api -n secops-ai
kubectl logs -f deployment/worker -n secops-ai
kubectl logs -f deployment/frontend -n secops-ai

# Check events
kubectl get events -n secops-ai --sort-by='.lastTimestamp'
```

### Common Issues

#### 1. Pods Not Starting

```bash
# Describe pod to see error
kubectl describe pod <pod-name> -n secops-ai

# Common causes:
# - Image pull errors: Check registry credentials
# - Resource limits: Check cluster resources
# - Config errors: Check environment variables
```

#### 2. Database Connection Errors

```bash
# Test database connectivity
kubectl run -it --rm debug \
  --image=postgres:15 \
  --restart=Never \
  -n secops-ai \
  -- psql -h postgres -U postgres -d secops_ai

# Check database pod logs
kubectl logs -f statefulset/postgres -n secops-ai
```

#### 3. WebSocket Connection Fails

```bash
# Check NGINX Ingress config for WebSocket support
kubectl get ingress secops-ai-ingress -n secops-ai -o yaml

# Ensure these annotations are present:
# nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
# nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
# nginx.ingress.kubernetes.io/websocket-services: "api"
```

### Logging

Set up centralized logging with ELK or Loki:

```bash
# Example: Deploy Loki + Promtail
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack -n monitoring --create-namespace

# View logs in Grafana
kubectl port-forward -n monitoring svc/loki-grafana 3000:80
```

### Metrics

Set up Prometheus for metrics:

```bash
# Install Prometheus
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# Default: admin / prom-operator

# Import dashboards for:
# - NestJS application metrics
# - PostgreSQL metrics
# - Redis metrics
# - Node.js performance
```

---

## Scaling & Performance

### Horizontal Scaling

#### Scale API Pods

```bash
# Manual scaling
kubectl scale deployment api --replicas=5 -n secops-ai

# Auto-scaling based on CPU
kubectl autoscale deployment api \
  --min=3 --max=10 \
  --cpu-percent=70 \
  -n secops-ai
```

#### Scale Worker Pods

```bash
# Scale based on queue depth
kubectl scale deployment worker --replicas=5 -n secops-ai

# For queue-based scaling, use KEDA (Kubernetes Event-driven Autoscaling)
helm repo add kedacore https://kedacore.github.io/charts
helm install keda kedacore/keda -n keda --create-namespace

# Create ScaledObject for worker based on Redis queue length
kubectl apply -f - <<EOF
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: worker-scaler
  namespace: secops-ai
spec:
  scaleTargetRef:
    name: worker
  minReplicaCount: 2
  maxReplicaCount: 10
  triggers:
  - type: redis
    metadata:
      address: redis:6379
      listName: bull:agent-runs:wait
      listLength: "5"
EOF
```

### Vertical Scaling

Update resource limits in deployment files:

```yaml
# api-deployment.yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

### Database Scaling

#### Read Replicas

```bash
# Create read replica StatefulSet
# Update connection string to use read replica for queries
# Use primary for writes only
```

#### Connection Pooling

Configure PgBouncer (see Database Setup section)

### Caching

Add Redis caching layer:

```typescript
// In backend code
@Injectable()
export class CacheService {
  async get(key: string) {
    return this.redis.get(key);
  }

  async set(key: string, value: any, ttl = 3600) {
    return this.redis.setex(key, ttl, JSON.stringify(value));
  }
}
```

---

## Security Checklist

- [ ] SSL/TLS enabled with valid certificates
- [ ] Secrets stored in Kubernetes secrets (not environment files)
- [ ] Network policies configured to restrict pod-to-pod communication
- [ ] RBAC enabled in Kubernetes cluster
- [ ] Regular security updates and image scanning
- [ ] Database backups configured and tested
- [ ] Rate limiting enabled
- [ ] Audit logging enabled and monitored
- [ ] API keys rotated regularly
- [ ] SSO configured for user authentication

---

## Rollback Procedure

```bash
# View deployment history
kubectl rollout history deployment/api -n secops-ai

# Rollback to previous version
kubectl rollout undo deployment/api -n secops-ai

# Rollback to specific revision
kubectl rollout undo deployment/api --to-revision=2 -n secops-ai

# Check rollout status
kubectl rollout status deployment/api -n secops-ai
```

---

## Maintenance

### Update Application

```bash
# 1. Build and push new image
docker build -t your-registry/secops-ai-backend:v2.0.0 -f infra/Dockerfile.backend .
docker push your-registry/secops-ai-backend:v2.0.0

# 2. Update deployment
kubectl set image deployment/api api=your-registry/secops-ai-backend:v2.0.0 -n secops-ai

# 3. Watch rollout
kubectl rollout status deployment/api -n secops-ai
```

### Database Migrations

```bash
# Run migrations in a job
kubectl create job migrate-$(date +%s) \
  --image=your-registry/secops-ai-backend:latest \
  -n secops-ai \
  -- npx prisma migrate deploy
```

### Backup and Restore

```bash
# Backup database
kubectl exec -it statefulset/postgres -n secops-ai -- \
  pg_dump -U postgres secops_ai > backup.sql

# Restore database
kubectl exec -i statefulset/postgres -n secops-ai -- \
  psql -U postgres secops_ai < backup.sql
```

---

## Support

For issues or questions:
- Check logs: `kubectl logs -f deployment/api -n secops-ai`
- Review documentation in `/docs`
- Check GitHub issues
- Contact support team

---

**Congratulations!** Your SecOps AI Agent Platform is now deployed and ready to use! 🎉
