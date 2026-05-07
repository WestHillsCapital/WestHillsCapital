# Business Continuity & Disaster Recovery Plan

| | |
|---|---|
| **Version** | 1.0 |
| **Effective date** | May 2026 |
| **Last reviewed** | May 2026 |
| **Next review due** | May 2027 |
| **Policy owner** | Engineering Lead |
| **SOC 2 controls** | CC9.1, A1.2, A1.3 |

---

## 1. Purpose and scope

This plan defines the organization's recovery objectives and procedures for restoring business operations following a significant disruption — including infrastructure outages, data loss events, ransomware or destructive attacks, and key-person unavailability. It covers:

- The Docuplete platform (API server, frontend, PostgreSQL database, GCS object storage, Redis job queue)
- The West Hills Capital internal portal and public marketing site

This plan does not address minor service degradations handled by the [Incident Response Plan](incident-response-plan.md) (P2/P3 events). It is activated for any P0 event that threatens sustained data availability, or any scenario where full service restoration requires deliberate recovery action beyond a simple restart.

---

## 2. Recovery objectives

### 2.1 Recovery Time Objective (RTO)

The **RTO** is the maximum acceptable time from the moment of a disaster declaration to the point when the affected service is fully operational. RTOs are defined per service component:

| Component | RTO | Basis |
|---|---|---|
| API server (crash / unhealthy container) | **15 minutes** | Railway `restartPolicyType = "on_failure"` restarts automatically; manual re-deploy via Railway dashboard if auto-restart fails |
| API server (bad deploy — code rollback needed) | **1 hour** | Identify bad commit → trigger Railway redeploy from last known-good build |
| Frontend / web (Replit deployment) | **1 hour** | Replit checkpoint restore → republish |
| Database (connection failure, transient) | **30 minutes** | Replit-managed Neon/PostgreSQL restored by Replit infrastructure; verify health + restart API server |
| Database (data corruption or loss) | **4 hours** | Contact Replit support for backup restore; full schema re-init from `initDb()` if required |
| Redis / job queue | **1 hour** | Railway Redis provisioned and `REDIS_URL` re-configured; BullMQ jobs re-queued |
| GCS object storage | **2 hours** | GCS SLA-backed; re-configure `PRIVATE_OBJECT_DIR` if bucket was misconfigured or re-created |
| Full environment loss (all services) | **8 hours** | Rebuild from GitHub source + Railway + Replit — see Section 4.4 |

### 2.2 Recovery Point Objective (RPO)

The **RPO** is the maximum acceptable data loss window measured in time before the disaster. RPOs are defined per data category:

| Data category | RPO | Backup mechanism |
|---|---|---|
| PostgreSQL (all customer data, audit logs, submissions) | **24 hours** | Replit-managed Neon automated daily backups; Neon also maintains point-in-time recovery (PITR) if available on the plan |
| GCS object storage (template PDFs, generated PDFs) | **On write** (no gap) | GCS provides built-in object versioning and replication within the storage region; object data is not separately backed up by us |
| Redis job queue (pending BullMQ jobs) | **Up to 15 minutes** | Redis is ephemeral; BullMQ jobs queued in the last 15 minutes before a Redis failure may be lost. Scheduler jobs re-run on next tick; API-triggered jobs (PDF generation, webhooks) may need manual re-trigger |
| Source code | **On push** (no gap) | GitHub repository is the source of truth; no data is lost if the Replit workspace is damaged |
| Encryption keys (`ENCRYPTION_MASTER_KEY`, `DATABASE_URL`) | **On set** (no gap) | Stored in Replit Secrets and Railway environment variables — provider-managed; back up values to a secure offline location |

### 2.3 RPO limitations and compensating controls

The 24-hour database RPO is a limitation of the current architecture:

