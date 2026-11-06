# FS-01 — Multi-Vendor E-Commerce Marketplace

A production-oriented marketplace starter for customers, vendors and administrators. Frontend and backend are separate workspaces and can be deployed independently.

## Prerequisites

- Node.js 26 LTS and npm
- Docker Desktop with at least 6 GB RAM available for Docker (Elasticsearch is memory-intensive)
- Git

## 1. Configure environment

From the repository root:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The supplied credentials are development-only placeholders. Change them before any shared or production deployment.

## 2. Start infrastructure

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

This starts MongoDB (replica set), Redis and Elasticsearch. Wait until the `mongo-rs-init` container exits successfully. Check containers with:

```bash
docker compose -f infrastructure/docker-compose.yml ps
```

MongoDB replica-set mode is intentional: later checkout transactions and change-stream-based search indexing depend on it. Elasticsearch is configured without authentication only for isolated local development; never expose this configuration publicly.

## 3. Install dependencies

```bash
npm install
```

## 4. Run frontend and backend

```bash
npm run dev
```

- Web app: http://localhost:5173
- API root: http://localhost:4000
- API liveness: http://localhost:4000/api/v1/health/live
- API readiness: http://localhost:4000/api/v1/health/ready
- MongoDB: localhost:27017
- Redis: localhost:6379
- Elasticsearch: http://localhost:9200

The readiness endpoint reports each infrastructure dependency. It returns HTTP 503 until all required dependencies are reachable.

## Useful scripts

```bash
npm run typecheck
npm test
npm run build
```

## Troubleshooting

- If Docker reports Elasticsearch memory or VM-map errors, increase Docker Desktop memory to at least 6 GB; on Linux, check `vm.max_map_count` per Elastic's installation guidance.
- If MongoDB readiness fails, inspect `fs01-mongo-rs-init` logs and confirm the replica set initialized with `rs.status()`.
- If Redis does not connect, make sure the `REDIS_URL` password matches `REDIS_PASSWORD` in `.env`.
- If the frontend cannot reach the API, check `VITE_API_BASE_URL` and `WEB_ORIGIN` in `.env`.

## Repository layout

```text
apps/api          Express REST API
apps/web          React marketplace frontend
infrastructure    Local Docker Compose services
docs              Architecture and database design notes
```

## Current milestone

**Step 1 — Foundation:** workspace scaffold, initial storefront shell, API liveness/readiness endpoints, environment validation, structured logging, dependency connectors, Docker Compose and architecture notes.

**Next milestone:** Step 2 — design and implement Mongoose schemas, indexes, seed data and relationship/ownership rules before building authentication.
