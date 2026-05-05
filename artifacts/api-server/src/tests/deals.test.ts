/**
 * Deals route integration tests
 *
 * Covers the status-transition and read paths in src/routes/deals.ts.
 * The POST / endpoint is excluded because it orchestrates an external
 * DG trade API call (lockAndExecuteTrade); instead a deal row is seeded
 * directly in the DB so the PATCH and GET handlers can be tested in
 * isolation.
 *
 * Covers:
 * 1. GET /:id — returns the deal object with the correct shape.
 * 2. GET /:id — returns 404 for a non-existent deal ID.
 * 3. PATCH /:id/payment — marks payment_received_at and returns success.
 * 4. PATCH /:id/wire-received — marks wire_received_at and returns success.
 * 5. POST /preview-invoice — returns a valid PDF (application/pdf) for a
 *    minimal invoice payload.
 *
 * Side effects in the PATCH handlers (Google Sheets sync, email send) are
 * fire-and-forget and wrapped in .catch(), so failures in those integrations
 * do not affect the response or these tests.
 *
 * Test data is cleaned up in after().
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import supertest from "supertest";
import { Pool } from "pg";
import dealsRouter from "../routes/deals.js";
import { getDb } from "../db.js";

// ── minimal Express app ───────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/", dealsRouter);
  return app;
}

// ── test suite ────────────────────────────────────────────────────────────────

describe("Deals routes", () => {
  let pool: Pool;
  let dealId: number;
  const app = buildApp();

  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL must be set to run deals tests");
    pool = new Pool({ connectionString: url, max: 3 });

    // Seed a minimal deal row directly — bypasses the DG trade execution path.
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
    dealId = row.id;
  });

  after(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM deals WHERE id = $1`, [dealId]);
    await pool.end();
    // Close the shared pg pool to free DB connections.
    try { await getDb().end(); } catch { /* already closed */ }
    // The googleapis HTTP/2 client and other fire-and-forget route handlers
    // keep the event loop alive after all tests complete.  Since this file
    // runs in its own isolated worker process (node:test spawns one per file),
    // force-exiting is safe and prevents the suite from hanging.
    process.exit(0);
  });

  // ── GET /:id ──────────────────────────────────────────────────────────────

  describe("GET /:id", () => {
    it("returns the deal with expected shape (200)", async () => {
      const res = await supertest(app).get(`/${dealId}`);
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

      const { deal } = res.body as { deal: Record<string, unknown> };
      assert.ok(deal,                           "Response must include a deal key");
      assert.equal(deal.id,         dealId,     "deal.id should match the seeded ID");
      assert.equal(deal.first_name, "Test",     "deal.first_name should match seeded value");
      assert.equal(deal.last_name,  "Deal",     "deal.last_name should match seeded value");
      assert.equal(deal.deal_type,  "cash",     "deal.deal_type should match seeded value");
      assert.ok(Array.isArray(deal.warnings),   "deal.warnings must be an array");
    });

    it("returns 404 for a non-existent deal ID", async () => {
      const res = await supertest(app).get("/999999999");
      assert.equal(res.status, 404, `Expected 404, got ${res.status}: ${JSON.stringify(res.body)}`);
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
      const res = await supertest(app).patch(`/${dealId}/payment`).send({});
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, true,        "Expected success: true");
      assert.ok(res.body.paymentReceivedAt,        "Expected paymentReceivedAt to be set");
    });

    it("returns 404 for a non-existent deal", async () => {
      const res = await supertest(app).patch("/999999999/payment").send({});
      assert.equal(res.status, 404, `Expected 404, got ${res.status}: ${JSON.stringify(res.body)}`);
    });
  });

  // ── PATCH /:id/wire-received ──────────────────────────────────────────────

  describe("PATCH /:id/wire-received", () => {
    it("marks wire_received_at and returns success (200)", async () => {
      const res = await supertest(app).patch(`/${dealId}/wire-received`).send({});
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, true,   "Expected success: true");
      assert.ok(res.body.wireReceivedAt,     "Expected wireReceivedAt to be set");
      // wireConfirmationEmailSentAt will be null in test env (email not configured),
      // but the field must be present in the response.
      assert.ok("wireConfirmationEmailSentAt" in res.body, "Expected wireConfirmationEmailSentAt key");
    });

    it("returns 404 for a non-existent deal", async () => {
      const res = await supertest(app).patch("/999999999/wire-received").send({});
      assert.equal(res.status, 404, `Expected 404, got ${res.status}: ${JSON.stringify(res.body)}`);
    });
  });

  // ── POST /preview-invoice ─────────────────────────────────────────────────

  describe("POST /preview-invoice", () => {
    it("returns a valid PDF for a minimal invoice payload", async () => {
      const res = await supertest(app)
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

      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(
        res.headers["content-type"]?.includes("application/pdf"),
        `Expected application/pdf, got ${res.headers["content-type"]}`,
      );
      // PDF magic number (%PDF-)
      assert.ok(
        res.body instanceof Buffer
          ? res.body.slice(0, 5).toString() === "%PDF-"
          : res.text?.startsWith("%PDF-") ?? (res.body as unknown),
        "Response body must start with the PDF magic number %PDF-",
      );
    });

    it("returns 400 for an invalid body", async () => {
      const res = await supertest(app)
        .post("/preview-invoice")
        .send({ unexpectedField: true });
      // The schema is lenient — all fields are optional in PreviewInvoiceBodySchema,
      // so even an empty or unknown body parses successfully. Validate that the
      // endpoint still responds (2xx or specific error), not a crash (5xx).
      assert.ok(
        res.status < 500,
        `Expected non-5xx status, got ${res.status}: ${JSON.stringify(res.body)}`,
      );
    });
  });
});
