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

There is no separate worker process or job queue. Both schedulers share the API server process.
