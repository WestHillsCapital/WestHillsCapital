import { Pool } from "pg";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import path from "path";
import { logger } from "./lib/logger";
import { appendBookingAttemptToSheet } from "./lib/google-sheets";
import { ObjectStorageService } from "./lib/objectStorage";

const objectStorage = new ObjectStorageService();

let pool: Pool | null = null;

// ── DB readiness flags ─────────────────────────────────────────────────────────
// Used by /healthz to report DB status without blocking the response.
export let dbReady = false;
export let dbError: string | null = null;

/**
 * Builds the SSL configuration for pg Pool connections.
 *
 * In development (NODE_ENV !== "production") SSL is disabled so the local
 * Replit-managed dev database (which does not serve TLS) can connect without
 * extra config.
 *
 * In production:
 *   - rejectUnauthorized: true  — certificate chain is verified against the
 *     Node.js system CA bundle (SOC 2 CC6.7 — authenticated connections).
 *     Both Replit-managed Neon and Railway Postgres use publicly-trusted certs
 *     (Let's Encrypt / DigiCert), so no custom CA is needed in standard setups.
 *   - DB_SSL_CA (optional, base64-encoded PEM) — if the database provider uses
 *     a private CA cert (e.g. a self-hosted Postgres), encode the cert as
 *     base64 and set this variable. The cert is decoded at startup and passed
 *     as the `ca` option to TLS, while rejectUnauthorized remains true.
 */
function buildDbSslConfig(): false | { rejectUnauthorized: boolean; ca?: string } {
  if (process.env.NODE_ENV !== "production") return false;

  const caPem = process.env.DB_SSL_CA
    ? Buffer.from(process.env.DB_SSL_CA, "base64").toString("utf8")
    : undefined;

  // Railway's managed PostgreSQL uses a self-signed certificate that is not in
  // the Node.js system CA bundle, so rejectUnauthorized must be false unless a
  // custom CA is explicitly provided via DB_SSL_CA.
  //
  // The connection is still fully TLS-encrypted (CC6.7); only certificate chain
  // verification is relaxed.  To enable strict verification, base64-encode the
  // provider's CA cert and set DB_SSL_CA.
  const rejectUnauthorized = !!caPem;

  return {
    rejectUnauthorized,
    ...(caPem ? { ca: caPem } : {}),
  };
}

export function getDb(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const sslConfig = buildDbSslConfig();
    logger.info(
      {
        sslEnabled: sslConfig !== false,
        rejectUnauthorized: sslConfig !== false ? sslConfig.rejectUnauthorized : false,
        customCa: sslConfig !== false && "ca" in sslConfig && !!sslConfig.ca,
      },
      "[DB] SSL configuration",
    );
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
      // Sane pool limits: enough for concurrent requests, not so many that we
      // exhaust Railway's Postgres connection limit.
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    // Log pool-level errors so they surface in Railway logs
    pool.on("error", (err) => {
      logger.error({ err }, "[DB] Unexpected pool error");
    });
  }
  return pool;
}

