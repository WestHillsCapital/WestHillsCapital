/**
 * Auth middleware unit/integration tests
 *
 * Covers:
 * 1. requireAccountId — rejects (401) when internalAccountId is missing,
 *    passes through when it is set.
 * 2. requireRole / requireAdminRole — rejects (403) requests whose role rank
 *    is below the minimum; passes for sufficient roles; bypasses for internal
 *    users (req.internalEmail set).
 * 3. requireWithinPlanLimits("seat") — returns 402 with upgrade_required: true
 *    when the active seat count meets or exceeds the account's seat_limit;
 *    passes through when under the limit.
 *
 * Test strategy
 * ─────────────
 * Middleware-only tests (1 & 2) use a minimal in-process Express app with no
 * database involved.  Plan-limits tests (3) create a throw-away test account
 * and account_user rows directly in the DB, then clean up in after().
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import supertest from "supertest";
import { Pool } from "pg";
import { requireAccountId } from "../middleware/requireAccountId.js";
import { requireRole, requireAdminRole } from "../middleware/requireRole.js";
import { requireWithinPlanLimits } from "../middleware/requireWithinPlanLimits.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function buildApp(
  setup: (req: express.Request) => void,
  ...middlewares: express.RequestHandler[]
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { setup(req); next(); });
  app.use(...middlewares);
  app.get("/probe", (_req, res) => res.json({ ok: true }));
  return app;
}

// ── 1. requireAccountId ───────────────────────────────────────────────────────

describe("requireAccountId", () => {
  it("returns 401 when internalAccountId is undefined", async () => {
    const app = buildApp((_req) => {}, requireAccountId);
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    assert.ok(res.body.error, "Expected an error message");
  });

  it("returns 401 when internalAccountId is null", async () => {
    const app = buildApp((req) => { req.internalAccountId = null as unknown as number; }, requireAccountId);
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  });

  it("passes through when internalAccountId is set to a valid number", async () => {
    const app = buildApp((req) => { req.internalAccountId = 42; }, requireAccountId);
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    assert.deepEqual(res.body, { ok: true });
  });
});

// ── 2. requireRole / requireAdminRole ─────────────────────────────────────────

describe("requireAdminRole", () => {
  it("returns 403 when productUserRole is 'member'", async () => {
    const app = buildApp(
      (req) => { req.internalAccountId = 1; req.productUserRole = "member"; },
      requireAdminRole,
    );
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
    assert.ok(res.body.error, "Expected error message");
  });

  it("returns 403 when productUserRole is 'readonly'", async () => {
    const app = buildApp(
      (req) => { req.internalAccountId = 1; req.productUserRole = "readonly"; },
      requireAdminRole,
    );
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
  });

  it("returns 403 when productUserRole is absent (defaults to member rank)", async () => {
    const app = buildApp(
      (req) => { req.internalAccountId = 1; },
      requireAdminRole,
    );
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
  });

  it("passes through when productUserRole is 'admin'", async () => {
    const app = buildApp(
      (req) => { req.internalAccountId = 1; req.productUserRole = "admin"; },
      requireAdminRole,
    );
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  });

  it("bypasses role check for internal users (internalEmail is set)", async () => {
    const app = buildApp(
      (req) => {
        req.internalAccountId = 1;
        req.productUserRole   = "readonly";
        req.internalEmail     = "ops@internal.example.com";
      },
      requireAdminRole,
    );
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 200, "Internal users must bypass role enforcement");
  });
});

describe("requireRole('member')", () => {
  it("returns 403 when productUserRole is 'readonly'", async () => {
    const app = buildApp(
      (req) => { req.internalAccountId = 1; req.productUserRole = "readonly"; },
      requireRole("member"),
    );
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
  });

  it("passes through for 'member' role", async () => {
    const app = buildApp(
      (req) => { req.internalAccountId = 1; req.productUserRole = "member"; },
      requireRole("member"),
    );
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  });

  it("passes through for 'admin' role (higher rank)", async () => {
    const app = buildApp(
      (req) => { req.internalAccountId = 1; req.productUserRole = "admin"; },
      requireRole("member"),
    );
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  });
});

// ── 3. requireWithinPlanLimits("seat") ────────────────────────────────────────

describe("requireWithinPlanLimits(seat)", () => {
  let pool: Pool;
  let atLimitAccountId: number;
  let underLimitAccountId: number;
  let activeUserId: number;

  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL must be set to run plan-limits tests");
    pool = new Pool({ connectionString: url, max: 3 });

    const suffix = Date.now().toString(36);

    // Account A — seat_limit = 1, will have 1 active seat (at limit)
    const { rows: [rowA] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug, seat_limit)
       VALUES ($1, $2, 1) RETURNING id`,
      [`_Test PlanLimits AtLimit ${suffix}`, `_test-plan-atlimit-${suffix}`],
    );
    atLimitAccountId = rowA.id;

    // Insert one active (non-pending) user so count = 1 = seat_limit
    const { rows: [userRow] } = await pool.query<{ id: number }>(
      `INSERT INTO account_users (account_id, email, role, status)
       VALUES ($1, $2, 'member', 'active') RETURNING id`,
      [atLimitAccountId, `_test-seat-user-${suffix}@example.com`],
    );
    activeUserId = userRow.id;

    // Account B — seat_limit = 5, has 1 active seat (under limit)
    const { rows: [rowB] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug, seat_limit)
       VALUES ($1, $2, 5) RETURNING id`,
      [`_Test PlanLimits UnderLimit ${suffix}`, `_test-plan-underlimit-${suffix}`],
    );
    underLimitAccountId = rowB.id;

    await pool.query(
      `INSERT INTO account_users (account_id, email, role, status)
       VALUES ($1, $2, 'member', 'active')`,
      [underLimitAccountId, `_test-seat-under-${suffix}@example.com`],
    );
  });

  after(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM account_users WHERE account_id IN ($1, $2)`, [atLimitAccountId, underLimitAccountId]);
    await pool.query(`DELETE FROM accounts WHERE id IN ($1, $2)`, [atLimitAccountId, underLimitAccountId]);
    await pool.end();
  });

  it("returns 402 with upgrade_required when at the seat limit", async () => {
    const app = buildApp(
      (req) => { req.internalAccountId = atLimitAccountId; req.productUserRole = "admin"; },
      requireWithinPlanLimits("seat") as express.RequestHandler,
    );
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 402, `Expected 402, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.upgrade_required, true, "Expected upgrade_required: true");
    assert.equal(res.body.limit_type, "seats", "Expected limit_type: seats");
  });

  it("passes through when under the seat limit", async () => {
    const app = buildApp(
      (req) => { req.internalAccountId = underLimitAccountId; req.productUserRole = "admin"; },
      requireWithinPlanLimits("seat") as express.RequestHandler,
    );
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  it("bypasses limits for internal users (internalEmail set)", async () => {
    const app = buildApp(
      (req) => {
        req.internalAccountId = atLimitAccountId;
        req.internalEmail     = "ops@internal.example.com";
      },
      requireWithinPlanLimits("seat") as express.RequestHandler,
    );
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 200, "Internal users must bypass plan limits");
  });

  it("returns 401 when internalAccountId is missing", async () => {
    const app = buildApp(
      (_req) => {},
      requireWithinPlanLimits("seat") as express.RequestHandler,
    );
    const res = await supertest(app).get("/probe");
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  });
});
