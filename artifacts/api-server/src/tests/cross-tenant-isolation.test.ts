/**
 * Cross-tenant data isolation integration tests
 *
 * Verifies that a fully-authenticated request carrying Account B's credentials
 * cannot read, modify, or delete resources owned by Account A.
 * All cross-account responses must be 404 (never 403) so the existence of the
 * resource is not revealed to the requesting tenant.
 *
 * Test strategy
 * ─────────────
 * 1. Two throw-away accounts (A, B) are created directly in the DB.
 * 2. A package, a seeded PDF document, and a session are created under Account A.
 * 3. A minimal Express app mounts the docufill router with a simple middleware
 *    that injects req.internalAccountId — exactly what the real auth middleware
 *    does after token validation.  Auth logic itself is tested separately.
 * 4. Account B's app makes requests against Account A's real resource IDs / tokens.
 * 5. All cross-tenant attempts must return 404.
 * 6. Verify Account A can still access its own resources (no false positives).
 * 7. Test data is cleaned up in `after()`.
 *
 * Note on the PDF document seed
 * ──────────────────────────────
 * Using real (existing) document IDs for Account B's cross-tenant requests is
 * important: with a nonexistent document ID a 404 would be returned regardless
 * of whether account scoping is enforced, masking a regression.  By seeding an
 * actual document under Account A and then confirming Account A can read it (200)
 * while Account B cannot (404), the tests verify that the 404 is caused by
 * account scoping, not by an absent document.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import supertest from "supertest";
import express from "express";
import { Pool } from "pg";
import docufillRouter from "../routes/docufill.js";

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj " +
  "2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj " +
  "3 0 obj<</Type /Page /MediaBox [0 0 612 792] /Parent 2 0 R>>endobj\n" +
  "xref\n0 4\n0000000000 65535 f \n" +
  "trailer<</Size 4 /Root 1 0 R>>\nstartxref\n9\n%%EOF\n",
  "ascii",
);

function buildTestApp(accountId: number) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.internalAccountId = accountId;
    req.productUserRole = "admin";
    next();
  });
  app.use("/", docufillRouter);
  return app;
}

describe("Cross-tenant data isolation", () => {
  let pool: Pool;
  let accountAId: number;
  let accountBId: number;
  let packageAId: number;
  let documentAId: string;
  let sessionAToken: string;
  let appA: ReturnType<typeof buildTestApp>;
  let appB: ReturnType<typeof buildTestApp>;

  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) {
      throw new Error("DATABASE_URL must be set to run cross-tenant isolation tests");
    }
    pool = new Pool({ connectionString: url, max: 5 });

    const suffix = Date.now().toString(36);

    const { rows: [rowA] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug)
       VALUES ($1, $2)
       RETURNING id`,
      [`_Test Tenant A ${suffix}`, `_test-isolation-a-${suffix}`],
    );
    const { rows: [rowB] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug)
       VALUES ($1, $2)
       RETURNING id`,
      [`_Test Tenant B ${suffix}`, `_test-isolation-b-${suffix}`],
    );

    accountAId = rowA.id;
    accountBId = rowB.id;

    appA = buildTestApp(accountAId);
    appB = buildTestApp(accountBId);

    // Seed a document ID for Account A's package
    documentAId = `doc-a-${suffix}`;

    // Create package with one stored document in its documents JSON
    const { rows: [pkgRow] } = await pool.query<{ id: number }>(
      `INSERT INTO docufill_packages
         (name, account_id, status, transaction_scope, documents, webhook_secret)
       VALUES ('Package A', $1, 'active', 'ira_transfer', $2::jsonb, $3)
       RETURNING id`,
      [
        accountAId,
        JSON.stringify([{
          id: documentAId,
          title: "Test Document",
          pages: 1,
          fileName: "test.pdf",
          pdfStored: true,
        }]),
        randomBytes(32).toString("hex"),
      ],
    );
    packageAId = pkgRow.id;

    // Insert the actual PDF binary so the GET /packages/:id/documents/:docId.pdf route can serve it
    await pool.query(
      `INSERT INTO docufill_package_documents
         (package_id, document_id, filename, content_type, byte_size, page_count, pdf_data)
       VALUES ($1, $2, 'test.pdf', 'application/pdf', $3, 1, $4)`,
      [packageAId, documentAId, MINIMAL_PDF.length, MINIMAL_PDF],
    );

    sessionAToken = `_test_iso_${suffix}`;
    await pool.query(
      `INSERT INTO docufill_interview_sessions
         (token, package_id, package_version, transaction_scope, source, status, prefill, answers, expires_at, account_id)
       VALUES ($1, $2, 1, 'ira_transfer', 'test', 'draft', '{}', '{}', NOW() + INTERVAL '90 days', $3)`,
      [sessionAToken, packageAId, accountAId],
    );
  });

  after(async () => {
    if (!pool) return;
    // Cascade deletes handle docufill_package_documents when the package is deleted
    await pool.query(
      `DELETE FROM docufill_interview_sessions WHERE token = $1`,
      [sessionAToken],
    );
    await pool.query(
      `DELETE FROM docufill_packages WHERE id = $1`,
      [packageAId],
    );
    await pool.query(
      `DELETE FROM accounts WHERE id IN ($1, $2)`,
      [accountAId, accountBId],
    );
    await pool.end();
  });

  describe("Bootstrap / package listing", () => {
    it("account A sees its own package in bootstrap", async () => {
      const res = await supertest(appA).get("/bootstrap");
      assert.equal(res.status, 200);
      const pkgs = res.body.packages as Array<{ id: number }>;
      assert.ok(
        pkgs.some((p) => p.id === packageAId),
        `Expected Account A's bootstrap to include package ${packageAId}`,
      );
    });

    it("account B does NOT see account A's package in bootstrap", async () => {
      const res = await supertest(appB).get("/bootstrap");
      assert.equal(res.status, 200);
      const pkgs = res.body.packages as Array<{ id: number }>;
      assert.ok(
        !pkgs.some((p) => p.id === packageAId),
        "Account B's bootstrap must not expose Account A's package",
      );
    });
  });

  describe("Package mutation isolation", () => {
    it("account B PATCH on account A's package → 404", async () => {
      const res = await supertest(appB)
        .patch(`/packages/${packageAId}`)
        .send({ name: "Hijacked by Tenant B" });
      assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("account A can still PATCH its own package", async () => {
      const res = await supertest(appA)
        .patch(`/packages/${packageAId}`)
        .send({ name: "Package A (updated)" });
      assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("account B DELETE on account A's package → 404", async () => {
      const res = await supertest(appB).delete(`/packages/${packageAId}`);
      assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("account B POST test-webhook on account A's package → 404", async () => {
      const res = await supertest(appB).post(`/packages/${packageAId}/test-webhook`);
      assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });
  });

  describe("PDF document isolation", () => {
    it("account A can read its own PDF document (baseline)", async () => {
      const res = await supertest(appA)
        .get(`/packages/${packageAId}/documents/${documentAId}.pdf`);
      assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(
        res.headers["content-type"]?.includes("application/pdf"),
        "Expected PDF content-type",
      );
    });

    it("account B GET on account A's real PDF document → 404", async () => {
      const res = await supertest(appB)
        .get(`/packages/${packageAId}/documents/${documentAId}.pdf`);
      assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("account B PUT on account A's real document → 404", async () => {
      // readPdfBody validates the PDF header before the package ownership check,
      // so we send a structurally-valid PDF buffer to ensure the 404 is caused
      // by account scoping, not by the PDF header check.
      const res = await supertest(appB)
        .put(`/packages/${packageAId}/documents/${documentAId}/pdf`)
        .set("Content-Type", "application/pdf")
        .send(MINIMAL_PDF);
      assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("account B DELETE on account A's real document → 404", async () => {
      const res = await supertest(appB)
        .delete(`/packages/${packageAId}/documents/${documentAId}`);
      assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });
  });

  describe("Webhook deliveries isolation", () => {
    it("account A can read its own webhook deliveries (returns array, max 10)", async () => {
      const res = await supertest(appA).get(`/packages/${packageAId}/webhook-deliveries`);
      assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(Array.isArray(res.body.deliveries), "Expected deliveries array");
      assert.ok(res.body.deliveries.length <= 10, `Expected at most 10 deliveries, got ${res.body.deliveries.length}`);
    });

    it("account B GET on account A's webhook deliveries → 404", async () => {
      const res = await supertest(appB).get(`/packages/${packageAId}/webhook-deliveries`);
      assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });
  });

  describe("Session isolation", () => {
    it("account A can read its own session", async () => {
      const res = await supertest(appA).get(`/sessions/${sessionAToken}`);
      assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("account B GET on account A's session → 404", async () => {
      const res = await supertest(appB).get(`/sessions/${sessionAToken}`);
      assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("account B PATCH on account A's session → 404", async () => {
      const res = await supertest(appB)
        .patch(`/sessions/${sessionAToken}`)
        .send({ answers: { hijack: true } });
      assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("account B POST generate on account A's session → 404", async () => {
      const res = await supertest(appB)
        .post(`/sessions/${sessionAToken}/generate`)
        .send({});
      assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("account B GET packet PDF for account A's session → 404", async () => {
      const res = await supertest(appB)
        .get(`/sessions/${sessionAToken}/packet.pdf`);
      assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });
  });
});
