# Deployment

---

## How deployment works

The application is deployed from the Replit workspace using Replit's built-in publish feature. When published:
- The monorepo is built and deployed to a `.replit.app` domain (or a custom domain if configured)
- The API server and web frontend are hosted under path-based routing
- The Replit-managed PostgreSQL database is automatically available in production

There is no separate CI/CD pipeline. Deployments are triggered manually from the Replit interface.

---

## Services deployed

| Service | Path | Notes |
|---|---|---|
| Web frontend (public site + internal portal) | `/` | Vite build, served statically |
| API server | `/api-server/` | Express server, long-running process |

Both services run in the same Replit deployment context. The API server connects to the Replit-managed PostgreSQL database.

---

## Pre-deploy checklist

Before deploying a new version:

- [ ] All three workflows start cleanly with no errors in the console
- [ ] API server logs show "Database ready — all systems operational"
- [ ] Test `GET /api/health` — should return `{ "status": "ok", "db": "ready" }`
- [ ] Test `GET /api/pricing/spot` — should return live gold/silver prices
- [ ] Test an appointment slot fetch from the public scheduling page
- [ ] Verify `FIZTRADE_DRY_RUN` is NOT set to `true` in production secrets
- [ ] Verify `INTERNAL_ALLOWED_EMAILS` includes all authorized staff
- [ ] Verify `FRONTEND_URL` is set to the production URL

---

## Environment variables in production

Production secrets are set in Replit's Secrets panel (same panel as development). Both environments share the same secret store.

If you need different values for dev vs. prod (e.g. a test Resend key vs. live key), Replit does not natively support separate secret environments — use a naming convention or toggle `FIZTRADE_DRY_RUN` manually.

After changing any secret, restart the affected workflow for it to take effect.

---

## Post-deploy verification

After a new deployment goes live:

1. Visit the public site home page — confirm it loads and shows live spot prices
2. Visit the scheduling page — confirm slots appear
3. Log in to the internal portal — confirm Google OAuth works and the dashboard loads
4. Open an existing deal in Deal Builder — confirm data loads correctly
5. Check the Google Sheets Operations tab — confirm it is still accessible
6. Check Resend dashboard — confirm domain verification is still active

---

## Rollback

Replit creates automatic checkpoints at regular intervals and after significant changes. To roll back:

1. In the Replit workspace, open the checkpoint history
2. Select the checkpoint to restore (the commit message describes what changed)
3. Restore — this rolls back all code files

**Database is NOT rolled back with a code rollback.** If the DB schema was migrated forward (new columns added), those columns remain after a code rollback. The `ADD COLUMN IF NOT EXISTS` pattern means this is safe — the old code will simply not read the new columns.

If a DB migration caused data loss, restore from the Replit database backup (contact Replit support).

---

## Background processes in production

In production, the two background schedulers run continuously as part of the API server process:

- `runScheduler()`: every 15 minutes — handles shipping emails, follow-up emails, status sync
- `runTrackingSync()`: every 15 minutes (2-minute offset) — polls DG for tracking numbers

These run as long as the API server is running. If the server is restarted, both schedulers restart immediately after DB initialization.

---

## Job queue (BullMQ + Redis)

The job queue infrastructure powers background processing for PDF generation, webhook delivery, and scheduled jobs. It consists of two independent processes:

| Process | Railway service config | Purpose |
|---|---|---|
| API server | `railway.toml` | Enqueues jobs; serves `/api/internal/queue-status` |
| Worker | `railway.worker.toml` | Processes jobs from all queues |

### Setting up Redis on Railway

1. In your Railway project, click **+ New** → **Database** → **Redis**
2. Once provisioned, Railway automatically injects `REDIS_URL` into any service that has it set as a variable reference. Alternatively, copy the connection URL from the Redis service's **Variables** tab.
3. Set `REDIS_URL` on both the API server service and the worker service.

### Adding the worker as a second Railway service

1. In your Railway project, click **+ New** → **GitHub Repo** (same repo)
2. In the service settings, set **Config file path** to `railway.worker.toml`
3. Set environment variables: `REDIS_URL`, `DATABASE_URL`, `SENTRY_DSN`, `NODE_ENV=production`, `ENCRYPTION_MASTER_KEY`
4. Deploy — the worker will start and log `[Worker] All processors registered — listening for jobs`

### Monitoring queue health

- `GET /api/internal/queue-status` (internal auth required) — returns live queue depth (waiting / active / completed / failed) for all queues
- On startup, the API server enqueues a ping job; the worker logs `[Worker:Ping] Ping job processed` when it completes, confirming the round-trip works

### Adding new job types

1. Add payload schema and type to `lib/queues/src/jobTypes.ts`
2. Add the queue name to `lib/queues/src/queueNames.ts`
3. Export the new queue from `artifacts/api-server/src/lib/queue.ts`
4. Add a processor in `artifacts/worker/src/processors/`
5. Register the processor in `artifacts/worker/src/index.ts`

### Graceful degradation

When `REDIS_URL` is not set (e.g. in the Replit development environment), all queue operations are skipped with a warning log. The API server and all existing features continue to work normally — jobs simply do not run.
