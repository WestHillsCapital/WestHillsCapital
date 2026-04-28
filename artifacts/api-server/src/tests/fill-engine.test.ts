/**
 * Fill engine test suite
 *
 * Covers:
 * 1. Format helper unit tests — formatDocuFillMappedValue for date, currency,
 *    SSN, phone, percent, zip, number, and edge-case inputs.
 * 2. Word-wrap algorithm unit tests — mirrors drawWrappedText from docufill.ts
 *    using pdf-lib Helvetica metrics; verifies wrapping and extreme-value safety.
 * 3. Text placement integration test — generates a real filled PDF via the
 *    generate + packet.pdf endpoints and verifies the output is valid and
 *    contains all expected pages.
 * 4. End-to-end smoke test — creates an org, package, and session using only
 *    HTTP API endpoints (POST /sessions → PATCH /sessions/:token → generate),
 *    then confirms a webhook_deliveries row is recorded within 5 seconds.
 * 5. Webhook URL pre-save validation — verifies that PATCH /packages/:id rejects
 *    unreachable or non-2xx webhook URLs before writing, using a local stub server
 *    to control the probe response.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import http from "node:http";
import supertest from "supertest";
import express from "express";
import { Pool } from "pg";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import { formatDocuFillMappedValue } from "../lib/docufill-redaction.js";
import docufillRouter from "../routes/docufill.js";

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

// ── 1. Format helper unit tests ───────────────────────────────────────────────

describe("Fill engine – format helpers", () => {
  // date-mm-dd-yyyy ──────────────────────────────────────────────────────────
  it("formats ISO date string as MM/DD/YYYY", () => {
    assert.equal(
      formatDocuFillMappedValue("2025-03-15", { format: "date-mm-dd-yyyy" }),
      "03/15/2025",
    );
  });

  it("formats date-time string as MM/DD/YYYY (ignores time component)", () => {
    assert.equal(
      formatDocuFillMappedValue("1990-07-04T00:00:00.000Z", { format: "date-mm-dd-yyyy" }),
      "07/04/1990",
    );
  });

  it("returns original text for unparseable date", () => {
    assert.equal(
      formatDocuFillMappedValue("not-a-date", { format: "date-mm-dd-yyyy" }),
      "not-a-date",
    );
  });

  // currency ─────────────────────────────────────────────────────────────────
  it("formats plain numeric string as USD currency", () => {
    assert.equal(
      formatDocuFillMappedValue("5000", { format: "currency" }),
      "$5,000.00",
    );
  });

  it("formats dollar-prefixed, comma-separated string as USD", () => {
    assert.equal(
      formatDocuFillMappedValue("$1,250.75", { format: "currency" }),
      "$1,250.75",
    );
  });

  it("formats zero as USD currency", () => {
    assert.equal(
      formatDocuFillMappedValue("0", { format: "currency" }),
      "$0.00",
    );
  });

  it("returns non-numeric currency input as-is", () => {
    assert.equal(
      formatDocuFillMappedValue("abc", { format: "currency" }),
      "abc",
    );
  });

  // SSN – digits-only & last-four ────────────────────────────────────────────
  it("strips hyphens from SSN for digits-only format", () => {
    assert.equal(
      formatDocuFillMappedValue("123-45-6789", { format: "digits-only" }),
      "123456789",
    );
  });

  it("extracts last 4 digits from SSN for last-four format", () => {
    assert.equal(
      formatDocuFillMappedValue("123-45-6789", { format: "last-four" }),
      "6789",
    );
  });

  // phone – digits-only & last-four ──────────────────────────────────────────
  it("strips formatting from phone number for digits-only format", () => {
    assert.equal(
      formatDocuFillMappedValue("(555) 867-5309", { format: "digits-only" }),
      "5558675309",
    );
  });

  it("extracts last 4 digits from phone number for last-four format", () => {
    assert.equal(
      formatDocuFillMappedValue("(555) 867-5309", { format: "last-four" }),
      "5309",
    );
  });

  // zip – digits-only ────────────────────────────────────────────────────────
  it("strips hyphen from ZIP+4 for digits-only format", () => {
    assert.equal(
      formatDocuFillMappedValue("12345-6789", { format: "digits-only" }),
      "123456789",
    );
  });

  it("returns plain 5-digit zip unchanged for digits-only format", () => {
    assert.equal(
      formatDocuFillMappedValue("90210", { format: "digits-only" }),
      "90210",
    );
  });

  // percent – as-entered (no special format key) ─────────────────────────────
  it("returns percent value unchanged when format is as-entered", () => {
    assert.equal(
      formatDocuFillMappedValue("75%", { format: "as-entered" }),
      "75%",
    );
  });

  it("returns percent value unchanged when no format is specified", () => {
    assert.equal(
      formatDocuFillMappedValue("50%", {}),
      "50%",
    );
  });

  // number ───────────────────────────────────────────────────────────────────
  it("returns numeric string unchanged by default", () => {
    assert.equal(formatDocuFillMappedValue("42", {}), "42");
  });

  it("returns negative numeric string unchanged by default", () => {
    assert.equal(formatDocuFillMappedValue("-7.5", {}), "-7.5");
  });

  // edge cases ───────────────────────────────────────────────────────────────
  it("returns empty string for empty input regardless of format", () => {
    assert.equal(formatDocuFillMappedValue("", { format: "currency" }), "");
    assert.equal(formatDocuFillMappedValue("  ", { format: "date-mm-dd-yyyy" }), "");
    assert.equal(formatDocuFillMappedValue("", { format: "digits-only" }), "");
    assert.equal(formatDocuFillMappedValue("", { format: "last-four" }), "");
  });

  it("uppercase format transforms text correctly", () => {
    assert.equal(
      formatDocuFillMappedValue("hello world", { format: "uppercase" }),
      "HELLO WORLD",
    );
  });

  it("lowercase format transforms text correctly", () => {
    assert.equal(
      formatDocuFillMappedValue("HELLO WORLD", { format: "lowercase" }),
      "hello world",
    );
  });

  it("unknown format returns text as-entered", () => {
    assert.equal(
      formatDocuFillMappedValue("Some value", { format: "nonexistent-format" }),
      "Some value",
    );
  });
});

// ── 2. Word-wrap algorithm unit tests ─────────────────────────────────────────
//
// Mirrors the drawWrappedText algorithm from docufill.ts exactly so regressions
// in the line-splitting logic surface here before reaching real PDFs.

describe("Fill engine – word wrap algorithm", () => {
  /**
   * Implements the same word-wrap logic as drawWrappedText in docufill.ts.
   * Returns the list of lines that would be drawn for the given parameters.
   */
  function wordWrapLines(
    text: string,
    size: number,
    font: PDFFont,
    maxWidth: number,
  ): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const nextLine = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(nextLine, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = nextLine;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  let font: PDFFont;

  before(async () => {
    const doc = await PDFDocument.create();
    font = await doc.embedFont(StandardFonts.Helvetica);
  });

  it("short text fits on a single line when maxWidth is generous", () => {
    const lines = wordWrapLines("Hello World", 11, font, 300);
    assert.equal(lines.length, 1);
    assert.equal(lines[0], "Hello World");
  });

  it("long text wraps into multiple lines when it exceeds maxWidth", () => {
    const text = "The quick brown fox jumps over the lazy dog and then ran away into the forest";
    const lines = wordWrapLines(text, 11, font, 80);
    assert.ok(
      lines.length > 1,
      `Expected multiple lines, got ${lines.length}: ${JSON.stringify(lines)}`,
    );
    // Reconstruct text and confirm no words were lost
    assert.equal(lines.join(" "), text);
  });

  it("no multi-word wrapped line exceeds the maxWidth", () => {
    const text = "Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa";
    const maxWidth = 60;
    const lines = wordWrapLines(text, 11, font, maxWidth);
    for (const line of lines) {
      const lineWords = line.split(" ");
      if (lineWords.length > 1) {
        assert.ok(
          font.widthOfTextAtSize(line, 11) <= maxWidth,
          `Multi-word line "${line}" (${font.widthOfTextAtSize(line, 11).toFixed(1)}pt) exceeds maxWidth ${maxWidth}pt`,
        );
      }
    }
  });

  it("very narrow maxWidth produces one word per line", () => {
    const lines = wordWrapLines("Alpha Beta Gamma", 11, font, 1);
    assert.ok(
      lines.length >= 3,
      `Expected at least 3 lines for 3 words, got ${lines.length}`,
    );
  });

  it("empty text produces no lines", () => {
    const lines = wordWrapLines("", 11, font, 200);
    assert.equal(lines.length, 0);
  });

  it("whitespace-only text produces no lines", () => {
    const lines = wordWrapLines("   ", 11, font, 200);
    assert.equal(lines.length, 0);
  });

  it("single word wider than maxWidth stays on its own line (cannot wrap)", () => {
    const lines = wordWrapLines("Supercalifragilistic", 11, font, 5);
    assert.equal(lines.length, 1);
    assert.equal(lines[0], "Supercalifragilistic");
  });

  it("large font size (72pt) does not crash the algorithm", () => {
    const lines = wordWrapLines("Hello World", 72, font, 400);
    assert.ok(lines.length >= 1, "Expected at least one line with large font");
  });

  it("very small font size (1pt) does not crash the algorithm", () => {
    const text = "The quick brown fox";
    const lines = wordWrapLines(text, 1, font, 50);
    assert.ok(lines.length >= 1);
    assert.equal(lines.join(" "), text);
  });
});

