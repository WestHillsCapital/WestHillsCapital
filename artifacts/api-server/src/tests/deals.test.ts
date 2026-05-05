/**
 * Deals route integration tests
 *
 * Covers the creation, status-transition, and read paths in
 * src/routes/deals.ts.
 *
 * Test strategy
 * ─────────────
 * The POST / test sends a product whose ID has no DG code mapping.
 * lockAndExecuteTrade then throws locally ("No mappable DG product codes")
 * before making any network call, which triggers the 502 error path.  The
 * 502 response includes the `dealId` of the DB row that was persisted before
 * the DG call, proving the creation logic works up to and including the DB
 * write — the most critical part of POST /.
 *
 * Open-handle note
 * ────────────────
 * Fire-and-forget route handlers (syncDealStatus, updateOperationsMilestone)
 * can open persistent googleapis HTTP/2 connections that outlive the test.
 * The test runner is invoked with --test-force-exit so it tears these down
 * automatically after all suites complete — the correct Node.js 24 mechanism
 * for this pattern (equivalent to Jest's --forceExit).
 *
 * Cross-tenant note
 * ─────────────────
 * West Hills Capital deals are an internal, single-tenant tool: every
 * authenticated WHC operator can see every deal by design (no account-level
 * scoping).  This is intentionally different from the Docuplete SaaS where
 * strict per-account isolation is enforced.  A test is included below that
 * documents this behaviour.
 *
 * All test data is cleaned up in after().
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import supertest from "supertest";
import { Pool } from "pg";
import dealsRouter from "../routes/deals.js";
import { getDb } from "../db.js";

// ── App builder ───────────────────────────────────────────────────────────────

function buildApp(internalEmail?: string): express.Express {
  const app = express();
  app.use(express.json());
  if (internalEmail) {
    // Setting internalEmail makes the rate-limiter use the email as the key
    // instead of req.ip, preventing cross-test rate-limit interference.
    app.use((req, _res, next) => {
      (req as unknown as Record<string, unknown>).internalEmail = internalEmail;
      next();
    });
  }
  app.use("/", dealsRouter);
  return app;
}

// ── Valid deal body (passes all body validation) ──────────────────────────────
//
// productId "_TEST_UNKNOWN" has no entry in fiztrade's DG_CODE map, so
// lockAndExecuteTrade throws locally ("No mappable DG product codes") before
// making any network call.  This triggers the 502 error path, which includes
// the persisted dealId proving the DB write succeeded.

const VALID_DEAL_BODY = {
  firstName:          "Integration",
  lastName:           "Test",
  email:              "_testdeal-post@example.com",
  dealType:           "cash",
  shippingMethod:     "fedex_hold",
  products: [{
    productId:   "_TEST_UNKNOWN",
    productName: "Test Product",
    metal:       "gold",
    qty:         1,
    unitPrice:   1000,
    lineTotal:   1000,
  }],
  total:              1000,
  termsProvided:      true,
  termsVersion:       "v1.0",
  confirmationMethod: "verbal_recorded_call",
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe("Deals routes", () => {
  let pool: Pool;
  let seededDealId: number;
  const createdDealIds: number[] = [];
  const app        = buildApp("_test-operator@example.com");
  const previewApp = buildApp();

  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL must be set to run deals tests");
    pool = new Pool({ connectionString: url, max: 3 });

    // Seed a minimal deal row directly — used by the GET and PATCH tests.
    const { rows: [row] } = await pool.query<{ id: number }>(
      `INSERT INTO deals
         (first_name, last_name, email, deal_type,
          products, total,
          terms_provided, terms_version, confirmation_method,
          status, locked_at)
       VALUES
         ('Test', 'Deal', '_testdeal@example.com', 'cash',
          '[]'::jsonb, 1000.00,
          true, 'v1.0', 'verbal_recorded_call',
          'locked', NOW())
       RETURNING id`,
    );
    seededDealId = row.id;
  });

  after(async () => {
    if (!pool) return;
    const allIds = [seededDealId, ...createdDealIds].filter(Boolean);
    if (allIds.length > 0) {
      await pool.query(
        `DELETE FROM deals WHERE id = ANY($1::int[])`,
        [allIds],
      );
    }
    await pool.end();
    // Close the shared getDb pool used by the route handlers.
    try { await getDb().end(); } catch { /* already closed */ }
    // Note: fire-and-forget handlers (syncDealStatus, google-sheets) may have
    // opened persistent HTTP/2 connections that outlive this hook.  The test
    // runner is started with --test-force-exit (see package.json) to tear
    // them down cleanly after all suites complete.
  });

  // ── POST / — deal creation ────────────────────────────────────────────────

  describe("POST /", () => {
    it("saves the deal to DB and returns 502 when DG product has no code mapping", async () => {
      const res = await supertest(app)
        .post("/")
        .send(VALID_DEAL_BODY);

      // DG execution fails locally (unknown product ID → no DG code to map),
      // but the deal is committed to the DB before the DG call.
      assert.equal(
        res.status, 502,
        `Expected 502, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
      assert.ok(
        typeof res.body.dealId === "number",
        "Response must include a numeric dealId (deal was persisted to DB)",
      );
      assert.ok(res.body.error,   "Response must include an error message");
      assert.ok(res.body.details, "Response must include details about the DG failure");

      // Track for cleanup
      if (res.body.dealId) createdDealIds.push(res.body.dealId as number);
    });

    it("returns 400 for an invalid body (missing required fields)", async () => {
      const res = await supertest(app)
        .post("/")
        .send({ firstName: "Incomplete" });

      assert.equal(
        res.status, 400,
        `Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
      assert.ok(res.body.error, "Expected error message");
    });

    it("returns 400 when termsProvided is not true", async () => {
      const res = await supertest(app)
        .post("/")
        .send({ ...VALID_DEAL_BODY, termsProvided: false });

      assert.equal(
        res.status, 400,
        `Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
    });

    it("returns 400 when products array is empty", async () => {
      const res = await supertest(app)
        .post("/")
        .send({ ...VALID_DEAL_BODY, products: [] });

      assert.equal(
        res.status, 400,
        `Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
    });
  });

  // ── GET /:id ──────────────────────────────────────────────────────────────

  describe("GET /:id", () => {
    it("returns the deal with expected shape (200)", async () => {
      const res = await supertest(app).get(`/${seededDealId}`);
      assert.equal(
        res.status, 200,
        `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`,
      );

      const { deal } = res.body as { deal: Record<string, unknown> };
      assert.ok(deal,                             "Response must include a deal key");
      assert.equal(deal.id,         seededDealId, "deal.id should match the seeded ID");
      assert.equal(deal.first_name, "Test",       "deal.first_name should match seeded value");
      assert.equal(deal.deal_type,  "cash",       "deal.deal_type should match seeded value");
      assert.ok(Array.isArray(deal.warnings),     "deal.warnings must be an array");
    });

    it("deals are not account-scoped (WHC single-tenant design — any caller sees any deal)", async () => {
      // WHC deals are an internal tool: every operator can access every deal.
      // This test documents the intentional design choice; it is NOT a bug.
      // Compare with Docuplete sessions which ARE account-scoped.
      const res = await supertest(app).get(`/${seededDealId}`);
      assert.equal(
        res.status, 200,
        "Deal must be accessible without account-level scoping (WHC internal single-tenant tool)",
      );
    });

    it("returns 404 for a non-existent deal ID", async () => {
      const res = await supertest(app).get("/999999999");
      assert.equal(
        res.status, 404,
        `Expected 404, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
      assert.ok(res.body.error, "Expected error message");
    });

    it("returns 400 for a non-numeric deal ID", async () => {
      const res = await supertest(app).get("/not-a-number");
      assert.equal(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    });
  });

  // ── PATCH /:id/payment ────────────────────────────────────────────────────

  describe("PATCH /:id/payment", () => {
    it("marks payment_received_at and returns success (200)", async () => {
      const res = await supertest(app).patch(`/${seededDealId}/payment`).send({});
      assert.equal(
        res.status, 200,
        `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
      assert.equal(res.body.success, true, "Expected success: true");
      assert.ok(res.body.paymentReceivedAt,      "Expected paymentReceivedAt to be set");
    });

    it("returns 404 for a non-existent deal", async () => {
      const res = await supertest(app).patch("/999999999/payment").send({});
      assert.equal(
        res.status, 404,
        `Expected 404, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
    });
  });

  // ── PATCH /:id/wire-received ──────────────────────────────────────────────

  describe("PATCH /:id/wire-received", () => {
    it("marks wire_received_at and returns success (200)", async () => {
      const res = await supertest(app).patch(`/${seededDealId}/wire-received`).send({});
      assert.equal(
        res.status, 200,
        `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
      assert.equal(res.body.success, true, "Expected success: true");
      assert.ok(res.body.wireReceivedAt,         "Expected wireReceivedAt to be set");
      // wireConfirmationEmailSentAt will be null in test env (RESEND_API_KEY
      // not configured), but the field must always be present in the response.
      assert.ok(
        "wireConfirmationEmailSentAt" in res.body,
        "Expected wireConfirmationEmailSentAt key",
      );
    });

    it("returns 404 for a non-existent deal", async () => {
      const res = await supertest(app).patch("/999999999/wire-received").send({});
      assert.equal(
        res.status, 404,
        `Expected 404, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
    });
  });

  // ── POST /preview-invoice ─────────────────────────────────────────────────

  describe("POST /preview-invoice", () => {
    it("returns a valid PDF for a minimal invoice payload", async () => {
      const res = await supertest(previewApp)
        .post("/preview-invoice")
        .send({
          firstName: "Preview",
          lastName:  "Client",
          email:     "preview@example.com",
          dealType:  "cash",
          products:  [],
          subtotal:  0,
          shipping:  0,
          total:     0,
        });

      assert.equal(
        res.status, 200,
        `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
      assert.ok(
        res.headers["content-type"]?.includes("application/pdf"),
        `Expected application/pdf, got ${res.headers["content-type"]}`,
      );
      // PDF magic number (%PDF-) — body is a Buffer for binary responses.
      const buf = Buffer.isBuffer(res.body)
        ? res.body
        : Buffer.from(res.body as ArrayBuffer);
      assert.ok(
        buf.slice(0, 5).toString("ascii") === "%PDF-",
        `Response body must start with %PDF- (got: ${buf.slice(0, 5).toString("ascii")})`,
      );
    });
  });
});
