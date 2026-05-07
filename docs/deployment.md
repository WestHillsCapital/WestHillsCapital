# Deployment

---

## How deployment works

The application is deployed from the Replit workspace using Replit's built-in publish feature. When published:
- The monorepo is built and deployed to a `.replit.app` domain (or a custom domain if configured)
- The API server and web frontend are hosted under path-based routing
- The Replit-managed PostgreSQL database is automatically available in production

**Deployments require a passing CI run and at least one approved pull request review** — see the CI/CD section below.

---

## CI/CD pipeline and branch protection (SOC 2 CC8.1)

All changes to `main` go through a controlled change management process:

```
feature-branch → Pull Request → CI checks pass → 1 approved review → merge → Replit/Railway deploy
```

### GitHub Actions CI workflow

Every push to `main` and every PR targeting `main` triggers `.github/workflows/ci.yml`, which runs three gates in sequence:

| Step | Command | Fails on |
|---|---|---|
| Typecheck | `pnpm run typecheck` | Any TypeScript type error across the monorepo |
| Dependency audit | `pnpm audit --audit-level=high` | Any high or critical CVE in the dependency tree |
| Build | `pnpm -r --filter '!@workspace/mockup-sandbox' --if-present run build` | Any compilation or bundling failure |

A failed CI run blocks merge. The CI badge in the repository README reflects the current `main` branch status.

### Setting up branch protection on GitHub

Configure these rules in **GitHub → Settings → Branches → Branch protection rules → Add rule** for the pattern `main`:

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1**
  - [x] Dismiss stale pull request approvals when new commits are pushed
- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Status check to add: **`ci`** (the job name from `ci.yml`)
- [x] **Require conversation resolution before merging**
- [x] **Do not allow bypassing the above settings** (optional but recommended for SOC 2)

### Hotfix bypass procedure

If a critical production issue requires bypassing branch protection:

1. A repository admin temporarily disables the "Do not allow bypassing" rule
2. The admin documents the reason in the PR description with the tag `[HOTFIX-BYPASS]`
3. The bypass must be re-enabled immediately after the merge
4. The incident is recorded in the change log / incident tracker

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

- [ ] Run `pnpm audit --audit-level=high` — must exit 0 (no high/critical vulnerabilities) before deploying
- [ ] All three workflows start cleanly with no errors in the console
- [ ] API server logs show "Database ready — all systems operational"
- [ ] Test `GET /api/health` — should return `{ "status": "ok", "db": "ready" }`
- [ ] Test `GET /api/pricing/spot` — should return live gold/silver prices
- [ ] Test an appointment slot fetch from the public scheduling page
- [ ] Verify `FIZTRADE_DRY_RUN` is NOT set to `true` in production secrets
- [ ] Verify `INTERNAL_ALLOWED_EMAILS` includes all authorized staff
- [ ] Verify `FRONTEND_URL` is set to the production URL

---

## Dependency vulnerability status (SOC 2 CC7.1)

Run `pnpm run audit` (alias for `pnpm audit --audit-level=high`) before every deployment. It is also the first step of the automated `build` script. The command exits 0 when no high/critical vulnerabilities are present.

### Current findings — as of May 2026 (all low/moderate, no blocking issues)

| Severity | Package | Finding | Location | Risk acceptance |
|---|---|---|---|---|
| LOW | `tmp` | Symlink arbitrary write via `dir` param | `zapier-platform-cli` transitive (dev/tooling) | No production code path; dev tooling only |
| LOW | `diff` (jsdiff) | DoS in `parsePatch` / `applyPatch` | `zapier-platform-cli` transitive (dev/tooling) | No production code path; dev tooling only |
| LOW | `@tootallnate/once` | Incorrect control flow scoping | `@google-cloud/storage` transitive | Resolved when GCS client releases an update |
| MODERATE | `brace-expansion` | Zero-step sequence causes ReDoS/memory hang | `archiver` transitive | Not reachable from untrusted input in current use; will be resolved by upstream update |
| MODERATE | `yaml` | Stack overflow on deeply nested YAML | `knip` dev-only transitive | Dev tool only; no production exposure |
| MODERATE | `postcss` | XSS via unescaped `</style>` in CSS stringify | `vite` transitive | Build-time only; no runtime exposure |
| MODERATE | `ip-address` | XSS in `Address6` HTML-emitting methods | `geoip-lite` + MCP SDK transitive | HTML-emitting methods not called in our code |

All findings are in transitive dependencies. Dependabot is configured to open automatic update PRs when parent packages release fixes.

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

---

## Database SSL (SOC 2 CC6.7)

The API server enforces TLS certificate validation for all production database connections (`rejectUnauthorized: true`). This applies to every pg Pool used by the server — the main pool (`db.ts`), the shared Drizzle pool (`lib/db`), and the StripeSync pool.

### Standard setup (Replit-managed or Railway Postgres)

No extra configuration is needed. Both Replit-managed Neon and Railway Postgres use publicly-trusted certificates (Let's Encrypt / DigiCert). The Node.js system CA bundle validates them automatically.

At startup, the API server logs the active SSL mode:

```
[DB] SSL configuration  { sslEnabled: true, rejectUnauthorized: true, customCa: false }
```

### Private-CA environments (self-hosted Postgres)

If your database uses a certificate issued by a private CA (e.g. a self-signed cert from a self-hosted Postgres), set the `DB_SSL_CA` secret to the base64-encoded PEM of the CA certificate:

```bash
# Encode the CA cert
base64 -w 0 /path/to/ca.crt
```

Paste the output as the value for `DB_SSL_CA` in Replit's Secrets panel. The connection will then use `rejectUnauthorized: true` with that CA as the trust anchor. The startup log will show `customCa: true`.

### Troubleshooting SSL connection failures

If the API server fails to connect after a deployment with errors like `SELF_SIGNED_CERT_IN_CHAIN` or `unable to verify the first certificate`:

1. Obtain the CA certificate from your DB provider's dashboard.
2. Base64-encode it and set `DB_SSL_CA` as described above.
3. Restart the API server workflow.

If you are on a provider that explicitly requires `rejectUnauthorized: false` (not recommended), contact your DB provider to obtain a valid CA cert instead — disabling validation removes SOC 2 CC6.7 compliance.