// ── Drizzle migrations ─────────────────────────────────────────────────────────
// Runs tracked SQL migrations from the ./drizzle folder on startup.
// On an existing database (accounts table already present) the initial migration
// is baselined so drizzle knows it is already applied. On a fresh database all
// migrations run normally. Always non-fatal — initDb() handles idempotent
// schema management for the running production DB.
export async function runDrizzleMigrations(): Promise<void> {
  const db = getDb();
  try {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { readFile } = await import("fs/promises");
    const { createHash } = await import("crypto");

    const migrationsFolder = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../drizzle",
    );

    // Read journal once — used by both baseline and concurrent-migration logic.
    const journalRaw = await readFile(
      path.join(migrationsFolder, "meta/_journal.json"),
      "utf8",
    );
    const journal = JSON.parse(journalRaw) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };

    // Helper: compute the SHA-256 hash Drizzle uses for tracking a migration.
    const migrationHash = async (tag: string) => {
      const sql = await readFile(path.join(migrationsFolder, `${tag}.sql`), "utf8");
      return { hash: createHash("sha256").update(sql).digest("hex"), sql };
    };

    // Helper: ensure the drizzle tracking table exists before any reads/writes.
    const ensureMigrationsTable = async () => {
      await db.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
      await db.query(`
        CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
          id         SERIAL PRIMARY KEY,
          hash       TEXT    NOT NULL,
          created_at BIGINT
        )
      `);
    };

    // Helper: upsert a migration record by its canonical timestamp.
    // Uses created_at as the identity key because Drizzle's migrator orders by
    // it to determine the "last applied" migration — not by hash.
    const upsertMigrationRecord = async (hash: string, when: number) => {
      await db.query(
        `DELETE FROM drizzle."__drizzle_migrations" WHERE hash = $1 OR created_at = $2`,
        [hash, when],
      );
      await db.query(
        `INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
        [hash, when],
      );
    };

    // ── Baseline + per-migration reconciliation ────────────────────────────────
    // Only runs when the accounts table already exists (i.e. production or dev
    // DBs that were set up before Drizzle migrations were introduced).
    const { rows } = await db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'accounts'
       ) AS exists`,
    );
    if (rows[0]?.exists) {
      await ensureMigrationsTable();

      const { rows: existing } = await db.query(
        `SELECT 1 FROM drizzle."__drizzle_migrations" LIMIT 1`,
      );
      if (existing.length === 0) {
        // Empty table: baseline migrations 0 and 1 only.
        // Leave 0002 (affiliate tables) unrecorded so migrate() creates them
        // on first run (they cannot be assumed to exist yet on a fresh DB).
        const AFFILIATE_TABLES_IDX = 2;
        const baselineEntries = journal.entries.filter(
          (e) => e.idx < AFFILIATE_TABLES_IDX,
        );
        for (const entry of baselineEntries) {
          const { hash } = await migrationHash(entry.tag);
          await db.query(
            `INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
            [hash, entry.when],
          );
        }
        logger.info(
          { count: baselineEntries.length },
          "[Migrations] Baselined Drizzle migrations on existing database",
        );
      }

      // ── Per-migration reconciliation (runs even when table is not empty) ────
      // These guards handle DBs where initDb() applied a schema change before
      // the corresponding Drizzle migration was introduced. Each check is
      // idempotent: if the record is already present with the correct timestamp,
      // the upsert replaces it with identical data — harmless.

      // Migration 0001: adds trial_ended_at + data_purged_at to accounts.
      // initDb() adds these columns with ALTER TABLE IF NOT EXISTS, so on a DB
      // that ran initDb() before migration 0001 was tracked, trial_ended_at will
      // already exist. Without this reconciliation Drizzle re-runs 0001 and
      // fails because ADD COLUMN (without IF NOT EXISTS) errors on duplicates.
      const { rows: trialColRows } = await db.query<{ exists: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM information_schema.columns
            WHERE table_name = 'accounts' AND column_name = 'trial_ended_at'
         ) AS exists`,
      );
      if (trialColRows[0]?.exists) {
        const entry = journal.entries.find((e) => e.idx === 1);
        if (entry) {
          const { hash } = await migrationHash(entry.tag);
          await upsertMigrationRecord(hash, entry.when);
          logger.info("[Migrations] Reconciled migration 0001 (trial_ended_at)");
        }
      }

      // Migration 0002: creates affiliate tables.
      // If the tables already exist, reconcile the record so migrate() skips it.
      // If they don't exist yet (DB was in a stuck state where migration 0002 never
      // committed), run the SQL inline NOW — before the non-transactional handler
      // pre-records migration 0004, which would otherwise raise the `created_at`
      // ceiling past 0002 and cause migrate() to skip it permanently.
      const entry0002 = journal.entries.find((e) => e.idx === 2);
      if (entry0002) {
        const { hash: hash0002, sql: sql0002 } = await migrationHash(entry0002.tag);
        const { rows: affiliateTableRows } = await db.query<{ exists: boolean }>(
          `SELECT EXISTS(
             SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'affiliates'
           ) AS exists`,
        );
        if (affiliateTableRows[0]?.exists) {
          // Tables already exist — just ensure the record is present/correct.
          await upsertMigrationRecord(hash0002, entry0002.when);
          logger.info("[Migrations] Reconciled migration 0002 (affiliate tables)");
        } else {
          // Tables missing on an existing DB — apply the migration inline.
          const { rows: m2Applied } = await db.query<{ id: number }>(
            `SELECT id FROM drizzle."__drizzle_migrations" WHERE hash = $1`,
            [hash0002],
          );
          if (m2Applied.length === 0) {
            logger.info("[Migrations] Applying migration 0002 (affiliate tables) inline");
            const stmts0002 = sql0002.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
            for (const stmt of stmts0002) {
              await db.query(stmt);
            }
            await upsertMigrationRecord(hash0002, entry0002.when);
            logger.info("[Migrations] Migration 0002 (affiliate tables) applied successfully");
          }
        }
      }

      // Migration 0003: adds pdf_gcs_key to docufill_package_documents.
      // Same dual pattern: reconcile if the column exists, apply inline if not.
      const entry0003 = journal.entries.find((e) => e.idx === 3);
      if (entry0003) {
        const { hash: hash0003, sql: sql0003 } = await migrationHash(entry0003.tag);
        const { rows: gcsColRows } = await db.query<{ exists: boolean }>(
          `SELECT EXISTS(
             SELECT 1 FROM information_schema.columns
              WHERE table_name = 'docufill_package_documents' AND column_name = 'pdf_gcs_key'
           ) AS exists`,
        );
        if (gcsColRows[0]?.exists) {
          await upsertMigrationRecord(hash0003, entry0003.when);
          logger.info("[Migrations] Reconciled migration 0003 (pdf_gcs_key)");
        } else {
          const { rows: m3Applied } = await db.query<{ id: number }>(
            `SELECT id FROM drizzle."__drizzle_migrations" WHERE hash = $1`,
            [hash0003],
          );
          if (m3Applied.length === 0) {
            logger.info("[Migrations] Applying migration 0003 (pdf_gcs_key) inline");
            const stmts0003 = sql0003.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
            for (const stmt of stmts0003) {
              await db.query(stmt);
            }
            await upsertMigrationRecord(hash0003, entry0003.when);
            logger.info("[Migrations] Migration 0003 (pdf_gcs_key) applied successfully");
          }
        }
      }

      // ── Non-transactional (CONCURRENTLY) migrations ──────────────────────────
      // CREATE INDEX CONCURRENTLY cannot run inside a transaction. Drizzle's
      // migrate() wraps every migration in BEGIN/COMMIT. Migrations marked with
      // the `-- DRIZZLE:RUN-CONCURRENT` header comment are detected here and
      // executed outside that wrapper on existing databases (where the indexed
      // tables are known to exist). The record is inserted into
      // __drizzle_migrations so migrate() treats it as already applied and
      // skips it.
      //
      // On fresh databases this block is skipped entirely (the enclosing
      // `if (rows[0]?.exists)` guard is false), so migrate() runs these
      // migrations as plain CREATE INDEX IF NOT EXISTS inside its transaction —
      // safe because newly created tables are small and hold no write load.
      for (const entry of journal.entries) {
        let sqlContent: string;
        try {
          sqlContent = await readFile(
            path.join(migrationsFolder, `${entry.tag}.sql`),
            "utf8",
          );
        } catch {
          continue;
        }
        if (!sqlContent.includes("DRIZZLE:RUN-CONCURRENT")) continue;

        const hash = createHash("sha256").update(sqlContent).digest("hex");
        const { rows: alreadyApplied } = await db.query<{ id: number }>(
          `SELECT id FROM drizzle."__drizzle_migrations" WHERE hash = $1`,
          [hash],
        );
        if (alreadyApplied.length > 0) continue;

        logger.info({ tag: entry.tag }, "[Migrations] Applying non-transactional migration");
        const rawStatements = sqlContent
          .split("--> statement-breakpoint")
          .map((s) =>
            s
              .split("\n")
              .filter((line) => !line.trim().startsWith("--"))
              .join("\n")
              .trim(),
          )
          .filter(Boolean);
        for (const stmt of rawStatements) {
          // Inject CONCURRENTLY after CREATE INDEX so that the index build
          // does not acquire a ShareLock on the existing table.
          const concurrentStmt = stmt.replace(
            /^CREATE INDEX IF NOT EXISTS/i,
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS",
          );
          await db.query(concurrentStmt);
        }
        await db.query(
          `INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
          [hash, entry.when],
        );
        logger.info({ tag: entry.tag }, "[Migrations] Non-transactional migration applied");
      }

      // Fall through — migrate() will now see all reconciled records and skip
      // any migrations whose schema changes are already present.
    }

    const ormDb = drizzle(db);
    await migrate(ormDb, { migrationsFolder });
    logger.info("[Migrations] Drizzle migrations applied successfully");
  } catch (err) {
    logger.warn({ err }, "[Migrations] Migration run skipped — schema may already be managed or DATABASE_URL absent");
  }
}


export async function initDb(): Promise<void> {
  const db = getDb();

  // ── Core tables ────────────────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id               SERIAL PRIMARY KEY,
      confirmation_id  TEXT NOT NULL UNIQUE,
      slot_id          TEXT NOT NULL,
      scheduled_time   TIMESTAMPTZ NOT NULL,
      day_label        TEXT NOT NULL,
      time_label       TEXT NOT NULL,
      first_name       TEXT NOT NULL,
      last_name        TEXT NOT NULL,
      email            TEXT NOT NULL,
      phone            TEXT NOT NULL,
      state            TEXT NOT NULL,
      allocation_type  TEXT NOT NULL,
      allocation_range TEXT NOT NULL,
      timeline         TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'confirmed',
      calendar_event_id TEXT,
      lead_id          INTEGER,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Safe column additions for existing deployments
  for (const col of [
    "ADD COLUMN IF NOT EXISTS calendar_event_id TEXT",
    "ADD COLUMN IF NOT EXISTS lead_id INTEGER",
    "ADD COLUMN IF NOT EXISTS notes TEXT",
    "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  ]) {
    await db.query(`ALTER TABLE appointments ${col}`).catch(() => {});
  }

  // Partial unique index: only one confirmed booking per slot
  try {
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_id_confirmed_idx
        ON appointments (slot_id)
       WHERE status = 'confirmed'
    `);
  } catch (err) {
    logger.warn({ err }, "Could not create unique index on appointments.slot_id");
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id                      SERIAL PRIMARY KEY,
      form_type               TEXT NOT NULL,
      first_name              TEXT NOT NULL,
      last_name               TEXT NOT NULL,
      email                   TEXT NOT NULL,
      phone                   TEXT,
      state                   TEXT,
      allocation_type         TEXT,
      allocation_range        TEXT,
      timeline                TEXT,
      current_custodian       TEXT,
      ip_address              TEXT,
      status                  TEXT NOT NULL DEFAULT 'new',
      notes                   TEXT,
      follow_up_date          DATE,
      owner                   TEXT,
      linked_confirmation_id  TEXT,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const col of [
    "ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'",
    "ADD COLUMN IF NOT EXISTS notes TEXT",
    "ADD COLUMN IF NOT EXISTS follow_up_date DATE",
    "ADD COLUMN IF NOT EXISTS owner TEXT",
    "ADD COLUMN IF NOT EXISTS linked_confirmation_id TEXT",
    "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  ]) {
    await db.query(`ALTER TABLE leads ${col}`).catch(() => {});
  }

  // ── Audit / ops tables ─────────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_attempts (
      id              SERIAL PRIMARY KEY,
      attempted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      email           TEXT NOT NULL,
      slot_id         TEXT NOT NULL,
      ip_address      TEXT,
      success         BOOLEAN NOT NULL,
      confirmation_id TEXT,
      error_code      TEXT,
      error_detail    TEXT
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS spot_price_history (
      id           SERIAL PRIMARY KEY,
      gold_bid     NUMERIC(12,4),
      gold_ask     NUMERIC(12,4),
      silver_bid   NUMERIC(12,4),
      silver_ask   NUMERIC(12,4),
      source       TEXT,
      recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Content articles table ─────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS content_articles (
      id               SERIAL PRIMARY KEY,
      slug             TEXT UNIQUE NOT NULL,
      title            TEXT NOT NULL,
      excerpt          TEXT NOT NULL,
      group_id         TEXT NOT NULL DEFAULT 'making-smart-decisions',
      meta_description TEXT NOT NULL DEFAULT '',
      sections         JSONB NOT NULL DEFAULT '[]',
      related          JSONB NOT NULL DEFAULT '[]',
      status           TEXT NOT NULL DEFAULT 'draft',
      published_at     TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(
    "ALTER TABLE content_articles ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT ''"
  ).catch(() => {});

  // ── Deals table ────────────────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS deals (
      id                  SERIAL PRIMARY KEY,
      lead_id             INTEGER,
      confirmation_id     TEXT,
      deal_type           TEXT NOT NULL DEFAULT 'cash',
      ira_type            TEXT,
      first_name          TEXT NOT NULL,
      last_name           TEXT NOT NULL,
      email               TEXT NOT NULL,
      phone               TEXT,
      state               TEXT,
      custodian           TEXT,
      custodian_id        INTEGER,
      depository          TEXT,
      depository_id       INTEGER,
      ira_account_number  TEXT,
      gold_spot_ask       NUMERIC(12,4),
      silver_spot_ask     NUMERIC(12,4),
      spot_timestamp      TIMESTAMPTZ,
      products            JSONB,
      subtotal            NUMERIC(12,2),
      shipping            NUMERIC(12,2),
      total               NUMERIC(12,2),
      balance_due         NUMERIC(12,2),
      shipping_method     TEXT DEFAULT 'fedex_hold',
      fedex_location      TEXT,
      notes               TEXT,
      status              TEXT NOT NULL DEFAULT 'locked',
      locked_at           TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Safe column additions for the deals table (idempotent) ─────────────────
  const safeAdd = async (col: string, type: string) => {
    await db.query(
      `ALTER TABLE deals ADD COLUMN IF NOT EXISTS ${col} ${type}`
    );
  };
  // Ship-to address
  await safeAdd("custodian_id",   "INTEGER");
  await safeAdd("depository",     "TEXT");
  await safeAdd("depository_id",  "INTEGER");
  await safeAdd("ship_to_name",  "TEXT");
  await safeAdd("ship_to_line1", "TEXT");
  await safeAdd("ship_to_city",  "TEXT");
  await safeAdd("ship_to_state", "TEXT");
  await safeAdd("ship_to_zip",   "TEXT");
  // DG trade execution
  await safeAdd("external_trade_id",        "TEXT");
  await safeAdd("supplier_confirmation_id", "TEXT");
  await safeAdd("execution_status",         "TEXT");
  await safeAdd("execution_timestamp",      "TIMESTAMPTZ");
  // Invoice
  await safeAdd("invoice_id",           "TEXT");
  await safeAdd("invoice_url",          "TEXT");
  await safeAdd("invoice_generated_at", "TIMESTAMPTZ");
  await safeAdd("recap_email_sent_at",  "TIMESTAMPTZ");
  // Billing address (shown on invoice Bill To block)
  await safeAdd("billing_line1", "TEXT");
  await safeAdd("billing_line2", "TEXT");
  await safeAdd("billing_city",  "TEXT");
  await safeAdd("billing_state", "TEXT");
  await safeAdd("billing_zip",   "TEXT");
  // FedEx Hold location hours (shown on invoice and recap email delivery block)
  await safeAdd("fedex_location_hours", "TEXT");
  // Terms of Service acknowledgment (required before deal execution)
  await safeAdd("terms_provided",       "BOOLEAN");
  await safeAdd("terms_provided_at",    "TIMESTAMPTZ");
  await safeAdd("terms_version",        "TEXT");
  await safeAdd("confirmation_method",  "TEXT");
  // Ops status tracking (legacy column — kept for backward compat)
  await safeAdd("payment_received_at",  "TIMESTAMPTZ");
  await safeAdd("tracking_number",      "TEXT");
  await safeAdd("order_placed_at",      "TIMESTAMPTZ");
  // Execution warnings (persisted so they survive page reload)
  await safeAdd("execution_warnings",   "JSONB DEFAULT '[]'::jsonb");
  // ── Fulfillment milestone dates ─────────────────────────────────────────
  // Two payment dates: customer pays WHC vs. WHC pays Dillon Gage
  await safeAdd("wire_received_at",     "TIMESTAMPTZ"); // customer wire arrives in WHC account
  await safeAdd("order_paid_at",        "TIMESTAMPTZ"); // Joe pays DG via ACH on Fiztrade
  // Shipping milestone dates
  await safeAdd("shipped_at",           "TIMESTAMPTZ"); // product ships from DG
  await safeAdd("delivered_at",         "TIMESTAMPTZ"); // customer confirms receipt
  // Scheduled email timestamps (set by system, consumed by background scheduler)
  await safeAdd("shipping_notification_scheduled_at", "TIMESTAMPTZ"); // NOW() + 24h when tracking # received
  await safeAdd("shipping_email_sent_at",             "TIMESTAMPTZ"); // when shipping email fired
  await safeAdd("delivery_email_sent_at",             "TIMESTAMPTZ"); // when delivery email fired
  await safeAdd("follow_up_7d_scheduled_at",           "TIMESTAMPTZ"); // set at delivery+7d; scheduler fires email when this passes
  await safeAdd("follow_up_30d_scheduled_at",         "TIMESTAMPTZ"); // set at delivery+30d; scheduler fires email when this passes
  // Sent-at columns — set after each email actually sends (idempotency guards)
  await safeAdd("follow_up_7d_sent_at",               "TIMESTAMPTZ"); // when 7-day follow-up email was sent
  await safeAdd("follow_up_30d_sent_at",              "TIMESTAMPTZ"); // when 30-day follow-up email was sent
  await safeAdd("wire_confirmation_email_sent_at",    "TIMESTAMPTZ"); // when wire confirmation email (Email 1) was sent

  // ── Multi-tenancy: accounts + users ───────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS account_users (
      id             SERIAL PRIMARY KEY,
      account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      email          TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'member',
      clerk_user_id  TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, email)
    )
  `);
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS clerk_user_id TEXT`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS account_users_clerk_user_id_idx ON account_users (clerk_user_id) WHERE clerk_user_id IS NOT NULL`);
  await db.query(`
    CREATE INDEX IF NOT EXISTS account_users_email_idx ON account_users (lower(email))
  `);

  // Seed the West Hills Capital account (account_id = 1) — idempotent
  await db.query(`
    INSERT INTO accounts (id, name, slug)
    VALUES (1, 'West Hills Capital', 'west-hills-capital')
    ON CONFLICT (id) DO NOTHING
  `);
  // Reset the sequence so new accounts start from 2 at minimum
  await db.query(`SELECT setval('accounts_id_seq', GREATEST((SELECT MAX(id) FROM accounts), 1))`);

  // Seed account_users from the INTERNAL_ALLOWED_EMAILS env var (idempotent)
  const allowedEmails = (process.env.INTERNAL_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const email of allowedEmails) {
    await db.query(
      `INSERT INTO account_users (account_id, email, role)
       VALUES (1, $1, 'admin')
       ON CONFLICT (account_id, email) DO NOTHING`,
      [email],
    ).catch(() => {});
  }

  // ── deals.account_id — added after accounts exists so FK can be declared ─────
  // The deals CREATE TABLE runs before accounts (for historical ordering reasons),
  // so account_id is added here, after accounts is guaranteed to exist.
  await safeAdd("account_id", "INTEGER REFERENCES accounts(id)");
  await db.query(`CREATE INDEX IF NOT EXISTS deals_account_id_idx ON deals (account_id)`);

  // ── Account branding columns ─────────────────────────────────────────────────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS logo_url TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS form_logo_url TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '#C49A38'`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS logo_on_white BOOLEAN NOT NULL DEFAULT TRUE`);

  // Seat limit — max active team members (default 10; updated when plan changes)
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS seat_limit INTEGER NOT NULL DEFAULT 10`);

  // ── Billing / subscription columns ────────────────────────────────────────────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'free'`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_status TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ`);

  // West Hills Capital (account 1) is the internal WHC account — give it enterprise
  await db.query(`
    UPDATE accounts SET plan_tier = 'enterprise', seat_limit = 999
    WHERE id = 1 AND plan_tier = 'free'
  `);

  // ── Industry column ───────────────────────────────────────────────────────────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS industry TEXT`);

  // ── Custom domain columns ─────────────────────────────────────────────────────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS custom_domain TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS custom_domain_status TEXT NOT NULL DEFAULT 'unverified'`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ`);

  // ── Usage events — one row per billable action per account per period ─────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS usage_events (
      id             SERIAL PRIMARY KEY,
      account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      event_type     TEXT NOT NULL,
      period_start   DATE NOT NULL DEFAULT DATE_TRUNC('month', NOW()),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS usage_events_account_period_idx
      ON usage_events (account_id, period_start, event_type)
  `);

  // Server-side session store backed by Postgres (replaces in-memory Map)
  await db.query(`
    CREATE TABLE IF NOT EXISTS internal_sessions (
      token      TEXT PRIMARY KEY,
      email      TEXT NOT NULL,
      account_id INTEGER NOT NULL DEFAULT 1,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS internal_sessions_expires_idx ON internal_sessions (expires_at)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_custodians (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL UNIQUE,
      contact_name TEXT,
      email        TEXT,
      phone        TEXT,
      notes        TEXT,
      active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_depositories (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL UNIQUE,
      contact_name TEXT,
      email        TEXT,
      phone        TEXT,
      notes        TEXT,
      active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_transaction_types (
      scope      TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      active     BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Migration: add per-org isolation — each account manages its own types
  await db.query(`
    ALTER TABLE docufill_transaction_types
      ADD COLUMN IF NOT EXISTS account_id INT REFERENCES accounts(id) ON DELETE CASCADE
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS docufill_transaction_types_account_idx
      ON docufill_transaction_types(account_id)
  `);
  // Seed default types for account 1 (West Hills Capital) using prefixed scopes
  await seedDefaultTransactionTypes(db, 1);

  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_fields (
      id                 TEXT PRIMARY KEY,
      label              TEXT NOT NULL,
      category           TEXT NOT NULL DEFAULT 'General',
      field_type         TEXT NOT NULL DEFAULT 'text',
      source             TEXT NOT NULL DEFAULT 'interview',
      options            JSONB NOT NULL DEFAULT '[]'::jsonb,
      sensitive          BOOLEAN NOT NULL DEFAULT FALSE,
      required           BOOLEAN NOT NULL DEFAULT FALSE,
      validation_type    TEXT NOT NULL DEFAULT 'none',
      validation_pattern TEXT,
      validation_message TEXT,
      active             BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order         INTEGER NOT NULL DEFAULT 100,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // NOTE: the global label-uniqueness index was replaced by per-scope partial indexes
  // via migration docufill_fields_scoped_label_v1 (see migration block below).
  // Do NOT recreate docufill_fields_label_unique here — the migration drops it
  // once and creates docufill_fields_global_label_unique + docufill_fields_account_label_unique.
  // Add per-account scoping column (NULL = global system field, set = account-owned field)
  await db.query(`ALTER TABLE docufill_fields ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id)`);
  await db.query(`
    INSERT INTO docufill_fields
      (id, label, category, field_type, source, options, sensitive, required, validation_type, validation_message, active, sort_order)
    VALUES
      ('client_name', 'Name', 'Customer identity', 'text', 'clientName', '[]'::jsonb, FALSE, TRUE, 'name', NULL, TRUE, 5),
      ('client_first_name', 'Client first name', 'Customer identity', 'text', 'firstName', '[]'::jsonb, FALSE, TRUE, 'name', NULL, TRUE, 10),
      ('client_last_name', 'Client last name', 'Customer identity', 'text', 'lastName', '[]'::jsonb, FALSE, TRUE, 'name', NULL, TRUE, 20),
      ('client_full_name', 'Client full legal name', 'Customer identity', 'text', 'fullName', '[]'::jsonb, FALSE, TRUE, 'name', NULL, TRUE, 30),
      ('client_email', 'Client email', 'Contact', 'text', 'email', '[]'::jsonb, FALSE, TRUE, 'email', NULL, TRUE, 40),
      ('client_phone', 'Client phone', 'Contact', 'text', 'phone', '[]'::jsonb, FALSE, TRUE, 'phone', NULL, TRUE, 50),
      ('client_ssn', 'Client SSN', 'Customer identity', 'text', 'ssn', '[]'::jsonb, TRUE, TRUE, 'ssn', 'Enter a valid SSN.', TRUE, 60),
      ('client_dob', 'Client date of birth', 'Customer identity', 'date', 'dateOfBirth', '[]'::jsonb, TRUE, TRUE, 'date', NULL, TRUE, 70),
      ('client_address_line1', 'Client address line 1', 'Address', 'text', 'addressLine1', '[]'::jsonb, FALSE, TRUE, 'none', NULL, TRUE, 80),
      ('client_address_line2', 'Client address line 2', 'Address', 'text', 'addressLine2', '[]'::jsonb, FALSE, FALSE, 'none', NULL, TRUE, 90),
      ('client_city', 'Client city', 'Address', 'text', 'city', '[]'::jsonb, FALSE, TRUE, 'none', NULL, TRUE, 100),
      ('client_state', 'Client state', 'Address', 'text', 'state', '[]'::jsonb, FALSE, TRUE, 'none', NULL, TRUE, 110),
      ('client_zip', 'Client ZIP code', 'Address', 'text', 'zip', '[]'::jsonb, FALSE, TRUE, 'custom', 'Enter a valid ZIP code.', TRUE, 120),
      ('ira_account_number', 'IRA account number', 'IRA account', 'text', 'iraAccountNumber', '[]'::jsonb, TRUE, FALSE, 'none', NULL, TRUE, 130),
      ('custodian_name', 'Custodian name', 'IRA account', 'text', 'custodian', '[]'::jsonb, FALSE, FALSE, 'none', NULL, TRUE, 140),
      ('beneficiary_name', 'Beneficiary full name', 'Beneficiary', 'text', 'beneficiaryName', '[]'::jsonb, FALSE, FALSE, 'name', NULL, TRUE, 150),
      ('beneficiary_relationship', 'Beneficiary relationship', 'Beneficiary', 'text', 'beneficiaryRelationship', '[]'::jsonb, FALSE, FALSE, 'none', NULL, TRUE, 160),
      ('client_signature', 'Client signature', 'Signature', 'text', 'signature', '[]'::jsonb, FALSE, TRUE, 'none', NULL, TRUE, 170),
      ('signature_date', 'Signature date', 'Signature', 'date', 'signatureDate', '[]'::jsonb, FALSE, TRUE, 'date', NULL, TRUE, 180)
    ON CONFLICT DO NOTHING
  `);
  await db.query(`
    UPDATE docufill_fields
       SET validation_pattern = '^\\d{5}(-\\d{4})?$',
           validation_message = COALESCE(validation_message, 'Enter a valid ZIP code.'),
           updated_at = NOW()
     WHERE id = 'client_zip'
       AND validation_type = 'custom'
       AND validation_pattern IS NULL
  `);

  // ── Field version history ──────────────────────────────────────────────────
  // One row per save of a library field definition (including rollbacks).
  // account_id is denormalized here so history is queryable without joining
  // docufill_fields (which may have been deleted).
  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_field_versions (
      id          SERIAL PRIMARY KEY,
      field_id    TEXT NOT NULL,
      account_id  INTEGER NOT NULL,
      changed_by  TEXT,
      changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      snapshot    JSONB NOT NULL
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS docufill_field_versions_field_idx
      ON docufill_field_versions (field_id, account_id, changed_at DESC)
  `);

  // ── Field groups (bundles of library fields for one-click package addition) ─
  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_field_groups (
      id          SERIAL PRIMARY KEY,
      account_id  INTEGER NOT NULL REFERENCES accounts(id),
      name        TEXT NOT NULL,
      description TEXT,
      field_ids   JSONB NOT NULL DEFAULT '[]',
      sort_order  INTEGER NOT NULL DEFAULT 100,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS docufill_field_groups_account_idx
      ON docufill_field_groups (account_id, sort_order ASC, name ASC)
  `);

  // ── Compliance tags ────────────────────────────────────────────────────────
  // Account-configurable tags for marking library fields as required by specific
  // regulations (KYC, FINRA, AML, etc.). is_required drives the audit report.
  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_compliance_tags (
      id          SERIAL PRIMARY KEY,
      account_id  INTEGER NOT NULL REFERENCES accounts(id),
      name        TEXT NOT NULL,
      color       TEXT NOT NULL DEFAULT '#6B7A99',
      description TEXT,
      is_required BOOLEAN NOT NULL DEFAULT FALSE,
      is_builtin  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, name)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS docufill_compliance_tags_account_idx
      ON docufill_compliance_tags (account_id, name ASC)
  `);
  // Add compliance_tags JSONB column to docufill_fields (array of tag names, e.g. ["KYC","AML"])
  await db.query(`ALTER TABLE docufill_fields ADD COLUMN IF NOT EXISTS compliance_tags JSONB NOT NULL DEFAULT '[]'::jsonb`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_packages (
      id                SERIAL PRIMARY KEY,
      name              TEXT NOT NULL,
      custodian_id      INTEGER REFERENCES docufill_custodians(id) ON DELETE SET NULL,
      depository_id     INTEGER REFERENCES docufill_depositories(id) ON DELETE SET NULL,
      transaction_scope TEXT NOT NULL DEFAULT '',
      description       TEXT,
      status            TEXT NOT NULL DEFAULT 'draft',
      version           INTEGER NOT NULL DEFAULT 1,
      documents         JSONB NOT NULL DEFAULT '[]'::jsonb,
      fields            JSONB NOT NULL DEFAULT '[]'::jsonb,
      mappings          JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Usage tracking: records which packages each field group has been applied to (created after both referenced tables)
  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_field_group_usage (
      group_id    INTEGER NOT NULL REFERENCES docufill_field_groups(id) ON DELETE CASCADE,
      package_id  INTEGER NOT NULL REFERENCES docufill_packages(id) ON DELETE CASCADE,
      account_id  INTEGER NOT NULL REFERENCES accounts(id),
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (group_id, package_id)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS docufill_field_group_usage_account_idx
      ON docufill_field_group_usage (account_id)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_package_documents (
      id             SERIAL PRIMARY KEY,
      package_id     INTEGER NOT NULL REFERENCES docufill_packages(id) ON DELETE CASCADE,
      document_id    TEXT NOT NULL,
      filename       TEXT NOT NULL,
      content_type   TEXT NOT NULL DEFAULT 'application/pdf',
      byte_size      INTEGER NOT NULL,
      page_count     INTEGER NOT NULL DEFAULT 1,
      pdf_data       BYTEA NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(package_id, document_id)
    )
  `);

  await db.query(`
    ALTER TABLE docufill_package_documents
    ADD COLUMN IF NOT EXISTS page_sizes JSONB NOT NULL DEFAULT '[]'::jsonb
  `);
  // GCS key for template PDFs — new writes go to GCS; pdf_data kept for legacy reads
  await db.query(`ALTER TABLE docufill_package_documents ADD COLUMN IF NOT EXISTS pdf_gcs_key TEXT`);
  await db.query(`ALTER TABLE docufill_package_documents ALTER COLUMN pdf_data DROP NOT NULL`);
  // AES-256-GCM encrypted form of pdf_data (SOC 2 CC6.1) — same envelope-encryption scheme as answers_ciphertext
  await db.query(`ALTER TABLE docufill_package_documents ADD COLUMN IF NOT EXISTS pdf_data_ciphertext TEXT`);
  await db.query(`
    ALTER TABLE docufill_packages
    ADD COLUMN IF NOT EXISTS transaction_scope TEXT NOT NULL DEFAULT ''
  `);
  await db.query(`
    ALTER TABLE docufill_packages
    ADD COLUMN IF NOT EXISTS recipients JSONB NOT NULL DEFAULT '[]'::jsonb
  `);
  await db.query(`
    ALTER TABLE docufill_packages
    ADD COLUMN IF NOT EXISTS enable_interview BOOLEAN NOT NULL DEFAULT true
  `);
  await db.query(`
    ALTER TABLE docufill_packages
    ADD COLUMN IF NOT EXISTS enable_csv BOOLEAN NOT NULL DEFAULT true
  `);
  await db.query(`
    ALTER TABLE docufill_packages
    ADD COLUMN IF NOT EXISTS enable_customer_link BOOLEAN NOT NULL DEFAULT false
  `);
  await db.query(`
    ALTER TABLE docufill_packages
    ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb
  `);
  await db.query(`
    ALTER TABLE docufill_packages
    ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN NOT NULL DEFAULT false
  `);
  await db.query(`
    ALTER TABLE docufill_packages
    ADD COLUMN IF NOT EXISTS webhook_url TEXT
  `);
  await db.query(`
    ALTER TABLE docufill_packages
    ADD COLUMN IF NOT EXISTS slack_notifications_enabled BOOLEAN NOT NULL DEFAULT false
  `);

  // ── Multi-tenancy: account_id columns + backfill ──────────────────────────
  // Nullable so existing rows don't fail; backfill immediately sets them to 1.
  for (const table of ["docufill_custodians", "docufill_depositories", "docufill_packages"]) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id)`).catch(() => {});
    await db.query(`UPDATE ${table} SET account_id = 1 WHERE account_id IS NULL`).catch(() => {});
  }
  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_migration_state (
      key        TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const sharedFieldBackfill = await db.query(
    "SELECT 1 FROM docufill_migration_state WHERE key = $1",
    ["shared_field_backfill_v1"],
  );
  if (!sharedFieldBackfill.rows[0]) {
    const backfillResult = await db.query(`
      UPDATE docufill_packages p
         SET fields = COALESCE((
           SELECT jsonb_agg(
             CASE
               WHEN field_item.item ? 'libraryFieldId' THEN field_item.item
               WHEN matched.id IS NOT NULL THEN field_item.item || jsonb_build_object('libraryFieldId', matched.id)
               ELSE field_item.item
             END
             ORDER BY field_item.ordinality
           )
           FROM jsonb_array_elements(p.fields) WITH ORDINALITY AS field_item(item, ordinality)
           LEFT JOIN LATERAL (
             SELECT id
               FROM docufill_fields
              WHERE lower(label) = lower(COALESCE(field_item.item->>'label', field_item.item->>'name'))
                 OR (
                   COALESCE(field_item.item->>'label', field_item.item->>'name', '') = ''
                   AND lower(source) = lower(field_item.item->>'source')
                 )
              ORDER BY sort_order ASC
              LIMIT 1
           ) matched ON TRUE
         ), '[]'::jsonb)
       WHERE jsonb_typeof(p.fields) = 'array'
         AND p.fields <> '[]'::jsonb
    `);
    await db.query(
      "INSERT INTO docufill_migration_state (key) VALUES ($1) ON CONFLICT (key) DO NOTHING",
      ["shared_field_backfill_v1"],
    );
    logger.info({ updatedPackages: backfillResult.rowCount }, "Docuplete shared field backfill completed");
  }

  // ── docufill_fields account-scoping migration ─────────────────────────────
  // Replaces global label uniqueness with per-scope partial indexes so
  // industry-seeded (per-account) fields don't collide with global system fields.
  const fieldScopeMig = await db.query(
    "SELECT 1 FROM docufill_migration_state WHERE key = $1",
    ["docufill_fields_scoped_label_v1"],
  );
  if (!fieldScopeMig.rows[0]) {
    try {
      await db.query(`DROP INDEX IF EXISTS docufill_fields_label_unique`);
      // Deduplicate global fields (account_id IS NULL) before building the partial
      // unique index — production data may have duplicate labels if the global index
      // was absent. Keep the row with the lowest sort_order (system fields first).
      await db.query(`
        DELETE FROM docufill_fields
        WHERE account_id IS NULL
          AND id NOT IN (
            SELECT DISTINCT ON (lower(label)) id
              FROM docufill_fields
             WHERE account_id IS NULL
             ORDER BY lower(label), sort_order ASC, id ASC
          )
      `);
      // Deduplicate per-account fields similarly.
      await db.query(`
        DELETE FROM docufill_fields
        WHERE account_id IS NOT NULL
          AND id NOT IN (
            SELECT DISTINCT ON (account_id, lower(label)) id
              FROM docufill_fields
             WHERE account_id IS NOT NULL
             ORDER BY account_id, lower(label), sort_order ASC, id ASC
          )
      `);
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS docufill_fields_global_label_unique
          ON docufill_fields (lower(label)) WHERE account_id IS NULL
      `);
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS docufill_fields_account_label_unique
          ON docufill_fields (account_id, lower(label)) WHERE account_id IS NOT NULL
      `);
      await db.query(
        "INSERT INTO docufill_migration_state (key) VALUES ($1) ON CONFLICT (key) DO NOTHING",
        ["docufill_fields_scoped_label_v1"],
      );
      logger.info("[DB] docufill_fields_scoped_label_v1: per-scope label uniqueness applied");
    } catch (migErr) {
      // Non-fatal: log and continue so the server stays up.
      // The migration will be retried on next restart once the data issue is resolved.
      logger.error({ err: migErr }, "[DB] docufill_fields_scoped_label_v1 migration failed (non-fatal) — server will continue");
    }
  }

  // ── Multi-tenant isolation hardening (migration v1) ───────────────────────
  // Enforces NOT NULL + FK on account_id in custodians/depositories/packages,
  // drops global UNIQUE(name), adds per-account UNIQUE(account_id, name) and
  // account_id indexes. Runs in a single transaction; state row written only
  // after post-migration verification passes. Idempotent on retry.
  const isolationV1 = await db.query(
    "SELECT 1 FROM docufill_migration_state WHERE key = $1",
    ["account_id_isolation_v1"],
  );
  if (!isolationV1.rows[0]) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Backfill any NULLs before enforcing NOT NULL
      for (const table of ["docufill_custodians", "docufill_depositories", "docufill_packages"]) {
        await client.query(`UPDATE ${table} SET account_id = 1 WHERE account_id IS NULL`);
      }

      // NOT NULL + FK constraints (idempotent DO blocks)
      for (const table of ["docufill_custodians", "docufill_depositories", "docufill_packages"]) {
        await client.query(`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns
               WHERE table_name = '${table}'
                 AND column_name = 'account_id'
                 AND is_nullable = 'YES'
            ) THEN
              ALTER TABLE ${table} ALTER COLUMN account_id SET NOT NULL;
            END IF;
          END$$
        `);
        await client.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints tc
               JOIN information_schema.key_column_usage kcu
                 ON tc.constraint_name = kcu.constraint_name
              WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = '${table}'
                AND kcu.column_name = 'account_id'
            ) THEN
              ALTER TABLE ${table}
                ADD CONSTRAINT ${table}_account_id_fk
                  FOREIGN KEY (account_id) REFERENCES accounts(id);
            END IF;
          END$$
        `);
      }

      // Per-account uniqueness for custodians/depositories; account_id indexes
      for (const table of ["docufill_custodians", "docufill_depositories"]) {
        await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_name_key`);
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS ${table}_account_name_idx ON ${table} (account_id, name)
        `);
      }
      await client.query(`CREATE INDEX IF NOT EXISTS docufill_custodians_account_idx ON docufill_custodians (account_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS docufill_depositories_account_idx ON docufill_depositories (account_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS docufill_packages_account_idx ON docufill_packages (account_id)`);

      // Verify NOT NULL is actually enforced before recording success
      for (const table of ["docufill_custodians", "docufill_depositories", "docufill_packages"]) {
        const check = await client.query(
          `SELECT is_nullable FROM information_schema.columns WHERE table_name = $1 AND column_name = 'account_id'`,
          [table],
        );
        if (!check.rows[0] || check.rows[0].is_nullable !== "NO") {
          throw new Error(`[DB] Migration verification: ${table}.account_id is still nullable`);
        }
      }

      await client.query(
        "INSERT INTO docufill_migration_state (key) VALUES ($1) ON CONFLICT (key) DO NOTHING",
        ["account_id_isolation_v1"],
      );
      await client.query("COMMIT");
      logger.info("[DB] account_id_isolation_v1 applied");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      logger.error({ err }, "[DB] account_id_isolation_v1 failed — will retry on next start");
      throw err;
    } finally {
      client.release();
    }
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_interview_sessions (
      id               SERIAL PRIMARY KEY,
      token            TEXT NOT NULL UNIQUE,
      package_id       INTEGER NOT NULL REFERENCES docufill_packages(id) ON DELETE CASCADE,
      package_version  INTEGER NOT NULL,
      deal_id          INTEGER REFERENCES deals(id) ON DELETE SET NULL,
      source           TEXT NOT NULL DEFAULT 'deal_builder',
      status           TEXT NOT NULL DEFAULT 'draft',
      prefill          JSONB NOT NULL DEFAULT '{}'::jsonb,
      answers          JSONB NOT NULL DEFAULT '{}'::jsonb,
      generated_packet JSONB,
      expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE docufill_interview_sessions
    ADD COLUMN IF NOT EXISTS transaction_scope TEXT NOT NULL DEFAULT ''
  `);
  await db.query(`
    ALTER TABLE docufill_interview_sessions
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
  `);
  await db.query(`
    ALTER TABLE docufill_interview_sessions
    ADD COLUMN IF NOT EXISTS generated_pdf_drive_id TEXT
  `);
  await db.query(`
    ALTER TABLE docufill_interview_sessions
    ADD COLUMN IF NOT EXISTS generated_pdf_url TEXT
  `);
  await db.query(`
    ALTER TABLE docufill_interview_sessions
    ADD COLUMN IF NOT EXISTS generated_pdf_saved_at TIMESTAMPTZ
  `);
  await db.query(`
    UPDATE docufill_interview_sessions
       SET expires_at = NOW() + INTERVAL '90 days'
     WHERE expires_at IS NULL
  `);
  await db.query(`
    ALTER TABLE docufill_interview_sessions
    ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '90 days')
  `);
  await db.query(`
    ALTER TABLE docufill_interview_sessions
    ADD COLUMN IF NOT EXISTS test_mode BOOLEAN NOT NULL DEFAULT false
  `);
  await db.query(`
    ALTER TABLE docufill_interview_sessions
    ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ
  `);
  await db.query(`
    ALTER TABLE docufill_interview_sessions
    ADD COLUMN IF NOT EXISTS voided_reason TEXT
  `);

  // ── Fix stale transaction_scope defaults ──────────────────────────────────
  // Older migrations used 'Custodial paperwork' / 'ira_transfer' as defaults.
  // The UI treats empty string as "Not specified", so we align the DB to match.
  await db.query(`
    ALTER TABLE docufill_packages
    ALTER COLUMN transaction_scope SET DEFAULT ''
  `);
  await db.query(`
    UPDATE docufill_packages
       SET transaction_scope = ''
     WHERE transaction_scope IN ('ira_transfer', 'Custodial paperwork')
  `);
  await db.query(`
    ALTER TABLE docufill_interview_sessions
    ALTER COLUMN transaction_scope SET DEFAULT ''
  `);
  await db.query(`
    UPDATE docufill_interview_sessions
       SET transaction_scope = ''
     WHERE transaction_scope IN ('ira_transfer', 'Custodial paperwork')
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS docufill_packages_combo_idx
      ON docufill_packages (custodian_id, depository_id, status)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS docufill_packages_workflow_idx
      ON docufill_packages (transaction_scope, status)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS docufill_package_documents_package_idx
      ON docufill_package_documents (package_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS docufill_interview_sessions_token_idx
      ON docufill_interview_sessions (token)
  `);

  // ── Session account ownership (migration v1) ──────────────────────────────
  // Adds account_id directly to docufill_interview_sessions so any query can
  // scope by account without a JOIN to docufill_packages. Idempotent: guarded
  // by docufill_migration_state; runs in a transaction; verifies NOT NULL
  // before recording success.
  const sessionAccountV1 = await db.query(
    "SELECT 1 FROM docufill_migration_state WHERE key = $1",
    ["session_account_id_v1"],
  );
  if (!sessionAccountV1.rows[0]) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Add nullable column (safe for existing rows)
      await client.query(`
        ALTER TABLE docufill_interview_sessions
        ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id)
      `);

      // Backfill from the session's package's account_id
      await client.query(`
        UPDATE docufill_interview_sessions s
           SET account_id = p.account_id
          FROM docufill_packages p
         WHERE p.id = s.package_id
           AND s.account_id IS NULL
      `);

      // Enforce NOT NULL now that all rows are filled
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_name = 'docufill_interview_sessions'
               AND column_name = 'account_id'
               AND is_nullable = 'YES'
          ) THEN
            ALTER TABLE docufill_interview_sessions ALTER COLUMN account_id SET NOT NULL;
          END IF;
        END$$
      `);

      // Index for fast per-account lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS docufill_interview_sessions_account_idx
          ON docufill_interview_sessions (account_id)
      `);

      // Verify before recording success
      const check = await client.query(
        `SELECT is_nullable FROM information_schema.columns
          WHERE table_name = 'docufill_interview_sessions'
            AND column_name = 'account_id'`,
      );
      if (!check.rows[0] || check.rows[0].is_nullable !== "NO") {
        throw new Error("[DB] Migration verification: docufill_interview_sessions.account_id is still nullable");
      }

      await client.query(
        "INSERT INTO docufill_migration_state (key) VALUES ($1) ON CONFLICT (key) DO NOTHING",
        ["session_account_id_v1"],
      );
      await client.query("COMMIT");
      logger.info("[DB] session_account_id_v1 applied");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      logger.error({ err }, "[DB] session_account_id_v1 failed — will retry on next start");
      throw err;
    } finally {
      client.release();
    }
  }

  // ── API keys (for external developer / partner integrations) ─────────────────
  // Raw keys are NEVER stored — only a SHA-256 hash is persisted.
  // The plaintext key is returned exactly once on creation.
  await db.query(`
    CREATE TABLE IF NOT EXISTS account_api_keys (
      id          SERIAL PRIMARY KEY,
      account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      key_hash    TEXT NOT NULL UNIQUE,
      key_prefix  TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at  TIMESTAMPTZ
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS account_api_keys_account_idx
      ON account_api_keys (account_id)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS account_api_keys_hash_idx
      ON account_api_keys (key_hash)
     WHERE revoked_at IS NULL
  `);

  // ── Task #186: last_used_at on API keys ───────────────────────────────────
  await db.query(`ALTER TABLE account_api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ`);

  // ── Task #192: team member management columns ─────────────────────────────
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS invited_by TEXT`);
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS display_name TEXT`);
  // ── Task #280: user profile fields ────────────────────────────────────────
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
  // avatar_token: a random UUID used as the public-facing URL segment for the avatar
  // serving route so that profile photos are not enumerable by sequential user IDs.
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS avatar_token TEXT`);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS account_users_avatar_token_idx
    ON account_users (avatar_token)
    WHERE avatar_token IS NOT NULL
  `);
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS pending_email TEXT`);
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS pending_email_token TEXT`);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS account_users_pending_email_token_idx
    ON account_users (pending_email_token)
    WHERE pending_email_token IS NOT NULL
  `);
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS pending_email_expires_at TIMESTAMPTZ`);
  // Back-fill any rows that pre-date the status column — they are all active
  await db.query(`UPDATE account_users SET status = 'active' WHERE status IS NULL OR status = ''`);

  // ── Task #194: interview link email tracking ───────────────────────────────
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS link_emailed_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS link_email_recipient TEXT`);

  // ── Task #195: per-package submission notification toggles ─────────────────
  await db.query(`ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS notify_staff_on_submit BOOLEAN NOT NULL DEFAULT false`);
  await db.query(`ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS notify_client_on_submit BOOLEAN NOT NULL DEFAULT false`);

  // ── Embed JS snippet output channel ────────────────────────────────────────
  await db.query(`ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS enable_embed BOOLEAN NOT NULL DEFAULT false`);
  await db.query(`ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS embed_key TEXT`);

  // ── Task #196: self-serve onboarding state ──────────────────────────────────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS onboarding_completed_steps JSONB NOT NULL DEFAULT '{}'::jsonb`);

  // ── Task #197: production-grade webhooks ─────────────────────────────────────
  // webhook_secret: HMAC-SHA256 key for X-Docuplete-Signature header.
  // Generated once on package creation; never changes; admin-only visible.
  await db.query(`
    ALTER TABLE docufill_packages
    ADD COLUMN IF NOT EXISTS webhook_secret TEXT
  `);
  // Backfill any existing packages that pre-date the column — generate secrets
  // in Node.js to avoid a pgcrypto dependency.
  {
    const { rows: missing } = await db.query<{ id: number }>(
      `SELECT id FROM docufill_packages WHERE webhook_secret IS NULL`,
    );
    for (const row of missing) {
      await db.query(
        `UPDATE docufill_packages SET webhook_secret = $1 WHERE id = $2`,
        [randomBytes(32).toString("hex"), row.id],
      );
    }
  }
  // Enforce NOT NULL now that all rows are backfilled.
  await db.query(`
    ALTER TABLE docufill_packages
    ALTER COLUMN webhook_secret SET NOT NULL
  `);
  // Delivery log: one row per HTTP attempt (initial + each retry)
  await db.query(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id             SERIAL PRIMARY KEY,
      package_id     INTEGER NOT NULL REFERENCES docufill_packages(id) ON DELETE CASCADE,
      account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      event_type     TEXT NOT NULL DEFAULT 'interview.submitted',
      payload_hash   TEXT NOT NULL,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      http_status    INTEGER,
      response_body  TEXT,
      duration_ms    INTEGER,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS webhook_deliveries_package_created_idx
      ON webhook_deliveries (package_id, created_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS webhook_deliveries_account_idx
      ON webhook_deliveries (account_id)
  `);

  // ── Task #217: store original payload for manual webhook retry ──────────────
  // payload_json holds the raw JSON body that was (or would have been) sent so
  // that failed deliveries can be replayed on demand from the dashboard.
  await db.query(`
    ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS payload_json TEXT
  `);

  // ── IP allowlisting — per-account CIDR ranges for API key access ─────────────
  // Empty array = no restriction (default). Enterprise feature.
  await db.query(`
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS allowed_ip_ranges TEXT[] NOT NULL DEFAULT '{}'
  `);

  // ── Task #247: groups table, kind column, multi-group junction ───────────────
  // docufill_groups may have been created by an earlier manual migration on some
  // environments; CREATE TABLE IF NOT EXISTS makes this idempotent everywhere.
  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_groups (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      kind       TEXT NOT NULL DEFAULT 'general',
      phone      TEXT,
      email      TEXT,
      notes      TEXT,
      active     BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 100,
      account_id INTEGER REFERENCES accounts(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE docufill_groups ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'general'`);
  await db.query(`ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES docufill_groups(id) ON DELETE SET NULL`);
  await db.query(`ALTER TABLE docufill_groups ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id)`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_package_groups (
      package_id INTEGER NOT NULL REFERENCES docufill_packages(id) ON DELETE CASCADE,
      group_id   INTEGER NOT NULL REFERENCES docufill_groups(id)   ON DELETE CASCADE,
      PRIMARY KEY (package_id, group_id)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS docufill_package_groups_package_idx
      ON docufill_package_groups (package_id)
  `);
  // Backfill legacy single group_id into junction table (idempotent via ON CONFLICT)
  {
    const migKey = "package_groups_backfill_v1";
    const { rows: mig } = await db.query("SELECT 1 FROM docufill_migration_state WHERE key = $1", [migKey]);
    if (!mig[0]) {
      await db.query(`
        INSERT INTO docufill_package_groups (package_id, group_id)
          SELECT id, group_id
            FROM docufill_packages
           WHERE group_id IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
      await db.query("INSERT INTO docufill_migration_state (key) VALUES ($1) ON CONFLICT (key) DO NOTHING", [migKey]);
      logger.info("[DB] package_groups_backfill_v1 applied");
    }
  }

  // ── PDF audit trail — extensible for e-sign events ─────────────────────────
  // event_type: 'generated' | 'downloaded' | 'signature_requested' | 'signed'
  // actor_type: 'staff' | 'client' | 'system' | 'api'
  await db.query(`
    CREATE TABLE IF NOT EXISTS pdf_audit_events (
      id            SERIAL PRIMARY KEY,
      account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      session_token TEXT    NOT NULL,
      event_type    TEXT    NOT NULL,
      actor_type    TEXT    NOT NULL,
      actor_email   TEXT,
      actor_ip      TEXT,
      actor_ua      TEXT,
      metadata      JSONB   NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS pdf_audit_events_session_idx
      ON pdf_audit_events (session_token, created_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS pdf_audit_events_account_idx
      ON pdf_audit_events (account_id, created_at DESC)
  `);

  // ── Slack integration — per-account webhook credentials ─────────────────────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slack_channel_name TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slack_connected_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slack_oauth_state TEXT`);

  // ── Google Drive — per-account OAuth credentials ──────────────────────────────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gdrive_access_token TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gdrive_refresh_token TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gdrive_connected_email TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gdrive_folder_id TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gdrive_folder_name TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gdrive_connected_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gdrive_oauth_state TEXT`);
  await db.query(`ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS enable_gdrive BOOLEAN NOT NULL DEFAULT false`);

  // ── Provider-agnostic cloud storage — OneDrive & Dropbox additions ───────────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS storage_provider TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS storage_access_token TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS storage_refresh_token TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS storage_connected_email TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS storage_folder_id TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS storage_folder_name TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS storage_connected_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS storage_oauth_state TEXT`);
  // Migrate existing Google Drive connections into the new provider-agnostic columns
  await db.query(`
    UPDATE accounts
       SET storage_provider        = 'gdrive',
           storage_access_token    = gdrive_access_token,
           storage_refresh_token   = gdrive_refresh_token,
           storage_connected_email = gdrive_connected_email,
           storage_folder_id       = gdrive_folder_id,
           storage_folder_name     = gdrive_folder_name,
           storage_connected_at    = gdrive_connected_at
     WHERE gdrive_refresh_token IS NOT NULL
       AND storage_provider IS NULL
  `);

  // ── HubSpot — per-account OAuth credentials ───────────────────────────────────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS hubspot_access_token TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS hubspot_refresh_token TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS hubspot_hub_id TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS hubspot_hub_domain TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS hubspot_connected_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS hubspot_oauth_state TEXT`);
  await db.query(`ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS enable_hubspot BOOLEAN NOT NULL DEFAULT false`);

  // ── Per-user notification preferences ────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_notification_prefs (
      id             SERIAL PRIMARY KEY,
      account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      clerk_user_id  TEXT    NOT NULL,
      event_key      TEXT    NOT NULL,
      email_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
      in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, clerk_user_id, event_key)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS user_notification_prefs_user_idx
      ON user_notification_prefs (account_id, clerk_user_id)
  `);

  // ── In-app notification inbox ─────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_in_app_notifications (
      id            BIGSERIAL PRIMARY KEY,
      account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      clerk_user_id TEXT    NOT NULL,
      event_key     TEXT    NOT NULL,
      title         TEXT    NOT NULL,
      body          TEXT    NOT NULL,
      read_at       TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS user_in_app_notif_user_idx
      ON user_in_app_notifications (account_id, clerk_user_id, created_at DESC)
  `);

  // ── Plan limit alert deduplication ───────────────────────────────────────────
  // Tracks which threshold alerts have already been sent for a given account
  // in a billing period so we never fire the same email twice.
  await db.query(`
    CREATE TABLE IF NOT EXISTS plan_limit_alerts (
      id                   BIGSERIAL PRIMARY KEY,
      account_id           INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      billing_period_start DATE    NOT NULL,
      threshold_pct        INTEGER NOT NULL,
      sent_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, billing_period_start, threshold_pct)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS plan_limit_alerts_lookup_idx
      ON plan_limit_alerts (account_id, billing_period_start)
  `);

  // ── Org-level audit log ──────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS org_audit_log (
      id            BIGSERIAL PRIMARY KEY,
      account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      actor_email   TEXT,
      actor_user_id TEXT,
      action        TEXT NOT NULL,
      resource_type TEXT,
      resource_id   TEXT,
      resource_label TEXT,
      metadata      JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS org_audit_log_account_created_idx
      ON org_audit_log (account_id, created_at DESC)
  `);
  await db.query(`ALTER TABLE org_audit_log ADD COLUMN IF NOT EXISTS ip_address TEXT`);

  // ── Email customization — per-org sender display name, reply-to, footer ──────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_sender_name TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_reply_to TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_footer TEXT`);

  // ── Interview defaults — org-level defaults for new interview sessions ────────
  // interview_link_expiry_days: NULL = never expires; a number = that many days.
  // Defaults to 90 for existing and new accounts — admin must explicitly set NULL for "never".
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS interview_link_expiry_days INTEGER DEFAULT 90`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS interview_reminder_enabled BOOLEAN NOT NULL DEFAULT false`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS interview_reminder_days INTEGER NOT NULL DEFAULT 2`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS interview_default_locale TEXT NOT NULL DEFAULT 'en'`);

  // ── Interview session — per-session locale and reminder preferences ───────────
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en'`);
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT false`);
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS reminder_days INTEGER NOT NULL DEFAULT 2`);

  // ── Timezone & Locale ─────────────────────────────────────────────────────────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York'`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS date_format TEXT NOT NULL DEFAULT 'MM/DD/YYYY'`);

  // ── Data & Privacy — submission retention and scheduled account deletion ──────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS submission_retention_days INTEGER`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deletion_requested_by TEXT`);
  // Post-trial data retention — set when a trial ends without converting; cleared on subscribe
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trial_ended_at TIMESTAMPTZ`);
  // Set by the purge job after org content is deleted; prevents re-processing
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS data_purged_at TIMESTAMPTZ`);

  // ── Data export requests — durable job queue for org data exports ─────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS data_export_requests (
      id             SERIAL PRIMARY KEY,
      account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      requested_by   TEXT NOT NULL,
      requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      download_token TEXT UNIQUE NOT NULL,
      status         TEXT NOT NULL DEFAULT 'pending',
      export_json    TEXT,
      completed_at   TIMESTAMPTZ,
      expires_at     TIMESTAMPTZ
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS data_export_requests_status_idx
      ON data_export_requests (status, requested_at)
  `);
  await db.query(`ALTER TABLE data_export_requests ADD COLUMN IF NOT EXISTS export_format TEXT NOT NULL DEFAULT 'zip'`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS brand_color_rate_limit (
      key          TEXT PRIMARY KEY,
      count        INTEGER NOT NULL DEFAULT 0,
      window_start BIGINT  NOT NULL
    )
  `);

  // ── Security: 2FA columns on account_users ───────────────────────────────────
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS totp_secret TEXT`);
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE account_users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[] NOT NULL DEFAULT '{}'`);

  // ── Security: active user sessions (tracks Clerk session IDs) ────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_active_sessions (
      id               SERIAL PRIMARY KEY,
      account_id       INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      user_id          INTEGER NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      clerk_session_id TEXT NOT NULL UNIQUE,
      ip_address       TEXT,
      user_agent       TEXT,
      last_active_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at       TIMESTAMPTZ
    )
  `);
  await db.query(`ALTER TABLE user_active_sessions ADD COLUMN IF NOT EXISTS totp_verified BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`
    CREATE INDEX IF NOT EXISTS user_active_sessions_user_idx
      ON user_active_sessions (user_id, last_active_at DESC)
  `);

  // ── Security: login history (one row per distinct login event) ───────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_login_history (
      id               SERIAL PRIMARY KEY,
      account_id       INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      user_id          INTEGER NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      clerk_session_id TEXT,
      ip_address       TEXT,
      user_agent       TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS user_login_history_user_idx
      ON user_login_history (user_id, created_at DESC)
  `);

  // ── Trusted devices (device-trust tokens for 2FA "remember this device") ─────
  await db.query(`
    CREATE TABLE IF NOT EXISTS trusted_devices (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      token_hash   TEXT NOT NULL UNIQUE,
      label        TEXT NOT NULL DEFAULT '',
      ip_address   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at   TIMESTAMPTZ NOT NULL,
      last_used_at TIMESTAMPTZ
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS trusted_devices_user_idx
      ON trusted_devices (user_id, expires_at DESC)
  `);

  dbReady = true;
  logger.info("Database tables and indexes verified / created");

  // ── Super-admin account notes ─────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS account_admin_notes (
      id          SERIAL PRIMARY KEY,
      account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      note        TEXT NOT NULL,
      created_by  TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS account_admin_notes_account_idx
      ON account_admin_notes (account_id, created_at DESC)
  `);

  // ── Encryption at rest — PII fields ──────────────────────────────────────────
  // Per-account data-encryption key, wrapped by ENCRYPTION_MASTER_KEY env var.
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS encrypted_dek TEXT`);
  // DEK version counter — incremented by rotate-master-key.mjs on each rotation.
  // Allows verifying which accounts have been migrated to a new master key.
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS dek_version INTEGER NOT NULL DEFAULT 1`);

  // ── Package channel defaults ──────────────────────────────────────────────────
  // These org-level flags determine which output channels are enabled by default
  // when a new package is created. Each flag defaults to true so new accounts
  // get the most useful channels pre-enabled without any manual configuration.
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS pkg_default_interview BOOLEAN NOT NULL DEFAULT true`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS pkg_default_csv BOOLEAN NOT NULL DEFAULT true`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS pkg_default_customer_link BOOLEAN NOT NULL DEFAULT true`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS pkg_default_notify_staff BOOLEAN NOT NULL DEFAULT true`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS pkg_default_notify_client BOOLEAN NOT NULL DEFAULT false`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS pkg_default_esign BOOLEAN NOT NULL DEFAULT false`);
  // Encrypted JSONB answers column; plaintext `answers` kept as fallback during
  // dual-mode migration period then cleared after all rows are migrated.
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS answers_ciphertext TEXT`);

  // ── E-sign v1 — email OTP identity verification ───────────────────────────
  // Per-package auth level: 'none' (default) or 'email_otp'
  await db.query(`ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS auth_level TEXT NOT NULL DEFAULT 'none'`);
  // Signing record stored on the completed interview session
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS signer_email TEXT`);
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS signer_name TEXT`);
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS pdf_sha256 TEXT`);
  // RFC 3161 trusted timestamp — raw TimeStampResp DER stored as base64, verifiable with openssl ts -verify
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS tsa_token_b64 TEXT`);
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS tsa_url TEXT`);
  // Immutable signed PDF stored in GCS — /objects/signed-pdfs/{token}.pdf
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS generated_pdf_storage_key TEXT`);
  // One row per OTP send; hashed code, expiry, attempt counter
  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_esign_otps (
      id            SERIAL PRIMARY KEY,
      session_token TEXT NOT NULL,
      email         TEXT NOT NULL,
      otp_hash      TEXT NOT NULL,
      expires_at    TIMESTAMPTZ NOT NULL,
      used_at       TIMESTAMPTZ,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS docufill_esign_otps_session_idx
      ON docufill_esign_otps (session_token, created_at DESC)
  `);
  // Append-only audit trail for all e-sign lifecycle events
  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_signing_events (
      id            SERIAL PRIMARY KEY,
      session_token TEXT NOT NULL,
      account_id    INTEGER,
      event_type    TEXT NOT NULL,
      actor_email   TEXT,
      actor_ip      TEXT,
      actor_ua      TEXT,
      metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS docufill_signing_events_session_idx
      ON docufill_signing_events (session_token, created_at)
  `);
  // Migration: actor_ua may not exist on tables created before this column was added
  await db.query(`ALTER TABLE docufill_signing_events ADD COLUMN IF NOT EXISTS actor_ua TEXT`);

  // ── Signer context on sessions (IP, user-agent, geo) ────────────────────────
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS signer_ip TEXT`);
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS signer_ua TEXT`);
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS signer_geo TEXT`);

  // ── Batch run tracking ──────────────────────────────────────────────────────
  // batch_run_id: UUID shared by all sessions from the same CSV upload run.
  // submitted_at: when the client completed/submitted their interview.
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS batch_run_id TEXT`);
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ`);
  await db.query(`CREATE INDEX IF NOT EXISTS dis_batch_run_idx ON docufill_interview_sessions (batch_run_id) WHERE batch_run_id IS NOT NULL`);
  // Back-fill submitted_at for sessions already in a terminal state
  await db.query(`UPDATE docufill_interview_sessions SET submitted_at = updated_at WHERE submitted_at IS NULL AND status IN ('submitted', 'signed', 'generated') AND source NOT IN ('csv_batch', 'deal_builder')`);

  // ── Submission bank ──────────────────────────────────────────────────────────
  // Each row is a deposit of submissions into an account's bank.
  // Entries are drawn down oldest-first. Plan submissions are use-or-lose (not
  // stored here); only purchased pack submissions are banked here.
  // source: 'one_off' | 'monthly_pack' | 'annual_pack'
  await db.query(`
    CREATE TABLE IF NOT EXISTS submission_bank (
      id           SERIAL PRIMARY KEY,
      account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      amount       INTEGER NOT NULL,
      remaining    INTEGER NOT NULL,
      source       TEXT    NOT NULL,
      pack_size    INTEGER NOT NULL,
      stripe_ref   TEXT,
      deposited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at   TIMESTAMPTZ NOT NULL
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS submission_bank_account_expiry_idx
      ON submission_bank (account_id, expires_at)
     WHERE remaining > 0
  `);

  // ── Pack subscriptions ───────────────────────────────────────────────────────
  // Tracks recurring pack subscriptions so invoice.paid can deposit the right
  // amount without an extra Stripe API call.
  await db.query(`
    CREATE TABLE IF NOT EXISTS pack_subscriptions (
      id                      SERIAL PRIMARY KEY,
      account_id              INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      stripe_subscription_id  TEXT    NOT NULL UNIQUE,
      pack_size               INTEGER NOT NULL,
      pack_type               TEXT    NOT NULL,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS pack_subscriptions_stripe_idx
      ON pack_subscriptions (stripe_subscription_id)
  `);

  // ── Ensure all demo packages use email_otp auth (e-sign + OTP required) ────
  // Packages seeded before this migration defaulted to 'none'. Idempotent.
  await db.query(`
    UPDATE docufill_packages
       SET auth_level = 'email_otp'
     WHERE name LIKE 'Demo%'
       AND auth_level != 'email_otp'
       AND status = 'active'
  `);

  // ── Mandate preview: require signers to view the filled PDF before signing ──
  await db.query(`ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS require_preview BOOLEAN NOT NULL DEFAULT FALSE`);

  // ── Mandate full scroll: require signers to scroll through the entire document ──
  await db.query(`ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS require_scroll_confirmation BOOLEAN NOT NULL DEFAULT FALSE`);

  // ── Server-side scroll confirmation: persisted timestamp when signer attests full scroll ──
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS scroll_confirmed_at TIMESTAMPTZ`);

  // ── Submission-scale composite indexes (task #592) ───────────────────────────
  // These are also created by Drizzle migration 0004_submission_scale_indexes.
  // Running them here with CONCURRENTLY ensures large production tables get a
  // non-blocking build. IF NOT EXISTS makes each call idempotent — on a fresh
  // DB the migration creates them first and these become no-ops.
  // CONCURRENTLY cannot run inside a transaction, so these must remain outside
  // the transactional migration path.
  await db.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS dis_account_created_idx
    ON docufill_interview_sessions (account_id, created_at DESC NULLS LAST)`);
  await db.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS dis_account_package_idx
    ON docufill_interview_sessions (account_id, package_id)`);
  await db.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS dis_account_status_idx
    ON docufill_interview_sessions (account_id, status)`);
  await db.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS dis_account_expires_idx
    ON docufill_interview_sessions (account_id, expires_at)`);
  await db.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS docufill_packages_account_created_idx
    ON docufill_packages (account_id, created_at DESC NULLS LAST)`);
  await db.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS webhook_deliveries_account_created_idx
    ON webhook_deliveries (account_id, created_at DESC NULLS LAST)`);
  // Ensure the session_id column exists before creating the session index.
  // Migration 0004 adds this column; this guard protects the fallback path.
  await db.query(`ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES docufill_interview_sessions(id) ON DELETE SET NULL`);
  await db.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS webhook_deliveries_session_created_idx
    ON webhook_deliveries (session_id, created_at DESC NULLS LAST)`);

  // ── Affiliate tables (mirror of migration 0002) ───────────────────────────
  // CREATE TABLE IF NOT EXISTS is idempotent — safe to run on every startup.
  // runDrizzleMigrations() is skipped in production (no RUN_MIGRATIONS=true),
  // so these tables must also be created here to ensure they exist.
  await db.query(`
    CREATE TABLE IF NOT EXISTS affiliates (
      id                  SERIAL PRIMARY KEY,
      name                TEXT NOT NULL,
      email               TEXT NOT NULL,
      company             TEXT,
      website             TEXT,
      referral_code       TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'pending',
      stripe_account_id   TEXT,
      stripe_account_status TEXT,
      commission_rate     NUMERIC(5,4) NOT NULL DEFAULT 0.2000,
      commission_months   INTEGER NOT NULL DEFAULT 12,
      invited_by_user_id  TEXT,
      notes               TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT affiliates_email_unique      UNIQUE (email),
      CONSTRAINT affiliates_referral_code_unique UNIQUE (referral_code)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS affiliates_status_idx ON affiliates (status)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS affiliate_referrals (
      id                       SERIAL PRIMARY KEY,
      affiliate_id             INTEGER NOT NULL REFERENCES affiliates(id),
      stripe_customer_id       TEXT NOT NULL,
      stripe_subscription_id   TEXT,
      plan_type                TEXT NOT NULL,
      monthly_amount_cents     INTEGER NOT NULL,
      commission_months_total  INTEGER NOT NULL DEFAULT 12,
      commission_months_paid   INTEGER NOT NULL DEFAULT 0,
      status                   TEXT NOT NULL DEFAULT 'active',
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT affiliate_referrals_subscription_unique UNIQUE (stripe_subscription_id)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS affiliate_referrals_affiliate_idx ON affiliate_referrals (affiliate_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS affiliate_referrals_customer_idx  ON affiliate_referrals (stripe_customer_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS affiliate_referrals_subscription_idx ON affiliate_referrals (stripe_subscription_id)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS affiliate_commissions (
      id                  SERIAL PRIMARY KEY,
      affiliate_id        INTEGER NOT NULL REFERENCES affiliates(id),
      referral_id         INTEGER NOT NULL REFERENCES affiliate_referrals(id),
      amount_cents        INTEGER NOT NULL,
      status              TEXT NOT NULL DEFAULT 'pending',
      due_date            TIMESTAMPTZ,
      paid_at             TIMESTAMPTZ,
      stripe_transfer_id  TEXT,
      period_label        TEXT,
      stripe_invoice_id   TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT affiliate_commissions_invoice_unique UNIQUE (stripe_invoice_id)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS affiliate_commissions_affiliate_idx ON affiliate_commissions (affiliate_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS affiliate_commissions_referral_idx  ON affiliate_commissions (referral_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS affiliate_commissions_status_idx    ON affiliate_commissions (status)`);
}

