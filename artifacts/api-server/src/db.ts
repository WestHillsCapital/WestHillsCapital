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
  await db.query(`
    INSERT INTO docufill_transaction_types (scope, label, active, sort_order)
    VALUES
      ('ira_transfer', 'IRA transfer / rollover', TRUE, 10),
      ('ira_contribution', 'IRA contribution', TRUE, 20),
      ('ira_distribution', 'IRA distribution', TRUE, 30),
      ('cash_purchase', 'Cash purchase', TRUE, 40),
      ('storage_change', 'Storage change', TRUE, 50),
      ('beneficiary_update', 'Beneficiary update', TRUE, 60),
      ('liquidation', 'Liquidation', TRUE, 70),
      ('buy_sell_direction', 'Buy / sell direction', TRUE, 80),
      ('address_change', 'Address change', TRUE, 90)
    ON CONFLICT (scope) DO NOTHING
  `);

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
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS docufill_fields_label_unique
      ON docufill_fields (lower(label))
  `);
  await db.query(`
    INSERT INTO docufill_fields
      (id, label, category, field_type, source, options, sensitive, required, validation_type, validation_message, active, sort_order)
    VALUES
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
    ON CONFLICT (id) DO NOTHING
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

  await db.query(`
    CREATE TABLE IF NOT EXISTS docufill_packages (
      id                SERIAL PRIMARY KEY,
      name              TEXT NOT NULL,
      custodian_id      INTEGER REFERENCES docufill_custodians(id) ON DELETE SET NULL,
      depository_id     INTEGER REFERENCES docufill_depositories(id) ON DELETE SET NULL,
      transaction_scope TEXT NOT NULL DEFAULT 'Custodial paperwork',
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
  await db.query(`
    ALTER TABLE docufill_packages
    ADD COLUMN IF NOT EXISTS transaction_scope TEXT NOT NULL DEFAULT 'Custodial paperwork'
  `);
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
    logger.info({ updatedPackages: backfillResult.rowCount }, "DocuFill shared field backfill completed");
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
    ADD COLUMN IF NOT EXISTS transaction_scope TEXT NOT NULL DEFAULT 'ira_transfer'
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
