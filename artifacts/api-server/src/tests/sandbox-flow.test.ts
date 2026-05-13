/**
 * Sandbox demo form submission flow tests
 *
 * Covers the full end-to-end sandbox journey a prospective customer takes
 * when exploring Docuplete via the public demo:
 *
 * 1. Start a sandbox session  (GET  /sandbox/start)
 * 2. Save all 8 required field answers  (PATCH /docuplete/public/sessions/:token)
 * 3. Generate the filled document  (POST /docuplete/public/sessions/:token/generate)
 *
 * Two scenarios are tested:
 *   A. Happy path  — all required fields supplied → 200/202, document URL present
 *   B. Missing fields — required fields omitted → 400, meaningful error message
 *
 * The tests require DATABASE_URL to be set. They create real sandbox sessions and
 * clean them up in `after`. They do NOT delete the shared sandbox account or demo
 * package (those are intentionally long-lived and shared across all sessions).
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import express from "express";
import { Pool } from "pg";
import sandboxRouter from "../routes/sandbox.js";
import { publicDocupleteRouter } from "../routes/docuplete.js";

// ── Test app ──────────────────────────────────────────────────────────────────
// Mounts both the sandbox router and the public Docuplete router at the same
// paths they occupy in the real API (relative to /api/v1).

function buildSandboxTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/sandbox",           sandboxRouter);
  app.use("/docuplete/public",  publicDocupleteRouter);
  return app;
}

// ── Complete set of answers that satisfy all 8 required DEMO_FIELDS ───────────
// Keys are the stable field IDs from demoPackage.ts (client_first_name, etc.).
// Values are realistic but clearly synthetic.
const ALL_REQUIRED_ANSWERS: Record<string, string> = {
  client_first_name:    "Jane",
  client_last_name:     "Doe",
  client_email:         "jane.doe@sandbox-test.example",
  client_dob:           "1985-04-12",
  client_address_line1: "123 Main Street",
  client_city:          "Springfield",
  client_state:         "IL",
  client_zip:           "62701",
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Sandbox demo – form submission flow", () => {
  let pool: Pool;
  let app: ReturnType<typeof buildSandboxTestApp>;

  // Tokens created during tests — cleaned up in `after`
  const createdTokens: string[] = [];

  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) {
      throw new Error("DATABASE_URL must be set to run sandbox flow tests");
    }
    pool = new Pool({ connectionString: url, max: 3 });
    app  = buildSandboxTestApp();
  });

  after(async () => {
    if (!pool) return;
    // Remove only the test sessions; do NOT delete the shared sandbox account
    // or demo package — they are intentionally long-lived.
    if (createdTokens.length > 0) {
      await pool.query(
        `DELETE FROM docuplete_interview_sessions WHERE token = ANY($1::text[])`,
        [createdTokens],
      );
    }
    await pool.end();
  });

  // ── Helper: start a fresh sandbox session ────────────────────────────────────

  async function startSandboxSession(): Promise<string> {
    const startRes = await supertest(app).get("/sandbox/start");
    assert.equal(
      startRes.status,
      200,
      `Expected 200 from /sandbox/start, got ${startRes.status}: ${JSON.stringify(startRes.body)}`,
    );
    const token: string = startRes.body.sessionToken;
    assert.ok(token, "sandbox/start must return a sessionToken");
    createdTokens.push(token);
    return token;
  }

  // ── Test A: Happy path ────────────────────────────────────────────────────────
  //
  // Start a session, save all 8 required answers, then generate.
  // The generate endpoint returns 200 (synchronous mode, no queue) or 202
  // (queue-backed async mode).  Both indicate success; when synchronous a
  // downloadUrl must also be present.

  it("A: starting a session returns a sessionToken and interviewUrl", async () => {
    const startRes = await supertest(app).get("/sandbox/start");

    assert.equal(
      startRes.status,
      200,
      `Expected 200, got ${startRes.status}: ${JSON.stringify(startRes.body)}`,
    );
    assert.ok(
      typeof startRes.body.sessionToken === "string" && startRes.body.sessionToken.length > 0,
      "Response must include a non-empty sessionToken",
    );
    assert.ok(
      typeof startRes.body.interviewUrl === "string" && startRes.body.interviewUrl.includes("sandbox"),
      "Response must include an interviewUrl that contains 'sandbox'",
    );
    assert.ok(
      typeof startRes.body.expiresAt === "string",
      "Response must include an expiresAt timestamp",
    );

    createdTokens.push(startRes.body.sessionToken);
  });

  it("A: prefill params are reflected in the session prefill object", async () => {
    const res = await supertest(app)
      .get("/sandbox/start?firstName=Alice&lastName=Smith&email=alice%40example.com");

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.prefill?.firstName, "Alice");
    assert.equal(res.body.prefill?.lastName, "Smith");
    assert.equal(res.body.prefill?.email, "alice@example.com");

    createdTokens.push(res.body.sessionToken);
  });

  it("A: filling all 8 required fields and submitting returns a success response with a document URL", async () => {
    const token = await startSandboxSession();

    // Save all required answers
    const patchRes = await supertest(app)
      .patch(`/docuplete/public/sessions/${token}`)
      .send({ answers: ALL_REQUIRED_ANSWERS });

    assert.equal(
      patchRes.status,
      200,
      `PATCH answers failed: ${JSON.stringify(patchRes.body)}`,
    );

    // Generate the filled document
    const genRes = await supertest(app)
      .post(`/docuplete/public/sessions/${token}/generate`)
      .send({});

    // The queue may or may not be available:
    // - Queue disabled (common in tests) → 200 + { packet, downloadUrl }
    // - Queue enabled (Redis present)   → 202 + { jobId, status: "pending" }
    const isSuccess = genRes.status === 200 || genRes.status === 202;
    assert.ok(
      isSuccess,
      `Expected 200 or 202 from generate, got ${genRes.status}: ${JSON.stringify(genRes.body)}`,
    );

    if (genRes.status === 200) {
      // Synchronous path: document URL and packet summary must be present
      assert.ok(
        typeof genRes.body.downloadUrl === "string" && genRes.body.downloadUrl.length > 0,
        `Expected downloadUrl in generate response, got: ${JSON.stringify(genRes.body)}`,
      );
      assert.ok(
        genRes.body.packet,
        `Expected packet summary in generate response, got: ${JSON.stringify(genRes.body)}`,
      );
    } else {
      // Async path: job reference must be present
      assert.ok(
        typeof genRes.body.jobId === "string" || typeof genRes.body.jobId === "number",
        `Expected jobId in 202 response, got: ${JSON.stringify(genRes.body)}`,
      );
    }
  });

  // ── Test B: Missing required fields ──────────────────────────────────────────
  //
  // When the session's answers object is empty (no fields filled), the generate
  // endpoint must reject the request with HTTP 400 and include a human-readable
  // error message identifying which fields are missing.

  it("B: submitting with no answers returns 400 with a meaningful missing-fields error", async () => {
    const token = await startSandboxSession();

    // Save an empty answers map — no fields filled at all
    const patchRes = await supertest(app)
      .patch(`/docuplete/public/sessions/${token}`)
      .send({ answers: {} });

    assert.equal(patchRes.status, 200, `PATCH (empty answers) failed: ${JSON.stringify(patchRes.body)}`);

    // Generate should reject because all 8 required fields are missing
    const genRes = await supertest(app)
      .post(`/docuplete/public/sessions/${token}/generate`)
      .send({});

    assert.equal(
      genRes.status,
      400,
      `Expected 400 for missing required fields, got ${genRes.status}: ${JSON.stringify(genRes.body)}`,
    );

    // The error message must be a non-empty string
    assert.ok(
      typeof genRes.body.error === "string" && genRes.body.error.length > 0,
      `Expected a non-empty error string, got: ${JSON.stringify(genRes.body)}`,
    );

    // The response must identify which fields are missing (missingFields array)
    assert.ok(
      Array.isArray(genRes.body.missingFields) && genRes.body.missingFields.length > 0,
      `Expected a non-empty missingFields array, got: ${JSON.stringify(genRes.body)}`,
    );

    // Sanity: all 8 DEMO_FIELDS are required, so all 8 should be listed
    assert.ok(
      genRes.body.missingFields.length >= 8,
      `Expected at least 8 missing field entries, got ${genRes.body.missingFields.length}: ${JSON.stringify(genRes.body.missingFields)}`,
    );
  });

  it("B: submitting with only some fields filled returns 400 listing the remaining missing fields", async () => {
    const token = await startSandboxSession();

    // Provide only 3 of the 8 required fields
    const partialAnswers: Record<string, string> = {
      client_first_name: "John",
      client_last_name:  "Smith",
      client_email:      "john.smith@sandbox-test.example",
      // dateOfBirth, addressLine1, city, state, zip intentionally omitted
    };

    const patchRes = await supertest(app)
      .patch(`/docuplete/public/sessions/${token}`)
      .send({ answers: partialAnswers });

    assert.equal(patchRes.status, 200, `PATCH (partial answers) failed: ${JSON.stringify(patchRes.body)}`);

    const genRes = await supertest(app)
      .post(`/docuplete/public/sessions/${token}/generate`)
      .send({});

    assert.equal(
      genRes.status,
      400,
      `Expected 400 for partial fields, got ${genRes.status}: ${JSON.stringify(genRes.body)}`,
    );

    assert.ok(
      typeof genRes.body.error === "string" && genRes.body.error.length > 0,
      `Expected a non-empty error string, got: ${JSON.stringify(genRes.body)}`,
    );

    assert.ok(
      Array.isArray(genRes.body.missingFields) && genRes.body.missingFields.length > 0,
      `Expected missing fields to be listed, got: ${JSON.stringify(genRes.body)}`,
    );

    // 5 fields were omitted — the error must not report the 3 that were supplied
    assert.ok(
      genRes.body.missingFields.length >= 5,
      `Expected at least 5 missing fields (the 5 omitted ones), got ${genRes.body.missingFields.length}: ${JSON.stringify(genRes.body.missingFields)}`,
    );

    // The 3 supplied fields must NOT appear in missingFields
    const missing: string[] = genRes.body.missingFields;
    assert.ok(
      !missing.some((f) => /first name/i.test(f)),
      `"Client first name" was supplied but appears in missingFields: ${JSON.stringify(missing)}`,
    );
    assert.ok(
      !missing.some((f) => /last name/i.test(f)),
      `"Client last name" was supplied but appears in missingFields: ${JSON.stringify(missing)}`,
    );
    assert.ok(
      !missing.some((f) => /email/i.test(f)),
      `"Client email" was supplied but appears in missingFields: ${JSON.stringify(missing)}`,
    );
  });

  it("B: generate without any prior PATCH also returns 400 (empty prefill, no answers)", async () => {
    const token = await startSandboxSession();

    // Skip the PATCH step entirely — session has no answers
    const genRes = await supertest(app)
      .post(`/docuplete/public/sessions/${token}/generate`)
      .send({});

    assert.equal(
      genRes.status,
      400,
      `Expected 400 when no answers exist at all, got ${genRes.status}: ${JSON.stringify(genRes.body)}`,
    );
    assert.ok(
      typeof genRes.body.error === "string" && genRes.body.error.length > 0,
      `Expected a non-empty error message, got: ${JSON.stringify(genRes.body)}`,
    );
  });
});
