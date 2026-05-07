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

All scheduled jobs run in the **worker process** (not the API server) as BullMQ repeatable jobs. BullMQ's distributed lock ensures each job runs exactly once regardless of how many worker instances are active.

| Job name | Cadence | What it does |
|---|---|---|
| `prune:sessions` | every 15 min | Deletes expired `internal_sessions` rows |
| `scheduler:fulfillment` | every 15 min | Shipping emails, follow-up emails, Ops status sync |
| `scheduler:tracking-sync` | every 15 min | Polls DG for tracking numbers on unshipped deals |
| `prune:audit-tables` | every 24 h | Deletes `booking_attempts` rows > 90 days old |
| `prune:submissions` | every 24 h | Deletes interview sessions past each account's retention policy |
| `prune:session-data` | every 24 h | Prunes `user_active_sessions` (30 d) and `user_login_history` (90 d) |
| `purge:scheduled-deletions` | every 6 h | Hard-deletes accounts past their 7-day deletion grace period |
| `purge:trial-data` | every 6 h | Purges org content for lapsed trial accounts |
| `expire:exports` | every 6 h | Clears `export_json` payloads after the 48-hour download window |

Jobs are registered idempotently via `queue.upsertJobScheduler()` on every worker startup. The API server does **not** run any scheduler logic — it handles HTTP requests only.

On worker startup, each scheduler function also runs once immediately as a backlog-clear pass (to process any rows that accumulated while the worker was down). This is done in the worker's init path, not in `initDb()`, so the API server is never involved.

### Inspecting scheduler run history

- `GET /api/internal/queue-status` (internal auth required) — includes the `scheduler` queue, showing waiting / active / completed / failed job counts
- **BullMQ Board**: connect a BullMQ Board instance to your Redis URL for a visual dashboard of all queues, repeatable job schedules, and per-job run history. See the [BullMQ Board docs](https://github.com/felixmosh/bull-board) for setup instructions.
- In Railway worker logs, look for `[Scheduler] Job scheduler registered` (registration complete) and job-specific log lines (e.g. `[Scheduler] Fulfillment scheduler tick complete`) to confirm jobs are running

---

## GCS object storage (template PDFs)

Template PDFs uploaded by users are stored in Google Cloud Storage. Signed/generated session PDFs (`generated_pdf_storage_key`) have always used GCS; template PDFs (`docufill_package_documents.pdf_gcs_key`) were migrated in Task #590.

### Bucket structure

| Path prefix | Content |
|---|---|
| `pdfs/{accountId}/{packageId}/{documentId}.pdf` | Template PDF uploaded by the user for a package document |
| `signed-pdfs/{sessionToken}.pdf` | Signed/generated PDF for a completed interview session |

Both paths live under the bucket configured in `PRIVATE_OBJECT_DIR` (e.g. `gs://my-bucket/private`). The `pdf_gcs_key` column stores the `/objects/...` reference used by the API server.

### Fallback behaviour

Rows that pre-date the migration continue to have `pdf_data` set in Postgres. All read paths check `pdf_gcs_key` first and fall back to `pdf_data` transparently.

### Migrating existing rows

Run the one-time migration script to upload existing Postgres blobs to GCS:

```bash
# Dry run — see what would be migrated
node artifacts/api-server/scripts/migrate-pdfs-to-gcs.mjs --dry-run

# Live run — upload and write back pdf_gcs_key (keeps pdf_data as fallback)
node artifacts/api-server/scripts/migrate-pdfs-to-gcs.mjs

# Live run + reclaim Postgres storage after upload
node artifacts/api-server/scripts/migrate-pdfs-to-gcs.mjs --null-pdf-data
```

Required env vars: `DATABASE_URL`, `PRIVATE_OBJECT_DIR`.

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
