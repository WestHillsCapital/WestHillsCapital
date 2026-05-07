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
- Retention pruner: `DELETE … WHERE dis.account_id = a.id AND a.submission_retention_days IS NOT NULL AND dis.created_at < NOW() - interval` — served by `dis_account_expires_idx`.

**Representative query plan (submission list, 50 k sessions, 1 k for this account):**

```
-- Before dis_account_package_idx:
Seq Scan on docufill_interview_sessions
  Filter: ((account_id = 7) AND (package_id = 42) AND (status = 'submitted'))
  Rows Removed by Filter: 49841
  actual rows=159  loops=1

-- After dis_account_package_idx:
Index Scan using dis_account_package_idx on docufill_interview_sessions
  Index Cond: ((account_id = 7) AND (package_id = 42))
  Filter: (status = 'submitted')
  actual rows=159  loops=1
  Buffers: shared hit=6  (was: shared hit=2187)
```

---

## `docufill_packages`

| Index name | Columns | Purpose |
|---|---|---|
| `docufill_packages_account_idx` | `(account_id)` | Baseline per-account scans |
| `docufill_packages_combo_idx` | `(account_id, status)` | Active/published package list |
| `docufill_packages_workflow_idx` | `(account_id, webhook_enabled)` | Webhook dispatch: find packages with webhooks on |
| `docufill_packages_account_created_idx` | `(account_id, created_at DESC)` | Package list ordered by creation date |

**Primary query pattern served:**

- Admin package list sorted by date with no status filter: `SELECT … FROM docufill_packages WHERE account_id = $1 ORDER BY created_at DESC` — `docufill_packages_account_created_idx` eliminates the sort step entirely when no additional filter is applied.

**Representative query plan (200 packages, 15 for this account):**

```
-- Before docufill_packages_account_created_idx:
Sort  (cost=8.45..8.49)
  Sort Key: created_at DESC
  ->  Index Scan using docufill_packages_account_idx
        Index Cond: (account_id = 7)

-- After docufill_packages_account_created_idx:
Index Scan using docufill_packages_account_created_idx
  Index Cond: (account_id = 7)
  (Sort eliminated — index already ordered DESC)
```

---

## `webhook_deliveries`

| Index name | Columns | Purpose |
|---|---|---|
| `webhook_deliveries_package_created_idx` | `(package_id, created_at)` | Per-package delivery log ordered by date |
| `webhook_deliveries_account_idx` | `(account_id)` | Baseline per-account scans |
| `webhook_deliveries_account_created_idx` | `(account_id, created_at DESC)` | Cross-package delivery log for an account |

**Schema note:** `webhook_deliveries` does not have a `session_id` column. The task specification originally listed `(session_id, created_at DESC)` as the target index, but no such column exists on this table (columns: `id`, `package_id`, `account_id`, `event_type`, `payload_hash`, `attempt_number`, `http_status`, `response_body`, `duration_ms`, `created_at`, `payload_json`). `(account_id, created_at DESC)` was used instead; it serves cross-package delivery history queries scoped to an account. If a `session_id` foreign key is added to this table in the future, a separate index on `(session_id, created_at DESC)` should be added at that time.

**Representative query plan (10 k deliveries, 120 for this account):**

```
-- Before webhook_deliveries_account_created_idx:
Seq Scan on webhook_deliveries
  Filter: (account_id = 7)
  Rows Removed by Filter: 9880
  actual rows=120  loops=1

-- After webhook_deliveries_account_created_idx:
Index Scan using webhook_deliveries_account_created_idx
  Index Cond: (account_id = 7)
  actual rows=120  loops=1
  Buffers: shared hit=4  (was: shared hit=412)
```

---

## `org_audit_log`

| Index name | Columns | Purpose |
|---|---|---|
| `org_audit_log_account_created_idx` | `(account_id, created_at DESC)` | Paginated audit log per account |

**Status:** This index predates the Drizzle migration system. It is:

1. Defined in the Drizzle schema (`lib/db/src/schema/notifications.ts`) so `drizzle-kit` tracks it.
2. Created imperatively in `initDb()` (`db.ts` line ~1386) with `CREATE INDEX IF NOT EXISTS` for backward compatibility with pre-Drizzle environments.
3. Not included in migration `0004` because it was already present in all target environments before that migration was written.

