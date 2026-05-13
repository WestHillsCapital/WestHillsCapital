/**
 * Load & Stress Tests — Enterprise API Endpoints
 *
 * Fires concurrent HTTP requests against the live API server running on
 * localhost:8080 (started by the "API Server" workflow).  A real API key
 * and SCIM token are seeded in the DB before the suite runs and cleaned
 * up afterwards.
 *
 * Metrics reported per scenario
 * ─────────────────────────────
 *   • Total requests    • Successes / Errors
 *   • Total duration    • Requests/sec (RPS)
 *   • p50 / p95 / p99 latency (ms)
 *
 * Thresholds (fail the test if exceeded)
 * ────────────────────────────────────────
 *   • Error rate < 5 %
 *   • p99 latency < 3 000 ms  (generous for dev)
 *   • RPS > 5  (sanity floor)
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";

// ── Config ─────────────────────────────────────────────────────────────────────

const BASE_URL    = "http://localhost:8080";
const CONCURRENCY = 15;   // parallel in-flight requests per batch
const TOTAL_REQS  = 150;  // total requests per scenario

const P99_THRESHOLD_MS  = 3_000;
const ERROR_RATE_MAX    = 0.05;   // 5 %
const MIN_RPS           = 5;

// ── Types ──────────────────────────────────────────────────────────────────────

interface Metrics {
  total:    number;
  success:  number;
  errors:   number;
  totalMs:  number;
  latencies: number[];
  rps:      number;
  p50:      number;
  p95:      number;
  p99:      number;
  errorRate: number;
}

// ── HTTP helper ────────────────────────────────────────────────────────────────

function httpRequest(opts: {
  method:  string;
  path:    string;
  headers?: Record<string, string>;
  body?:   string;
}): Promise<{ status: number; body: string; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const url    = new URL(opts.path, BASE_URL);
    const start  = Date.now();
    const reqOpts: http.RequestOptions = {
      method:   opts.method,
      hostname: url.hostname,
      port:     Number(url.port) || 8080,
      path:     url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
        ...opts.headers,
        ...(opts.body ? { "Content-Length": String(Buffer.byteLength(opts.body)) } : {}),
      },
    };

    const req = http.request(reqOpts, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          body:   Buffer.concat(chunks).toString(),
          latencyMs: Date.now() - start,
        });
      });
    });

    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ── Load driver ────────────────────────────────────────────────────────────────

async function runLoad(
  label: string,
  requestFn: () => Promise<{ status: number; latencyMs: number }>,
  total = TOTAL_REQS,
  concurrency = CONCURRENCY,
): Promise<Metrics> {
  const latencies: number[] = [];
  let success = 0;
  let errors  = 0;

  const wallStart = Date.now();

  // Run in batches of `concurrency`
  for (let sent = 0; sent < total; sent += concurrency) {
    const batch = Math.min(concurrency, total - sent);
    const results = await Promise.allSettled(
      Array.from({ length: batch }, () => requestFn()),
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        latencies.push(r.value.latencyMs);
        if (r.value.status >= 200 && r.value.status < 300) {
          success++;
        } else if (r.value.status === 207) {
          // Bulk create returns 207 — count as success
          success++;
        } else {
          errors++;
        }
      } else {
        errors++;
        latencies.push(5_000); // penalise connection-refused as 5s
      }
    }
  }

  const totalMs = Date.now() - wallStart;
  const sorted  = [...latencies].sort((a, b) => a - b);
  const p = (pct: number) => sorted[Math.floor(sorted.length * pct / 100)] ?? 0;

  const metrics: Metrics = {
    total: total,
    success,
    errors,
    totalMs,
    latencies,
    rps:       Math.round((total / totalMs) * 1000),
    p50:       p(50),
    p95:       p(95),
    p99:       p(99),
    errorRate: errors / total,
  };

  console.log(
    `\n  ⚡ ${label}\n` +
    `     ${total} reqs, ${concurrency} concurrent → ${totalMs}ms total\n` +
    `     ✓ ${success} success  ✗ ${errors} errors  (${(metrics.errorRate * 100).toFixed(1)}% error rate)\n` +
    `     RPS: ${metrics.rps}   p50: ${metrics.p50}ms   p95: ${metrics.p95}ms   p99: ${metrics.p99}ms`,
  );

  return metrics;
}

// ── Shared state ───────────────────────────────────────────────────────────────

let pool: Pool;
let accountId: number;
let rawApiKey: string;
let rawScimToken: string;
let packageId: number;
const suffix = randomBytes(4).toString("hex");

// ── Global before / after ─────────────────────────────────────────────────────

before(async () => {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL must be set");
  pool = new Pool({ connectionString: url, max: 10 });

  // Verify server is reachable
  try {
    const probe = await httpRequest({ method: "GET", path: "/health" });
    if (probe.status !== 200) throw new Error(`Server returned ${probe.status}`);
  } catch {
    // /health might not exist; try any route
    try {
      await httpRequest({ method: "GET", path: "/api/v1/sessions" });
    } catch (err) {
      throw new Error(
        `Load tests require the API server to be running on ${BASE_URL}. ` +
        `Start the "API Server" workflow first.  Inner error: ${err}`,
      );
    }
  }

  // Create test account
  const { rows: [acct] } = await pool.query<{ id: number }>(
    `INSERT INTO accounts (name, slug) VALUES ($1, $2) RETURNING id`,
    [`_Load Test ${suffix}`, `_load-test-${suffix}`],
  );
  accountId = acct.id;

  // Seed API key
  rawApiKey = `dp_live_${randomBytes(20).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawApiKey).digest("hex");
  await pool.query(
    `INSERT INTO account_api_keys (account_id, name, key_hash, key_prefix)
     VALUES ($1, $2, $3, $4)`,
    [accountId, "_load-test-key", keyHash, rawApiKey.substring(0, 12)],
  );

  // Seed SCIM token
  rawScimToken = `scim_${randomBytes(20).toString("hex")}`;
  const scimHash = createHash("sha256").update(rawScimToken).digest("hex");
  await pool.query(
    `INSERT INTO scim_tokens (account_id, name, token_hash, token_prefix)
     VALUES ($1, $2, $3, $4)`,
    [accountId, "_load-test-scim", scimHash, rawScimToken.substring(0, 12)],
  );

  // Seed package and 20 sessions as read-load data
  const { rows: [pkg] } = await pool.query<{ id: number }>(
    `INSERT INTO docuplete_packages
       (name, account_id, status, version, documents, fields, mappings, recipients, tags, webhook_secret)
     VALUES ($1, $2, 'active', 1, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, $3)
     RETURNING id`,
    [`_Load Test Pkg ${suffix}`, accountId, randomBytes(16).toString("hex")],
  );
  packageId = pkg.id;

  // Seed 20 sessions for list read-load
  for (let i = 0; i < 20; i++) {
    const tok = `df_load_${i}_${randomBytes(8).toString("hex")}`;
    await pool.query(
      `INSERT INTO docuplete_interview_sessions (token, status, account_id, package_id, package_version, expires_at)
       VALUES ($1, 'draft', $2, $3, 1, NOW() + INTERVAL '1 day')`,
      [tok, accountId, packageId],
    );
  }

  console.log(`\n  Load test account id=${accountId}, packageId=${packageId}`);
});

after(async () => {
  if (pool && accountId) {
    // Delete child records before the account to satisfy FK constraints
    await pool.query(`DELETE FROM docuplete_audit_logs WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM docuplete_session_signers WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM docuplete_interview_sessions WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM docuplete_packages WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM scim_tokens WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM account_users WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM account_api_keys WHERE account_id = $1`, [accountId]);
    await pool.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
  }
  await pool?.end();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Sessions List — read-heavy load
// ═══════════════════════════════════════════════════════════════════════════════

describe("Load Test — Sessions List (GET /api/v1/sessions)", () => {
  it(`sustains ${TOTAL_REQS} requests at ${CONCURRENCY} concurrent within thresholds`, async () => {
    const metrics = await runLoad(
      "GET /api/v1/sessions",
      () => httpRequest({
        method:  "GET",
        path:    `/api/v1/sessions?limit=20`,
        headers: { Authorization: `Bearer ${rawApiKey}` },
      }),
    );

    assert.ok(
      metrics.errorRate < ERROR_RATE_MAX,
      `Error rate ${(metrics.errorRate * 100).toFixed(1)}% exceeds ${ERROR_RATE_MAX * 100}% threshold`,
    );
    assert.ok(
      metrics.p99 < P99_THRESHOLD_MS,
      `p99 ${metrics.p99}ms exceeds ${P99_THRESHOLD_MS}ms threshold`,
    );
    assert.ok(
      metrics.rps >= MIN_RPS,
      `RPS ${metrics.rps} is below minimum ${MIN_RPS}`,
    );
  });

  it("filtered query (by packageId) remains fast under load", async () => {
    const metrics = await runLoad(
      `GET /api/v1/sessions?packageId=${packageId}`,
      () => httpRequest({
        method:  "GET",
        path:    `/api/v1/sessions?packageId=${packageId}`,
        headers: { Authorization: `Bearer ${rawApiKey}` },
      }),
      60,  // lighter load — just validate the filter path
      10,
    );

    assert.ok(
      metrics.errorRate < ERROR_RATE_MAX,
      `Filtered list error rate ${(metrics.errorRate * 100).toFixed(1)}% too high`,
    );
    assert.ok(metrics.p95 < P99_THRESHOLD_MS, `p95 ${metrics.p95}ms too slow`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Bulk Session Creation — write-heavy load
// ═══════════════════════════════════════════════════════════════════════════════

describe("Load Test — Bulk Session Creation (POST /api/v1/sessions/bulk)", () => {
  it("creates sessions in bulk at sustained concurrency", async () => {
    const body = JSON.stringify({
      sessions: Array.from({ length: 5 }, () => ({
        packageId,
        prefill: { ref: `load-${Date.now()}` },
      })),
    });

    const metrics = await runLoad(
      "POST /api/v1/sessions/bulk (5-item batches)",
      async () => {
        const r = await httpRequest({
          method:  "POST",
          path:    "/api/v1/sessions/bulk",
          headers: { Authorization: `Bearer ${rawApiKey}` },
          body,
        });
        // 207 is the success code for bulk
        return { status: r.status === 207 ? 200 : r.status, latencyMs: r.latencyMs };
      },
      40,   // 40 bulk requests × 5 sessions = 200 sessions created
      8,
    );

    assert.ok(
      metrics.errorRate < ERROR_RATE_MAX,
      `Bulk create error rate ${(metrics.errorRate * 100).toFixed(1)}% too high`,
    );
    assert.ok(
      metrics.p99 < P99_THRESHOLD_MS,
      `Bulk create p99 ${metrics.p99}ms too slow`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SCIM Users List — read load
// ═══════════════════════════════════════════════════════════════════════════════

describe("Load Test — SCIM Users List (GET /api/scim/v2/Users)", () => {
  it(`sustains ${TOTAL_REQS} SCIM list requests within thresholds`, async () => {
    const metrics = await runLoad(
      "GET /api/scim/v2/Users",
      () => httpRequest({
        method:  "GET",
        path:    "/api/scim/v2/Users",
        headers: {
          Authorization: `Bearer ${rawScimToken}`,
          Accept:        "application/scim+json",
        },
      }),
    );

    assert.ok(
      metrics.errorRate < ERROR_RATE_MAX,
      `SCIM error rate ${(metrics.errorRate * 100).toFixed(1)}% too high`,
    );
    assert.ok(
      metrics.p99 < P99_THRESHOLD_MS,
      `SCIM p99 ${metrics.p99}ms too slow`,
    );
    assert.ok(metrics.rps >= MIN_RPS, `SCIM RPS ${metrics.rps} below floor`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Mixed concurrency stress test
// ═══════════════════════════════════════════════════════════════════════════════

describe("Stress Test — Mixed concurrent endpoint calls", () => {
  it("handles simultaneous read and write requests without errors", async () => {
    const readFn = () => httpRequest({
      method:  "GET",
      path:    "/api/v1/sessions",
      headers: { Authorization: `Bearer ${rawApiKey}` },
    });

    const writeFn = () => httpRequest({
      method:  "POST",
      path:    "/api/v1/sessions/bulk",
      headers: { Authorization: `Bearer ${rawApiKey}` },
      body:    JSON.stringify({ sessions: [{ packageId }] }),
    });

    const scimFn = () => httpRequest({
      method:  "GET",
      path:    "/api/scim/v2/Users",
      headers: { Authorization: `Bearer ${rawScimToken}` },
    });

    // Interleave: 2 reads, 1 write, 1 SCIM per "unit"
    const latencies: number[] = [];
    let success = 0;
    let errors  = 0;
    const wallStart = Date.now();

    const MIXED_TOTAL = 40;
    for (let i = 0; i < MIXED_TOTAL; i += 4) {
      const results = await Promise.allSettled([
        readFn(), readFn(), writeFn(), scimFn(),
      ]);
      for (const r of results) {
        if (r.status === "fulfilled") {
          latencies.push(r.value.latencyMs);
          const ok = r.value.status === 200 || r.value.status === 207;
          ok ? success++ : errors++;
        } else {
          errors++;
        }
      }
    }

    const totalMs = Date.now() - wallStart;
    const sorted  = [...latencies].sort((a, b) => a - b);
    const p99     = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
    const errRate = errors / (success + errors);

    console.log(
      `\n  ⚡ Mixed Stress\n` +
      `     ${success + errors} requests in ${totalMs}ms\n` +
      `     ✓ ${success}  ✗ ${errors}  p99: ${p99}ms`,
    );

    assert.ok(errRate < ERROR_RATE_MAX, `Mixed stress error rate ${(errRate * 100).toFixed(1)}% too high`);
    assert.ok(p99 < P99_THRESHOLD_MS, `Mixed stress p99 ${p99}ms too slow`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Auth rejection load test (should never hit the DB)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Load Test — Auth rejection throughput", () => {
  it("rejects 100 invalid keys quickly without degradation", async () => {
    const metrics = await runLoad(
      "GET /api/v1/sessions (invalid key)",
      async () => {
        const r = await httpRequest({
          method:  "GET",
          path:    "/api/v1/sessions",
          headers: {
            Authorization: "Bearer dp_live_invalid_key_xyz_12345",
            // Use a unique fake IP so these failures never poison the 127.0.0.1
            // rate-limit bucket that valid-key tests use.
            "X-Forwarded-For": "10.99.99.99",
          },
        });
        // 401 (auth rejected) and 429 (rate limited) are both valid rejection outcomes
        const isRejected = r.status === 401 || r.status === 429;
        return { status: isRejected ? 200 : 500, latencyMs: r.latencyMs };
      },
      100,
      20,
    );

    assert.ok(
      metrics.errorRate < ERROR_RATE_MAX,
      `Auth rejection error rate ${(metrics.errorRate * 100).toFixed(1)}% — server may be failing on bad keys`,
    );
    assert.ok(
      metrics.p99 < 5_000,
      `Auth rejection p99 ${metrics.p99}ms — rate limiting may be blocking`,
    );
  });
});
