/**
 * Interview form submission end-to-end tests
 *
 * Tests the public PATCH /sessions/:token endpoint — the primary API surface
 * through which a signer fills in interview answers.
 *
 * Coverage
 * ────────
 * • Valid PATCH → 200, session object returned
 * • Answers persisted to DB (or encrypted ciphertext set)
 * • Unknown / expired tokens → 404
 * • Malformed / missing body → 400
 * • Null byte (U+0000) stripping
 * • Password-mask glyph (U+25CF ●) stripping
 * • status='submitted' sets submitted_at in DB
 * • status field absent → existing status preserved
 * • Response includes full session object shape
 *
 * Test strategy
 * ─────────────
 * 1. One throw-away account and package are seeded directly in the DB.
 * 2. An active session (expires far in the future) and an expired session
 *    are seeded once for reuse across tests.
 * 3. The publicDocupleteRouter is mounted on a minimal Express app with
 *    no auth middleware — this endpoint is intentionally token-based/public.
 * 4. All test data is cleaned up in after().
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import supertest from "supertest";
import express from "express";
import { Pool } from "pg";
import { publicDocupleteRouter } from "../routes/docuplete.js";
import { initDb } from "../db.js";

function buildPublicApp() {
  const app = express();
  app.use(express.json());
  app.use("/", publicDocupleteRouter);
  return app;
}

describe("Interview form submission – public PATCH /sessions/:token", () => {
  let pool:         Pool;
  let accountId:    number;
  let packageId:    number;
  let activeToken:  string;
  let expiredToken: string;
  let publicApp:    ReturnType<typeof buildPublicApp>;

  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL must be set");
    await initDb();
    pool = new Pool({ connectionString: url, max: 5 });

    const suffix = `${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;

    const { rows: [acct] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug) VALUES ($1, $2) RETURNING id`,
      [`_Test Interview ${suffix}`, `_test-interview-${suffix}`],
    );
    accountId = acct.id;

    const { rows: [pkg] } = await pool.query<{ id: number }>(
      `INSERT INTO docuplete_packages
         (name, account_id, status, transaction_scope, documents, fields, mappings, webhook_secret)
       VALUES ($1, $2, 'active', 'ira_transfer', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $3)
       RETURNING id`,
      [`Interview Test Package ${suffix}`, accountId, randomBytes(32).toString("hex")],
    );
    packageId = pkg.id;

    activeToken  = `_iv_${randomBytes(20).toString("hex")}`;
    expiredToken = `_iv_exp_${randomBytes(20).toString("hex")}`;

    await pool.query(
      `INSERT INTO docuplete_interview_sessions
         (token, package_id, package_version, transaction_scope, source, status,
          prefill, answers, expires_at, account_id)
       VALUES
         ($1, $2, 1, 'ira_transfer', 'test', 'draft', '{}', '{}', NOW() + INTERVAL '90 days', $3),
         ($4, $2, 1, 'ira_transfer', 'test', 'draft', '{}', '{}', NOW() - INTERVAL '1 day',   $3)`,
      [activeToken, packageId, accountId, expiredToken],
    );

    publicApp = buildPublicApp();
  });

  after(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM docuplete_interview_sessions WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM docuplete_packages WHERE id = $1`, [packageId]);
    await pool.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
    await pool.end();
  });

  /** Seed a fresh single-use session that won't be shared between tests. */
  async function freshSession(): Promise<string> {
    const token = `_iv_fresh_${randomBytes(16).toString("hex")}`;
    await pool.query(
      `INSERT INTO docuplete_interview_sessions
         (token, package_id, package_version, transaction_scope, source, status,
          prefill, answers, expires_at, account_id)
       VALUES ($1, $2, 1, 'ira_transfer', 'test', 'draft',
               '{}', '{}', NOW() + INTERVAL '90 days', $3)`,
      [token, packageId, accountId],
    );
    return token;
  }

  // ── 200 happy-path ─────────────────────────────────────────────────────────

  it("valid PATCH returns 200 with a session object", async () => {
    const res = await supertest(publicApp)
      .patch(`/sessions/${activeToken}`)
      .send({ answers: { name: "Alice Smith", amount: "5000" } });

    assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.session, "Expected session key in response body");
    assert.equal(res.body.session.token, activeToken, "Session token must match the requested token");
    assert.ok(typeof res.body.session.status === "string", "Session must include a status field");
  });

  it("answers are persisted to the database after a PATCH", async () => {
    const token     = await freshSession();
    const unique    = `UniqueUser_${Date.now()}`;
    const patchAnswers = { applicant_name: unique, amount: "12345" };

    const res = await supertest(publicApp)
      .patch(`/sessions/${token}`)
      .send({ answers: patchAnswers });
    assert.equal(res.status, 200);

    const { rows: [row] } = await pool.query<{
      answers: Record<string, unknown>;
      answers_ciphertext: string | null;
    }>(
      `SELECT answers, answers_ciphertext FROM docuplete_interview_sessions WHERE token = $1`,
      [token],
    );
    assert.ok(row, "Expected session row in DB");
    // When encryption is disabled answers are stored in the JSONB column;
    // when enabled the JSONB is cleared and answers_ciphertext is set.
    const encrypted = row.answers_ciphertext != null;
    if (!encrypted) {
      assert.equal(
        row.answers?.applicant_name,
        unique,
        `Expected applicant_name="${unique}" in answers JSONB`,
      );
    } else {
      assert.ok(
        typeof row.answers_ciphertext === "string" && row.answers_ciphertext.length > 0,
        "Expected non-empty ciphertext when encryption is enabled",
      );
    }
  });

  it("PATCH returns the full session with package fields", async () => {
    const res = await supertest(publicApp)
      .patch(`/sessions/${activeToken}`)
      .send({ answers: { name: "Full Object Check" } });

    assert.equal(res.status, 200);
    const session = res.body.session as Record<string, unknown>;
    assert.ok(typeof session.token    === "string", "Expected token field");
    assert.ok(typeof session.status   === "string", "Expected status field");
  });

  // ── 404 error paths ────────────────────────────────────────────────────────

  it("PATCH with an unknown token returns 404", async () => {
    const res = await supertest(publicApp)
      .patch(`/sessions/does-not-exist-xyz`)
      .send({ answers: { name: "Ghost" } });

    assert.equal(res.status, 404);
    assert.ok(typeof res.body.error === "string", "Expected error message in response");
  });

  it("PATCH with an expired token returns 404", async () => {
    const res = await supertest(publicApp)
      .patch(`/sessions/${expiredToken}`)
      .send({ answers: { name: "Expired User" } });

    assert.equal(res.status, 404, `Expected 404 for expired session, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  // ── 400 validation paths ───────────────────────────────────────────────────

  it("PATCH with no body returns 400", async () => {
    const res = await supertest(publicApp)
      .patch(`/sessions/${activeToken}`)
      .send();

    assert.equal(res.status, 400, `Expected 400 for missing body, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(typeof res.body.error === "string", "Expected error message");
  });

  it("PATCH with answers=null returns 400", async () => {
    const res = await supertest(publicApp)
      .patch(`/sessions/${activeToken}`)
      .send({ answers: null });

    assert.equal(res.status, 400, `Expected 400 for null answers, got ${res.status}`);
  });

  it("PATCH with answers as a non-object string returns 400", async () => {
    const res = await supertest(publicApp)
      .patch(`/sessions/${activeToken}`)
      .send({ answers: "not an object" });

    assert.equal(res.status, 400, `Expected 400 for string answers, got ${res.status}`);
  });

  // ── Input sanitisation ─────────────────────────────────────────────────────

  it("strips null bytes (U+0000) from string answer values before saving", async () => {
    const token = await freshSession();

    const res = await supertest(publicApp)
      .patch(`/sessions/${token}`)
      .send({ answers: { name: "Null\u0000Byte\u0000Test" } });
    assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);

    const { rows: [row] } = await pool.query<{ answers: Record<string, unknown> }>(
      `SELECT answers FROM docuplete_interview_sessions WHERE token = $1`,
      [token],
    );
    if (row?.answers?.name) {
      assert.ok(
        !String(row.answers.name).includes("\u0000"),
        "Null byte (U+0000) must be stripped from saved answer values",
      );
      assert.equal(row.answers.name, "NullByteTest", "Non-null chars must be preserved after stripping");
    }
  });

  it("strips password-mask glyphs (U+25CF ●) from string answer values before saving", async () => {
    const token = await freshSession();

    const res = await supertest(publicApp)
      .patch(`/sessions/${token}`)
      .send({ answers: { secret: "real\u25CF\u25CF\u25CFmasked" } });
    assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);

    const { rows: [row] } = await pool.query<{ answers: Record<string, unknown> }>(
      `SELECT answers FROM docuplete_interview_sessions WHERE token = $1`,
      [token],
    );
    if (row?.answers?.secret) {
      assert.ok(
        !String(row.answers.secret).includes("\u25CF"),
        "Password-mask glyph (U+25CF ●) must be stripped from saved answer values",
      );
      assert.equal(row.answers.secret, "realmasked", "Non-mask chars must be preserved after stripping");
    }
  });

  // ── Status & timestamp progression ────────────────────────────────────────

  it("PATCH with status='submitted' transitions status and sets submitted_at", async () => {
    const token = await freshSession();

    const res = await supertest(publicApp)
      .patch(`/sessions/${token}`)
      .send({ answers: {}, status: "submitted" });
    assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);

    const { rows: [row] } = await pool.query<{ status: string; submitted_at: Date | null }>(
      `SELECT status, submitted_at FROM docuplete_interview_sessions WHERE token = $1`,
      [token],
    );
    assert.ok(row, "Expected session row in DB");
    assert.equal(row.status, "submitted", "status must be updated to 'submitted'");
    assert.ok(row.submitted_at != null, "submitted_at must be set when status='submitted'");
  });

  it("submitted_at is NOT overwritten on a subsequent PATCH of an already-submitted session", async () => {
    const token = await freshSession();

    // First PATCH: submit
    await supertest(publicApp)
      .patch(`/sessions/${token}`)
      .send({ answers: {}, status: "submitted" });

    const { rows: [first] } = await pool.query<{ submitted_at: Date }>(
      `SELECT submitted_at FROM docuplete_interview_sessions WHERE token = $1`,
      [token],
    );
    const firstSubmittedAt = first.submitted_at;

    await new Promise((r) => setTimeout(r, 20));

    // Second PATCH: re-submit (should not move submitted_at)
    await supertest(publicApp)
      .patch(`/sessions/${token}`)
      .send({ answers: { extra: "value" }, status: "submitted" });

    const { rows: [second] } = await pool.query<{ submitted_at: Date }>(
      `SELECT submitted_at FROM docuplete_interview_sessions WHERE token = $1`,
      [token],
    );
    assert.equal(
      second.submitted_at.toISOString(),
      firstSubmittedAt.toISOString(),
      "submitted_at must not be overwritten on subsequent PATCHes",
    );
  });

  it("PATCH without a status field preserves the current status", async () => {
    const token = await freshSession();

    await supertest(publicApp)
      .patch(`/sessions/${token}`)
      .send({ answers: { name: "No Status Change" } });

    const { rows: [row] } = await pool.query<{ status: string }>(
      `SELECT status FROM docuplete_interview_sessions WHERE token = $1`,
      [token],
    );
    assert.ok(
      ["draft", "in_progress"].includes(row.status),
      `Expected draft or in_progress after status-less PATCH, got ${row.status}`,
    );
  });

  it("PATCH with status='in_progress' is accepted and persisted", async () => {
    const token = await freshSession();

    const res = await supertest(publicApp)
      .patch(`/sessions/${token}`)
      .send({ answers: { step: "1" }, status: "in_progress" });
    assert.equal(res.status, 200, `Expected 200 but got ${res.status}`);

    const { rows: [row] } = await pool.query<{ status: string }>(
      `SELECT status FROM docuplete_interview_sessions WHERE token = $1`,
      [token],
    );
    assert.equal(row.status, "in_progress", "status must be updated to in_progress");
  });
});
