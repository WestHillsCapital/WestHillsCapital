/**
 * In-app notification preference enforcement tests
 *
 * Verifies that sendInAppNotifications() respects per-user in_app_enabled
 * preferences: users who opted out must not receive in-app notification rows,
 * while opted-in users (including defaults) do receive them.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { sendInAppNotifications } from "../lib/notificationPrefs.js";

describe("sendInAppNotifications — preference enforcement", () => {
  let pool: Pool;
  let accountId: number;
  const userA = `_test-inapp-user-a-${Date.now()}`;
  const userB = `_test-inapp-user-b-${Date.now()}`;
  const userC = `_test-inapp-user-c-${Date.now()}`;

  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL must be set");

    pool = new Pool({ connectionString: url, max: 3 });

    // notificationPrefs uses the singleton DB from db.ts; initialise it via
    // a temporary pool exposed the same way the production code would.
    // We short-circuit by setting DATABASE_URL which initDb() will use.
    const { initDb } = await import("../db.js");
    await initDb();

    const suffix = `${Date.now().toString(36)}`;
    const { rows: [acct] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug) VALUES ($1, $2) RETURNING id`,
      [`_Test InApp Prefs ${suffix}`, `_test-inapp-prefs-${suffix}`],
    );
    accountId = acct.id;

    // Seed three active org members
    for (const [uid, email] of [
      [userA, `inapp-a-${suffix}@test.invalid`],
      [userB, `inapp-b-${suffix}@test.invalid`],
      [userC, `inapp-c-${suffix}@test.invalid`],
    ] as [string, string][]) {
      await pool.query(
        `INSERT INTO account_users (account_id, clerk_user_id, email, role, status)
         VALUES ($1, $2, $3, 'member', 'active')`,
        [accountId, uid, email],
      );
    }

    // userB explicitly opts OUT of in-app for api_key_created
    await pool.query(
      `INSERT INTO user_notification_prefs
         (account_id, clerk_user_id, event_key, email_enabled, in_app_enabled)
       VALUES ($1, $2, 'api_key_created', true, false)`,
      [accountId, userB],
    );
    // userA and userC have no pref row → default true
  });

  after(async () => {
    // Clean up; CASCADE takes care of child rows
    await pool.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
    await pool.end();
  });

  it("sends in-app notification to opted-in users (A and C) but not opted-out user (B)", async () => {
    await sendInAppNotifications(
      accountId,
      "api_key_created",
      "Test key created",
      "A test API key was created.",
    );

    const { rows } = await pool.query<{ clerk_user_id: string }>(
      `SELECT clerk_user_id FROM user_in_app_notifications
        WHERE account_id = $1 AND event_key = 'api_key_created'`,
      [accountId],
    );
    const recipients = rows.map(r => r.clerk_user_id);

    assert.ok(recipients.includes(userA), "userA (default opted-in) should receive notification");
    assert.ok(recipients.includes(userC), "userC (default opted-in) should receive notification");
    assert.ok(!recipients.includes(userB), "userB (opted-out) must NOT receive notification");
  });

  it("excludes the actor's own clerk user ID when provided", async () => {
    // userC acts and should be excluded
    await sendInAppNotifications(
      accountId,
      "api_key_revoked",
      "Key revoked",
      "A key was revoked.",
      [userC],
    );

    const { rows } = await pool.query<{ clerk_user_id: string }>(
      `SELECT clerk_user_id FROM user_in_app_notifications
        WHERE account_id = $1 AND event_key = 'api_key_revoked'`,
      [accountId],
    );
    const recipients = rows.map(r => r.clerk_user_id);

    assert.ok(recipients.includes(userA), "userA should receive revoke notification");
    assert.ok(!recipients.includes(userC), "userC (actor) must be excluded");
  });
});