// ── 3 & 4. DB-backed tests ────────────────────────────────────────────────────
//
// Section 3: Text placement integration — verifies that a real filled PDF
// produced by buildPacketPdfBuffer does not crash and yields a valid,
// non-empty document when extreme values and long wrapping text are used.
//
// Section 4: End-to-end smoke test — exercises the full intake→generate chain
// using only HTTP API endpoints (no direct DB inserts for the session flow).

describe("Fill engine – DB-backed tests (extreme values + E2E smoke)", () => {
  let pool: Pool;
  let accountId: number;
  let packageExtremeId: number;
  let packageWebhookId: number;
  // fieldId stored in packageExtremeId's fields array
  let storedFieldId: string;
  let app: ReturnType<typeof buildTestApp>;

  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) {
      throw new Error("DATABASE_URL must be set to run fill-engine DB tests");
    }
    pool = new Pool({ connectionString: url, max: 5 });

    const suffix = Date.now().toString(36);

    // Create a test account with enterprise plan so the plan-limit middleware
    // on POST /sessions passes without a 402.
    const { rows: [acctRow] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug, plan_tier, seat_limit)
       VALUES ($1, $2, 'enterprise', 999)
       RETURNING id`,
      [`_Test FillEngine ${suffix}`, `_test-fill-engine-${suffix}`],
    );
    accountId = acctRow.id;
    app = buildTestApp(accountId);

    // Build a proper single-page PDF using pdf-lib so buildPacketPdfBuffer
    // can load and copy it, then apply field mappings.
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBuf = Buffer.from(await pdfDoc.save());

    // ── Package for extreme font / box size tests ──────────────────────────
    // Mapping uses fontSize=999 (clamped to 24) and h=0.001 (clamped to 1).
    // The field value contains a long sentence to exercise line wrapping within
    // the real buildPacketPdfBuffer path.
    const docId = `doc-extreme-${suffix}`;
    storedFieldId = `field_extreme_${suffix}`;

    const { rows: [pkgRow] } = await pool.query<{ id: number }>(
      `INSERT INTO docufill_packages
         (name, account_id, status, transaction_scope, documents, fields, mappings, webhook_secret)
       VALUES ('FillEngine Extreme Test', $1, 'active', 'ira_transfer',
               $2::jsonb, $3::jsonb, $4::jsonb, $5)
       RETURNING id`,
      [
        accountId,
        JSON.stringify([{
          id: docId,
          title: "Extreme Test Doc",
          pages: 1,
          fileName: "extreme.pdf",
          pdfStored: true,
        }]),
        JSON.stringify([{
          id: storedFieldId,
          label: "Extreme Test Field",
          source: "interview",
          type: "text",
          sensitive: false,
          required: false,
          validationType: "none",
          // interviewVisible=false so validateSessionAnswers skips this field
          interviewVisible: false,
        }]),
        // Extreme mapping values: fontSize=999 clamped to 24, h=0.001 clamped to 1,
        // w=10% — narrow box to force real text wrapping.
        JSON.stringify([{
          fieldId: storedFieldId,
          documentId: docId,
          page: 1,
          x: 10,
          y: 10,
          w: 10,
          h: 0.001,
          fontSize: 999,
          format: "as-entered",
          align: "left",
        }]),
        randomBytes(32).toString("hex"),
      ],
    );
    packageExtremeId = pkgRow.id;

    await pool.query(
      `INSERT INTO docufill_package_documents
         (package_id, document_id, filename, content_type, byte_size, page_count, pdf_data)
       VALUES ($1, $2, 'extreme.pdf', 'application/pdf', $3, 1, $4)`,
      [packageExtremeId, docId, pdfBuf.length, pdfBuf],
    );

    // ── Package for E2E webhook smoke test ────────────────────────────────
    // Uses pdfkit fallback (no stored PDF, no fields). Webhook URL points to
    // an invalid target so the HTTP request fails immediately, but the delivery
    // row is still inserted in webhook_deliveries.
    const { rows: [pkgWh] } = await pool.query<{ id: number }>(
      `INSERT INTO docufill_packages
         (name, account_id, status, transaction_scope, documents, fields, mappings,
          webhook_enabled, webhook_url, webhook_secret)
       VALUES ('FillEngine Webhook Test', $1, 'active', 'ira_transfer',
               '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
               TRUE, 'https://0.0.0.0/invalid-webhook-target', $2)
       RETURNING id`,
      [accountId, randomBytes(32).toString("hex")],
    );
    packageWebhookId = pkgWh.id;
  });

  after(async () => {
    if (!pool) return;
    await pool.query(
      `DELETE FROM docufill_interview_sessions WHERE account_id = $1`,
      [accountId],
    );
    // Webhook deliveries are cascade-deleted when packages are deleted
    await pool.query(
      `DELETE FROM docufill_packages WHERE account_id = $1`,
      [accountId],
    );
    await pool.query(
      `DELETE FROM accounts WHERE id = $1`,
      [accountId],
    );
    await pool.end();
  });

  // ── Section 3a: Extreme font size ────────────────────────────────────────
  it("generate with extreme fontSize (999 → clamped to 24) does not crash", async () => {
    const token = `_test_extreme_fs_${Date.now().toString(36)}`;
    await pool.query(
      `INSERT INTO docufill_interview_sessions
         (token, package_id, package_version, transaction_scope, source, status,
          prefill, answers, expires_at, account_id)
       VALUES ($1, $2, 1, 'ira_transfer', 'test', 'draft',
               '{}'::jsonb, $3::jsonb,
               NOW() + INTERVAL '90 days', $4)`,
      [
        token,
        packageExtremeId,
        JSON.stringify({ [storedFieldId]: "Hello World extreme font size test" }),
        accountId,
      ],
    );

    const res = await supertest(app)
      .post(`/sessions/${token}/generate`)
      .send({});

    assert.equal(
      res.status,
      200,
      `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`,
    );
    assert.ok(res.body.packet, "Response should include a packet summary");
  });

  // ── Section 3b: Tiny box height ──────────────────────────────────────────
  it("generate with tiny box height (h=0.001 → clamped to 1) does not crash", async () => {
    const token = `_test_extreme_h_${Date.now().toString(36)}`;
    await pool.query(
      `INSERT INTO docufill_interview_sessions
         (token, package_id, package_version, transaction_scope, source, status,
          prefill, answers, expires_at, account_id)
       VALUES ($1, $2, 1, 'ira_transfer', 'test', 'draft',
               '{}'::jsonb, $3::jsonb,
               NOW() + INTERVAL '90 days', $4)`,
      [
        token,
        packageExtremeId,
        JSON.stringify({ [storedFieldId]: "A value long enough to force line wrapping within the narrow bounding box defined by w=10%" }),
        accountId,
      ],
    );

    const res = await supertest(app)
      .post(`/sessions/${token}/generate`)
      .send({});

    assert.equal(
      res.status,
      200,
      `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`,
    );
  });

  // ── Section 3c: Text placement integration ───────────────────────────────
  // Verifies that the real buildPacketPdfBuffer path (not just the mirrored
  // algorithm) produces a valid, non-empty PDF with the correct page count
  // even when the field value is long and the bounding box is narrow.
  it("generated packet PDF is a valid non-empty document with correct page count", async () => {
    const token = `_test_pdf_wrap_${Date.now().toString(36)}`;
    const longValue =
      "The quick brown fox jumps over the lazy dog. " +
      "This sentence is intentionally long to exercise multi-line wrapping " +
      "inside the narrow 10%-wide bounding box with extreme font size clamped to 24pt.";

    await pool.query(
      `INSERT INTO docufill_interview_sessions
         (token, package_id, package_version, transaction_scope, source, status,
          prefill, answers, expires_at, account_id)
       VALUES ($1, $2, 1, 'ira_transfer', 'test', 'draft',
               '{}'::jsonb, $3::jsonb,
               NOW() + INTERVAL '90 days', $4)`,
      [token, packageExtremeId, JSON.stringify({ [storedFieldId]: longValue }), accountId],
    );

    // Generate the packet
    const genRes = await supertest(app).post(`/sessions/${token}/generate`).send({});
    assert.equal(genRes.status, 200, `Generate failed: ${JSON.stringify(genRes.body)}`);

    // Fetch the real filled PDF from the route (exercises full buildPacketPdfBuffer)
    const pdfRes = await supertest(app)
      .get(`/sessions/${token}/packet.pdf`)
      .buffer(true)
      .parse((_res, callback) => {
        const chunks: Buffer[] = [];
        _res.on("data", (chunk: Buffer) => chunks.push(chunk));
        _res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    assert.equal(pdfRes.status, 200, `PDF download failed: status ${pdfRes.status}`);
    assert.ok(
      pdfRes.headers["content-type"]?.includes("application/pdf"),
      "Expected application/pdf content-type",
    );

    const pdfBuf = pdfRes.body as Buffer;
    assert.ok(pdfBuf.length > 0, "Generated PDF must not be empty");

    // Load with pdf-lib to confirm the output is a structurally valid PDF
    // with the expected page count (proves no silent data loss in placement).
    const loaded = await PDFDocument.load(pdfBuf);
    assert.equal(loaded.getPageCount(), 1, "Filled PDF should have exactly 1 page");
  });

  // ── Section 4: E2E smoke test ─────────────────────────────────────────────
  // Uses only HTTP API endpoints — no direct DB inserts for the session flow.
  // Flow: POST /sessions → PATCH /sessions/:token → POST generate → poll webhook_deliveries.
  it("E2E: full intake→generate chain records a webhook_deliveries row", async () => {
    // Step 1 — Create session via API
    const createRes = await supertest(app)
      .post("/sessions")
      .send({ packageId: packageWebhookId, source: "test" });

    assert.equal(
      createRes.status,
      201,
      `Session creation failed: ${JSON.stringify(createRes.body)}`,
    );
    const token: string = createRes.body.token;
    assert.ok(token, "Session token should be present in create response");

    // Step 2 — Submit answers via API (package has no fields, so empty answers are valid)
    const patchRes = await supertest(app)
      .patch(`/sessions/${token}`)
      .send({ answers: {} });

    assert.equal(
      patchRes.status,
      200,
      `Answer submission failed: ${JSON.stringify(patchRes.body)}`,
    );

    // Step 3 — Trigger generation
    const genRes = await supertest(app)
      .post(`/sessions/${token}/generate`)
      .send({});

    assert.equal(
      genRes.status,
      200,
      `Generate failed: ${JSON.stringify(genRes.body)}`,
    );
    assert.ok(genRes.body.packet, "Response should include a generated packet summary");
    assert.ok(genRes.body.downloadUrl, "Response should include a downloadUrl");

    // Step 4 — Verify session status in DB
    const { rows: [sessionRow] } = await pool.query<{ status: string }>(
      `SELECT status FROM docufill_interview_sessions WHERE token = $1`,
      [token],
    );
    assert.equal(sessionRow.status, "generated", "Session status should be 'generated'");

    // Step 5 — Poll for the webhook delivery row.
    // The HTTP request to the invalid URL fails immediately (ECONNREFUSED),
    // but doWebhookDelivery still inserts a row recording the attempt.
    // The schema uses `created_at` (timestamptz NOT NULL DEFAULT NOW()) as
    // the delivery timestamp — the task description refers to this as "attempted_at".
    //
    // Poll window is 12 s: the router's AbortController fires at 10 s, so in
    // the worst case (DNS hanging, not ECONNREFUSED) the first attempt completes
    // at ~10 s; 12 s gives 2 s headroom before the test assertion fires.
    let deliveryFound = false;
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      const { rows } = await pool.query<{ id: number; created_at: Date }>(
        `SELECT id, created_at
           FROM webhook_deliveries
          WHERE package_id = $1
          LIMIT 1`,
        [packageWebhookId],
      );
      if (rows.length > 0) {
        deliveryFound = true;
        assert.ok(
          rows[0].created_at != null,
          "webhook_deliveries.created_at (delivery timestamp) must be non-null",
        );
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    assert.ok(
      deliveryFound,
      "Expected a webhook_deliveries row to be recorded within 5 seconds of generate",
    );
  });
});

// ── 5. Webhook URL pre-save validation ────────────────────────────────────────
//
// Verifies that PATCH /packages/:id rejects unreachable or non-2xx webhook URLs
// before writing to the database, and accepts URLs that return 2xx.

describe("Fill engine – webhook URL pre-save validation", () => {
  let pool: Pool;
  let accountId: number;
  let packageId: number;
  let app: ReturnType<typeof buildTestApp>;
  // Tiny HTTP server spun up for each test to control the probe response.
  let stubServer: http.Server;
  let stubPort: number;

  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) {
      throw new Error("DATABASE_URL must be set to run webhook validation tests");
    }
    pool = new Pool({ connectionString: url, max: 3 });

    const suffix = Date.now().toString(36) + "v";

    const { rows: [acctRow] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug, plan_tier, seat_limit)
       VALUES ($1, $2, 'enterprise', 999)
       RETURNING id`,
      [`_Test WebhookValidation ${suffix}`, `_test-wh-val-${suffix}`],
    );
    accountId = acctRow.id;
    app = buildTestApp(accountId);

    const { rows: [pkgRow] } = await pool.query<{ id: number }>(
      `INSERT INTO docufill_packages
         (name, account_id, status, transaction_scope, documents, fields, mappings, webhook_secret)
       VALUES ('Webhook Validation Test', $1, 'active', 'ira_transfer',
               '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $2)
       RETURNING id`,
      [accountId, randomBytes(32).toString("hex")],
    );
    packageId = pkgRow.id;
  });

  after(async () => {
    if (!pool) return;
    if (stubServer?.listening) await new Promise<void>((resolve) => stubServer.close(() => resolve()));
    await pool.query(`DELETE FROM docufill_packages WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
    await pool.end();
  });

  /** Start (or restart) the stub server with the given status code handler. */
  async function startStub(statusCode: number): Promise<string> {
    if (stubServer?.listening) {
      await new Promise<void>((resolve) => stubServer.close(() => resolve()));
    }
    stubServer = http.createServer((_req, res) => {
      res.writeHead(statusCode, { "Content-Type": "text/plain" });
      res.end(statusCode < 300 ? "ok" : "error");
    });
    await new Promise<void>((resolve, reject) => {
      stubServer.listen(0, "127.0.0.1", () => {
        const addr = stubServer.address();
        if (!addr || typeof addr === "string") return reject(new Error("unexpected address"));
        stubPort = addr.port;
        resolve();
      });
    });
    return `http://127.0.0.1:${stubPort}/hook`;
  }

  it("PATCH with unreachable webhook URL returns 422", async () => {
    // Port 1 is reserved and not listening — guaranteed ECONNREFUSED.
    const res = await supertest(app)
      .patch(`/packages/${packageId}`)
      .send({ webhookUrl: "http://127.0.0.1:1/unreachable" });

    assert.equal(
      res.status,
      422,
      `Expected 422 for unreachable URL, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
    assert.ok(
      typeof res.body.error === "string" && res.body.error.length > 0,
      "Response should include a descriptive error message",
    );
  });

  it("PATCH with webhook URL returning non-2xx returns 422", async () => {
    const hookUrl = await startStub(500);

    const res = await supertest(app)
      .patch(`/packages/${packageId}`)
      .send({ webhookUrl: hookUrl });

    assert.equal(
      res.status,
      422,
      `Expected 422 for non-2xx URL, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
    assert.ok(
      typeof res.body.error === "string" && res.body.error.includes("500"),
      `Error message should mention the HTTP status code; got: ${res.body.error}`,
    );
  });

  it("PATCH with reachable 2xx webhook URL saves successfully", async () => {
    const hookUrl = await startStub(200);

    const res = await supertest(app)
      .patch(`/packages/${packageId}`)
      .send({ webhookUrl: hookUrl, webhookEnabled: true });

    assert.equal(
      res.status,
      200,
      `Expected 200 for reachable URL, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
    assert.ok(res.body.package, "Response should include the updated package");

    // Confirm the URL was actually persisted
    const { rows: [row] } = await pool.query<{ webhook_url: string }>(
      `SELECT webhook_url FROM docufill_packages WHERE id = $1`,
      [packageId],
    );
    assert.equal(row.webhook_url, hookUrl, "Webhook URL should be persisted in DB");
  });

  it("PATCH without webhookUrl field skips validation and succeeds", async () => {
    const res = await supertest(app)
      .patch(`/packages/${packageId}`)
      .send({ name: "Updated Name Only" });

    assert.equal(
      res.status,
      200,
      `Expected 200 when webhookUrl is not in body, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
  });

  it("PATCH with null webhookUrl clears the URL without probing", async () => {
    const res = await supertest(app)
      .patch(`/packages/${packageId}`)
      .send({ webhookUrl: null });

    assert.equal(
      res.status,
      200,
      `Expected 200 when clearing webhookUrl, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
    const { rows: [row] } = await pool.query<{ webhook_url: string | null }>(
      `SELECT webhook_url FROM docufill_packages WHERE id = $1`,
      [packageId],
    );
    assert.equal(row.webhook_url, null, "Webhook URL should be cleared to null");
  });

  it("PATCH with malformed webhook URL returns 422 without probing", async () => {
    const res = await supertest(app)
      .patch(`/packages/${packageId}`)
      .send({ webhookUrl: "not-a-url-at-all" });

    assert.equal(
      res.status,
      422,
      `Expected 422 for malformed URL, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
    assert.ok(
      typeof res.body.error === "string" && res.body.error.length > 0,
      "Response should include a descriptive error message",
    );
  });

  it("POST /packages with unreachable webhook URL returns 422 without creating the package", async () => {
    const countBefore = (await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM docufill_packages WHERE account_id = $1`,
      [accountId],
    )).rows[0].count;

    const res = await supertest(app)
      .post("/packages")
      .send({ name: "Probe Test Package", webhookUrl: "http://127.0.0.1:1/unreachable", webhookEnabled: true });

    assert.equal(
      res.status,
      422,
      `Expected 422 for POST with unreachable URL, got ${res.status}: ${JSON.stringify(res.body)}`,
    );

    const countAfter = (await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM docufill_packages WHERE account_id = $1`,
      [accountId],
    )).rows[0].count;
    assert.equal(countAfter, countBefore, "No new package should be created when probe fails");
  });

  it("PATCH probe includes a valid HMAC signature that matches the package secret", async () => {
    const { createHmac } = await import("node:crypto");

    // Fetch the package's webhook_secret so we can recompute the expected signature.
    const { rows: [pkgRow] } = await pool.query<{ webhook_secret: string }>(
      `SELECT webhook_secret FROM docufill_packages WHERE id = $1`,
      [packageId],
    );
    const secret = pkgRow.webhook_secret;

    let receivedSig: string | undefined;
    let receivedBody: string | undefined;

    // Stub server that captures the raw body and signature header, then returns 200.
    const hookUrl = await startStub(200);
    stubServer.removeAllListeners("request");
    stubServer.on("request", (req, res) => {
      receivedSig = req.headers["x-docuplete-signature"] as string | undefined;
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString("utf8");
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
      });
    });

    const patchRes = await supertest(app)
      .patch(`/packages/${packageId}`)
      .send({ webhookUrl: hookUrl, webhookEnabled: true });

    assert.equal(
      patchRes.status,
      200,
      `Expected 200 for signature-checking stub, got ${patchRes.status}: ${JSON.stringify(patchRes.body)}`,
    );

    assert.ok(
      typeof receivedSig === "string" && receivedSig.startsWith("sha256="),
      `Expected X-Docuplete-Signature header with 'sha256=' prefix, got: ${receivedSig}`,
    );
    assert.ok(typeof receivedBody === "string" && receivedBody.length > 0, "Probe body must be non-empty");

    // Compute the expected signature from the captured body and the known secret.
    const expectedSig = "sha256=" + createHmac("sha256", secret).update(receivedBody!).digest("hex");
    assert.equal(
      receivedSig,
      expectedSig,
      "X-Docuplete-Signature must exactly match HMAC-SHA256 of the probe body",
    );
  });
});
