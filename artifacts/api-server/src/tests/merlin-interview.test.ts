/**
 * Merlin customer interview conversation flow tests
 *
 * Covers the public customer-facing Merlin endpoint:
 *   POST /sessions/:token/merlin
 *
 * Test strategy
 * ─────────────
 * Rather than mocking ES modules (which conflicts with the tsx/esm loader),
 * we redirect the real Anthropic SDK to a lightweight local stub HTTP server.
 * The route already supports AI_INTEGRATIONS_ANTHROPIC_BASE_URL for the Replit
 * proxy integration; pointing that env-var at our stub lets us control every
 * Anthropic response without any module-level mocking.
 *
 * A real database is used (DATABASE_URL must be set).  Throw-away accounts,
 * packages, and sessions are created in before() and removed in after().
 *
 * Test cases
 * ──────────
 * 1. Input validation: missing / empty messages → 400
 * 2. Non-existent / expired session → SSE error event
 * 3. Completed session → SSE error event ("already complete")
 * 4. First turn: system prompt includes the OPENING greeting instruction
 * 5. First turn: system prompt does NOT include OPENING on subsequent turns
 * 6. Subsequent turn with stored name: system prompt includes KNOWN FACT
 * 7. No stored name: system prompt does NOT include KNOWN FACT
 * 8. update_form_fields tool call → SSE field_updates event with correct values
 * 9. No tool call in response → no field_updates SSE event
 * 10. Customer first name is persisted to DB when a first-name field is updated
 * 11. Conditional field: system prompt includes CONDITIONAL logic
 * 12. Chunk SSE events are emitted for each text fragment
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import supertest from "supertest";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";

// ── Anthropic SSE stub server ──────────────────────────────────────────────────
// Speaks just enough of Anthropic's streaming protocol to satisfy the SDK.

type StubConfig = {
  textChunks: string[];
  toolBlocks: Array<{ id: string; name: string; input: unknown }>;
};

let stubConfig: StubConfig = { textChunks: ["Hello!"], toolBlocks: [] };
let lastRequestBody: Record<string, unknown> = {};

/** Build an SSE response string for the Anthropic messages/stream endpoint. */
function buildAnthropicSSE(cfg: StubConfig): string {
  const lines: string[] = [];

  function sse(event: string, data: unknown) {
    lines.push(`event: ${event}`, `data: ${JSON.stringify(data)}`, "");
  }

  sse("message_start", {
    type: "message_start",
    message: {
      id: "msg_stub",
      type: "message",
      role: "assistant",
      content: [],
      model: "claude-sonnet-4-6",
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 50, output_tokens: 0 },
    },
  });

  let blockIndex = 0;

  // Text block (if any text chunks)
  if (cfg.textChunks.length > 0) {
    sse("content_block_start", {
      type: "content_block_start",
      index: blockIndex,
      content_block: { type: "text", text: "" },
    });
    for (const chunk of cfg.textChunks) {
      sse("content_block_delta", {
        type: "content_block_delta",
        index: blockIndex,
        delta: { type: "text_delta", text: chunk },
      });
    }
    sse("content_block_stop", { type: "content_block_stop", index: blockIndex });
    blockIndex++;
  }

  // Tool use blocks (if any)
  for (const tool of cfg.toolBlocks) {
    sse("content_block_start", {
      type: "content_block_start",
      index: blockIndex,
      content_block: { type: "tool_use", id: tool.id, name: tool.name, input: {} },
    });
    sse("content_block_delta", {
      type: "content_block_delta",
      index: blockIndex,
      delta: { type: "input_json_delta", partial_json: JSON.stringify(tool.input) },
    });
    sse("content_block_stop", { type: "content_block_stop", index: blockIndex });
    blockIndex++;
  }

  const stopReason = cfg.toolBlocks.length > 0 ? "tool_use" : "end_turn";
  sse("message_delta", {
    type: "message_delta",
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: cfg.textChunks.length + cfg.toolBlocks.length },
  });
  sse("message_stop", { type: "message_stop" });

  // SSE spec: each event block must be terminated with \n\n.
  // join("\n") gives a trailing single \n after the last empty element;
  // the extra "\n" here ensures the final event block is properly closed.
  return lines.join("\n") + "\n";
}