- **No continuous WAL streaming or read replicas** — a point-in-time restore beyond what Replit/Neon provides is not available without upgrading to a plan that includes PITR.
- **No cross-region replication** — all data resides in a single region.
- **Compensating controls:**
  - Replit and Railway are both SOC 2 Type II certified (see [Vendor Inventory](vendor-inventory.md)) with their own infrastructure redundancy.
  - Encryption at rest (AES-256-GCM per-account DEKs) means a stolen database backup is not readable without `ENCRYPTION_MASTER_KEY`.
  - Audit logs (`org_audit_log`) and PDF audit events are append-only and are never automatically pruned, providing a durable audit trail even if application data is partially lost.

---

## 3. Architecture overview (recovery context)

```
Internet
    │
    ▼
Replit deployment (Vite frontend, static files)
    │
    ├── API Server (Railway — Node.js/Express)
    │       │
    │       ├── PostgreSQL (Replit-managed Neon)
    │       ├── Redis (Railway-managed)
    │       └── GCS (Google Cloud Storage)
    │
    └── Worker (Railway — BullMQ job processor)
            │
            └── Redis (Railway-managed) ── shared with API Server
```

**Source of truth:** GitHub repository `WestHillsCapital/WestHillsCapital`
**Deployment pipeline:** GitHub Actions CI → Replit publish (frontend) + Railway deploy (API server + worker)

---

## 4. Recovery runbooks

### 4.1 Scenario A — API server crash or unhealthy container

**Symptoms:** Railway logs show repeated crash/restart cycles; `GET /healthz` returns non-200 or times out; Sentry shows a spike in unhandled errors.

**Automatic recovery:** Railway's `restartPolicyType = "on_failure"` (configured in `railway.toml`) restarts the API server automatically after a crash. Wait up to 2 minutes after the crash is detected before escalating to manual steps.

**Manual recovery steps:**

1. Open the Railway dashboard → select the API server service → **Logs** tab.
2. Identify the error causing the crash (startup failure, OOM, DB connection refused, etc.).
3. If it is a **transient error** (DB temporarily unavailable, network blip):
   - Click **Restart** in the Railway service menu.
   - Monitor logs for `Database ready — all systems operational`.
4. If it is a **bad deploy** (code regression introduced in the last deployment):
   - In Railway, navigate to **Deployments** → select the last known-good deploy → **Rollback**.
   - Alternatively, revert the bad commit in GitHub and push — the CI pipeline will re-deploy.
5. Verify recovery:
   ```bash
   curl https://<railway-api-url>/healthz
   # Expected: {"ok":true,"db":"ready","uptime":N,"dryRun":false}
   ```
6. Check Sentry — confirm the error rate returns to baseline within 5 minutes.

**Escalation:** If the API server cannot be recovered within 30 minutes, declare a P0 incident per the [Incident Response Plan](incident-response-plan.md) and notify customers if the outage exceeds 2 hours.

---

### 4.2 Scenario B — Database failure (transient connection loss)

**Symptoms:** API server logs show `[DB] Unexpected pool error`; `GET /healthz` returns `"db":"error"`; all API endpoints return 500.

**Recovery steps:**

1. Check the Replit dashboard for any active status incidents (neon.tech/status or replit.com/status).
2. If Replit/Neon is healthy on their status page:
   - The connection pool may be exhausted or stale. Restart the Railway API server service.
   - Monitor logs for `Database ready — all systems operational`.
3. If the Replit database itself is degraded (indicated on the Replit status page):
   - Wait for Replit to restore service (SLA-backed by Replit infrastructure).
   - Monitor Replit status; escalate to Replit support if the outage exceeds 1 hour.
4. Once database connectivity is restored, confirm:
   ```bash
   curl https://<railway-api-url>/healthz
   # Expected: {"ok":true,"db":"ready",...}
   ```
5. Check BullMQ worker logs — scheduled jobs will have accumulated backlog. The worker runs a backlog-clear pass on startup automatically.

---

### 4.3 Scenario C — Database corruption or data loss (requiring backup restore)

**Symptoms:** Data appears corrupted, missing rows, or schema is in an inconsistent state not caused by a code bug.

> **STOP:** Before any restore, preserve evidence. Do not run any `DELETE` or `DROP` statements until the scope of corruption is understood.

**Recovery steps:**

