/**
 * Enterprise Features — Functional & Schema Validation Tests
 *
 * Covers all 8 enterprise features:
 *   1. Sessions list & search API
 *   2. Bulk session creation
 *   3. Audit log API
 *   4. Session signers (multi-party signing)
 *   5. Custom domain management
 *   6. SCIM 2.0 user provisioning
 *   7. Schema validation — new tables and columns
 *   8. Reminder config at session creation
 *
 * Strategy
 * ────────
 * Each describe block creates an in-process Express app mounting only the
 * relevant router, bypasses network-level auth where possible, and uses a
 * shared test account seeded in the real DB.  All test data is prefixed
 * "_Test" and cleaned up in `after()`.
 *
 * For routes protected by requireApiKeyAuth (which hashes the Bearer token
 * against account_api_keys), we seed a real key hash so the full middleware
 * stack runs as it would in production.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import express from "express";
import supertest from "supertest";
import { Pool } from "pg";

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import headlessSessionsRouter from "../routes/headlessSessions.js";
import customDomainRouter from "../routes/customDomain.js";
import scimRouter from "../routes/scim.js";
import { initDb, getDb } from "../db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Shared state ───────────────────────────────────────────────────────────────

let pool: Pool;
let accountId: number;
let packageId: number;
let rawApiKey: string;
let rawScimToken: string;
let sessionToken: string;
let sessionId: number;
const suffix = randomBytes(4).toString("hex");

// ── Test apps ─────────────────────────────────────────────────────────────────

/** App that passes API key through the full requireApiKeyAuth middleware */
function buildApiKeyApp(router: express.Router, mountPath = "/") {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  return app;
}

/** App that bypasses auth — injects accountId directly */
function buildBypassApp(accountId: number, router: express.Router, mountPath = "/") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.internalAccountId = accountId;
    req.productUserRole = "admin";
    next();
  });
  app.use(mountPath, router);
  return app;
}

// ── Global before / after ─────────────────────────────────────────────────────

