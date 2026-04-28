import { Pool } from "pg";
import { randomBytes } from "crypto";
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

  // ── Account branding columns ─────────────────────────────────────────────────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS logo_url TEXT`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '#C49A38'`);

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
  // Back-fill any rows that pre-date the status column — they are all active
  await db.query(`UPDATE account_users SET status = 'active' WHERE status IS NULL OR status = ''`);

  // ── Task #194: interview link email tracking ───────────────────────────────
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS link_emailed_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE docufill_interview_sessions ADD COLUMN IF NOT EXISTS link_email_recipient TEXT`);

  // ── Task #195: per-package submission notification toggles ─────────────────
  await db.query(`ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS notify_staff_on_submit BOOLEAN NOT NULL DEFAULT false`);
  await db.query(`ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS notify_client_on_submit BOOLEAN NOT NULL DEFAULT false`);

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

  // ── Data & Privacy — submission retention and scheduled account deletion ──────
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS submission_retention_days INTEGER`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deletion_requested_by TEXT`);

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

  // ── Submission retention: delete sessions older than the account's policy ─────
  async function pruneRetainedSubmissions(): Promise<void> {
    try {
      const retentionDb = getDb();
      const { rowCount } = await retentionDb.query(`
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

  pruneRetainedSubmissions().catch(() => {});
  setInterval(() => pruneRetainedSubmissions().catch(() => {}), 24 * 60 * 60 * 1000).unref();

  // ── Account deletion: hard-delete accounts past their 7-day grace period ──────
  // Uses explicit ordered deletes inside a transaction to avoid FK violations on
  // tables that do NOT have ON DELETE CASCADE on their account_id foreign key
  // (docufill_custodians, docufill_depositories, docufill_groups, docufill_packages,
  // and docufill_interview_sessions all have account_id without CASCADE).
  async function processScheduledDeletions(): Promise<void> {
    try {
      const delDb = getDb();
      const { rows } = await delDb.query<{ id: number; name: string }>(
        `SELECT id, name FROM accounts
         WHERE deletion_requested_at IS NOT NULL
           AND deletion_requested_at < NOW() - INTERVAL '7 days'`,
      );
      for (const account of rows) {
        const client = await delDb.connect();
        try {
          await client.query("BEGIN");
          // 1. Null-out account_id on global reference tables that lack CASCADE
          await client.query(`UPDATE docufill_custodians  SET account_id = NULL WHERE account_id = $1`, [account.id]);
          await client.query(`UPDATE docufill_depositories SET account_id = NULL WHERE account_id = $1`, [account.id]);
          // 2. Delete interview sessions (account_id FK lacks CASCADE on accounts)
          await client.query(`DELETE FROM docufill_interview_sessions WHERE account_id = $1`, [account.id]);
          // 3. Delete packages (cascades: sessions via package_id, webhook_deliveries, package_documents)
          await client.query(`DELETE FROM docufill_packages WHERE account_id = $1`, [account.id]);
          // 4. Delete groups (account_id FK lacks CASCADE)
          await client.query(`DELETE FROM docufill_groups   WHERE account_id = $1`, [account.id]);
          // 5. Delete the account — remaining tables (account_users, usage_events, api_keys,
          //    audit_log, notification_prefs, plan_limit_alerts, data_export_requests, etc.)
          //    all have ON DELETE CASCADE and will be handled automatically.
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

  processScheduledDeletions().catch(() => {});
  setInterval(() => processScheduledDeletions().catch(() => {}), 6 * 60 * 60 * 1000).unref();
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