// ── Scheduler functions (exported for BullMQ worker) ─────────────────────────
// These were previously nested inside initDb() as setInterval callbacks.
// They are now top-level exports so the worker can call them as repeatable-job
// processors. initDb() still calls each one once on startup (see above) to
// clear any backlog accumulated while the worker was down.

export async function pruneAuditTables(): Promise<void> {
  try {
    const db = getDb();
    const { rowCount } = await db.query(`
      DELETE FROM booking_attempts WHERE attempted_at < NOW() - INTERVAL '90 days'
    `);
    if ((rowCount ?? 0) > 0) {
      logger.info({ rowCount }, "[DB] Pruned old booking_attempts rows");
    }
  } catch (err) {
    logger.error({ err }, "[DB] booking_attempts prune failed (non-fatal)");
  }
}

export async function pruneRetainedSubmissions(): Promise<void> {
  try {
    const db = getDb();
    // Collect GCS keys before deleting so object storage stays in sync
    const { rows: keyRows } = await db.query<{ generated_pdf_storage_key: string | null }>(
      `SELECT dis.generated_pdf_storage_key
       FROM docufill_interview_sessions dis
       JOIN accounts a ON dis.account_id = a.id
       WHERE a.submission_retention_days IS NOT NULL
         AND dis.created_at < NOW() - (a.submission_retention_days || ' days')::INTERVAL
         AND dis.generated_pdf_storage_key IS NOT NULL`,
    );
    const gcsKeys = keyRows.map((r) => r.generated_pdf_storage_key).filter((k): k is string => !!k);
    if (gcsKeys.length > 0) {
      await Promise.allSettled(
        gcsKeys.map((key) =>
          objectStorage
            .getObjectEntityFile(key)
            .then((f) => f.delete({ ignoreNotFound: true }))
            .catch((err) => logger.warn({ err, key }, "[DB] GCS cleanup for retained submission failed (non-fatal)")),
        ),
      );
      logger.info({ count: gcsKeys.length }, "[DB] GCS objects deleted for retention-pruned sessions");
    }
    const { rowCount } = await db.query(`
      DELETE FROM docufill_interview_sessions dis
      USING accounts a
      WHERE dis.account_id = a.id
        AND a.submission_retention_days IS NOT NULL
        AND dis.created_at < NOW() - (a.submission_retention_days || ' days')::INTERVAL
    `);
    if ((rowCount ?? 0) > 0) {
      logger.info({ rowCount }, "[DB] Pruned old interview sessions per retention policy");
    }
  } catch (err) {
    logger.error({ err }, "[DB] Submission retention prune failed (non-fatal)");
  }
}

