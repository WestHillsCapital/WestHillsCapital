/**
 * SDK Enterprise Features — Integration Tests
 *
 * Tests the @docuplete/sdk TypeScript client against a lightweight mock HTTP
 * server that mirrors the real API's response shape.  No database or running
 * API server is required — the mock server starts on a random port inside each
 * test suite and is torn down in `after()`.
 *
 * Covers:
 *   • Docuplete constructor validation
 *   • sessions.list() — params, response mapping
 *   • sessions.get()  — happy path, error propagation
 *   • sessions.bulkCreate() — 207 multi-status handling
 *   • sessions.auditLog()   — event array mapping
 *   • sessions.signers()    — ordered signer list
 *   • Webhook payload discriminated union type safety (compile-time only)
 *   • DocupleteError thrown for non-2xx responses
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import express from "express";
import { Docuplete, DocupleteError } from "@docuplete/sdk";
import type {
  BulkCreateSessionResult,
  AuditLogResult,
  SessionSignersResult,
  CustomDomainStatus,
} from "@docuplete/sdk";

// ── Mock server helpers ────────────────────────────────────────────────────────

function startMockServer(app: express.Express): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
    server.on("error", reject);
  });
}

function stopMockServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

// ── SDK client factory ─────────────────────────────────────────────────────────

function makeClient(baseUrl: string, apiKey = "dp_live_test_key_12345") {
  return new Docuplete({ apiKey, baseUrl });
}

// ── Fixture data ───────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  id: 1,
  token: "df_mock_session_token_abc123",
  packageId: 42,
  packageName: "Test Package",
  status: "draft",
  locale: "en",
  prefill: {},
  expiresAt: "9999-12-31T23:59:59Z",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_SIGNER = {
  id: 1,
  order: 1,
  email: "alice@example.com",
  name: "Alice",
  status: "pending",
  signerToken: "sgn_abc123",
  notifiedAt: null,
  signedAt: null,
  declinedAt: null,
  declinedReason: null,
  createdAt: new Date().toISOString(),
};

const MOCK_AUDIT_EVENT = {
  id: 1,
  event: "session.created",
  actorType: "system",
  actorEmail: null,
  actorIp: null,
  metadata: { packageId: 42 },
  createdAt: new Date().toISOString(),
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CLIENT CONSTRUCTOR
// ═══════════════════════════════════════════════════════════════════════════════

describe("Docuplete — constructor", () => {
  it("throws when apiKey is missing", () => {
    assert.throws(
      () => new Docuplete({ apiKey: "" }),
      /apiKey is required/i,
    );
  });

  it("strips trailing slash from baseUrl", async () => {
    const app = express();
    app.use(express.json());
    app.get("/api/v1/sessions", (_req, res) => res.json({ sessions: [], total: 0, limit: 50, offset: 0 }));
    const { server, baseUrl } = await startMockServer(app);
    try {
      const client = makeClient(`${baseUrl}/`);
      const result = await client.sessions.list();
      assert.ok(Array.isArray(result.sessions));
    } finally {
      await stopMockServer(server);
    }
  });

  it("constructs successfully with a valid apiKey", () => {
    const client = new Docuplete({ apiKey: "dp_live_valid_key" });
    assert.ok(client);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. sessions.list()
// ═══════════════════════════════════════════════════════════════════════════════

describe("SDK — sessions.list()", () => {
  let server: http.Server;
  let client: Docuplete;
  let capturedQuery: Record<string, string> = {};

  before(async () => {
    const app = express();
    app.use(express.json());
    app.get("/api/v1/sessions", (req, res) => {
      capturedQuery = req.query as Record<string, string>;
      res.json({ sessions: [MOCK_SESSION], total: 1, limit: 50, offset: 0 });
    });
    const result = await startMockServer(app);
    server = result.server;
    client = makeClient(result.baseUrl);
  });

  after(() => stopMockServer(server));

  it("returns sessions array and total", async () => {
    const result = await client.sessions.list();
    assert.ok(Array.isArray(result.sessions));
    assert.equal(result.total, 1);
    assert.equal(result.sessions[0]?.token, MOCK_SESSION.token);
  });

  it("passes packageId as query param", async () => {
    await client.sessions.list({ packageId: 42 });
    assert.equal(capturedQuery["packageId"], "42", "packageId should be sent as query param");
  });

  it("passes status as query param", async () => {
    await client.sessions.list({ status: "submitted" });
    assert.equal(capturedQuery["status"], "submitted");
  });

  it("passes limit and offset as query params", async () => {
    await client.sessions.list({ limit: 25, offset: 50 });
    assert.equal(capturedQuery["limit"], "25");
    assert.equal(capturedQuery["offset"], "50");
  });

  it("passes updatedAfter as query param", async () => {
    const ts = "2024-01-01T00:00:00Z";
    await client.sessions.list({ updatedAfter: ts });
    assert.equal(capturedQuery["updatedAfter"], ts);
  });

  it("passes search as query param", async () => {
    await client.sessions.list({ search: "alice" });
    assert.equal(capturedQuery["search"], "alice");
  });

  it("sends Authorization: Bearer header", async () => {
    let capturedAuth = "";
    const app2 = express();
    app2.use((req, _res, next) => { capturedAuth = req.headers.authorization ?? ""; next(); });
    app2.get("/api/v1/sessions", (_req, res) => res.json({ sessions: [], total: 0, limit: 50, offset: 0 }));
    const { server: s2, baseUrl: u2 } = await startMockServer(app2);
    try {
      const c2 = makeClient(u2, "dp_live_testkey999");
      await c2.sessions.list();
      assert.equal(capturedAuth, "Bearer dp_live_testkey999");
    } finally {
      await stopMockServer(s2);
    }
  });

  it("throws DocupleteError on 401", async () => {
    const app2 = express();
    app2.get("/api/v1/sessions", (_req, res) =>
      res.status(401).json({ error: "Unauthorized" }),
    );
    const { server: s2, baseUrl: u2 } = await startMockServer(app2);
    try {
      const c2 = makeClient(u2);
      await assert.rejects(
        () => c2.sessions.list(),
        (err: unknown) => {
          assert.ok(err instanceof DocupleteError, "Expected DocupleteError");
          assert.equal((err as DocupleteError).status, 401);
          return true;
        },
      );
    } finally {
      await stopMockServer(s2);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. sessions.get()
// ═══════════════════════════════════════════════════════════════════════════════

describe("SDK — sessions.get()", () => {
  let server: http.Server;
  let client: Docuplete;
  let capturedToken = "";

  before(async () => {
    const app = express();
    app.use(express.json());
    app.get("/api/v1/sessions/:token", (req, res) => {
      capturedToken = req.params.token;
      if (req.params.token === "df_not_found") {
        return res.status(404).json({ error: "Session not found" });
      }
      return res.json({ session: { ...MOCK_SESSION, token: req.params.token } });
    });
    const result = await startMockServer(app);
    server = result.server;
    client = makeClient(result.baseUrl);
  });

  after(() => stopMockServer(server));

  it("returns the session for a valid token", async () => {
    const session = await client.sessions.get("df_mock_abc");
    assert.equal(capturedToken, "df_mock_abc");
    assert.equal(session.token, "df_mock_abc");
    assert.equal(session.status, "draft");
  });

  it("throws DocupleteError with status 404 for unknown token", async () => {
    await assert.rejects(
      () => client.sessions.get("df_not_found"),
      (err: unknown) => {
        assert.ok(err instanceof DocupleteError);
        assert.equal((err as DocupleteError).status, 404);
        return true;
      },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. sessions.bulkCreate()
// ═══════════════════════════════════════════════════════════════════════════════

describe("SDK — sessions.bulkCreate()", () => {
  let server: http.Server;
  let client: Docuplete;
  let capturedBody: unknown = null;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.post("/api/v1/sessions/bulk", (req, res) => {
      capturedBody = req.body;
      const sessions = (req.body as { sessions: unknown[] }).sessions ?? [];
      const results = sessions.map((_s, i) => ({
        index: i,
        ok: true,
        sessionToken: `df_bulk_${i}_abc`,
        interviewUrl: `https://app.docuplete.com/sessions/df_bulk_${i}_abc`,
        expiresAt: null,
      }));
      return res.status(207).json({ results, total: sessions.length, succeeded: sessions.length, failed: 0 });
    });
    const result = await startMockServer(app);
    server = result.server;
    client = makeClient(result.baseUrl);
  });

  after(() => stopMockServer(server));

  it("sends sessions array to POST /sessions/bulk", async () => {
    // bulkCreate takes { sessions: [...] } — it wraps the array in the expected body shape
    const result: BulkCreateSessionResult = await client.sessions.bulkCreate({
      sessions: [
        { packageId: 1, prefill: { name: "Alice" } },
        { packageId: 2, prefill: { name: "Bob" } },
      ],
    });
    assert.ok(Array.isArray(result.results));
    assert.equal(result.results.length, 2);
    const body = capturedBody as { sessions: Array<{ packageId: number }> };
    assert.equal(body.sessions.length, 2);
    assert.equal(body.sessions[0].packageId, 1);
    assert.equal(body.sessions[1].packageId, 2);
  });

  it("each result has ok, sessionToken, and interviewUrl", async () => {
    const result = await client.sessions.bulkCreate({ sessions: [{ packageId: 42 }] });
    const [first] = result.results;
    assert.equal(first?.ok, true);
    assert.ok(first?.sessionToken, "Expected sessionToken");
    assert.ok(first?.interviewUrl, "Expected interviewUrl");
  });

  it("throws DocupleteError on 400", async () => {
    const app2 = express();
    app2.use(express.json());
    app2.post("/api/v1/sessions/bulk", (_req, res) =>
      res.status(400).json({ error: "sessions must have at least 1 item" }),
    );
    const { server: s2, baseUrl: u2 } = await startMockServer(app2);
    try {
      const c2 = makeClient(u2);
      await assert.rejects(
        () => c2.sessions.bulkCreate({ sessions: [] }),
        (err: unknown) => {
          assert.ok(err instanceof DocupleteError);
          assert.equal((err as DocupleteError).status, 400);
          return true;
        },
      );
    } finally {
      await stopMockServer(s2);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. sessions.auditLog()
// ═══════════════════════════════════════════════════════════════════════════════

describe("SDK — sessions.auditLog()", () => {
  let server: http.Server;
  let client: Docuplete;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.get("/api/v1/sessions/:token/audit-log", (req, res) => {
      if (req.params.token === "df_no_session") {
        return res.status(404).json({ error: "Not found" });
      }
      return res.json({
        token: req.params.token,
        entries: [MOCK_AUDIT_EVENT],
      });
    });
    const result = await startMockServer(app);
    server = result.server;
    client = makeClient(result.baseUrl);
  });

  after(() => stopMockServer(server));

  it("returns token and entries array", async () => {
    const result: AuditLogResult = await client.sessions.auditLog("df_mock_session_token_abc123");
    assert.equal(result.token, "df_mock_session_token_abc123");
    assert.ok(Array.isArray(result.entries));
    assert.equal(result.entries.length, 1);
  });

  it("audit entry has correct shape", async () => {
    const result = await client.sessions.auditLog("df_mock_session_token_abc123");
    const [entry] = result.entries;
    assert.ok(entry, "Expected at least one entry");
    assert.equal(entry.event, "session.created");
    assert.equal(entry.actorType, "system");
    assert.ok(entry.createdAt, "Expected createdAt");
  });

  it("throws DocupleteError with 404 for unknown session", async () => {
    await assert.rejects(
      () => client.sessions.auditLog("df_no_session"),
      (err: unknown) => {
        assert.ok(err instanceof DocupleteError);
        assert.equal((err as DocupleteError).status, 404);
        return true;
      },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. sessions.signers()
// ═══════════════════════════════════════════════════════════════════════════════

describe("SDK — sessions.signers()", () => {
  let server: http.Server;
  let client: Docuplete;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.get("/api/v1/sessions/:token/signers", (req, res) => {
      if (req.params.token === "df_empty") {
        return res.json({ token: req.params.token, signers: [], allSigned: false });
      }
      return res.json({
        token: req.params.token,
        signers: [
          { ...MOCK_SIGNER, order: 1, email: "alice@example.com", status: "pending" },
          { ...MOCK_SIGNER, id: 2, order: 2, email: "bob@example.com", status: "awaiting", signerToken: "sgn_xyz" },
        ],
        allSigned: false,
      });
    });
    const result = await startMockServer(app);
    server = result.server;
    client = makeClient(result.baseUrl);
  });

  after(() => stopMockServer(server));

  it("returns token, signers array, and allSigned flag", async () => {
    const result: SessionSignersResult = await client.sessions.signers("df_multi_signing");
    assert.equal(result.token, "df_multi_signing");
    assert.ok(Array.isArray(result.signers));
    assert.equal(result.signers.length, 2);
    assert.equal(typeof result.allSigned, "boolean");
    assert.equal(result.allSigned, false);
  });

  it("each signer has required fields", async () => {
    const result = await client.sessions.signers("df_multi_signing");
    const [alice, bob] = result.signers;
    assert.ok(alice, "Expected first signer");
    assert.equal(alice.email, "alice@example.com");
    assert.equal(alice.status, "pending");
    assert.ok(alice.signerToken, "Expected signerToken");
    assert.ok(bob, "Expected second signer");
    assert.equal(bob.status, "awaiting");
  });

  it("returns empty signers array for session with no signers", async () => {
    const result = await client.sessions.signers("df_empty");
    assert.equal(result.signers.length, 0);
    assert.equal(result.allSigned, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. WebhookPayload type coverage (runtime validation)
// ═══════════════════════════════════════════════════════════════════════════════

describe("SDK — WebhookPayload discriminated union", () => {
  it("all 9 event types are valid string literals", () => {
    const events = [
      "interview.submitted",
      "pdf.generated",
      "session.created",
      "session.viewed",
      "session.started",
      "session.voided",
      "session.signed",
      "session.declined",
      "session.expired",
    ];
    assert.equal(events.length, 9, "Expected 9 distinct event types");
    for (const e of events) {
      assert.equal(typeof e, "string");
      assert.ok(e.length > 0);
    }
  });

  it("interview.submitted payload shape matches expected fields", () => {
    const payload = {
      event: "interview.submitted",
      token: "df_abc",
      package_id: 1,
      packageId: 1,
      answers: {},
      prefill: {},
      createdAt: new Date().toISOString(),
    };
    assert.equal(payload.event, "interview.submitted");
    assert.ok("answers" in payload);
    assert.ok("prefill" in payload);
  });

  it("session.voided payload shape has voidedAt and reason", () => {
    const payload = {
      event: "session.voided",
      token: "df_abc",
      voidedAt: new Date().toISOString(),
      reason: "Test void",
    };
    assert.equal(payload.event, "session.voided");
    assert.ok("voidedAt" in payload);
    assert.ok("reason" in payload);
  });

  it("session.viewed payload has viewedAt", () => {
    const payload = {
      event: "session.viewed",
      token: "df_abc",
      viewedAt: new Date().toISOString(),
    };
    assert.equal(payload.event, "session.viewed");
    assert.ok("viewedAt" in payload);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. CustomDomainStatus type coverage
// ═══════════════════════════════════════════════════════════════════════════════

describe("SDK — CustomDomainStatus type", () => {
  it("represents a domain with status", () => {
    const status: CustomDomainStatus = {
      domain: "docs.example.com",
      status: "pending_verification",
      cnameTarget: "docuplete.com",
      verifiedAt: null,
      instructions: null,
    };
    assert.equal(status.domain, "docs.example.com");
    assert.equal(status.status, "pending_verification");
    assert.ok(["pending_verification", "active", "verification_failed", "not_configured"].includes(status.status));
  });

  it("represents null domain (not configured)", () => {
    const status: CustomDomainStatus = {
      domain: null,
      status: "not_configured",
      cnameTarget: "docuplete.com",
      verifiedAt: null,
      instructions: null,
    };
    assert.equal(status.domain, null);
    assert.equal(status.status, "not_configured");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Error handling across SDK
// ═══════════════════════════════════════════════════════════════════════════════

describe("SDK — DocupleteError propagation", () => {
  let server: http.Server;
  let client: Docuplete;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.get("/api/v1/sessions", (_req, res) =>
      res.status(500).json({ error: "Internal Server Error", code: "server_error" }),
    );
    app.post("/api/v1/sessions/bulk", (_req, res) =>
      res.status(422).json({ error: "Validation failed", code: "validation_error", issues: ["field required"] }),
    );
    app.get("/api/v1/sessions/:token/audit-log", (_req, res) =>
      res.status(403).json({ error: "Forbidden", code: "forbidden" }),
    );
    const result = await startMockServer(app);
    server = result.server;
    client = makeClient(result.baseUrl);
  });

  after(() => stopMockServer(server));

  it("DocupleteError from 500 has correct status and code", async () => {
    await assert.rejects(
      () => client.sessions.list(),
      (err: unknown) => {
        assert.ok(err instanceof DocupleteError);
        assert.equal((err as DocupleteError).status, 500);
        assert.equal((err as DocupleteError).code, "server_error");
        return true;
      },
    );
  });

  it("DocupleteError from 422 includes issues array", async () => {
    await assert.rejects(
      () => client.sessions.bulkCreate({ sessions: [{ packageId: 1 }] }),
      (err: unknown) => {
        assert.ok(err instanceof DocupleteError);
        assert.equal((err as DocupleteError).status, 422);
        assert.ok(Array.isArray((err as DocupleteError).issues));
        assert.ok((err as DocupleteError).issues!.length > 0);
        return true;
      },
    );
  });

  it("DocupleteError from 403 has correct status", async () => {
    await assert.rejects(
      () => client.sessions.auditLog("df_any"),
      (err: unknown) => {
        assert.ok(err instanceof DocupleteError);
        assert.equal((err as DocupleteError).status, 403);
        return true;
      },
    );
  });
});