/** Start the Anthropic stub server; returns the base URL. */
async function startStubServer(): Promise<{ url: string; server: http.Server }> {
  const server = http.createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }

    let body = "";
    req.on("data", (c: Buffer) => { body += c.toString(); });
    req.on("end", () => {
      try {
        lastRequestBody = JSON.parse(body) as Record<string, unknown>;
      } catch {
        lastRequestBody = {};
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.end(buildAnthropicSSE(stubConfig));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as { port: number };
  return { url: `http://127.0.0.1:${addr.port}`, server };
}

// ── SSE response parser ────────────────────────────────────────────────────────

function parseSSE(body: string): Record<string, unknown>[] {
  return body
    .split(/\n\n+/)
    .map((block) => {
      const line = block.split("\n").find((l) => l.startsWith("data: "));
      if (!line) return null;
      try {
        return JSON.parse(line.slice(6)) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((v): v is Record<string, unknown> => v !== null);
}

// ── Test package fields ────────────────────────────────────────────────────────

const TEST_FIELDS = [
  {
    id: "f_first_name",
    name: "First Name",
    label: "First Name",
    type: "text",
    interviewMode: "required",
  },
  {
    id: "f_last_name",
    name: "Last Name",
    label: "Last Name",
    type: "text",
    interviewMode: "required",
  },
  {
    id: "f_citizenship",
    name: "Citizenship Status",
    label: "Citizenship Status",
    type: "radio",
    interviewMode: "required",
    options: ["US Citizen", "Permanent Resident", "Other"],
  },
  {
    id: "f_foreign_id",
    name: "Foreign ID Number",
    label: "Foreign ID Number",
    type: "text",
    interviewMode: "optional",
    condition: {
      fieldId: "f_citizenship",
      operator: "equals",
      value: "Other",
    },
  },
];

// ── Shared state ───────────────────────────────────────────────────────────────

let pool: Pool;
let app: express.Express;
let accountId: number;
let packageId: number;
let stubServer: http.Server;
const suffix = randomBytes(4).toString("hex");
const createdTokens: string[] = [];

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("Merlin customer interview – conversation flow", () => {
  before(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL must be set to run Merlin tests");
    pool = new Pool({ connectionString: url, max: 3 });

    // Throw-away account
    const { rows: [acct] } = await pool.query<{ id: number }>(
      `INSERT INTO accounts (name, slug) VALUES ($1, $2) RETURNING id`,
      [`_Test Merlin ${suffix}`, `_test-merlin-${suffix}`],
    );
    accountId = acct.id;

    // Package with fields (including one conditional field).
    // webhook_secret is NOT NULL with no default, so must be provided.
    const { rows: [pkg] } = await pool.query<{ id: number }>(
      `INSERT INTO docufill_packages (account_id, name, status, fields, webhook_secret)
       VALUES ($1, $2, 'active', $3::jsonb, $4) RETURNING id`,
      [accountId, `_Test Merlin Package ${suffix}`, JSON.stringify(TEST_FIELDS), `wsec_${suffix}`],
    );
    packageId = pkg.id;

    // Start Anthropic stub and point the route at it
    const stub = await startStubServer();
    stubServer = stub.server;
    process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"] = stub.url;
    process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"]  = "sk-stub-test-key";

    // Import the router AFTER env vars are set so getAnthropicClient()
    // picks up the stub URL on every request.
    const { publicMerlinRouter } = await import("../routes/merlin.js");
    app = express();
    app.use(express.json());
    app.use("/", publicMerlinRouter);
  });

  after(async () => {
    if (createdTokens.length > 0) {
      await pool?.query(
        `DELETE FROM docufill_interview_sessions WHERE token = ANY($1::text[])`,
        [createdTokens],
      );
    }
    if (accountId) {
      await pool?.query(`DELETE FROM docufill_packages WHERE account_id = $1`, [accountId]);
      await pool?.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
    }
    await pool?.end();
    await new Promise<void>((resolve) => stubServer?.close(() => resolve()));
    delete process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
    delete process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"];
  });

  // ── Helper: create a test session ──────────────────────────────────────────

  async function createSession(opts: {
    storedName?: string | null;
    prefill?: Record<string, unknown>;
    status?: string;
  } = {}): Promise<string> {
    const token = `df_mrln_${suffix}_${randomBytes(4).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await pool.query(
      `INSERT INTO docufill_interview_sessions
         (token, account_id, package_id, package_version, status, prefill, expires_at, customer_first_name)
       VALUES ($1, $2, $3, 1, $4, $5::jsonb, $6, $7)`,
      [
        token,
        accountId,
        packageId,
        opts.status ?? "in_progress",
        JSON.stringify(opts.prefill ?? {}),
        expiresAt,
        opts.storedName ?? null,
      ],
    );
    createdTokens.push(token);
    return token;
  }

  function resetStub(overrides: Partial<StubConfig> = {}) {
    stubConfig = { textChunks: ["Hello!"], toolBlocks: [], ...overrides };
    lastRequestBody = {};
  }

  // Capture the system prompt from the last request to the stub
  function capturedSystem(): string {
    return String(lastRequestBody["system"] ?? "");
  }
  function capturedMessages(): unknown[] {
    return Array.isArray(lastRequestBody["messages"])
      ? (lastRequestBody["messages"] as unknown[])
      : [];
  }

  // ── 1. Input validation ─────────────────────────────────────────────────────

  it("returns 400 when messages is absent", async () => {
    const res = await supertest(app)
      .post("/sessions/any-token/merlin")
      .send({});
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it("returns 400 when messages is an empty array", async () => {
    const res = await supertest(app)
      .post("/sessions/any-token/merlin")
      .send({ messages: [] });
    assert.equal(res.status, 400);
  });

  // ── 2. Non-existent / expired session ─────────────────────────────────────

  it("emits error SSE event for an unknown session token", async () => {
    const res = await supertest(app)
      .post("/sessions/df_no_such_session_xyz/merlin")
      .send({ messages: [{ role: "user", content: "Hi" }] });

    assert.equal(res.status, 200);
    const events = parseSSE(res.text);
    const errEvent = events.find((e) => e["type"] === "error");
    assert.ok(errEvent, `Expected error SSE event; got ${JSON.stringify(events)}`);
    assert.match(String(errEvent["message"] ?? ""), /not found|expired/i);
  });

  it("emits error SSE event when session is already generated", async () => {
    const token = await createSession({ status: "generated" });
    const res = await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({ messages: [{ role: "user", content: "Hi" }] });

    assert.equal(res.status, 200);
    const events = parseSSE(res.text);
    const errEvent = events.find((e) => e["type"] === "error");
    assert.ok(errEvent, `Expected error SSE event; got ${JSON.stringify(events)}`);
    assert.match(String(errEvent["message"] ?? ""), /complete|already/i);
  });

  // ── 3. First turn greeting ─────────────────────────────────────────────────

  it("first turn: system prompt includes OPENING greeting instruction", async () => {
    resetStub({ textChunks: ["Hi, I'm Merlin! I'll be helping you fill out this form today."] });
    const token = await createSession({});

    const res = await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({ messages: [{ role: "user", content: "Hi there" }] });

    assert.equal(res.status, 200);
    const events = parseSSE(res.text);
    assert.ok(events.some((e) => e["type"] === "done"));

    const sysPrompt = capturedSystem();
    assert.ok(
      sysPrompt.includes("OPENING"),
      "Expected 'OPENING' in system prompt on first turn",
    );
    assert.ok(
      sysPrompt.includes("Hi, I'm Merlin"),
      "Expected greeting script in system prompt on first turn",
    );
  });

  it("first turn: no assistant messages are forwarded to Anthropic", async () => {
    resetStub({ textChunks: ["I'm Merlin!"] });
    const token = await createSession({});

    await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({ messages: [{ role: "user", content: "Hello" }] });

    const msgs = capturedMessages() as Array<{ role: string }>;
    assert.ok(
      msgs.every((m) => m.role !== "assistant"),
      "No assistant messages should be sent on the first turn",
    );
  });

  it("subsequent turns: OPENING instruction is absent from system prompt", async () => {
    resetStub({ textChunks: ["Got it, thanks!"] });
    const token = await createSession({});

    await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Hi, I'm Merlin!" },
          { role: "user", content: "Alice" },
        ],
      });

    assert.ok(
      !capturedSystem().includes("OPENING: This is the very first message"),
      "OPENING instruction must not appear on subsequent turns",
    );
  });

  // ── 4. Customer name in system prompt ─────────────────────────────────────

  it("subsequent turn: system prompt includes KNOWN FACT with stored customer name", async () => {
    resetStub({ textChunks: ["Great, Alice!"] });
    const token = await createSession({ storedName: "Alice" });

    await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "What's your name?" },
          { role: "user", content: "Alice" },
        ],
      });

    const sysPrompt = capturedSystem();
    assert.ok(
      sysPrompt.includes("KNOWN FACT"),
      "Expected 'KNOWN FACT' in system prompt when storedName is set",
    );
    assert.ok(
      sysPrompt.includes("Alice"),
      "Expected stored name 'Alice' in system prompt",
    );
  });

  it("no stored name: system prompt does NOT include KNOWN FACT", async () => {
    resetStub({ textChunks: ["What's your name?"] });
    const token = await createSession({ storedName: null });

    await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({ messages: [{ role: "user", content: "Hello" }] });

    assert.ok(
      !capturedSystem().includes("KNOWN FACT"),
      "System prompt must not include KNOWN FACT when no name is stored",
    );
  });

  // ── 5. update_form_fields tool call → field_updates SSE event ─────────────

  it("emits field_updates SSE event when Anthropic calls update_form_fields", async () => {
    resetStub({
      textChunks: ["Perfect, I've got your name."],
      toolBlocks: [
        {
          id: "toolu_abc",
          name: "update_form_fields",
          input: { updates: { f_first_name: "Bob", f_last_name: "Smith" } },
        },
      ],
    });
    const token = await createSession({});

    const res = await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "What's your name?" },
          { role: "user", content: "Bob Smith" },
        ],
      });

    assert.equal(res.status, 200);
    const events = parseSSE(res.text);
    const fieldUpdateEvent = events.find((e) => e["type"] === "field_updates");
    assert.ok(
      fieldUpdateEvent,
      `Expected field_updates SSE event; got: ${JSON.stringify(events)}`,
    );

    const updates = fieldUpdateEvent["updates"] as Record<string, string>;
    assert.equal(updates["f_first_name"], "Bob");
    assert.equal(updates["f_last_name"], "Smith");
  });

  it("no field_updates SSE event when no tool call is returned", async () => {
    resetStub({ textChunks: ["Let me ask you another question."], toolBlocks: [] });
    const token = await createSession({});

    const res = await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({ messages: [{ role: "user", content: "Hello" }] });

    assert.equal(res.status, 200);
    const events = parseSSE(res.text);
    assert.ok(
      !events.some((e) => e["type"] === "field_updates"),
      "Expected no field_updates event when Anthropic returns no tool call",
    );
  });

  it("update_form_fields with correct values for multiple fields", async () => {
    resetStub({
      textChunks: ["Great, noted!"],
      toolBlocks: [
        {
          id: "toolu_xyz",
          name: "update_form_fields",
          input: {
            updates: {
              f_citizenship: "US Citizen",
              f_last_name:   "Johnson",
            },
          },
        },
      ],
    });
    const token = await createSession({});

    const res = await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Are you a US citizen?" },
          { role: "user", content: "Yes, I'm a US citizen. Last name is Johnson." },
        ],
      });

    assert.equal(res.status, 200);
    const events = parseSSE(res.text);
    const fu = events.find((e) => e["type"] === "field_updates");
    assert.ok(fu, "Expected field_updates event");
    const updates = fu["updates"] as Record<string, string>;
    assert.equal(updates["f_citizenship"], "US Citizen");
    assert.equal(updates["f_last_name"], "Johnson");
  });

  // ── 6. Customer first name persisted to DB ─────────────────────────────────

  it("persists customer first name to DB when a first-name field is updated", async () => {
    resetStub({
      textChunks: ["Thanks, Carol!"],
      toolBlocks: [
        {
          id: "toolu_persist",
          name: "update_form_fields",
          input: { updates: { f_first_name: "Carol" } },
        },
      ],
    });
    const token = await createSession({ storedName: null });

    const res = await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "What's your first name?" },
          { role: "user", content: "Carol" },
        ],
      });

    assert.equal(res.status, 200);
    assert.ok(parseSSE(res.text).some((e) => e["type"] === "field_updates"));

    const { rows } = await pool.query<{ customer_first_name: string }>(
      `SELECT customer_first_name FROM docufill_interview_sessions WHERE token = $1`,
      [token],
    );
    assert.equal(
      rows[0]?.customer_first_name,
      "Carol",
      "Expected 'Carol' persisted as customer_first_name in the DB",
    );
  });

  // ── 7. Conditional fields in system prompt ─────────────────────────────────

  it("system prompt includes CONDITIONAL logic for conditional fields", async () => {
    resetStub({ textChunks: ["Are you a US citizen?"] });
    const token = await createSession({});

    const res = await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({ messages: [{ role: "user", content: "Hi" }] });

    assert.equal(res.status, 200);
    const sysPrompt = capturedSystem();

    assert.ok(
      sysPrompt.includes("CONDITIONAL"),
      "Expected 'CONDITIONAL' in system prompt for fields with conditions",
    );
    assert.ok(
      sysPrompt.includes("Citizenship Status"),
      "Expected trigger field name 'Citizenship Status' in CONDITIONAL description",
    );
    assert.ok(
      sysPrompt.includes("Foreign ID Number"),
      "Expected conditional field 'Foreign ID Number' to appear in system prompt",
    );
  });

  it("conditional field appears in system prompt with its trigger condition even when unanswered", async () => {
    resetStub({ textChunks: ["Let me ask about your citizenship."] });
    const token = await createSession({});

    // Answers are empty — the trigger field is not answered
    await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({
        messages: [{ role: "user", content: "Hello" }],
        answers: {},
      });

    const sysPrompt = capturedSystem();
    assert.ok(
      sysPrompt.includes("Foreign ID Number"),
      "Conditional field must appear in system prompt so Merlin can reason about skipping it",
    );
    assert.ok(
      sysPrompt.includes("CONDITIONAL"),
      "CONDITIONAL tag must be present so Merlin knows when to ask",
    );
  });

  // ── 8. Conditional field skip behavior ────────────────────────────────────
  //
  // The system prompt tells Merlin to respect conditional logic. These tests
  // verify the outcome-level behavior: when a trigger condition is NOT met,
  // the conditional field is absent from field_updates (Merlin skips it); when
  // the condition IS met, it can be updated.

  it("conditional field is NOT updated when its trigger condition is not met", async () => {
    // f_foreign_id is conditional on f_citizenship === "Other".
    // Here citizenship is "US Citizen" → condition is NOT met.
    // The mock simulates a well-behaved Merlin that skips the conditional field.
    resetStub({
      textChunks: ["Got it, you're a US citizen. What's your last name?"],
      toolBlocks: [
        {
          id: "toolu_skip_cond",
          name: "update_form_fields",
          input: {
            updates: {
              f_citizenship: "US Citizen",
              // f_foreign_id intentionally absent — condition not met
            },
          },
        },
      ],
    });
    const token = await createSession({});

    const res = await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({
        messages: [
          { role: "user", content: "I'm a US citizen." },
        ],
        answers: {},
      });

    assert.equal(res.status, 200);
    const events = parseSSE(res.text);
    const fu = events.find((e) => e["type"] === "field_updates");
    assert.ok(fu, "Expected a field_updates event");

    const updates = fu["updates"] as Record<string, string>;
    assert.equal(updates["f_citizenship"], "US Citizen",
      "Citizenship field should be updated");
    assert.ok(
      !("f_foreign_id" in updates),
      "Conditional field f_foreign_id must NOT be in field_updates when trigger condition is unmet",
    );
  });

  it("conditional field IS updated when its trigger condition is met", async () => {
    // f_foreign_id is conditional on f_citizenship === "Other".
    // Here citizenship is "Other" → condition IS met; Merlin can update the field.
    resetStub({
      textChunks: ["Thanks! What is your foreign ID number?"],
      toolBlocks: [
        {
          id: "toolu_cond_met",
          name: "update_form_fields",
          input: {
            updates: {
              f_foreign_id: "A12345678",
            },
          },
        },
      ],
    });
    const token = await createSession({});

    const res = await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({
        messages: [
          { role: "user", content: "My foreign ID is A12345678." },
        ],
        // f_citizenship = "Other" satisfies the condition for f_foreign_id
        answers: { f_citizenship: "Other" },
      });

    assert.equal(res.status, 200);
    const events = parseSSE(res.text);
    const fu = events.find((e) => e["type"] === "field_updates");
    assert.ok(fu, "Expected a field_updates event when condition is met");

    const updates = fu["updates"] as Record<string, string>;
    assert.equal(
      updates["f_foreign_id"],
      "A12345678",
      "Conditional field must be updatable when its trigger condition is satisfied",
    );
  });

  it("system prompt marks trigger field as answered when condition is met", async () => {
    // Verify the system prompt correctly reflects that f_citizenship is answered
    // as "Other", enabling Merlin to reason that f_foreign_id should be asked.
    resetStub({ textChunks: ["What is your foreign ID number?"] });
    const token = await createSession({});

    await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({
        messages: [
          { role: "user", content: "I hold foreign status." },
        ],
        answers: { f_citizenship: "Other" },
      });

    const sysPrompt = capturedSystem();
    // The system prompt's field summary should show f_citizenship as answered
    assert.ok(
      sysPrompt.includes('[answered: "Other"]'),
      "System prompt must show f_citizenship as answered with 'Other' so Merlin knows the condition is met",
    );
    // f_foreign_id should appear as pending (not yet answered)
    assert.ok(
      sysPrompt.includes("f_foreign_id") && sysPrompt.includes("[pending]"),
      "Conditional field should appear as pending when condition is met",
    );
  });

  it("system prompt shows trigger field as answered with non-trigger value so Merlin can skip", async () => {
    // When citizenship is answered but NOT "Other", Merlin should see the
    // condition is unmet and skip f_foreign_id even though it's still pending.
    resetStub({ textChunks: ["Great, what's your last name?"] });
    const token = await createSession({});

    await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({
        messages: [
          { role: "user", content: "I'm a permanent resident." },
        ],
        answers: { f_citizenship: "Permanent Resident" },
      });

    const sysPrompt = capturedSystem();
    // The system prompt must show f_citizenship as answered with "Permanent Resident"
    assert.ok(
      sysPrompt.includes('[answered: "Permanent Resident"]'),
      "System prompt must reflect the actual answer so Merlin can evaluate whether the condition is met",
    );
    // The CONDITIONAL tag for f_foreign_id must still be present so Merlin
    // knows to skip it when the value is not "Other"
    assert.ok(
      sysPrompt.includes("CONDITIONAL") && sysPrompt.includes("Other"),
      "CONDITIONAL tag with trigger value 'Other' must appear so Merlin can determine condition is not met",
    );
  });

  // ── 9. Chunk SSE events ───────────────────────────────────────────────────

  it("emits one chunk SSE event per text fragment from Anthropic", async () => {
    resetStub({ textChunks: ["Hello ", "there ", "friend!"] });
    const token = await createSession({});

    const res = await supertest(app)
      .post(`/sessions/${token}/merlin`)
      .send({ messages: [{ role: "user", content: "Hi" }] });

    assert.equal(res.status, 200);
    const events = parseSSE(res.text);
    const chunkEvents = events.filter((e) => e["type"] === "chunk");

    assert.ok(
      chunkEvents.length >= 3,
      `Expected at least 3 chunk events; got ${chunkEvents.length}: ${JSON.stringify(chunkEvents)}`,
    );
    const combined = chunkEvents.map((e) => String(e["text"] ?? "")).join("");
    assert.equal(combined, "Hello there friend!");
    assert.ok(events.some((e) => e["type"] === "done"), "Expected a done event at end");
  });
});
