# Docker Deployment Guide

Production-oriented container setup for BehavioralDNA: multi-stage image, non-root runtime, health checks, PostgreSQL persistence, and optional Nginx edge proxy.

## Quick start

```bash
cp .env.example .env
# Edit .env — set DB_PASS, ADMIN_PASS, and JWT_SECRET

docker compose up -d --build
```

Dashboard: [http://localhost:3001](http://localhost:3001) (default `APP_PUBLISH_PORT`).

Login uses `ADMIN_USER` / `ADMIN_PASS` from `.env`.

## Stacks

| Command | Services |
|---------|----------|
| `docker compose up -d --build` | App + PostgreSQL |
| `docker compose --profile demo up -d --build` | Above + mock upstream backend on port 3002 |
| `docker compose --profile production up -d --build` | Above + Nginx on port 80 |
| `docker compose --profile redis up -d` | Adds Redis (for future caching integrations) |

### Demo with reverse proxy

```bash
# In .env:
TARGET_ORIGIN=http://mock-backend:3002

docker compose --profile demo up -d --build
curl http://localhost:3001/backend/api/users
```

### Production edge (Nginx)

```bash
docker compose --profile production up -d --build
# App only on internal network; public traffic via Nginx :80
```

## Security checklist

Before going live:

1. Set strong `DB_PASS`, `ADMIN_PASS`, and `JWT_SECRET` (e.g. `openssl rand -hex 32`).
2. Set `ALLOWED_ORIGINS` to your real domain(s), not `*`.
3. Set `DB_SYNC=false` after the first deploy if you manage schema with migrations.
4. Put TLS in front of Nginx (cert-manager, Caddy, or cloud load balancer).
5. Do not commit `.env` — it is gitignored.

## Troubleshooting

### `password authentication failed for user "postgres"`

PostgreSQL stores the password in the **data volume** on first startup. If you see:

```text
PostgreSQL Database directory appears to contain a database; Skipping initialization
```

and the app cannot connect, your current `DB_PASS` in `.env` does not match the password baked into the existing volume (common after changing `.env` or reusing an old volume from a test run).

**Fix — reset the database volume** (this deletes all data in the container DB):

```bash
docker compose down -v
docker compose up -d --build
```

Ensure `.env` has the same `DB_PASS` you want Postgres to use before running the command above.

## Operations

```bash
# Logs
docker compose logs -f app

# Health
curl -s http://localhost:3001/health | jq

# Rebuild after code changes
docker compose up -d --build

# Stop and remove containers (keeps DB volume)
docker compose down

# Stop and wipe database volume
docker compose down -v
```

## Image details

- **Base:** Node 20 Alpine
- **User:** `nodejs` (UID 1001), read-only root filesystem + `/tmp` tmpfs
- **Init:** `dumb-init` for correct signal handling
- **Health:** `GET /health` (returns 503 if PostgreSQL is required but down)

## Environment reference

See [.env.example](.env.example) for all variables. Key Docker-specific values:

| Variable | Default in Compose |
|----------|-------------------|
| `DB_HOST` | `postgres` |
| `DB_PORT` | `5432` |
| `TRUST_PROXY` | `true` |
| `WAIT_FOR_DB` | `true` |

## Local development without Docker

Unchanged — use `npm run dev` with a local PostgreSQL instance and `.env` pointing at `localhost`.
