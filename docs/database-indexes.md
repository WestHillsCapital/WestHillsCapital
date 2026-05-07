# Database Indexes

This document describes the indexes on high-volume Docuplete tables, the query patterns they serve, and operational notes for maintaining them at scale.

---

## Overview

Docuplete's submission tables (`docufill_interview_sessions`, `docufill_packages`, `webhook_deliveries`) are queried under multi-tenant conditions where every query is scoped to a single `account_id`. Without composite indexes, Postgres falls back to a full index scan on the single-column `account_id` index followed by a re-check on every secondary filter, which degrades significantly as submission counts grow per account.

Composite indexes leading with `account_id` allow Postgres to range-scan directly to the relevant account's rows and sort or filter within that tight range.

---

## `docufill_interview_sessions`

| Index name | Columns | Purpose |
|---|---|---|
| `docufill_interview_sessions_token_idx` | `(token)` | Public-link and e-sign token lookups |
| `docufill_interview_sessions_account_idx` | `(account_id)` | Baseline per-account scans |
| `dis_batch_run_idx` | `(batch_run_id)` WHERE NOT NULL | CSV batch run progress queries |
| `dis_account_created_idx` | `(account_id, created_at DESC)` | Submission list ordered by date |
| `dis_account_package_idx` | `(account_id, package_id)` | Filter by package within an account |
| `dis_account_status_idx` | `(account_id, status)` | Filter by status (draft / submitted / signed) |
| `dis_account_expires_idx` | `(account_id, expires_at ASC)` | Retention pruner: find sessions expiring soonest |

**Primary query patterns served:**

- `GET /sessions` and `GET /sessions/portal-list` — both build a dynamic `WHERE account_id = $1 [AND package_id = …] [AND status = …]` clause ordered by `updated_at DESC`. `dis_account_package_idx` and `dis_account_status_idx` let Postgres narrow to the right partition before evaluating the ORDER BY.
- `SELECT COUNT(DISTINCT batch_run_id) … WHERE account_id = $1 AND batch_run_id IS NOT NULL` — served by `dis_batch_run_idx`.
- Retention pruner (scheduled): queries sessions by `account_id` + `expires_at` range — served by `dis_account_expires_idx`.

---

## `docufill_packages`

| Index name | Columns | Purpose |
|---|---|---|
| `docufill_packages_account_idx` | `(account_id)` | Baseline per-account scans |
| `docufill_packages_combo_idx` | `(account_id, status)` | Active/published package list |
| `docufill_packages_workflow_idx` | `(account_id, webhook_enabled)` | Webhook dispatch: find packages with webhooks on |
| `docufill_packages_account_created_idx` | `(account_id, created_at DESC)` | Package list ordered by creation date |

**Primary query pattern served:**

- Admin package list with optional status filter, sorted by date — `docufill_packages_account_created_idx` eliminates the sort step when no status filter is applied.

---

## `webhook_deliveries`

| Index name | Columns | Purpose |
|---|---|---|
| `webhook_deliveries_package_created_idx` | `(package_id, created_at)` | Per-package delivery log ordered by date |
| `webhook_deliveries_account_idx` | `(account_id)` | Baseline per-account scans |
| `webhook_deliveries_account_created_idx` | `(account_id, created_at DESC)` | Cross-package delivery log for an account |

**Notes:**

- `webhook_deliveries` does not have a `session_id` column. Cross-package delivery history for an account is served by `webhook_deliveries_account_created_idx`.

---

## `org_audit_log`

| Index name | Columns | Purpose |
|---|---|---|
| `org_audit_log_account_created_idx` | `(account_id, created_at DESC)` | Paginated audit log per account |

This index is defined in both `lib/db/src/schema/notifications.ts` and created imperatively in `initDb()` (for pre-Drizzle environments). It predates the Drizzle migration system and is therefore not part of the `0004` migration.

---

## Migration: `0004_submission_scale_indexes`

File: `artifacts/api-server/drizzle/0004_submission_scale_indexes.sql`

All six new indexes use `CREATE INDEX IF NOT EXISTS` so the migration is idempotent and safe to run on a database where any index was pre-created manually.

**Production note — avoiding table locks:** `CREATE INDEX` acquires a `ShareLock` on the table, which blocks concurrent writes for the duration of the build. For tables with millions of rows or sustained write load, prefer running these statements manually with `CONCURRENTLY` outside a transaction before the migration runs:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS dis_account_created_idx
  ON docufill_interview_sessions (account_id, created_at DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS dis_account_package_idx
  ON docufill_interview_sessions (account_id, package_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS dis_account_status_idx
  ON docufill_interview_sessions (account_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS dis_account_expires_idx
  ON docufill_interview_sessions (account_id, expires_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS docufill_packages_account_created_idx
  ON docufill_packages (account_id, created_at DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS webhook_deliveries_account_created_idx
  ON webhook_deliveries (account_id, created_at DESC NULLS LAST);
```

Because the migration uses `IF NOT EXISTS`, it will skip any index already present and complete cleanly without error.

---

## Adding indexes in the future

1. Add the index definition to the relevant table in `lib/db/src/schema/` (e.g. `docufill.ts`, `notifications.ts`).
2. Run `pnpm --filter @workspace/api-server run db:generate` to produce the next migration file.
3. Verify the generated SQL contains only the expected `CREATE INDEX` statements (no unintended table DDL).
4. For large production tables, execute with `CONCURRENTLY` manually first (see above), then let the migration run normally.
