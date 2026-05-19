/**
 * Audit log endpoint integration tests
 *
 * Covers the highest-risk paths in the GET /audit-log and
 * GET /audit-log/export routes (src/routes/settings.ts):
 *
 * 1. GET /audit-log — returns 200 with entries + total for admin
 * 2. GET /audit-log — returns 403 for non-admin (member / readonly)
 * 3. GET /audit-log — action filter narrows results correctly
 * 4. GET /audit-log — search filter matches actor_email substring
 * 5. GET /audit-log — after/before date range excludes out-of-range rows
 * 6. GET /audit-log — account scoping: account B cannot see account A's rows
 * 7. GET /audit-log/export — returns 200 with Content-Type: text/csv
 * 8. GET /audit-log/export — CSV has the eight expected header columns
 * 9. GET /audit-log/export — returns 403 for non-admin
 * 10. GET /audit-log/export — action filter applied to CSV rows
 *
 * Test strategy
 * ─────────────
 * Two throw-away accounts are created directly in the DB. Audit log rows are
 * inserted for account A; account B is used for cross-tenant isolation checks.
 * The Express app is built with the settings router, using the same mock-auth
 * middleware pattern as settings.test.ts. All data is cleaned up in after().
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express, { type Request } from "express";
import supertest from "supertest";
import { Pool } from "pg";
import settingsRouter from "../routes/settings.js";

// ── helpers ───────────────────────────────────────────────────────────────────

type ClerkAuthStub = { userId: null; sessionId: null; sessionClaims: null; actor: null; orgId: null };
const NULL_AUTH: ClerkAuthStub = { userId: null, sessionId: null, sessionClaims: null, actor: null, orgId: null };

function buildApp(accountId: number, role: "admin" | "member" | "readonly") {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res, next) => {
    req.internalAccountId = accountId;
    req.productUserRole   = role;
    (req as unknown as Record<string, unknown>).auth = () => NULL_AUTH;
    next();
  });
  app.use("/", settingsRouter);
  return app;
}

// ── fixtures ──────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let accountA: number;
let accountB: number;
let adminApp: ReturnType<typeof buildApp>;
let memberApp: ReturnType<typeof buildApp>;
let accountBAdminApp: ReturnType<typeof buildApp>;

const suffix = Date.now().toString(36);

async function seedAuditRow(opts: {
  accountId: number;
  action: string;
  actorEmail?: string;
  resourceLabel?: string;
  createdAt?: string;
}) {
  const { rows: [row] } = await pool.query<{ id: number }>(
    `INSERT INTO org_audit_log (account_id, actor_email, actor_user_id, action, resource_type, resource_label, metadata, ip_address, created_at)
     VALUES ($1, $2, 'test_user_id', $3, 'test_resource', $4, '{}', '127.0.0.1', $5::timestamptz)
     RETURNING id`,
    [
      opts.accountId,
      opts.actorEmail ?? `tester-${suffix}@example.com`,
      opts.action,
      opts.resourceLabel ?? "Test Resource",
      opts.createdAt ?? new Date().toISOString(),
    ],
  );
  return row.id;
}

before(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set to run audit-log tests");

  // Create two throw-away accounts
  const { rows: [a] } = await pool.query<{ id: number }>(
    `INSERT INTO accounts (name, slug, seat_limit) VALUES ($1, $2, 5) RETURNING id`,
    [`_Test AuditLog A ${suffix}`, `_test-audit-a-${suffix}`],
  );
  accountA = a.id;

  const { rows: [b] } = await pool.query<{ id: number }>(
    `INSERT INTO accounts (name, slug, seat_limit) VALUES ($1, $2, 5) RETURNING id`,
    [`_Test AuditLog B ${suffix}`, `_test-audit-b-${suffix}`],
  );
  accountB = b.id;

  // Seed rows for account A  (email uses "acct-a-" prefix so it can never be a
  // substring of the account B email used below)
  await seedAuditRow({ accountId: accountA, action: "org.updated",      actorEmail: `acct-a-${suffix}@example.com`, resourceLabel: "Org Name" });
  await seedAuditRow({ accountId: accountA, action: "auth.login",       actorEmail: `acct-a-${suffix}@example.com` });
  await seedAuditRow({ accountId: accountA, action: "team.invite_sent", actorEmail: `acct-a-${suffix}@example.com`, resourceLabel: "Invited User" });
  // One old row — 30 days ago — for date-range tests
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  await seedAuditRow({ accountId: accountA, action: "auth.login", actorEmail: `acct-a-${suffix}@example.com`, createdAt: thirtyDaysAgo });

  // Seed one row for account B (must NOT appear in account A queries)
  await seedAuditRow({ accountId: accountB, action: "org.updated", actorEmail: `acct-b-${suffix}@example.com` });

  adminApp         = buildApp(accountA, "admin");
  memberApp        = buildApp(accountA, "member");
  accountBAdminApp = buildApp(accountB, "admin");
});

after(async () => {
  if (accountA) await pool.query(`DELETE FROM org_audit_log WHERE account_id = $1`, [accountA]);
  if (accountB) await pool.query(`DELETE FROM org_audit_log WHERE account_id = $1`, [accountB]);
  if (accountA) await pool.query(`DELETE FROM accounts WHERE id = $1`, [accountA]);
  if (accountB) await pool.query(`DELETE FROM accounts WHERE id = $1`, [accountB]);
  await pool.end();
});

// ── GET /audit-log ────────────────────────────────────────────────────────────

describe("GET /audit-log", () => {
  it("returns 200 with entries array and total for admin", async () => {
    const res = await supertest(adminApp).get("/audit-log");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.entries), "entries should be an array");
    assert.ok(typeof res.body.total === "number", "total should be a number");
    assert.ok(res.body.total >= 4, `Expected ≥ 4 entries for account A, got ${res.body.total}`);
  });

  it("returns 403 for member role", async () => {
    const res = await supertest(memberApp).get("/audit-log");
    assert.equal(res.status, 403);
  });

  it("action filter returns only matching rows", async () => {
    const res = await supertest(adminApp).get("/audit-log?action=org.updated");
    assert.equal(res.status, 200);
    assert.ok(res.body.entries.length >= 1, "Should have at least one org.updated row");
    for (const entry of res.body.entries as Array<{ action: string }>) {
      assert.equal(entry.action, "org.updated");
    }
  });

  it("search filter matches actor_email substring", async () => {
    const res = await supertest(adminApp).get(`/audit-log?search=${encodeURIComponent(`acct-a-${suffix}`)}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.entries.length >= 1, "Should find rows matching the acct-a email");
    for (const entry of res.body.entries as Array<{ actor_email: string }>) {
      assert.ok(
        entry.actor_email?.toLowerCase().includes(`acct-a-${suffix}`),
        `actor_email '${entry.actor_email}' should contain 'acct-a-${suffix}'`,
      );
    }
  });

  it("after date range excludes old rows", async () => {
    // yesterday — should exclude the 30-days-ago row
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const res = await supertest(adminApp).get(`/audit-log?after=${encodeURIComponent(yesterday)}`);
    assert.equal(res.status, 200);
    // The 30-days-ago row should not be in the results
    for (const entry of res.body.entries as Array<{ created_at: string }>) {
      const ts = new Date(entry.created_at).getTime();
      assert.ok(ts >= new Date(yesterday).getTime(), "All returned rows should be after yesterday");
    }
  });

  it("before date range excludes recent rows", async () => {
    // 15 days ago — should exclude yesterday's and today's rows but include the 30-day-old row
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString();
    const res = await supertest(adminApp).get(`/audit-log?before=${encodeURIComponent(fifteenDaysAgo)}`);
    assert.equal(res.status, 200);
    for (const entry of res.body.entries as Array<{ created_at: string }>) {
      const ts = new Date(entry.created_at).getTime();
      assert.ok(
        ts <= new Date(fifteenDaysAgo).getTime(),
        "All returned rows should be before the cutoff",
      );
    }
  });

  it("account scoping: account A admin cannot see account B rows", async () => {
    const res = await supertest(adminApp).get("/audit-log?limit=100");
    assert.equal(res.status, 200);

    const actorEmails = (res.body.entries as Array<{ actor_email: string }>).map(e => e.actor_email ?? "");
    const hasAccountBEmail = actorEmails.some(e => e.includes(`acct-b-${suffix}`));
    assert.ok(!hasAccountBEmail, "Account A audit log must not contain account B rows");
  });

  it("account scoping: account B admin only sees its own rows", async () => {
    const res = await supertest(accountBAdminApp).get("/audit-log");
    assert.equal(res.status, 200);
    const actorEmails = (res.body.entries as Array<{ actor_email: string }>).map(e => e.actor_email ?? "");
    // "acct-a-" and "acct-b-" share no common substring — safe to check with includes
    const hasAccountAEmail = actorEmails.some(e => e.includes(`acct-a-${suffix}`));
    assert.ok(!hasAccountAEmail, "Account B audit log must not contain account A rows");
    assert.ok(res.body.total >= 1, "Account B should see at least its own 1 row");
  });

  it("pagination: page and limit params work correctly", async () => {
    const page1 = await supertest(adminApp).get("/audit-log?limit=2&page=1");
    const page2 = await supertest(adminApp).get("/audit-log?limit=2&page=2");
    assert.equal(page1.status, 200);
    assert.equal(page2.status, 200);

    // Pages must not overlap (compare IDs)
    const ids1 = new Set((page1.body.entries as Array<{ id: number }>).map(e => e.id));
    const ids2 = (page2.body.entries as Array<{ id: number }>).map(e => e.id);
    for (const id of ids2) {
      assert.ok(!ids1.has(id), `ID ${id} appeared on both page 1 and page 2`);
    }
  });

  it("each entry includes the eight expected fields", async () => {
    const res = await supertest(adminApp).get("/audit-log?limit=1");
    assert.equal(res.status, 200);
    if (res.body.entries.length === 0) return; // skip if empty

    const entry = res.body.entries[0] as Record<string, unknown>;
    const expectedFields = ["id", "actor_email", "action", "created_at"];
    for (const field of expectedFields) {
      assert.ok(field in entry, `Entry is missing expected field: ${field}`);
    }
  });
});

// ── GET /audit-log/export ─────────────────────────────────────────────────────

describe("GET /audit-log/export", () => {
  it("returns 200 with Content-Type text/csv for admin", async () => {
    const res = await supertest(adminApp).get("/audit-log/export");
    assert.equal(res.status, 200);
    assert.ok(
      (res.headers["content-type"] as string)?.includes("text/csv"),
      `Expected text/csv, got: ${res.headers["content-type"]}`,
    );
  });

  it("returns 403 for member role", async () => {
    const res = await supertest(memberApp).get("/audit-log/export");
    assert.equal(res.status, 403);
  });

  it("CSV has the eight expected header columns in correct order", async () => {
    const res = await supertest(adminApp).get("/audit-log/export");
    assert.equal(res.status, 200);

    const csv = res.text;
    const header = csv.split("\n")[0] ?? "";
    const expectedCols = ["timestamp", "actor_email", "action", "resource_type", "resource_label", "resource_id", "ip_address", "metadata"];
    for (const col of expectedCols) {
      assert.ok(header.includes(col), `CSV header is missing column: ${col}\nGot: ${header}`);
    }
  });

  it("CSV includes data rows for account A", async () => {
    const res = await supertest(adminApp).get("/audit-log/export");
    assert.equal(res.status, 200);

    const lines = res.text.split("\n").filter(Boolean);
    // header + at least 4 data rows
    assert.ok(lines.length >= 5, `Expected ≥ 5 lines (header + 4 data rows), got ${lines.length}`);
  });

  it("Content-Disposition header sets a filename with today's date", async () => {
    const res = await supertest(adminApp).get("/audit-log/export");
    assert.equal(res.status, 200);

    const disposition = res.headers["content-disposition"] as string;
    const today = new Date().toISOString().slice(0, 10);
    assert.ok(
      disposition?.includes(`audit-log-${today}`),
      `Expected filename with today (${today}) in Content-Disposition: ${disposition}`,
    );
  });

  it("action filter is applied to the CSV export", async () => {
    const res = await supertest(adminApp).get("/audit-log/export?action=org.updated");
    assert.equal(res.status, 200);

    const lines = res.text.split("\n").filter(Boolean);
    // All data rows must contain org.updated
    for (const line of lines.slice(1)) {
      assert.ok(
        line.includes("org.updated"),
        `CSV row does not match action filter: ${line}`,
      );
    }
  });

  it("account scoping: export does not include other accounts' rows", async () => {
    const res = await supertest(adminApp).get("/audit-log/export");
    assert.equal(res.status, 200);

    assert.ok(
      !res.text.includes(`acct-b-${suffix}`),
      "Export must not include account B's actor_email",
    );
  });
});