1. Immediately take the API server offline to stop further writes (Railway → **Pause** service or set `DATABASE_URL` to a read-only connection if available).
2. Document the exact symptoms, affected tables, and the approximate time of corruption in the incident thread.
3. **Contact Replit support** to request a database backup restore:
   - Email: support@replit.com or use the Replit dashboard Help → Contact Support.
   - Provide: account email, the database/project name, the approximate time to restore to (most recent clean state), and a description of the corruption.
   - Replit/Neon retains daily snapshots; confirm the available restore points.
4. While waiting for the restore:
   - Export any partially intact data you can access with read queries for cross-referencing.
   - Identify which tables and accounts are affected using the `org_audit_log` (audit log is append-only and will show the last known-good state of write operations).
5. After the restore is complete:
   - Run `initDb()` logic (the API server does this automatically on startup) to ensure the schema is current — `ADD COLUMN IF NOT EXISTS` patterns make this safe on a restored older schema.
   - Run Drizzle migrations if the restored DB predates any applied schema migrations.
   - Restart the API server and verify `GET /healthz` returns `"db":"ready"`.
6. Audit data integrity: spot-check affected tables against the audit log to quantify any data loss.
7. Notify affected customers per the [Incident Response Plan](incident-response-plan.md) notification obligations (Section 6).

---

### 4.4 Scenario D — Frontend / Replit deployment outage

**Symptoms:** The public marketing site or internal portal is unreachable; Replit deployment shows an error.

**Recovery steps:**

1. Open the Replit workspace for the project.
2. Check the deployment status in the **Deployments** tab.
3. If the most recent deployment failed:
   - Review the build log for errors (typically TypeScript errors or missing env vars).
   - Fix the issue and republish using the Replit **Publish** button.
4. If the Replit deployment infrastructure itself is degraded:
   - Check replit.com/status for active incidents.
   - Wait for Replit to restore service.
5. If a bad code change caused the frontend to break post-deploy:
   - In the Replit workspace, open the **Checkpoint history**.
   - Select the last checkpoint that was known to work.
   - Restore the checkpoint and republish.
6. Verify the frontend is accessible and the internal portal login works end-to-end.

---

### 4.5 Scenario E — Full environment loss (catastrophic)

**Definition:** The Replit workspace, Railway project, and/or production secrets are lost or destroyed and cannot be recovered through provider support. This scenario requires rebuilding from scratch.

**Expected RTO: 8 hours**

**Prerequisites:** The following information must be stored securely offline (e.g., in a password manager or printed and stored in a physical safe) and accessible independently of the systems being recovered:

| Item | Purpose |
|---|---|
| `ENCRYPTION_MASTER_KEY` value | Required to decrypt all customer DEKs and read encrypted data |
| `DATABASE_URL` | Required to connect to any restored database |
| `STRIPE_SECRET_KEY` | Required to re-connect Stripe billing |
| All other production secrets | Required for full service operation |
| Railway project token / account credentials | Required to access and rebuild Railway services |
| GCS service account key (`GOOGLE_SERVICE_ACCOUNT_KEY`) | Required to access existing GCS bucket contents |

**Rebuild procedure:**

1. **Recover source code** — Clone from GitHub:
   ```bash
   git clone https://github.com/WestHillsCapital/WestHillsCapital.git
   cd WestHillsCapital
   pnpm install
   ```

2. **Provision a new database** — Create a new Replit-managed PostgreSQL database or a Railway PostgreSQL service. Copy the new `DATABASE_URL`.

3. **Restore database data** — If a backup from the old database is available (from Replit support), restore it to the new database. If no backup is available, the database will rebuild its schema from `initDb()` on first API server startup (data loss per the RPO defined in Section 2.2).

4. **Provision Redis** — Create a new Railway Redis instance. Copy `REDIS_URL`.

5. **Set environment variables** — In the new Railway project, set all required environment variables:
   - `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_MASTER_KEY`, `STRIPE_SECRET_KEY`
   - `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
   - `SENTRY_DSN`, `RESEND_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`
   - `PRIVATE_OBJECT_DIR`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`
   - `INTERNAL_ALLOWED_EMAILS`, `COOKIE_SECRET`
   - See `docs/environment-variables.md` for the full list.