export async function pruneSessionData(): Promise<void> {
  try {
    const db = getDb();
    const { rowCount: sessionRows } = await db.query(`
      DELETE FROM user_active_sessions
       WHERE last_active_at < NOW() - INTERVAL '30 days'
    `);
    if ((sessionRows ?? 0) > 0) {
      logger.info({ rowCount: sessionRows }, "[DB] Pruned inactive user_active_sessions");
    }
    const { rowCount: historyRows } = await db.query(`
      DELETE FROM user_login_history
       WHERE created_at < NOW() - INTERVAL '90 days'
    `);
    if ((historyRows ?? 0) > 0) {
      logger.info({ rowCount: historyRows }, "[DB] Pruned old user_login_history rows");
    }
  } catch (err) {
    logger.error({ err }, "[DB] Session data prune failed (non-fatal)");
  }
}

export async function processScheduledDeletions(): Promise<void> {
  try {
    const db = getDb();
    const { rows } = await db.query<{ id: number; name: string }>(
      `SELECT id, name FROM accounts
       WHERE deletion_requested_at IS NOT NULL
         AND deletion_requested_at < NOW() - INTERVAL '7 days'`,
    );
    for (const account of rows) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM docufill_custodians   WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM docufill_depositories WHERE account_id = $1`, [account.id]);
        // Clean up GCS objects before removing session rows
        const { rows: sessionKeyRows } = await client.query<{ generated_pdf_storage_key: string | null }>(
          `SELECT generated_pdf_storage_key FROM docufill_interview_sessions
           WHERE account_id = $1 AND generated_pdf_storage_key IS NOT NULL`,
          [account.id],
        );
        const sessionGcsKeys = sessionKeyRows.map((r) => r.generated_pdf_storage_key).filter((k): k is string => !!k);
        if (sessionGcsKeys.length > 0) {
          await Promise.allSettled(
            sessionGcsKeys.map((key) =>
              objectStorage
                .getObjectEntityFile(key)
                .then((f) => f.delete({ ignoreNotFound: true }))
                .catch((err) => logger.warn({ err, key, accountId: account.id }, "[DB] GCS cleanup for deleted account session failed (non-fatal)")),
            ),
          );
        }
        await client.query(`DELETE FROM docufill_interview_sessions WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM docufill_packages WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM docufill_groups   WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM accounts WHERE id = $1`, [account.id]);
        await client.query("COMMIT");
        logger.info({ accountId: account.id, name: account.name }, "[DB] Hard-deleted account after grace period");
      } catch (deleteErr) {
        await client.query("ROLLBACK");
        logger.error({ err: deleteErr, accountId: account.id }, "[DB] Account hard-delete failed, rolled back");
      } finally {
        client.release();
      }
    }
  } catch (err) {
    logger.error({ err }, "[DB] Account deletion processing failed (non-fatal)");
  }
}

export async function purgeExpiredTrialData(): Promise<void> {
  try {
    const db = getDb();
    const { rows } = await db.query<{ id: number; name: string }>(
      `SELECT id, name FROM accounts
       WHERE trial_ended_at IS NOT NULL
         AND trial_ended_at < NOW() - INTERVAL '7 days'
         AND data_purged_at IS NULL
         AND (subscription_status IS NULL OR subscription_status NOT IN ('active', 'trialing'))`,
    );
    for (const account of rows) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM docufill_custodians        WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM docufill_depositories      WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM docufill_fields            WHERE account_id = $1`, [account.id]);
        // Clean up GCS objects before removing session rows
        const { rows: trialSessionKeyRows } = await client.query<{ generated_pdf_storage_key: string | null }>(
          `SELECT generated_pdf_storage_key FROM docufill_interview_sessions
           WHERE account_id = $1 AND generated_pdf_storage_key IS NOT NULL`,
          [account.id],
        );
        const trialGcsKeys = trialSessionKeyRows.map((r) => r.generated_pdf_storage_key).filter((k): k is string => !!k);
        if (trialGcsKeys.length > 0) {
          await Promise.allSettled(
            trialGcsKeys.map((key) =>
              objectStorage
                .getObjectEntityFile(key)
                .then((f) => f.delete({ ignoreNotFound: true }))
                .catch((err) => logger.warn({ err, key, accountId: account.id }, "[DB] GCS cleanup for lapsed trial session failed (non-fatal)")),
            ),
          );
        }
        await client.query(`DELETE FROM docufill_interview_sessions WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM docufill_packages          WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM docufill_groups            WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM account_api_keys           WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM account_users              WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM docufill_signing_events    WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM docufill_transaction_types WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM usage_events               WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM submission_bank            WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM pack_subscriptions         WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM pdf_audit_events           WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM data_export_requests       WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM user_notification_prefs    WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM user_in_app_notifications  WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM plan_limit_alerts          WHERE account_id = $1`, [account.id]);
        await client.query(`DELETE FROM org_audit_log              WHERE account_id = $1`, [account.id]);
        await client.query(`UPDATE accounts SET data_purged_at = NOW() WHERE id = $1`, [account.id]);
        await client.query("COMMIT");
        logger.info({ accountId: account.id, name: account.name }, "[DB] Purged org content for lapsed trial account");
      } catch (purgeErr) {
        await client.query("ROLLBACK");
        logger.error({ err: purgeErr, accountId: account.id }, "[DB] Trial data purge failed, rolled back");
      } finally {
        client.release();
      }
    }
  } catch (err) {
    logger.error({ err }, "[DB] Trial data purge job failed (non-fatal)");
  }
}

