-- =============================================================================
-- Docuplete Enterprise Features — Database Migration
-- Run this against your PostgreSQL database to enable all 8 enterprise features.
--
-- Tables added:
--   1. docuplete_audit_logs         — Audit log API (Feature 4)
--   2. docuplete_session_signers    — Multi-party sequential signing (Feature 8)
--   3. scim_tokens                  — SCIM 2.0 provisioning (Feature 7)
--
-- Columns added:
--   accounts.reminder_enabled     — Reminder config (Feature 5, if not present)
--   accounts.reminder_days        — Reminder config (Feature 5, if not present)
--   docuplete_interview_sessions.reminder_enabled — Per-session reminder override
--   docuplete_interview_sessions.reminder_days    — Per-session reminder override
--   docuplete_interview_sessions.first_viewed_at  — session.viewed webhook tracking
--   docuplete_interview_sessions.first_started_at — session.started webhook tracking
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. docuplete_audit_logs — general-purpose session audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docuplete_audit_logs (
  id           SERIAL PRIMARY KEY,
  session_id   INTEGER REFERENCES docuplete_interview_sessions(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,
  actor_type   TEXT NOT NULL DEFAULT 'system',
  actor_email  TEXT,
  actor_ip     TEXT,
  actor_ua     TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS docuplete_audit_logs_session_token_idx
  ON docuplete_audit_logs (session_token);

CREATE INDEX IF NOT EXISTS docuplete_audit_logs_session_id_idx
  ON docuplete_audit_logs (session_id);

CREATE INDEX IF NOT EXISTS docuplete_audit_logs_account_created_idx
  ON docuplete_audit_logs (account_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. docuplete_session_signers — multi-party sequential signing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docuplete_session_signers (
  id              SERIAL PRIMARY KEY,
  session_id      INTEGER NOT NULL REFERENCES docuplete_interview_sessions(id) ON DELETE CASCADE,
  account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  signer_order    INTEGER NOT NULL DEFAULT 0,
  email           TEXT NOT NULL,
  name            TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',   -- pending | awaiting | notified | signed | declined
  token           TEXT NOT NULL UNIQUE,              -- df_sgn_ prefixed unique token
  notified_at     TIMESTAMPTZ,
  signed_at       TIMESTAMPTZ,
  declined_at     TIMESTAMPTZ,
  declined_reason TEXT,
  signer_ip       TEXT,
  signer_ua       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS docuplete_session_signers_session_idx
  ON docuplete_session_signers (session_id);

CREATE INDEX IF NOT EXISTS docuplete_session_signers_token_idx
  ON docuplete_session_signers (token);

CREATE INDEX IF NOT EXISTS docuplete_session_signers_account_idx
  ON docuplete_session_signers (account_id);

-- ---------------------------------------------------------------------------
-- 3. scim_tokens — bearer tokens for SCIM 2.0 provisioning
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scim_tokens (
  id           SERIAL PRIMARY KEY,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,  -- SHA-256(raw_token)
  token_prefix TEXT NOT NULL,         -- first 12 chars for display only
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS scim_tokens_account_idx ON scim_tokens (account_id);
CREATE INDEX IF NOT EXISTS scim_tokens_hash_idx    ON scim_tokens (token_hash);

-- ---------------------------------------------------------------------------
-- 4. Per-session reminder config columns
--    (accounts table should already have interview_reminder_enabled/days)
-- ---------------------------------------------------------------------------
ALTER TABLE docuplete_interview_sessions
  ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_days    INTEGER NOT NULL DEFAULT 2;

-- Track first-view and first-answer for lifecycle webhooks
ALTER TABLE docuplete_interview_sessions
  ADD COLUMN IF NOT EXISTS first_viewed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_started_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 5. Ensure accounts table has interview_reminder columns
-- ---------------------------------------------------------------------------
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS interview_reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interview_reminder_days    INTEGER NOT NULL DEFAULT 2;

COMMIT;
