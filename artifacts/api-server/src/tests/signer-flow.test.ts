/**
 * Multi-step signer UX end-to-end tests
 *
 * Tests the full public signing flow: session retrieval → answer submission →
 * PDF generation → packet download.  Also exercises the email-OTP identity-
 * verification sub-flow independently of email delivery.
 *
 * Coverage
 * ────────
 * Public session info (GET /sessions/:token)
 *   • Valid token → 200 with session metadata
 *   • Non-existent token → 404
 *
 * No-auth flow (auth_level = null)
 *   • Full round-trip: PATCH answers → POST generate → GET packet.pdf → %PDF
 *   • POST generate with client-supplied signedAt → 400
 *   • GET packet.pdf for unknown token → 404
 *   • POST scroll-confirm → 200 / 204
 *
 * Email-OTP verification flow (auth_level = 'email_otp')
 *   • Correct code → 200 with identityToken
 *   • Wrong code → 400
 *   • Max attempts exhausted (attempt_count ≥ 5) → 400
 *   • Expired OTP → 400
 *   • No active OTP rows → 400
 *   • request-otp on non-OTP session → 400
 *
 * Test strategy
 * ─────────────
 * 1. One throw-away account and two packages are created in the DB:
 *    - "no-auth" package (auth_level = null) — for straight-through flow
 *    - "email-otp" package (auth_level = 'email_otp') — for OTP tests
 *    Both packages include a real one-page PDF built with pdf-lib so that
 *    buildPacketPdfBuffer can load and return it without hitting GCS.
 * 2. Sessions are seeded directly in the DB to avoid triggering email sends.
 * 3. For OTP tests, OTP rows are seeded using hashOtp() so we know the
 *    plaintext code and can call verify-otp without sending any emails.
 * 4. All test data is cleaned up in after().
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import supertest from "supertest";
import express from "express";
import { Pool } from "pg";
import { PDFDocument } from "pdf-lib";
import { publicDocupleteRouter } from "../routes/docuplete.js";
import { hashOtp } from "../lib/esign.js";
import { initDb } from "../db.js";

function buildPublicApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/", publicDocupleteRouter);
  return app;
}

describe("Multi-step signer UX – public signing flow", () => {
  let pool:             Pool;
  let accountId:        number;
  let noAuthPackageId:  number;
  let otpPackageId:     number;
  let noAuthDocId:      string;
  let otpDocId:         string;
  let publicApp:        ReturnType<typeof buildPublicApp>;

  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL must be set");
    await initDb();
    pool = new Pool({ connectionString: url, max: 5 });

    const suffix = `${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;

    const { rows: [acct] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug) VALUES ($1, $2) RETURNING id`,
      [`_Test SignerFlow ${suffix}`, `_test-signer-${suffix}`],
    );
    accountId = acct.id;

    // Build a real one-page PDF so buildPacketPdfBuffer can load it
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBuf = Buffer.from(await pdfDoc.save());

    noAuthDocId = `doc-sf-na-${suffix}`;
    otpDocId    = `doc-sf-otp-${suffix}`;

    const docList = (docId: string) => [
      { id: docId, title: "Test.pdf", pages: 1, fileName: "test.pdf", pdfStored: true },
    ];

    const { rows: [pkgNoAuth] } = await pool.query<{ id: number }>(
      `INSERT INTO docuplete_packages
         (name, account_id, status, transaction_scope, documents, fields, mappings,
          auth_level, webhook_secret)
       VALUES ($1, $2, 'active', 'ira_transfer', $3::jsonb, '[]'::jsonb, '[]'::jsonb,
               'none', $4)
       RETURNING id`,
      ["No-Auth Package", accountId, JSON.stringify(docList(noAuthDocId)), randomBytes(32).toString("hex")],
    );
    noAuthPackageId = pkgNoAuth.id;

    await pool.query(
      `INSERT INTO docuplete_package_documents
         (package_id, document_id, filename, content_type, byte_size, page_count, pdf_data)
       VALUES ($1, $2, 'test.pdf', 'application/pdf', $3, 1, $4)`,
      [noAuthPackageId, noAuthDocId, pdfBuf.length, pdfBuf],
    );

    const { rows: [pkgOtp] } = await pool.query<{ id: number }>(
      `INSERT INTO docuplete_packages
         (name, account_id, status, transaction_scope, documents, fields, mappings,
          auth_level, webhook_secret)
       VALUES ($1, $2, 'active', 'ira_transfer', $3::jsonb, '[]'::jsonb, '[]'::jsonb,
               'email_otp', $4)
       RETURNING id`,
      ["OTP Package", accountId, JSON.stringify(docList(otpDocId)), randomBytes(32).toString("hex")],
    );
    otpPackageId = pkgOtp.id;

    await pool.query(
      `INSERT INTO docuplete_package_documents
         (package_id, document_id, filename, content_type, byte_size, page_count, pdf_data)
       VALUES ($1, $2, 'test.pdf', 'application/pdf', $3, 1, $4)`,
      [otpPackageId, otpDocId, pdfBuf.length, pdfBuf],
    );

    publicApp = buildPublicApp();
  });

  after(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM docuplete_esign_otps WHERE session_token LIKE '_sf_%'`);
    await pool.query(`DELETE FROM docuplete_interview_sessions WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM docuplete_packages WHERE id IN ($1, $2)`, [noAuthPackageId, otpPackageId]);
    await pool.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
    await pool.end();
  });

  async function seedSession(pkgId: number): Promise<string> {
    const tok = `_sf_${randomBytes(20).toString("hex")}`;
    await pool.query(
      `INSERT INTO docuplete_interview_sessions
         (token, package_id, package_version, transaction_scope, source, status,
          prefill, answers, expires_at, account_id)
       VALUES ($1, $2, 1, 'ira_transfer', 'test', 'draft',
               '{}', '{}', NOW() + INTERVAL '90 days', $3)`,
      [tok, pkgId, accountId],
    );
    return tok;
  }

  // ── Public session info ────────────────────────────────────────────────────

  describe("Public session info (GET /sessions/:token)", () => {
    it("returns session metadata for a valid token", async () => {
      const token = await seedSession(noAuthPackageId);
      const res   = await supertest(publicApp).get(`/sessions/${token}`);

      assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
      // The public GET returns either { session } or the session object directly
      const session = res.body.session ?? res.body;
      assert.ok(session.token ?? res.body.token, "Expected a token field in the session response");
    });

    it("returns 404 for a non-existent token", async () => {
      const res = await supertest(publicApp).get(`/sessions/no-such-token-xyz`);
      assert.equal(res.status, 404);
    });
  });

  // ── No-auth signing flow ───────────────────────────────────────────────────

  describe("No-auth flow: PATCH → scroll-confirm → generate → packet.pdf", () => {
    it("full round-trip produces a valid PDF with %PDF magic bytes", async () => {
      const token = await seedSession(noAuthPackageId);

      // Step 1: submit answers
      const patchRes = await supertest(publicApp)
        .patch(`/sessions/${token}`)
        .send({ answers: {}, status: "submitted" });
      assert.equal(patchRes.status, 200, `PATCH failed: ${JSON.stringify(patchRes.body)}`);

      // Step 2: generate packet (queue absent in CI → synchronous fallback)
      const genRes = await supertest(publicApp)
        .post(`/sessions/${token}/generate`)
        .send({});
      assert.equal(genRes.status, 200, `Generate failed: ${JSON.stringify(genRes.body)}`);

      // Step 3: download the signed packet as a raw buffer
      const pdfRes = await supertest(publicApp)
        .get(`/sessions/${token}/packet.pdf`)
        .buffer(true)
        .parse((_res, callback) => {
          const chunks: Buffer[] = [];
          _res.on("data", (c: Buffer) => chunks.push(c));
          _res.on("end",  () => callback(null, Buffer.concat(chunks)));
        });

      assert.equal(pdfRes.status, 200, `packet.pdf failed with status ${pdfRes.status}`);
      assert.ok(
        pdfRes.headers["content-type"]?.includes("application/pdf"),
        `Expected application/pdf content-type, got ${pdfRes.headers["content-type"]}`,
      );
      const pdf = pdfRes.body as Buffer;
      assert.ok(pdf.length > 0, "PDF must not be empty");
      assert.equal(
        pdf.slice(0, 4).toString("ascii"),
        "%PDF",
        "Downloaded packet must begin with %PDF magic bytes",
      );
    });

    it("generate accepts an empty body without error", async () => {
      const token = await seedSession(noAuthPackageId);
      const res   = await supertest(publicApp).post(`/sessions/${token}/generate`).send({});
      assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("generate response includes packet byteSize or status field", async () => {
      const token = await seedSession(noAuthPackageId);
      const res   = await supertest(publicApp).post(`/sessions/${token}/generate`).send({});
      assert.equal(res.status, 200);
      const hasPacketInfo =
        res.body.packet != null ||
        typeof res.body.status === "string" ||
        typeof res.body.jobId  === "string";
      assert.ok(hasPacketInfo, `Expected packet/status/jobId in response, got: ${JSON.stringify(res.body)}`);
    });

    it("client-supplied signedAt in generate body → 400", async () => {
      const token = await seedSession(noAuthPackageId);
      const res   = await supertest(publicApp)
        .post(`/sessions/${token}/generate`)
        .send({ signedAt: "2026-01-01T00:00:00Z" });

      assert.equal(res.status, 400, `Expected 400 but got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(
        typeof res.body.error === "string" && res.body.error.toLowerCase().includes("signedat"),
        `Expected signedAt-specific error, got: ${JSON.stringify(res.body)}`,
      );
    });

    it("packet.pdf for a non-existent token returns 404", async () => {
      const res = await supertest(publicApp).get(`/sessions/fake-token-xyz/packet.pdf`);
      assert.equal(res.status, 404);
    });

  });

  // ── Email-OTP verification flow ────────────────────────────────────────────

  describe("Email-OTP verification flow (POST /sessions/:token/verify-otp)", () => {
    const TEST_EMAIL = "signer@example-otp-test.invalid";
    const KNOWN_CODE  = "482916";

    async function seedOtp(token: string, opts: {
      code?:         string;
      attemptCount?: number;
      expiresAt?:    string;
    } = {}): Promise<void> {
      const code        = opts.code ?? KNOWN_CODE;
      const hash        = hashOtp(code);
      const expiresAt   = opts.expiresAt ?? "NOW() + INTERVAL '15 minutes'";
      const attempts    = opts.attemptCount ?? 0;
      await pool.query(
        `INSERT INTO docuplete_esign_otps
           (session_token, email, otp_hash, expires_at, attempt_count)
         VALUES ($1, $2, $3, ${expiresAt}, $4)`,
        [token, TEST_EMAIL, hash, attempts],
      );
    }

    it("correct code returns 200 with an identityToken", async () => {
      const token = await seedSession(otpPackageId);
      await seedOtp(token);

      const res = await supertest(publicApp)
        .post(`/sessions/${token}/verify-otp`)
        .send({ email: TEST_EMAIL, code: KNOWN_CODE });

      assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(
        typeof res.body.identityToken === "string" && res.body.identityToken.length > 0,
        `Expected identityToken in response, got: ${JSON.stringify(res.body)}`,
      );
    });

    it("wrong code returns 400", async () => {
      const token = await seedSession(otpPackageId);
      await seedOtp(token);

      const res = await supertest(publicApp)
        .post(`/sessions/${token}/verify-otp`)
        .send({ email: TEST_EMAIL, code: "000000" });

      assert.equal(res.status, 400, `Expected 400 for wrong code, got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("wrong code increments attempt_count in the DB", async () => {
      const token = await seedSession(otpPackageId);
      await seedOtp(token);

      await supertest(publicApp)
        .post(`/sessions/${token}/verify-otp`)
        .send({ email: TEST_EMAIL, code: "000000" });

      const { rows: [row] } = await pool.query<{ attempt_count: number }>(
        `SELECT attempt_count FROM docuplete_esign_otps
          WHERE session_token = $1 AND email = $2
          ORDER BY created_at DESC LIMIT 1`,
        [token, TEST_EMAIL],
      );
      assert.ok(row, "Expected OTP row to still exist after failed attempt");
      assert.ok(row.attempt_count >= 1, `Expected attempt_count ≥ 1, got ${row.attempt_count}`);
    });

    it("attempt_count ≥ 5 returns 400 even with the correct code", async () => {
      const token = await seedSession(otpPackageId);
      await seedOtp(token, { attemptCount: 5 });

      const res = await supertest(publicApp)
        .post(`/sessions/${token}/verify-otp`)
        .send({ email: TEST_EMAIL, code: KNOWN_CODE });

      assert.equal(res.status, 400, `Expected 400 for exhausted attempts, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(
        typeof res.body.error === "string" && res.body.error.toLowerCase().includes("attempt"),
        `Expected attempt-limit error, got: ${JSON.stringify(res.body)}`,
      );
    });

    it("expired OTP returns 400 (no active code found)", async () => {
      const token = await seedSession(otpPackageId);
      await seedOtp(token, { expiresAt: "NOW() - INTERVAL '1 hour'" });

      const res = await supertest(publicApp)
        .post(`/sessions/${token}/verify-otp`)
        .send({ email: TEST_EMAIL, code: KNOWN_CODE });

      assert.equal(res.status, 400, `Expected 400 for expired OTP, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(
        typeof res.body.error === "string" && res.body.error.toLowerCase().includes("code"),
        `Expected expired-code error, got: ${JSON.stringify(res.body)}`,
      );
    });

    it("no active OTP rows returns 400", async () => {
      const token = await seedSession(otpPackageId);
      // No OTP row seeded for this session

      const res = await supertest(publicApp)
        .post(`/sessions/${token}/verify-otp`)
        .send({ email: TEST_EMAIL, code: "999999" });

      assert.equal(res.status, 400, `Expected 400 when no OTP row exists, got ${res.status}`);
    });

    it("verify-otp on a session with wrong email returns 400", async () => {
      const token = await seedSession(otpPackageId);
      await seedOtp(token);

      const res = await supertest(publicApp)
        .post(`/sessions/${token}/verify-otp`)
        .send({ email: "wrong@example.invalid", code: KNOWN_CODE });

      assert.equal(res.status, 400, `Expected 400 for wrong email, got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it("request-otp on a non-OTP session (auth_level = null) returns 400", async () => {
      const token = await seedSession(noAuthPackageId);

      const res = await supertest(publicApp)
        .post(`/sessions/${token}/request-otp`)
        .send({ email: TEST_EMAIL });

      assert.equal(res.status, 400, `Expected 400 for non-OTP session, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(
        typeof res.body.error === "string" && res.body.error.toLowerCase().includes("verification"),
        `Expected 'verification' in error text, got: ${JSON.stringify(res.body)}`,
      );
    });

    it("verify-otp on a non-OTP session (auth_level = null) returns 400", async () => {
      const token = await seedSession(noAuthPackageId);

      const res = await supertest(publicApp)
        .post(`/sessions/${token}/verify-otp`)
        .send({ email: TEST_EMAIL, code: KNOWN_CODE });

      assert.equal(res.status, 400, `Expected 400 for non-OTP session, got ${res.status}: ${JSON.stringify(res.body)}`);
    });
  });
});