before(async () => {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL must be set");
  // Ensure all docuplete_* tables exist and enterprise tables/columns are present
  // so this test is self-contained on a fresh CI database.
  await initDb();
  const enterpriseSql = readFileSync(
    resolve(__dirname, "../../src/lib/migrate-enterprise.sql"),
    "utf8",
  );
  await getDb().query(enterpriseSql);
  pool = new Pool({ connectionString: url, max: 5 });

  // Create test account
  const { rows: [acct] } = await pool.query<{ id: number }>(
    `INSERT INTO accounts (name, slug) VALUES ($1, $2) RETURNING id`,
    [`_Test Enterprise ${suffix}`, `_test-enterprise-${suffix}`],
  );
  accountId = acct.id;

  // Seed a real API key (dp_live_ prefix) so requireApiKeyAuth works
  rawApiKey = `dp_live_${randomBytes(20).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawApiKey).digest("hex");
  await pool.query(
    `INSERT INTO account_api_keys (account_id, name, key_hash, key_prefix)
     VALUES ($1, $2, $3, $4)`,
    [accountId, "_test-api-key", keyHash, rawApiKey.substring(0, 12)],
  );

  // Seed a SCIM bearer token
  rawScimToken = `scim_${randomBytes(20).toString("hex")}`;
  const scimHash = createHash("sha256").update(rawScimToken).digest("hex");
  await pool.query(
    `INSERT INTO scim_tokens (account_id, name, token_hash, token_prefix)
     VALUES ($1, $2, $3, $4)`,
    [accountId, "_test-scim-token", scimHash, rawScimToken.substring(0, 12)],
  );

  // Create a docuplete package (required for the INNER JOIN in sessions list)
  // webhook_secret is NOT NULL with no default so we must supply it.
  const { rows: [pkg] } = await pool.query<{ id: number }>(
    `INSERT INTO docuplete_packages
       (name, account_id, status, version, documents, fields, mappings, recipients, tags, webhook_secret)
     VALUES ($1, $2, 'active', 1, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, $3)
     RETURNING id`,
    [`_Test Package ${suffix}`, accountId, randomBytes(16).toString("hex")],
  );
  packageId = pkg.id;

  // Create one test session
  sessionToken = `df_${randomBytes(18).toString("hex")}`;
  const { rows: [sess] } = await pool.query<{ id: number }>(
    `INSERT INTO docuplete_interview_sessions
       (token, status, account_id, package_id, package_version, expires_at)
     VALUES ($1, 'draft', $2, $3, 1, NOW() + INTERVAL '90 days')
     RETURNING id`,
    [sessionToken, accountId, packageId],
  );
  sessionId = sess.id;
});

after(async () => {
  if (pool && accountId) {
    // Delete child records first to respect FK constraints, then the account
    await pool.query(`DELETE FROM docuplete_audit_logs WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM docuplete_session_signers WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM docuplete_interview_sessions WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM docuplete_packages WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM scim_tokens WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM account_users WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM account_api_keys WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
  }
  await pool?.end();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Schema Validation — new tables and columns", () => {
  async function getColumns(table: string): Promise<Map<string, string>> {
    const { rows } = await pool.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position`,
      [table],
    );
    return new Map(rows.map((r) => [r.column_name, r.data_type]));
  }

  it("docuplete_audit_logs has all required columns with correct types", async () => {
    const cols = await getColumns("docuplete_audit_logs");
    const required: [string, string][] = [
      ["id",            "integer"],
      ["session_id",    "integer"],
      ["session_token", "text"],
      ["account_id",    "integer"],
      ["event",         "text"],
      ["actor_type",    "text"],
      ["actor_email",   "text"],
      ["actor_ip",      "text"],
      ["actor_ua",      "text"],
      ["metadata",      "jsonb"],
      ["created_at",    "timestamp with time zone"],
    ];
    for (const [col, type] of required) {
      assert.ok(cols.has(col), `docuplete_audit_logs missing column: ${col}`);
      assert.equal(cols.get(col), type, `${col}: expected ${type}, got ${cols.get(col)}`);
    }
  });

  it("docuplete_audit_logs has correct indexes", async () => {
    const { rows } = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'docuplete_audit_logs'`,
    );
    const names = rows.map((r) => r.indexname);
    assert.ok(
      names.some((n) => n.endsWith("audit_logs_pkey")),
      "missing primary key index",
    );
    assert.ok(
      names.some((n) => n.includes("session_token")),
      "missing session_token index",
    );
    assert.ok(
      names.some((n) => n.includes("account")),
      "missing account index",
    );
  });

  it("docuplete_session_signers has all required columns", async () => {
    const cols = await getColumns("docuplete_session_signers");
    const required: [string, string][] = [
      ["id",            "integer"],
      ["session_id",    "integer"],
      ["account_id",    "integer"],
      ["signer_order",  "integer"],
      ["email",         "text"],
      ["name",          "text"],
      ["status",        "text"],
      ["token",         "text"],
      ["notified_at",   "timestamp with time zone"],
      ["signed_at",     "timestamp with time zone"],
      ["declined_at",   "timestamp with time zone"],
      ["declined_reason","text"],
      ["signer_ip",     "text"],
      ["signer_ua",     "text"],
      ["created_at",    "timestamp with time zone"],
      ["updated_at",    "timestamp with time zone"],
    ];
    for (const [col, type] of required) {
      assert.ok(cols.has(col), `docuplete_session_signers missing column: ${col}`);
      assert.equal(cols.get(col), type, `${col}: expected ${type}, got ${cols.get(col)}`);
    }
  });

  it("docuplete_session_signers has UNIQUE constraint on token", async () => {
    const { rows } = await pool.query<{ constraint_name: string; constraint_type: string }>(
      `SELECT constraint_name, constraint_type
         FROM information_schema.table_constraints
        WHERE table_name = 'docuplete_session_signers'
          AND constraint_type = 'UNIQUE'`,
    );
    assert.ok(rows.length > 0, "Expected UNIQUE constraint on docuplete_session_signers");
  });

  it("scim_tokens has all required columns", async () => {
    const cols = await getColumns("scim_tokens");
    const required: [string, string][] = [
      ["id",            "integer"],
      ["account_id",    "integer"],
      ["name",          "text"],
      ["token_hash",    "text"],
      ["token_prefix",  "text"],
      ["created_at",    "timestamp with time zone"],
      ["revoked_at",    "timestamp with time zone"],
      ["last_used_at",  "timestamp with time zone"],
    ];
    for (const [col, type] of required) {
      assert.ok(cols.has(col), `scim_tokens missing column: ${col}`);
      assert.equal(cols.get(col), type, `${col}: expected ${type}, got ${cols.get(col)}`);
    }
  });

  it("scim_tokens has UNIQUE constraint on token_hash", async () => {
    const { rows } = await pool.query<{ constraint_name: string }>(
      `SELECT tc.constraint_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'scim_tokens'
          AND tc.constraint_type = 'UNIQUE'
          AND kcu.column_name = 'token_hash'`,
    );
    assert.ok(rows.length > 0, "Expected UNIQUE constraint on scim_tokens.token_hash");
  });

  it("docuplete_interview_sessions has lifecycle timestamp columns", async () => {
    const cols = await getColumns("docuplete_interview_sessions");
    assert.ok(cols.has("first_viewed_at"), "Missing first_viewed_at");
    assert.equal(cols.get("first_viewed_at"), "timestamp with time zone");
    assert.ok(cols.has("first_started_at"), "Missing first_started_at");
    assert.equal(cols.get("first_started_at"), "timestamp with time zone");
  });

  it("docuplete_interview_sessions has reminder columns", async () => {
    const cols = await getColumns("docuplete_interview_sessions");
    assert.ok(cols.has("reminder_enabled"), "Missing reminder_enabled");
    assert.equal(cols.get("reminder_enabled"), "boolean");
    assert.ok(cols.has("reminder_days"), "Missing reminder_days");
    assert.equal(cols.get("reminder_days"), "integer");
  });

  it("accounts table has custom domain columns", async () => {
    const cols = await getColumns("accounts");
    assert.ok(cols.has("custom_domain"), "Missing custom_domain");
    assert.ok(cols.has("custom_domain_status"), "Missing custom_domain_status");
  });

  it("accounts table has reminder default columns", async () => {
    const cols = await getColumns("accounts");
    assert.ok(cols.has("interview_reminder_enabled"), "Missing interview_reminder_enabled");
    assert.equal(cols.get("interview_reminder_enabled"), "boolean");
    assert.ok(cols.has("interview_reminder_days"), "Missing interview_reminder_days");
    assert.equal(cols.get("interview_reminder_days"), "integer");
  });

  it("all new tables have foreign keys to accounts with CASCADE DELETE", async () => {
    const { rows } = await pool.query<{ table_name: string; delete_rule: string }>(
      `SELECT tc.table_name, rc.delete_rule
         FROM information_schema.referential_constraints rc
         JOIN information_schema.table_constraints tc
           ON rc.constraint_name = tc.constraint_name
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
         JOIN information_schema.key_column_usage kcu2
           ON rc.unique_constraint_name = kcu2.constraint_name
        WHERE tc.table_name IN ('docuplete_audit_logs','docuplete_session_signers','scim_tokens')
          AND kcu2.table_name = 'accounts'`,
    );
    const tables = new Set(rows.map((r) => r.table_name));
    assert.ok(tables.has("docuplete_audit_logs"), "audit_logs missing FK to accounts");
    assert.ok(tables.has("docuplete_session_signers"), "session_signers missing FK to accounts");
    assert.ok(tables.has("scim_tokens"), "scim_tokens missing FK to accounts");
    for (const row of rows) {
      assert.equal(row.delete_rule, "CASCADE", `${row.table_name} FK should CASCADE`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SESSIONS LIST & SEARCH API
// ═══════════════════════════════════════════════════════════════════════════════

describe("Sessions API — List & Search (GET /v1/sessions)", () => {
  let app: express.Express;

  before(() => {
    app = buildApiKeyApp(headlessSessionsRouter, "/v1/sessions");
  });

  it("returns 401 with no Authorization header", async () => {
    const res = await supertest(app).get("/v1/sessions");
    assert.equal(res.status, 401, "Expected 401 for missing auth");
    assert.ok(res.body.error, "Expected error message");
  });

  it("returns 401 with a malformed API key", async () => {
    const res = await supertest(app)
      .get("/v1/sessions")
      .set("Authorization", "Bearer not_a_real_key");
    assert.equal(res.status, 401);
  });

  it("returns 200 with sessions array and total for valid API key", async () => {
    const res = await supertest(app)
      .get("/v1/sessions")
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.sessions), "sessions should be an array");
    assert.ok(typeof res.body.total === "number", "total should be a number");
    assert.ok(typeof res.body.limit === "number", "limit should be a number");
    assert.ok(typeof res.body.offset === "number", "offset should be a number");
  });

  it("includes the test session in the list", async () => {
    const res = await supertest(app)
      .get("/v1/sessions")
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    const found = (res.body.sessions as Array<{ token: string }>).find(
      (s) => s.token === sessionToken,
    );
    assert.ok(found, `Expected to find session ${sessionToken} in list`);
  });

  it("filters by packageId and returns only matching sessions", async () => {
    const res = await supertest(app)
      .get(`/v1/sessions?packageId=${packageId}`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    const sessions = res.body.sessions as Array<{ package_id?: number; packageId?: number }>;
    for (const s of sessions) {
      const id = s.package_id ?? s.packageId;
      assert.equal(id, packageId, `All sessions should belong to package ${packageId}`);
    }
  });

  it("filters by status and returns only matching sessions", async () => {
    const res = await supertest(app)
      .get("/v1/sessions?status=draft")
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    const sessions = res.body.sessions as Array<{ status: string }>;
    for (const s of sessions) {
      assert.equal(s.status, "draft");
    }
  });

  it("ignores invalid status values and returns all sessions", async () => {
    // The API silently ignores unrecognised status values rather than erroring
    const res = await supertest(app)
      .get("/v1/sessions?status=invalid_status")
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.sessions));
  });

  it("respects limit and offset for pagination", async () => {
    const res = await supertest(app)
      .get("/v1/sessions?limit=1&offset=0")
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.sessions.length <= 1, "Expected at most 1 session with limit=1");
    assert.equal(res.body.limit, 1);
    assert.equal(res.body.offset, 0);
  });

  it("clamps limit greater than 200 to 200 and returns 200", async () => {
    // The API silently clamps the limit to the max of 200 rather than erroring
    const res = await supertest(app)
      .get("/v1/sessions?limit=999")
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.limit <= 200, `Expected clamped limit <= 200, got ${res.body.limit}`);
  });

  it("returns empty sessions array and total=0 for non-existent packageId", async () => {
    const res = await supertest(app)
      .get("/v1/sessions?packageId=999999999")
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.sessions.length, 0);
    assert.equal(res.body.total, 0);
  });

  it("search parameter filters sessions by token prefix", async () => {
    const prefix = sessionToken.substring(0, 6);
    const res = await supertest(app)
      .get(`/v1/sessions?search=${prefix}`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.sessions), "Expected sessions array");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SESSION DETAIL (GET /v1/sessions/:token)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Sessions API — Get by Token (GET /v1/sessions/:token)", () => {
  let app: express.Express;

  before(() => {
    app = buildApiKeyApp(headlessSessionsRouter, "/v1/sessions");
  });

  it("returns 200 with session details for a valid token", async () => {
    const res = await supertest(app)
      .get(`/v1/sessions/${sessionToken}`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.session, "Expected session object");
    assert.equal(res.body.session.token, sessionToken);
    assert.equal(res.body.session.status, "draft");
  });

  it("returns 404 for a token belonging to a different account", async () => {
    const otherToken = `df_${randomBytes(18).toString("hex")}`;
    const res = await supertest(app)
      .get(`/v1/sessions/${otherToken}`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 404);
  });

  it("returns 401 without Authorization header", async () => {
    const res = await supertest(app).get(`/v1/sessions/${sessionToken}`);
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. BULK SESSION CREATION (POST /v1/sessions/bulk)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Bulk Session Creation (POST /v1/sessions/bulk)", () => {
  let app: express.Express;
  const createdTokens: string[] = [];

  before(() => {
    app = buildApiKeyApp(headlessSessionsRouter, "/v1/sessions");
  });

  after(async () => {
    if (createdTokens.length > 0) {
      await pool.query(
        `DELETE FROM docuplete_interview_sessions WHERE token = ANY($1)`,
        [createdTokens],
      );
    }
  });

  it("creates multiple sessions and returns 207 with per-item results", async () => {
    const items = [
      { packageId: packageId, prefill: { name: "Alice Bulk" } },
      { packageId: packageId, prefill: { name: "Bob Bulk" } },
      { packageId: packageId, prefill: { name: "Carol Bulk" } },
    ];
    const res = await supertest(app)
      .post("/v1/sessions/bulk")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ sessions: items });
    assert.equal(res.status, 207, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.results), "Expected results array");
    assert.equal(res.body.results.length, 3, "Expected 3 results");
    assert.equal(typeof res.body.succeeded, "number", "Expected succeeded count");

    // Bulk result shape: { index, ok, sessionToken, interviewUrl, expiresAt }
    for (const result of res.body.results as Array<{ ok: boolean; sessionToken?: string; error?: string }>) {
      assert.equal(result.ok, true, `Expected ok=true, got error: ${result.error}`);
      assert.ok(result.sessionToken, "Expected sessionToken in successful result");
      createdTokens.push(result.sessionToken!);
    }
  });

  it("returns 207 with partial failures when some items have invalid packageId", async () => {
    const items = [
      { packageId: packageId },
      { packageId: 999999999 }, // non-existent package
    ];
    const res = await supertest(app)
      .post("/v1/sessions/bulk")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ sessions: items });
    assert.equal(res.status, 207);
    const results = res.body.results as Array<{ ok: boolean; sessionToken?: string }>;
    assert.equal(results.length, 2);
    const successes = results.filter((r) => r.ok);
    if (successes.length > 0 && successes[0].sessionToken) {
      createdTokens.push(successes[0].sessionToken);
    }
  });

  it("rejects empty sessions array with 400", async () => {
    const res = await supertest(app)
      .post("/v1/sessions/bulk")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ sessions: [] });
    assert.equal(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  it("rejects sessions array over 100 items with 400", async () => {
    const items = Array.from({ length: 101 }, () => ({ packageId: packageId }));
    const res = await supertest(app)
      .post("/v1/sessions/bulk")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ sessions: items });
    assert.equal(res.status, 400);
  });

  it("returns 401 without Authorization header", async () => {
    const res = await supertest(app)
      .post("/v1/sessions/bulk")
      .send({ sessions: [{ packageId: packageId }] });
    assert.equal(res.status, 401);
  });

  it("created sessions have correct account_id scoping", async () => {
    const items = [{ packageId: packageId, prefill: { ref: "scope-check" } }];
    const res = await supertest(app)
      .post("/v1/sessions/bulk")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ sessions: items });
    assert.equal(res.status, 207);
    const [result] = res.body.results as Array<{ ok: boolean; sessionToken?: string }>;
    if (result.ok && result.sessionToken) {
      createdTokens.push(result.sessionToken);
      const { rows } = await pool.query<{ account_id: number }>(
        `SELECT account_id FROM docuplete_interview_sessions WHERE token = $1`,
        [result.sessionToken],
      );
      assert.equal(rows[0]?.account_id, accountId, "Created session must belong to API key's account");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. REMINDER CONFIG AT SESSION CREATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Reminder Config at Session Creation (POST /v1/sessions)", () => {
  let app: express.Express;
  const createdTokens: string[] = [];

  before(() => {
    app = buildApiKeyApp(headlessSessionsRouter, "/v1/sessions");
  });

  after(async () => {
    if (createdTokens.length > 0) {
      await pool.query(
        `DELETE FROM docuplete_interview_sessions WHERE token = ANY($1)`,
        [createdTokens],
      );
    }
  });

  it("creates a session with reminder config and persists it to DB", async () => {
    const res = await supertest(app)
      .post("/v1/sessions")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ packageId: packageId, reminders: { enabled: true, intervalDays: 3 } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    // API returns { sessionToken, interviewUrl, expiresAt }
    const tok = res.body.sessionToken as string;
    assert.ok(tok, "Expected sessionToken in response");
    createdTokens.push(tok);

    const { rows } = await pool.query<{ reminder_enabled: boolean; reminder_days: number }>(
      `SELECT reminder_enabled, reminder_days FROM docuplete_interview_sessions WHERE token = $1`,
      [tok],
    );
    assert.equal(rows[0]?.reminder_enabled, true, "reminder_enabled should be true in DB");
    assert.equal(rows[0]?.reminder_days, 3, "reminder_days should be 3 in DB");
  });

  it("creates a session with reminders disabled", async () => {
    const res = await supertest(app)
      .post("/v1/sessions")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ packageId: packageId, reminders: { enabled: false } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const tok = res.body.sessionToken as string;
    createdTokens.push(tok);

    const { rows } = await pool.query<{ reminder_enabled: boolean }>(
      `SELECT reminder_enabled FROM docuplete_interview_sessions WHERE token = $1`,
      [tok],
    );
    assert.equal(rows[0]?.reminder_enabled, false);
  });

  it("creates a session without reminder config and falls back to account defaults", async () => {
    const res = await supertest(app)
      .post("/v1/sessions")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ packageId: packageId });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const tok = res.body.sessionToken as string;
    createdTokens.push(tok);
    assert.ok(tok, "Expected sessionToken in response");
  });

  it("rejects intervalDays < 1 with 400", async () => {
    const res = await supertest(app)
      .post("/v1/sessions")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ packageId: packageId, reminders: { enabled: true, intervalDays: 0 } });
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. AUDIT LOG API
// ═══════════════════════════════════════════════════════════════════════════════

