import { Pool } from "pg";
import { logger } from "./lib/logger";
import { appendBookingAttemptToSheet } from "./lib/google-sheets";

let pool: Pool | null = null;

// ── DB readiness flags ─────────────────────────────────────────────────────────
// Used by /healthz to report DB status without blocking the response.
export let dbReady = false;
export let dbError: string | null = null;

export function getDb(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
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
  // Ops status tracking
  await safeAdd("payment_received_at",  "TIMESTAMPTZ");
  await safeAdd("tracking_number",      "TEXT");
  await safeAdd("order_placed_at",      "TIMESTAMPTZ");

  dbReady = true;
  logger.info("Database tables and indexes verified / created");

  // ── Scheduled data retention ──────────────────────────────────────────────
  // Keeps the audit tables from growing unboundedly.
  // booking_attempts can accumulate quickly (every booking attempt writes a row).
  // Run once on startup (to catch any backlog) and then every 24 hours.
  async function pruneAuditTables(): Promise<void> {
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

  pruneAuditTables().catch(() => {});
  setInterval(() => pruneAuditTables().catch(() => {}), 24 * 60 * 60 * 1000).unref();
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