It does not need to be re-created. Any environment that ran `initDb()` at any point already has this index.

---

## Migration: `0004_submission_scale_indexes`

File: `artifacts/api-server/drizzle/0004_submission_scale_indexes.sql`

Contains six `CREATE INDEX CONCURRENTLY IF NOT EXISTS` statements (one per new index). All use btree and `DESC NULLS LAST` ordering for the `created_at` / `expires_at` columns.

### Why CONCURRENTLY in the migration file

`CREATE INDEX CONCURRENTLY` builds the index without holding a write lock, avoiding visible latency spikes on tables with sustained write load. Standard `CREATE INDEX` (inside a transaction) acquires a `ShareLock` for the entire build duration.

`CONCURRENTLY` **cannot run inside a transaction block**. Drizzle's `migrate()` function wraps every migration in `BEGIN`/`COMMIT`. To resolve this constraint, `runDrizzleMigrations()` contains a **non-transactional pre-handler** that runs before `migrate()`:

1. Scans the migration journal for any migration whose SQL contains `CONCURRENTLY`.
2. For each such migration, if it is not yet recorded in `__drizzle_migrations`, runs the SQL statements directly via `pool.query()` (auto-committed, outside any transaction).
3. Inserts the migration's hash into `__drizzle_migrations` immediately after.
4. When `migrate()` runs subsequently, it sees the migration as already applied and skips it.

This means the migration file correctly says `CONCURRENTLY` and is executed correctly outside a transaction. The `IF NOT EXISTS` guard ensures the statement is a no-op on any environment where the indexes were already created manually or by a prior run.

### `initDb()` CONCURRENTLY guards

Six matching `CREATE INDEX CONCURRENTLY IF NOT EXISTS` calls also exist at the end of `initDb()` (`db.ts`). These run on **every** server startup after `runDrizzleMigrations()`. They are instant no-ops if the indexes exist and serve as a belt-and-suspenders safety net for environments where the migration failed silently.

### Manual pre-creation (optional, for very large tables)

To create the indexes manually before deploying (e.g. during a maintenance window), run each statement **outside a transaction** (`BEGIN`/`COMMIT` must not wrap them):

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

Because the migration uses `IF NOT EXISTS`, it will skip any index already present and complete cleanly without error when the server next deploys.

---

## Migration reconciliation in `runDrizzleMigrations()`

The dev and production databases were created before Drizzle migrations were introduced. `initDb()` applied many schema changes imperatively using `ALTER TABLE … IF NOT EXISTS`. This meant the Drizzle migration tracking table (`drizzle.__drizzle_migrations`) could be in a state where it only had migration 0000's record, causing Drizzle to re-run migrations 0001–0004, all of which would fail (column/table already exists).

`runDrizzleMigrations()` contains per-migration reconciliation guards that fix this:

| Migration | Schema signal checked | Behaviour |
|---|---|---|
| 0001 | `accounts.trial_ended_at` column exists | Upsert record (mark as applied, skip re-run) |
| 0002 | `affiliates` table exists | Upsert record; if table missing, run SQL inline |
| 0003 | `docufill_package_documents.pdf_gcs_key` column exists | Upsert record; if column missing, run SQL inline |
| 0004 | Contains `CONCURRENTLY` | Non-transactional pre-handler (see above) |

All reconciliation logic is idempotent: if the record already exists with the correct hash and timestamp, `upsertMigrationRecord()` replaces it with identical data.

---

## Adding indexes in the future

1. Add the index definition to the relevant table in `lib/db/src/schema/` (e.g. `docufill.ts`, `notifications.ts`).
2. Run `pnpm --filter @workspace/api-server run db:generate` to produce the next migration file.
3. Verify the generated SQL contains only the expected `CREATE INDEX` statements (no unintended table DDL — check if prior migration snapshots are missing from `drizzle/meta/`).
4. If the index build should not block writes, write the migration SQL with `CREATE INDEX CONCURRENTLY IF NOT EXISTS` — the non-transactional pre-handler in `runDrizzleMigrations()` will detect it automatically.
5. Add a matching `CREATE INDEX CONCURRENTLY IF NOT EXISTS` guard at the end of `initDb()` in `db.ts` as a belt-and-suspenders fallback.
6. For very large production tables, also run the `CONCURRENTLY` form manually before deploying (see above).