export async function purgeExpiredExports(): Promise<void> {
  try {
    const db = getDb();
    const result = await db.query(
      `UPDATE data_export_requests
          SET export_json = NULL, status = 'expired'
        WHERE expires_at < NOW()
          AND export_json IS NOT NULL`,
    );
    if ((result.rowCount ?? 0) > 0) {
      logger.info({ purged: result.rowCount }, "[DB] Cleared export payloads from expired data_export_requests rows");
    }
  } catch (err) {
    logger.error({ err }, "[DB] Export payload purge failed (non-fatal)");
  }
}

export async function pruneExpiredDocufillSessions(): Promise<void> {
  try {
    const db = getDb();
    // Collect GCS keys for sessions that have passed their expiry without completing
    const { rows: keyRows } = await db.query<{ generated_pdf_storage_key: string | null }>(
      `SELECT generated_pdf_storage_key
       FROM docufill_interview_sessions
       WHERE expires_at < NOW()
         AND status IN ('draft', 'in_progress')
         AND generated_pdf_storage_key IS NOT NULL`,
    );
    const gcsKeys = keyRows.map((r) => r.generated_pdf_storage_key).filter((k): k is string => !!k);
    if (gcsKeys.length > 0) {
      await Promise.allSettled(
        gcsKeys.map((key) =>
          objectStorage
            .getObjectEntityFile(key)
            .then((f) => f.delete({ ignoreNotFound: true }))
            .catch((err) => logger.warn({ err, key }, "[DB] GCS cleanup for expired draft session failed (non-fatal)")),
        ),
      );
      logger.info({ count: gcsKeys.length }, "[DB] GCS objects deleted for expired draft/in_progress sessions");
    }
    const { rowCount } = await db.query(
      `DELETE FROM docufill_interview_sessions
       WHERE expires_at < NOW()
         AND status IN ('draft', 'in_progress')`,
    );
    if ((rowCount ?? 0) > 0) {
      logger.info({ rowCount }, "[DB] Pruned expired draft/in_progress interview sessions");
    }
  } catch (err) {
    logger.error({ err }, "[DB] Expired docufill session prune failed (non-fatal)");
  }
}

