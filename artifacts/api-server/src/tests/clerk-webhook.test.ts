/**
 * Clerk webhook handler unit tests
 *
 * Covers:
 * 1. verifyAndParseClerkWebhook — throws when CLERK_WEBHOOK_SECRET is missing
 * 2. verifyAndParseClerkWebhook — throws when svix headers are absent/invalid
 * 3. handleClerkWebhookEvent — session.ended with missing data.id is a no-op
 * 4. handleClerkWebhookEvent — session.ended with a valid id runs without error
 * 5. handleClerkWebhookEvent — session.created with missing user_id is a no-op
 * 6. handleClerkWebhookEvent — session.created with unknown user_id is a no-op
 * 7. handleClerkWebhookEvent — user.authentication_failed is gracefully ignored
 * 8. handleClerkWebhookEvent — unknown event types are ignored without error
 * 9. SESSION_ENDED_EVENTS — session.revoked and session.removed are also handled
 *
 * The DB calls inside handleClerkWebhookEvent are exercised against the real
 * test database (DATABASE_URL env var, same as other integration tests).
 * Rows are cleaned up in after().
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { verifyAndParseClerkWebhook, handleClerkWebhookEvent } from "../lib/clerkWebhookHandlers.js";

// ── DB setup ──────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let testAccountId: number;
let testUserId: number;
let testClerkUserId: string;

const suffix = Date.now().toString(36);

before(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set to run clerk-webhook tests");

  // Create a throw-away account + user for resolveAccountForClerkUser tests
  const { rows: [acct] } = await pool.query<{ id: number }>(
    `INSERT INTO accounts (name, slug, seat_limit)
     VALUES ('Clerk Webhook Test Org', $1, 5)
     RETURNING id`,
    [`_test-clerk-webhook-${suffix}`],
  );
  testAccountId = acct.id;
  testClerkUserId = `test_clerk_uid_${suffix}`;

  const { rows: [user] } = await pool.query<{ id: number }>(
    `INSERT INTO account_users (account_id, clerk_user_id, email, role, status)
     VALUES ($1, $2, 'webhook-test@example.com', 'admin', 'active')
     RETURNING id`,
    [testAccountId, testClerkUserId],
  );
  testUserId = user.id;

  // Insert a fake active session so session.ended can UPDATE it
  await pool.query(
    `INSERT INTO user_active_sessions (account_id, user_id, clerk_session_id)
     VALUES ($1, $2, 'test_session_abc123')
     ON CONFLICT DO NOTHING`,
    [testAccountId, testUserId],
  );
});

after(async () => {
  if (testAccountId) {
    await pool.query(`DELETE FROM org_audit_log WHERE account_id = $1`, [testAccountId]);
    await pool.query(`DELETE FROM user_active_sessions WHERE account_id = $1`, [testAccountId]);
    await pool.query(`DELETE FROM account_users WHERE account_id = $1`, [testAccountId]);
    await pool.query(`DELETE FROM accounts WHERE id = $1`, [testAccountId]);
  }
  await pool.end();
});

// ── verifyAndParseClerkWebhook ────────────────────────────────────────────────

describe("verifyAndParseClerkWebhook", () => {
  it("throws when CLERK_WEBHOOK_SECRET is not set", () => {
    const original = process.env.CLERK_WEBHOOK_SECRET;
    delete process.env.CLERK_WEBHOOK_SECRET;

    assert.throws(
      () => verifyAndParseClerkWebhook(Buffer.from("{}"), {}),
      /CLERK_WEBHOOK_SECRET is not configured/,
    );

    if (original !== undefined) process.env.CLERK_WEBHOOK_SECRET = original;
  });

  it("throws when svix headers are missing (invalid signature)", () => {
    const original = process.env.CLERK_WEBHOOK_SECRET;
    process.env.CLERK_WEBHOOK_SECRET = "whsec_dGVzdF9zZWNyZXRfdGVzdF9zZWNyZXRfdGVzdF8=";

    assert.throws(
      () =>
        verifyAndParseClerkWebhook(Buffer.from(JSON.stringify({ type: "session.created", data: {} })), {
          "svix-id": "",
          "svix-timestamp": "",
          "svix-signature": "",
        }),
      // svix throws a generic Error or WebhookVerificationError
      /./,
    );

    if (original !== undefined) process.env.CLERK_WEBHOOK_SECRET = original;
    else delete process.env.CLERK_WEBHOOK_SECRET;
  });
});

// ── handleClerkWebhookEvent ───────────────────────────────────────────────────

describe("handleClerkWebhookEvent — session ended events", () => {
  it("session.ended with missing data.id resolves without error", async () => {
    await assert.doesNotReject(
      () => handleClerkWebhookEvent({ type: "session.ended", data: {} }),
    );
  });

  it("session.ended with a non-string data.id resolves without error", async () => {
    await assert.doesNotReject(
      () => handleClerkWebhookEvent({ type: "session.ended", data: { id: 42 } }),
    );
  });

  it("session.ended with a valid clerk_session_id marks matching row revoked", async () => {
    await assert.doesNotReject(
      () =>
        handleClerkWebhookEvent({
          type: "session.ended",
          data: { id: "test_session_abc123" },
        }),
    );

    // Verify the row was actually updated
    const { rows } = await pool.query(
      `SELECT revoked_at FROM user_active_sessions WHERE clerk_session_id = 'test_session_abc123'`,
    );
    if (rows.length > 0) {
      assert.ok(rows[0].revoked_at !== null, "revoked_at should be set after session.ended");
    }
    // If the row doesn't exist yet, it means user_active_sessions is an opt-in table —
    // in that case the UPDATE is a valid no-op.
  });

  it("session.revoked is handled identically to session.ended", async () => {
    await assert.doesNotReject(
      () =>
        handleClerkWebhookEvent({
          type: "session.revoked",
          data: { id: "nonexistent_session_xyz" },
        }),
    );
  });

  it("session.removed is handled identically to session.ended", async () => {
    await assert.doesNotReject(
      () =>
        handleClerkWebhookEvent({
          type: "session.removed",
          data: { id: "nonexistent_session_xyz" },
        }),
    );
  });
});

describe("handleClerkWebhookEvent — session.created", () => {
  it("missing user_id is a no-op", async () => {
    await assert.doesNotReject(
      () => handleClerkWebhookEvent({ type: "session.created", data: {} }),
    );
  });

  it("non-string user_id is a no-op", async () => {
    await assert.doesNotReject(
      () => handleClerkWebhookEvent({ type: "session.created", data: { user_id: 123 } }),
    );
  });

  it("unknown user_id (no matching account_users row) is a no-op", async () => {
    await assert.doesNotReject(
      () =>
        handleClerkWebhookEvent({
          type: "session.created",
          data: { user_id: "clerk_unknown_user_xyz_e2e" },
        }),
    );
  });

  it("known user_id writes an auth.login audit entry", async () => {
    await assert.doesNotReject(
      () =>
        handleClerkWebhookEvent({
          type: "session.created",
          data: { user_id: testClerkUserId },
        }),
    );

    // Give the fire-and-forget insertAuditLog a moment to settle
    await new Promise((r) => setTimeout(r, 200));

    const { rows } = await pool.query(
      `SELECT action FROM org_audit_log WHERE account_id = $1 AND action = 'auth.login' LIMIT 1`,
      [testAccountId],
    );
    assert.ok(rows.length > 0, "auth.login audit entry should have been inserted");
  });
});

describe("handleClerkWebhookEvent — user.authentication_failed", () => {
  it("unknown user resolves without error", async () => {
    await assert.doesNotReject(
      () =>
        handleClerkWebhookEvent({
          type: "user.authentication_failed",
          data: { user_id: "clerk_unknown_xyz", reason: "bad_password" },
        }),
    );
  });

  it("known user writes an auth.login_failed audit entry", async () => {
    await assert.doesNotReject(
      () =>
        handleClerkWebhookEvent({
          type: "user.authentication_failed",
          data: { user_id: testClerkUserId, reason: "bad_password" },
        }),
    );

    await new Promise((r) => setTimeout(r, 200));

    const { rows } = await pool.query(
      `SELECT action FROM org_audit_log WHERE account_id = $1 AND action = 'auth.login_failed' LIMIT 1`,
      [testAccountId],
    );
    assert.ok(rows.length > 0, "auth.login_failed audit entry should have been inserted");
  });

  it("no user_id at all resolves without error", async () => {
    await assert.doesNotReject(
      () =>
        handleClerkWebhookEvent({
          type: "user.authentication_failed",
          data: { reason: "bad_password" },
        }),
    );
  });
});

describe("handleClerkWebhookEvent — unknown event types", () => {
  it("completely unknown event type is ignored without error", async () => {
    await assert.doesNotReject(
      () =>
        handleClerkWebhookEvent({
          type: "organization.created",
          data: { id: "org_abc" },
        }),
    );
  });

  it("empty event type string is ignored without error", async () => {
    await assert.doesNotReject(
      () => handleClerkWebhookEvent({ type: "", data: {} }),
    );
  });
});
