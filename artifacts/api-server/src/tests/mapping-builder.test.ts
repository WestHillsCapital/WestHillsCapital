/**
 * Mapping builder integration tests
 *
 * Verifies that PATCH /packages/:id correctly saves MappingItem arrays to the
 * database and GET /packages/:id returns them faithfully, and that cross-tenant
 * write attempts are rejected with 404.
 *
 * Test strategy
 * ─────────────
 * 1. Two throw-away accounts (A, B) are created in the DB.
 * 2. Account A owns a package with pre-defined fields and a document reference.
 * 3. The internal docupleteRouter is mounted on a minimal Express app with
 *    auth bypassed via req.internalAccountId injection — exactly the same
 *    pattern as cross-tenant-isolation.test.ts.
 * 4. All test data is cleaned up in after().
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import supertest from "supertest";
import express from "express";
import { Pool } from "pg";
import docupleteRouter from "../routes/docuplete.js";
import { initDb } from "../db.js";

function buildTestApp(accountId: number) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.internalAccountId = accountId;
    req.productUserRole   = "admin";
    next();
  });
  app.use("/", docupleteRouter);
  return app;
}

describe("Mapping builder – PATCH / GET round-trip and cross-tenant isolation", () => {
  let pool:       Pool;
  let accountAId: number;
  let accountBId: number;
  let packageId:  number;
  let documentId: string;
  let appA: ReturnType<typeof buildTestApp>;
  let appB: ReturnType<typeof buildTestApp>;

  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL must be set");
    await initDb();
    pool = new Pool({ connectionString: url, max: 5 });

    const suffix = `${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
    documentId = `doc-mb-${suffix}`;

    const { rows: [acctA] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug) VALUES ($1, $2) RETURNING id`,
      [`_Test MappingA ${suffix}`, `_test-mapping-a-${suffix}`],
    );
    accountAId = acctA.id;

    const { rows: [acctB] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug) VALUES ($1, $2) RETURNING id`,
      [`_Test MappingB ${suffix}`, `_test-mapping-b-${suffix}`],
    );
    accountBId = acctB.id;

    const docList  = [{ id: documentId, title: "Test.pdf", pages: 1, fileName: "test.pdf", pdfStored: false }];
    const fields   = [
      { id: "f_name",   name: "Full Name", type: "text",     required: false },
      { id: "f_agree",  name: "I Agree",   type: "checkbox", required: false },
      { id: "f_amount", name: "Amount",    type: "text",     required: false },
    ];

    const { rows: [pkg] } = await pool.query<{ id: number }>(
      `INSERT INTO docuplete_packages
         (name, account_id, status, transaction_scope, documents, fields, mappings, webhook_secret)
       VALUES ($1, $2, 'active', 'ira_transfer', $3::jsonb, $4::jsonb, '[]'::jsonb, $5)
       RETURNING id`,
      [
        "Mapping Test Package",
        accountAId,
        JSON.stringify(docList),
        JSON.stringify(fields),
        randomBytes(32).toString("hex"),
      ],
    );
    packageId = pkg.id;

    appA = buildTestApp(accountAId);
    appB = buildTestApp(accountBId);
  });

  after(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM docuplete_packages WHERE id = $1`, [packageId]);
    await pool.query(`DELETE FROM accounts WHERE id IN ($1, $2)`, [accountAId, accountBId]);
    await pool.end();
  });

  function sampleMappings(docId = documentId) {
    return [
      {
        id: "m1", fieldId: "f_name", documentId: docId,
        page: 1, x: 72, y: 680, w: 200, h: 20, fontSize: 11, align: "left",
      },
      {
        id: "m2", fieldId: "f_agree", documentId: docId,
        page: 1, x: 72, y: 640, w: 20, h: 20, format: "checkbox-yes",
      },
      {
        id: "m3", fieldId: "f_amount", documentId: docId,
        page: 1, x: 200, y: 600, w: 120, h: 20, format: "currency",
      },
    ];
  }

  it("PATCH with valid mappings returns 200 and the updated package", async () => {
    const res = await supertest(appA)
      .patch(`/packages/${packageId}`)
      .send({ mappings: sampleMappings() });

    assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.package, "Expected package in response body");
  });

  it("GET /packages/:id returns the saved mappings", async () => {
    await supertest(appA)
      .patch(`/packages/${packageId}`)
      .send({ mappings: sampleMappings() });

    const res = await supertest(appA).get(`/packages/${packageId}`);
    assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);

    const pkg      = (res.body.package ?? res.body) as Record<string, unknown>;
    const mappings = pkg.mappings as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(mappings), "Expected mappings array");
    assert.equal(mappings.length, 3, `Expected 3 mappings, got ${mappings.length}`);

    const m1 = mappings.find((m) => m.id === "m1");
    assert.ok(m1, "Expected mapping with id=m1");
    assert.equal(m1.fieldId, "f_name");
    assert.equal(m1.page, 1);
    assert.equal(Number(m1.x), 72);
    assert.equal(m1.align, "left");
  });

  it("format fields round-trip correctly (checkbox-yes, currency)", async () => {
    await supertest(appA)
      .patch(`/packages/${packageId}`)
      .send({ mappings: sampleMappings() });

    const res = await supertest(appA).get(`/packages/${packageId}`);
    assert.equal(res.status, 200);

    const pkg      = (res.body.package ?? res.body) as Record<string, unknown>;
    const mappings = pkg.mappings as Array<Record<string, unknown>>;
    const m2 = mappings.find((m) => m.id === "m2");
    const m3 = mappings.find((m) => m.id === "m3");
    assert.ok(m2, "Expected mapping m2 (checkbox-yes)");
    assert.equal(m2.format, "checkbox-yes", "checkbox-yes format must round-trip");
    assert.ok(m3, "Expected mapping m3 (currency)");
    assert.equal(m3.format, "currency", "currency format must round-trip");
  });

  it("PATCH with empty mappings array clears all previous mappings", async () => {
    await supertest(appA)
      .patch(`/packages/${packageId}`)
      .send({ mappings: sampleMappings() });

    const clearRes = await supertest(appA)
      .patch(`/packages/${packageId}`)
      .send({ mappings: [] });
    assert.equal(clearRes.status, 200, `Expected 200 clearing mappings, got ${clearRes.status}`);

    const getRes  = await supertest(appA).get(`/packages/${packageId}`);
    const pkg     = (getRes.body.package ?? getRes.body) as Record<string, unknown>;
    const mappings = pkg.mappings as Array<unknown>;
    assert.ok(Array.isArray(mappings), "mappings must be an array after clearing");
    assert.equal(mappings.length, 0, "Expected 0 mappings after clearing");
  });

  it("mapping with rotation field round-trips correctly", async () => {
    const withRotation = [
      { id: "r1", fieldId: "f_name", documentId, page: 1, x: 72, y: 400, w: 200, h: 20, rotation: 90 },
    ];

    await supertest(appA)
      .patch(`/packages/${packageId}`)
      .send({ mappings: withRotation });

    const res     = await supertest(appA).get(`/packages/${packageId}`);
    const pkg     = (res.body.package ?? res.body) as Record<string, unknown>;
    const mappings = pkg.mappings as Array<Record<string, unknown>>;
    const r1 = mappings.find((m) => m.id === "r1");
    assert.ok(r1, "Expected mapping r1 in response");
    assert.equal(Number(r1.rotation), 90, "rotation must round-trip as 90");
  });

  it("mapping with checkbox-option format round-trips correctly", async () => {
    const mappings = [
      { id: "co1", fieldId: "f_agree", documentId, page: 1, x: 50, y: 700, w: 20, h: 20, format: "checkbox-option:yes_value" },
    ];
    await supertest(appA)
      .patch(`/packages/${packageId}`)
      .send({ mappings });

    const res  = await supertest(appA).get(`/packages/${packageId}`);
    const pkg  = (res.body.package ?? res.body) as Record<string, unknown>;
    const saved = (pkg.mappings as Array<Record<string, unknown>>).find((m) => m.id === "co1");
    assert.ok(saved, "Expected mapping co1");
    assert.equal(saved.format, "checkbox-option:yes_value", "checkbox-option format must round-trip verbatim");
  });

  it("PATCH updating mappings does not clobber other package fields (name stays intact)", async () => {
    const nameRes = await supertest(appA)
      .patch(`/packages/${packageId}`)
      .send({ name: "Preserved Name" });
    assert.equal(nameRes.status, 200);

    await supertest(appA)
      .patch(`/packages/${packageId}`)
      .send({ mappings: sampleMappings() });

    const res = await supertest(appA).get(`/packages/${packageId}`);
    const pkg = (res.body.package ?? res.body) as Record<string, unknown>;
    assert.equal(pkg.name, "Preserved Name", "Package name must survive a subsequent mappings PATCH");
  });

  it("account B PATCH on account A's package → 404", async () => {
    const res = await supertest(appB)
      .patch(`/packages/${packageId}`)
      .send({ mappings: sampleMappings() });

    assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  it("account B GET on account A's package → 404", async () => {
    const res = await supertest(appB).get(`/packages/${packageId}`);
    assert.equal(res.status, 404, `Expected 404 but got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  it("PATCH on a non-existent package → 404", async () => {
    const res = await supertest(appA)
      .patch(`/packages/999999999`)
      .send({ mappings: [] });

    assert.equal(res.status, 404);
  });
});