/**
 * Write one row to booking_attempts and mirror it to Google Sheets.
 * Never throws — audit writes are non-fatal.
 */
export async function recordBookingAttempt(params: {
  email: string;
  slotId: string;
  ipAddress: string | null;
  success: boolean;
  confirmationId?: string;
  errorCode?: string;
  errorDetail?: string;
}): Promise<void> {
  try {
    const db = getDb();
    const result = await db.query<{ id: number; attempted_at: Date }>(
      `INSERT INTO booking_attempts
         (email, slot_id, ip_address, success, confirmation_id, error_code, error_detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, attempted_at`,
      [
        params.email,
        params.slotId,
        params.ipAddress ?? null,
        params.success,
        params.confirmationId ?? null,
        params.errorCode ?? null,
        params.errorDetail ?? null,
      ]
    );

    const row = result.rows[0];
    if (row) {
      appendBookingAttemptToSheet({
        id: String(row.id),
        email: params.email,
        slotId: params.slotId,
        ipAddress: params.ipAddress,
        success: params.success,
        errorCode: params.errorCode,
        errorDetail: params.errorDetail,
        confirmationId: params.confirmationId,
        attemptedAt: row.attempted_at.toISOString(),
      }).catch((err) => logger.error({ err }, "[Sheets] Booking attempt sync failed"));
    }
  } catch (err) {
    logger.error({ err }, "[Audit] Failed to write booking_attempt row");
  }
}