6. **Deploy API server on Railway** — Connect the GitHub repository in Railway, set the config file to `railway.toml`, and deploy.

7. **Deploy worker on Railway** — Add a second Railway service for the worker, using `railway.worker.toml`.

8. **Deploy frontend on Replit** — Open the Replit workspace, configure secrets, and publish.

9. **Verify end-to-end:**
   - `GET /healthz` returns `{"ok":true,"db":"ready"}`
   - Internal portal login works
   - A test Docuplete session can be started and completed
   - BullMQ worker processes a test job (`[Worker:Ping] Ping job processed`)

10. **Notify customers** — If any data was lost during the rebuild, notify affected customers per the IRP notification obligations.

---

### 4.6 Scenario F — Redis / job queue loss

**Symptoms:** PDF generation jobs, webhook delivery jobs, or scheduled jobs are not running; BullMQ queues are empty despite expected activity; worker logs show connection failures.

**Recovery steps:**

1. Check Railway Redis service status. If the Redis instance is crashed or removed:
   - Provision a new Railway Redis instance.
   - Update `REDIS_URL` on both the API server and worker Railway services.
   - Restart both services.
2. Verify recovery: in Railway worker logs, look for `[Worker] All processors registered — listening for jobs` and `[Worker:Ping] Ping job processed`.
3. Assess backlog: jobs that were queued in Redis at the time of the failure are lost (per the 15-minute RPO for Redis in Section 2.2). Review:
   - **PDF generation jobs:** Check `docufill_interview_sessions` for sessions with `status = 'completed'` but no `generated_pdf_storage_key`. Re-trigger PDF generation for these sessions.
   - **Webhook delivery jobs:** Check `webhook_deliveries` for recently failed deliveries. Re-enqueue manually if needed.
   - **Scheduler jobs:** The worker re-registers all repeatable jobs on startup — these will resume automatically on the next tick.

---

## 5. Known gaps and compensating controls

| Gap | Risk | Compensating control |
|---|---|---|
| No automated DB backup access | In a corruption/loss event, restore requires contacting Replit support; restore time is outside our direct control | Envelope encryption means a stolen backup is not readable; audit log is append-only and preserved; target RPO is 24 hours which is acceptable for the current business scale |
| No point-in-time recovery (PITR) beyond daily snapshots | Data written in the window between daily snapshots is at risk | Consider upgrading to a Neon plan with PITR; currently RPO accepted at 24 hours |
| No multi-region / multi-AZ deployment | A regional cloud failure at Replit or Railway could cause extended outage | Both Replit and Railway are SOC 2 Type II certified with their own availability SLAs; consider Railway region selection to minimize overlap |
| Redis is ephemeral (no persistence) | In-flight BullMQ jobs lost on Redis failure | Scheduler jobs recover automatically on next tick; API-triggered jobs (PDF generation, webhooks) may need manual re-trigger; impact is operational inconvenience, not data loss |
| Recovery of `ENCRYPTION_MASTER_KEY` depends on offline storage | If the key is lost and no offline copy exists, all encrypted customer data is permanently unreadable | Key must be stored in an offline, access-controlled location (e.g., physical safe or hardware security module); this is a critical BCP dependency |

---

## 6. Annual BCP review and testing

| Activity | Cadence | Owner |
|---|---|---|
| Annual BCP document review | Yearly (next: May 2027) | Engineering Lead |
| Tabletop exercise — simulate Scenario C (DB corruption) | Yearly | Engineering Lead + business owner |
| Verify offline copy of `ENCRYPTION_MASTER_KEY` and other critical secrets is current and accessible | Quarterly | Engineering Lead |
| Confirm Replit/Railway backup retention settings are unchanged | At each quarterly access review | Engineering Lead |

After any real disaster recovery event, update this plan with lessons learned within 5 business days of resolution. Record changes in the document history below.

---

## 7. Document history

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | May 2026 | Engineering Lead | Initial plan |
