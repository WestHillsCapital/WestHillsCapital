/**
 * Settings route integration tests
 *
 * Covers the highest-risk paths in src/routes/settings.ts:
 * 1. PATCH /org — admin succeeds (200); member is rejected (403).
 * 2. GET  /billing — returns expected billing shape fields.
 * 3. POST /team/invite — blocked with 402 when the account is at its seat limit.
 * 4. PATCH /team/:id/role — admin can change a team member's role.
 *
 * Test strategy
 * ─────────────
 * One throw-away account is created directly in the DB with seat_limit = 1.
 * Two test apps share the same account ID but inject different productUserRole
 * values to simulate an admin and a member hitting the same endpoints.
 * Clerk's getAuth() is neutralised by writing a null auth stub onto each
 * request so the route's `?.userId ?? null` pattern resolves safely.
 * All test data is cleaned up in after().
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
    // @clerk/express getAuth() calls req.auth() as a function — provide a no-op
    // stub so route handlers that call getAuth(req)?.userId work safely.
    (req as unknown as Record<string, unknown>).auth = () => NULL_AUTH;
    next();
  });
  app.use("/", settingsRouter);
  return app;
}

// ── test suite ────────────────────────────────────────────────────────────────

describe("Settings routes", () => {
  let pool: Pool;
  let testAccountId: number;
  let testMemberId: number;
  let adminApp: ReturnType<typeof buildApp>;
  let memberApp: ReturnType<typeof buildApp>;

  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL must be set to run settings tests");
    pool = new Pool({ connectionString: url, max: 5 });

    const suffix = Date.now().toString(36);

    // Create one test account with seat_limit = 1 so the invite endpoint hits
    // the limit as soon as there is one active seat.
    const { rows: [acct] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug, seat_limit)
       VALUES ($1, $2, 1) RETURNING id`,
      [`_Test Settings ${suffix}`, `_test-settings-${suffix}`],
    );
    testAccountId = acct.id;

    // Seed one active member (fills the one available seat)
    const { rows: [member] } = await pool.query<{ id: number }>(
      `INSERT INTO account_users (account_id, email, role, status)
       VALUES ($1, $2, 'member', 'active') RETURNING id`,
      [testAccountId, `_test-settings-member-${suffix}@example.com`],
    );
    testMemberId = member.id;

    // Seed a second user (pending — does not count toward the seat limit) whose
    // role will be changed in test 4.
    await pool.query(
      `INSERT INTO account_users (account_id, email, role, status)
       VALUES ($1, $2, 'member', 'pending')`,
      [testAccountId, `_test-settings-pending-${suffix}@example.com`],
    );

    adminApp  = buildApp(testAccountId, "admin");
    memberApp = buildApp(testAccountId, "member");
  });

  after(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM account_users WHERE account_id = $1`, [testAccountId]);
    await pool.query(`DELETE FROM accounts WHERE id = $1`, [testAccountId]);
    await pool.end();
  });

  // ── PATCH /org ──────────────────────────────────────────────────────────────

  describe("PATCH /org", () => {
    it("admin can update org name (200)", async () => {
      const res = await supertest(adminApp)
        .patch("/org")
        .send({ name: "Updated Test Org" });
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      // Response shape is { org: { name, ... } }
      assert.equal(res.body.org?.name, "Updated Test Org", "Response should include updated org name");
    });

    it("member is rejected with 403", async () => {
      const res = await supertest(memberApp)
        .patch("/org")
        .send({ name: "Should Not Update" });
      assert.equal(res.status, 403, `Expected 403, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.error, "Expected error message");
    });
  });

  // ── GET /billing ────────────────────────────────────────────────────────────

  describe("GET /billing", () => {
    it("returns a billing object with the expected shape", async () => {
      const res = await supertest(adminApp).get("/billing");
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

      const { billing } = res.body as { billing: Record<string, unknown> };
      assert.ok(billing,                              "Response must include a billing key");
      assert.ok("plan_tier" in billing,               "billing must include plan_tier");
      assert.ok("limits"    in billing,               "billing must include limits");
      assert.ok("usage"     in billing,               "billing must include usage");

      const limits = billing.limits as Record<string, unknown>;
      assert.ok("max_seats" in limits,                "limits must include max_seats");
      assert.ok("max_packages" in limits,             "limits must include max_packages");
      assert.ok("max_submissions_per_month" in limits,"limits must include max_submissions_per_month");

      const usage = billing.usage as Record<string, unknown>;
      assert.ok("seats"       in usage,               "usage must include seats");
      assert.ok("packages"    in usage,               "usage must include packages");
      assert.ok("submissions" in usage,               "usage must include submissions");
    });
  });

  // ── POST /team/invite ───────────────────────────────────────────────────────

  describe("POST /team/invite", () => {
    it("returns 402 upgrade_required when account is at its seat limit", async () => {
      const res = await supertest(adminApp)
        .post("/team/invite")
        .send({ email: "new-invite@example.com", role: "member" });

      assert.equal(res.status, 402, `Expected 402, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.upgrade_required, true, "Expected upgrade_required: true");
      assert.equal(res.body.limit_type, "seats",    "Expected limit_type: seats");
    });

    it("returns 403 when a member tries to invite", async () => {
      const res = await supertest(memberApp)
        .post("/team/invite")
        .send({ email: "new-invite@example.com", role: "member" });

      assert.equal(res.status, 403, `Expected 403, got ${res.status}: ${JSON.stringify(res.body)}`);
    });
  });

  // ── PATCH /team/:id/role ────────────────────────────────────────────────────

  describe("PATCH /team/:id/role", () => {
    it("admin can change a member's role to readonly", async () => {
      const res = await supertest(adminApp)
        .patch(`/team/${testMemberId}/role`)
        .send({ role: "readonly" });

      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      const member = res.body.member as Record<string, unknown>;
      assert.equal(member.role, "readonly", "Role should have been updated to readonly");
    });

    it("returns 404 for a team member that does not exist", async () => {
      const res = await supertest(adminApp)
        .patch("/team/999999999/role")
        .send({ role: "member" });

      assert.equal(res.status, 404, `Expected 404, got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("member cannot change a team member's role (403)", async () => {
      const res = await supertest(memberApp)
        .patch(`/team/${testMemberId}/role`)
        .send({ role: "admin" });

      assert.equal(res.status, 403, `Expected 403, got ${res.status}: ${JSON.stringify(res.body)}`);
    });
  });
});