// ── Per-account transaction type seeding ──────────────────────────────────────

const DEFAULT_TRANSACTION_TYPES = [
  { slug: "ira_transfer",       label: "IRA transfer / rollover", sortOrder: 10 },
  { slug: "ira_contribution",   label: "IRA contribution",        sortOrder: 20 },
  { slug: "ira_distribution",   label: "IRA distribution",        sortOrder: 30 },
  { slug: "cash_purchase",      label: "Cash purchase",           sortOrder: 40 },
  { slug: "storage_change",     label: "Storage change",          sortOrder: 50 },
  { slug: "beneficiary_update", label: "Beneficiary update",      sortOrder: 60 },
  { slug: "liquidation",        label: "Liquidation",             sortOrder: 70 },
  { slug: "buy_sell_direction", label: "Buy / sell direction",    sortOrder: 80 },
  { slug: "address_change",     label: "Address change",          sortOrder: 90 },
];

export async function seedDefaultTransactionTypes(db: Pool, accountId: number): Promise<void> {
  for (const t of DEFAULT_TRANSACTION_TYPES) {
    await db.query(
      `INSERT INTO docufill_transaction_types (scope, account_id, label, active, sort_order)
       VALUES ($1, $2, $3, TRUE, $4)
       ON CONFLICT (scope) DO NOTHING`,
      [`a${accountId}_${t.slug}`, accountId, t.label, t.sortOrder],
    );
  }
}