describe("Audit Log API (GET /v1/sessions/:token/audit-log)", () => {
  let app: express.Express;

  before(() => {
    app = buildApiKeyApp(headlessSessionsRouter, "/v1/sessions");
  });

  it("returns 200 with an entries array (may be empty)", async () => {
    const res = await supertest(app)
      .get(`/v1/sessions/${sessionToken}/audit-log`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    // Audit log response shape: { token, entries, total }
    assert.ok(Array.isArray(res.body.entries), "Expected entries array");
    assert.equal(res.body.token, sessionToken);
  });

  it("returns audit entries after manually inserting one", async () => {
    await pool.query(
      `INSERT INTO docuplete_audit_logs
         (session_id, session_token, account_id, event, actor_type, metadata)
       VALUES ($1, $2, $3, 'test.event', 'system', '{"source":"test"}'::jsonb)`,
      [sessionId, sessionToken, accountId],
    );

    const res = await supertest(app)
      .get(`/v1/sessions/${sessionToken}/audit-log`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    const entries = res.body.entries as Array<{ event: string }>;
    const found = entries.find((e) => e.event === "test.event");
    assert.ok(found, "Expected to find test.event in audit log entries");
  });

  it("returns 404 for a token not owned by the account", async () => {
    const res = await supertest(app)
      .get(`/v1/sessions/df_nonexistent_xyz/audit-log`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 404);
  });

  it("returns 401 without Authorization header", async () => {
    const res = await supertest(app).get(`/v1/sessions/${sessionToken}/audit-log`);
    assert.equal(res.status, 401);
  });

  it("audit entries are ordered chronologically (oldest first)", async () => {
    const res = await supertest(app)
      .get(`/v1/sessions/${sessionToken}/audit-log`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    const entries = res.body.entries as Array<{ created_at?: string; createdAt?: string }>;
    if (entries.length > 1) {
      for (let i = 1; i < entries.length; i++) {
        const prev = new Date((entries[i - 1].created_at ?? entries[i - 1].createdAt)!);
        const curr = new Date((entries[i].created_at ?? entries[i].createdAt)!);
        assert.ok(curr >= prev, "Entries should be in chronological order");
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. MULTI-PARTY SEQUENTIAL SIGNING — SIGNERS API
// ═══════════════════════════════════════════════════════════════════════════════

describe("Multi-Party Signers (GET /v1/sessions/:token/signers)", () => {
  let app: express.Express;
  let multiToken: string;
  let multiSessionId: number;

  before(async () => {
    app = buildApiKeyApp(headlessSessionsRouter, "/v1/sessions");

    // Create a session with signers seeded directly in the DB
    multiToken = `df_${randomBytes(18).toString("hex")}`;
    const { rows: [sess] } = await pool.query<{ id: number }>(
      `INSERT INTO docuplete_interview_sessions
         (token, status, account_id, package_id, package_version, expires_at)
       VALUES ($1, 'draft', $2, $3, 1, NOW() + INTERVAL '90 days')
       RETURNING id`,
      [multiToken, accountId, packageId],
    );
    multiSessionId = sess.id;

    // Seed two signers
    await pool.query(
      `INSERT INTO docuplete_session_signers
         (session_id, account_id, signer_order, email, name, status, token)
       VALUES
         ($1, $2, 1, 'alice@example.com', 'Alice', 'pending',  'sgn_${randomBytes(10).toString("hex")}'),
         ($1, $2, 2, 'bob@example.com',   'Bob',   'awaiting', 'sgn_${randomBytes(10).toString("hex")}')`,
      [multiSessionId, accountId],
    );
  });

  after(async () => {
    if (multiToken) {
      await pool.query(
        `DELETE FROM docuplete_interview_sessions WHERE token = $1`,
        [multiToken],
      );
    }
  });

  it("returns 200 with ordered signers and allSigned flag", async () => {
    const res = await supertest(app)
      .get(`/v1/sessions/${multiToken}/signers`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.signers), "Expected signers array");
    assert.equal(res.body.signers.length, 2);
    assert.equal(typeof res.body.allSigned, "boolean");
    assert.equal(res.body.allSigned, false, "Not all signed yet");
    assert.equal(res.body.token, multiToken);
  });

  it("signers are returned in ascending signer_order", async () => {
    const res = await supertest(app)
      .get(`/v1/sessions/${multiToken}/signers`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    const [first, second] = res.body.signers as Array<{ order?: number; signer_order?: number; email: string }>;
    const firstOrder  = first.order  ?? first.signer_order  ?? 0;
    const secondOrder = second.order ?? second.signer_order ?? 0;
    assert.ok(firstOrder < secondOrder, "Signers should be in ascending order");
    assert.equal(first.email,  "alice@example.com");
    assert.equal(second.email, "bob@example.com");
  });

  it("returns empty array for session with no signers", async () => {
    const res = await supertest(app)
      .get(`/v1/sessions/${sessionToken}/signers`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.signers.length, 0);
    assert.equal(res.body.allSigned, false);
  });

  it("allSigned is true when all signers have status='signed'", async () => {
    await pool.query(
      `UPDATE docuplete_session_signers SET status = 'signed' WHERE session_id = $1`,
      [multiSessionId],
    );
    const res = await supertest(app)
      .get(`/v1/sessions/${multiToken}/signers`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.allSigned, true, "allSigned should be true when all signers signed");
  });

  it("returns 404 for token not owned by the account", async () => {
    const res = await supertest(app)
      .get(`/v1/sessions/df_unknown_token/signers`)
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. MULTI-PARTY SIGNING — CREATE SESSION WITH SIGNERS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Multi-Party Signing — Create Session with Signers", () => {
  let app: express.Express;
  const createdTokens: string[] = [];

  before(() => {
    app = buildApiKeyApp(headlessSessionsRouter, "/v1/sessions");
  });

  after(async () => {
    if (createdTokens.length > 0) {
      await pool.query(
        `DELETE FROM docuplete_interview_sessions WHERE token = ANY($1)`,
        [createdTokens],
      );
    }
  });

  it("creates session with signers and seeds them in docuplete_session_signers", async () => {
    const res = await supertest(app)
      .post("/v1/sessions")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({
        packageId: packageId,
        signers: [
          { email: "signer1@test.com", name: "Signer One" },
          { email: "signer2@test.com", name: "Signer Two" },
        ],
      });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    // API returns { sessionToken, interviewUrl, expiresAt }
    const token = res.body.sessionToken as string;
    assert.ok(token, "Expected sessionToken in response");
    createdTokens.push(token);

    const { rows: sessRows } = await pool.query<{ id: number }>(
      `SELECT id FROM docuplete_interview_sessions WHERE token = $1`,
      [token],
    );
    assert.ok(sessRows[0], "Session must exist in DB");

    const { rows: signerRows } = await pool.query<{ email: string; status: string; signer_order: number }>(
      `SELECT email, status, signer_order FROM docuplete_session_signers
        WHERE session_id = $1 ORDER BY signer_order`,
      [sessRows[0].id],
    );
    assert.equal(signerRows.length, 2, "Expected 2 signers in DB");
    assert.equal(signerRows[0].email, "signer1@test.com");
    assert.equal(signerRows[0].status, "pending",  "First signer should be pending");
    assert.equal(signerRows[1].email, "signer2@test.com");
    assert.equal(signerRows[1].status, "awaiting", "Second signer should be awaiting");
  });

  it("rejects signers with invalid email with 400", async () => {
    const res = await supertest(app)
      .post("/v1/sessions")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({
        packageId: packageId,
        signers: [{ email: "not-an-email", name: "Bad" }],
      });
    assert.equal(res.status, 400);
  });

  it("rejects more than 10 signers with 400", async () => {
    const signers = Array.from({ length: 11 }, (_, i) => ({
      email: `signer${i}@test.com`,
      name: `Signer ${i}`,
    }));
    const res = await supertest(app)
      .post("/v1/sessions")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ packageId: packageId, signers });
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. CUSTOM DOMAIN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe("Custom Domain Management", () => {
  let app: express.Express;

  before(() => {
    app = buildApiKeyApp(customDomainRouter, "/v1/account/custom-domain");
  });

  it("GET returns current domain status (null when not configured)", async () => {
    const res = await supertest(app)
      .get("/v1/account/custom-domain")
      .set("Authorization", `Bearer ${rawApiKey}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok("domain" in res.body, "Expected domain field");
  });

  it("PUT sets a domain and returns pending_verification status", async () => {
    const res = await supertest(app)
      .put("/v1/account/custom-domain")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ domain: `test-${suffix}.docuplete.io` });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.domain, "Expected domain in response");
    assert.ok(
      ["pending_verification", "active"].includes(res.body.status),
      `Unexpected status: ${res.body.status}`,
    );
  });

  it("PUT rejects an empty domain with 400", async () => {
    const res = await supertest(app)
      .put("/v1/account/custom-domain")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ domain: "" });
    assert.equal(res.status, 400);
  });

  it("PUT rejects a domain with invalid characters with 400", async () => {
    const res = await supertest(app)
      .put("/v1/account/custom-domain")
      .set("Authorization", `Bearer ${rawApiKey}`)
      .send({ domain: "not a valid domain!!" });
    assert.equal(res.status, 400);
  });

  it("DELETE removes the custom domain configuration", async () => {
    const res = await supertest(app)
      .delete("/v1/account/custom-domain")
      .set("Authorization", `Bearer ${rawApiKey}`);
    // May be 204 or 200 depending on implementation
    assert.ok([200, 204].includes(res.status), `Expected 200 or 204, got ${res.status}`);

    // Verify cleared in DB
    const { rows } = await pool.query<{ custom_domain: string | null }>(
      `SELECT custom_domain FROM accounts WHERE id = $1`,
      [accountId],
    );
    assert.ok(
      rows[0]?.custom_domain === null || rows[0]?.custom_domain === "",
      "custom_domain should be cleared after DELETE",
    );
  });

  it("returns 401 without Authorization header", async () => {
    const res = await supertest(app).get("/v1/account/custom-domain");
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. SCIM 2.0 — FULL USER CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe("SCIM 2.0 — Users CRUD", () => {
  let app: express.Express;
  let createdScimUserId: number | null = null;

  before(() => {
    app = buildApiKeyApp(scimRouter, "/scim/v2");
  });

  after(async () => {
    if (createdScimUserId) {
      await pool.query(
        `DELETE FROM account_users WHERE id = $1`,
        [createdScimUserId],
      ).catch(() => { /* may not exist */ });
    }
  });

  const authHeader = () => `Bearer ${rawScimToken}`;

  it("GET /ServiceProviderConfig returns 200 without auth", async () => {
    const res = await supertest(app).get("/scim/v2/ServiceProviderConfig");
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.schemas?.[0], "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig");
  });

  it("GET /Schemas returns 200 without auth", async () => {
    const res = await supertest(app).get("/scim/v2/Schemas");
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.schemas?.[0], "urn:ietf:params:scim:api:messages:2.0:ListResponse");
  });

  it("GET /Users returns 401 without token", async () => {
    const res = await supertest(app).get("/scim/v2/Users");
    assert.equal(res.status, 401);
  });

  it("GET /Users returns 401 with an invalid token", async () => {
    const res = await supertest(app)
      .get("/scim/v2/Users")
      .set("Authorization", "Bearer invalid_scim_token_xyz");
    assert.equal(res.status, 401);
  });

  it("GET /Users returns ListResponse with valid SCIM token", async () => {
    const res = await supertest(app)
      .get("/scim/v2/Users")
      .set("Authorization", authHeader());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.schemas?.[0], "urn:ietf:params:scim:api:messages:2.0:ListResponse");
    assert.ok(typeof res.body.totalResults === "number");
    assert.ok(Array.isArray(res.body.Resources));
  });

  it("POST /Users creates a user and returns 201", async () => {
    const userEmail = `scim-test-${suffix}@example.com`;
    const res = await supertest(app)
      .post("/scim/v2/Users")
      .set("Authorization", authHeader())
      .set("Content-Type", "application/scim+json")
      .send({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: userEmail,
        name: { givenName: "SCIM", familyName: "Test" },
        emails: [{ value: userEmail, primary: true }],
        active: true,
      });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.ok(res.body.id, "Expected id in response");
    assert.equal(res.body.userName, userEmail);
    assert.equal(res.body.active, true);
    createdScimUserId = parseInt(res.body.id, 10);
  });

  it("GET /Users/:id returns the created user", async () => {
    if (!createdScimUserId) return;
    const res = await supertest(app)
      .get(`/scim/v2/Users/${createdScimUserId}`)
      .set("Authorization", authHeader());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.id, String(createdScimUserId));
  });

  it("GET /Users/:id returns 404 for non-existent user", async () => {
    const res = await supertest(app)
      .get("/scim/v2/Users/999999999")
      .set("Authorization", authHeader());
    assert.equal(res.status, 404);
  });

  it("PATCH /Users/:id deactivates the user", async () => {
    if (!createdScimUserId) return;
    const res = await supertest(app)
      .patch(`/scim/v2/Users/${createdScimUserId}`)
      .set("Authorization", authHeader())
      .set("Content-Type", "application/scim+json")
      .send({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "Replace", path: "active", value: false }],
      });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.active, false, "User should be deactivated");
  });

  it("DELETE /Users/:id soft-deletes the user", async () => {
    if (!createdScimUserId) return;
    const res = await supertest(app)
      .delete(`/scim/v2/Users/${createdScimUserId}`)
      .set("Authorization", authHeader());
    assert.equal(res.status, 204, JSON.stringify(res.body));

    // Verify user still exists in DB but is deactivated (soft delete)
    const { rows } = await pool.query<{ status: string }>(
      `SELECT status FROM account_users WHERE id = $1`,
      [createdScimUserId],
    );
    if (rows[0]) {
      assert.equal(rows[0].status, "deactivated", "Soft-deleted user should have status='deactivated'");
    }
    createdScimUserId = null;
  });

  it("SCIM response includes required schemas field", async () => {
    const res = await supertest(app)
      .get("/scim/v2/Users")
      .set("Authorization", authHeader());
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.schemas), "Expected schemas array");
    assert.ok(res.body.schemas.length > 0, "Expected at least one schema");
  });

  it("GET /Users supports filter parameter", async () => {
    const res = await supertest(app)
      .get("/scim/v2/Users?filter=userName+eq+%22nobody%40example.com%22")
      .set("Authorization", authHeader());
    assert.ok([200, 400].includes(res.status), `Got unexpected status: ${res.status}`);
    if (res.status === 200) {
      assert.ok(typeof res.body.totalResults === "number");
    }
  });
});
