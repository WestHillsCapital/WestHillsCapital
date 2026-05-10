/**
 * Sandbox session synthetic probe.
 *
 * Runs the full sandbox cycle — GET /api/v1/sandbox/start,
 * PATCH /api/v1/docuplete/public/sessions/:token (fill answers), and
 * POST /api/v1/docuplete/public/sessions/:token/generate — against the
 * local API server and records step-by-step timing and success/failure.
 *
 * The probe result is cached in memory and exposed via GET /api/healthz/sandbox.
 * Failures fire a Sentry alert and an email to PROBE_ALERT_EMAIL (or ADMIN_EMAIL).
 *
 * Design decisions:
 *  - Calls the actual HTTP endpoints so that route-level validation, middleware,
 *    and schema parsing are all exercised (the same layer that broke in #658).
 *  - Cleans up the probe session row immediately after the generate step so no
 *    real PDF is persisted and the BullMQ worker can drop the orphaned job quietly.
 *  - Self-contained: the probe's alert path avoids importing email.ts to keep the
 *    dependency graph clean (uses fetch → Resend API directly).
 */

import * as Sentry from "@sentry/node";
import { getDb } from "../db.js";
import { logger } from "./logger.js";

// ── Alert config ────────────────────────────────────────────────────────────
const RESEND_API_KEY      = process.env.RESEND_API_KEY;
const FROM_EMAIL          = process.env.FROM_EMAIL ?? "Docuplete <noreply@westhillscapital.com>";
const PROBE_ALERT_EMAIL   = process.env.PROBE_ALERT_EMAIL ?? process.env.ADMIN_EMAIL ?? "";

const PROBE_TIMEOUT_MS    = 20_000; // per-step HTTP timeout
const PROBE_INTERVAL_MS   = 5 * 60 * 1_000; // 5 minutes

// ── Types ────────────────────────────────────────────────────────────────────

export interface SandboxProbeStepResult {
  ok: boolean;
  durationMs: number;
  statusCode?: number;
  error?: string;
}

export interface SandboxProbeResult {
  ok: boolean;
  durationMs: number;
  checkedAt: string;
  steps: {
    start:    SandboxProbeStepResult;
    patch?:   SandboxProbeStepResult;
    generate?: SandboxProbeStepResult;
    cleanup?: SandboxProbeStepResult;
  };
  error?: string;
}

// ── In-process state ─────────────────────────────────────────────────────────

let _lastResult: SandboxProbeResult | null = null;
let _probeInterval: ReturnType<typeof setInterval> | null = null;
let _consecutiveFailures = 0;

export function getLastProbeResult(): SandboxProbeResult | null {
  return _lastResult;
}

// ── Demo answers — satisfy all DEMO_FIELDS required constraints ───────────────
// Keyed by field.id (NOT field.source) — the frontend writes answers keyed by
// field.id and the backend's validateSessionAnswers reads answers[field.id]
// first. Source-keyed answers only resolve via the prefill fallback, which the
// probe doesn't populate. Using source keys would make the probe falsely report
// "missing required fields" 400s while real users succeed.
const PROBE_ANSWERS: Record<string, string> = {
  client_first_name:    "Probe",
  client_last_name:     "Monitor",
  client_email:         "probe@sandbox.docuplete.com",
  client_dob:           "1990-01-01",
  client_address_line1: "123 Health Check Lane",
  client_city:          "Monitorville",
  client_state:         "CA",
  client_zip:           "90210",
};

// ── Step runner ───────────────────────────────────────────────────────────────

async function step<T>(
  fn: () => Promise<{ value: T; statusCode?: number }>,
): Promise<{ value: T | null; result: SandboxProbeStepResult }> {
  const t0 = Date.now();
  try {
    const { value, statusCode } = await fn();
    return { value, result: { ok: true, durationMs: Date.now() - t0, statusCode } };
  } catch (err) {
    return {
      value: null,
      result: {
        ok: false,
        durationMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

// ── Core probe ────────────────────────────────────────────────────────────────

export async function runSandboxProbe(baseUrl: string): Promise<SandboxProbeResult> {
  const t0         = Date.now();
  const checkedAt  = new Date().toISOString();
  const steps: SandboxProbeResult["steps"] = {} as SandboxProbeResult["steps"];

  // ── 1. Start sandbox session ────────────────────────────────────────────────
  const { value: token, result: startResult } = await step(async () => {
    const res = await fetch(`${baseUrl}/api/v1/sandbox/start`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const statusCode = res.status;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw Object.assign(new Error(`HTTP ${statusCode}: ${text}`), { statusCode });
    }
    const body = (await res.json()) as { sessionToken?: string };
    if (!body.sessionToken) throw new Error("Response missing sessionToken");
    return { value: body.sessionToken, statusCode };
  });
  steps.start = startResult;

  if (!token) {
    return { ok: false, durationMs: Date.now() - t0, checkedAt, steps, error: startResult.error };
  }

  // ── 2. PATCH answers ────────────────────────────────────────────────────────
  const { value: patchOk, result: patchResult } = await step(async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/docuplete/public/sessions/${token}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: PROBE_ANSWERS }),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      },
    );
    const statusCode = res.status;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw Object.assign(new Error(`HTTP ${statusCode}: ${text}`), { statusCode });
    }
    return { value: true as const, statusCode };
  });
  steps.patch = patchResult;

  if (!patchOk) {
    void cleanupSession(token, steps);
    return { ok: false, durationMs: Date.now() - t0, checkedAt, steps, error: patchResult.error };
  }

  // ── 3. POST generate ────────────────────────────────────────────────────────
  // The generate endpoint responds 200 (sync, no queue) or 202 (async, queued).
  // We capture the jobId from a 202 so we can poll for completion before cleanup.
  let generateJobId: string | null = null;
  let generateSyncDone = false;

  const { value: genOk, result: generateResult } = await step(async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/docuplete/public/sessions/${token}/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      },
    );
    const statusCode = res.status;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw Object.assign(new Error(`HTTP ${statusCode}: ${text}`), { statusCode });
    }
    const body = await res.json().catch(() => ({})) as { jobId?: string };
    if (statusCode === 200) {
      // Synchronous path (queue disabled) — generation already complete.
      generateSyncDone = true;
    } else if (statusCode === 202 && body.jobId) {
      // Asynchronous path — job is queued; we must wait before deleting the session.
      generateJobId = body.jobId;
    }
    return { value: true as const, statusCode };
  });
  steps.generate = generateResult;

  if (!genOk) {
    // Generate failed — clean up the session immediately since no job was queued.
    void cleanupSession(token, steps);
    return { ok: false, durationMs: Date.now() - t0, checkedAt, steps, error: generateResult.error };
  }

  // ── 4. Wait for async generation to reach a terminal state ─────────────────
  // Only needed in the async (queue-enabled) path. Deleting the session while a
  // BullMQ job is still processing it causes the worker to fail with
  // "Session not found", creating Sentry noise and unnecessary retries.
  // waitForGeneration returns true=success, false=generation failed, null=timeout.
  let asyncGenerationOk: boolean | null = null;
  if (generateJobId && !generateSyncDone) {
    asyncGenerationOk = await waitForGeneration(baseUrl, token, generateJobId, steps);
  }

  // ── Cleanup — delete the probe session after generation is complete ─────────
  // Safe to delete now: either generation was synchronous and finished, or the
  // async job has reached a terminal state (ready/failed).
  void cleanupSession(token, steps);

  // An async failure (worker returned "failed") is a real probe failure.
  // A null (poll timeout) is treated as a warning, not a hard failure.
  const asyncFailed = asyncGenerationOk === false;
  const ok = startResult.ok && patchResult.ok && generateResult.ok && !asyncFailed;
  const error = asyncFailed
    ? "PDF generation worker reported failure (generate-status: failed)"
    : (ok ? undefined : generateResult.error);
  return {
    ok,
    durationMs: Date.now() - t0,
    checkedAt,
    steps,
    ...(error ? { error } : {}),
  };
}

// ── Wait for async PDF generation ─────────────────────────────────────────────
// Polls /generate-status until the job reaches a terminal state (ready/failed)
// or the timeout elapses.
//
// Returns:
//   true  — generation completed successfully (status "ready" or "generated")
//   false — generation failed (status "failed")
//   null  — timed out or polling error; outcome unknown (treated as non-fatal)
const GENERATE_WAIT_TIMEOUT_MS = 25_000;
const GENERATE_POLL_INTERVAL_MS = 1_500;

async function waitForGeneration(
  baseUrl: string,
  token: string,
  jobId: string,
  steps: SandboxProbeResult["steps"],
): Promise<boolean | null> {
  const deadline = Date.now() + GENERATE_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, GENERATE_POLL_INTERVAL_MS));

    try {
      const res = await fetch(
        `${baseUrl}/api/v1/docuplete/public/sessions/${token}/generate-status?jobId=${encodeURIComponent(jobId)}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!res.ok) break; // Non-2xx — stop polling, return unknown

      const body = (await res.json()) as { status?: string; error?: string };
      const status = body.status;

      if (status === "ready" || status === "generated") {
        logger.debug({ token, jobId, status }, "[SandboxProbe] Generation completed successfully");
        return true;
      }
      if (status === "failed") {
        const workerError = body.error ?? "worker reported failure";
        logger.warn({ token, jobId, workerError }, "[SandboxProbe] Generation job failed");
        // Surface the failure in the generate step result
        steps.generate = {
          ...(steps.generate ?? { durationMs: 0 }),
          ok: false,
          error: workerError,
        };
        return false;
      }
      // status === "pending" | "processing" — keep polling
    } catch {
      // Network or timeout error during polling — stop, outcome unknown
      break;
    }
  }

  // Timed out or stopped early — treat as unknown (non-fatal for the probe).
  // Add a brief extra wait so the BullMQ worker has a head start before cleanup.
  logger.warn({ token, jobId }, "[SandboxProbe] Generate-status poll timed out — cleaning up anyway");
  await new Promise<void>((r) => setTimeout(r, 2_000));
  return null;
}

async function cleanupSession(
  token: string,
  steps: SandboxProbeResult["steps"],
): Promise<void> {
  const t0 = Date.now();
  try {
    const db = getDb();
    await db.query(
      `DELETE FROM docufill_interview_sessions WHERE token = $1`,
      [token],
    );
    steps.cleanup = { ok: true, durationMs: Date.now() - t0 };
  } catch (err) {
    steps.cleanup = {
      ok: false,
      durationMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Alert ─────────────────────────────────────────────────────────────────────

async function sendProbeAlertEmail(result: SandboxProbeResult): Promise<void> {
  // Email alert — requires RESEND_API_KEY and a recipient address.
  // Sentry is already captured at the call site on every failure tick.
  if (!RESEND_API_KEY || !PROBE_ALERT_EMAIL) return;

  const stepRows = Object.entries(result.steps)
    .map(([name, s]) => {
      if (!s) return "";
      const icon   = s.ok ? "✅" : "❌";
      const code   = s.statusCode ? ` (HTTP ${s.statusCode})` : "";
      const errStr = s.error ? `<br><small style="color:#dc2626">${s.error}</small>` : "";
      return `<tr>
        <td style="padding:4px 8px;font-family:monospace">${name}</td>
        <td style="padding:4px 8px">${icon}${code}${errStr}</td>
        <td style="padding:4px 8px">${s.durationMs} ms</td>
      </tr>`;
    })
    .join("\n");

  const html = `
<p>The Docuplete sandbox synthetic monitor detected a failure at <strong>${result.checkedAt}</strong>.</p>
<p>Total duration: <strong>${result.durationMs} ms</strong></p>
<table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px">
  <thead>
    <tr style="background:#f3f4f6">
      <th style="padding:4px 8px;text-align:left">Step</th>
      <th style="padding:4px 8px;text-align:left">Result</th>
      <th style="padding:4px 8px;text-align:left">Duration</th>
    </tr>
  </thead>
  <tbody>
    ${stepRows}
  </tbody>
</table>
<p style="margin-top:16px;color:#6b7280;font-size:12px">
  This alert is sent when consecutive sandbox probe failures are detected.<br>
  Check the API server logs and Sentry for more detail.
</p>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [PROBE_ALERT_EMAIL],
        subject: `[ALERT] Docuplete sandbox probe failed — ${result.checkedAt}`,
        html,
      }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "[SandboxProbe] Alert email send failed");
    } else {
      logger.info({ to: PROBE_ALERT_EMAIL }, "[SandboxProbe] Alert email sent");
    }
  } catch (err) {
    logger.warn({ err }, "[SandboxProbe] Alert email send threw");
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

async function tick(baseUrl: string): Promise<void> {
  logger.debug("[SandboxProbe] Running probe tick");
  try {
    const result = await runSandboxProbe(baseUrl);
    _lastResult  = result;

    if (result.ok) {
      if (_consecutiveFailures > 0) {
        logger.info(
          { durationMs: result.durationMs },
          "[SandboxProbe] Probe recovered after consecutive failures",
        );
      } else {
        logger.debug({ durationMs: result.durationMs }, "[SandboxProbe] Probe passed");
      }
      _consecutiveFailures = 0;
    } else {
      _consecutiveFailures += 1;
      logger.error(
        { consecutiveFailures: _consecutiveFailures, error: result.error, steps: result.steps },
        "[SandboxProbe] Probe FAILED",
      );
      // Sentry alert fires on EVERY failure so no breakage is silently missed.
      // Email alert is rate-limited to the 1st + every 3rd consecutive failure to
      // avoid inbox flooding during extended outages.
      const sentryErr = new Error(
        `[SandboxProbe] Probe failed: ${result.error ?? "see steps for details"}`,
      );
      Sentry.captureException(sentryErr, {
        tags: { probe: "sandbox", consecutiveFailures: _consecutiveFailures },
        extra: {
          checkedAt:  result.checkedAt,
          durationMs: result.durationMs,
          steps:      result.steps,
        },
      });
      if (_consecutiveFailures === 1 || _consecutiveFailures % 3 === 0) {
        void sendProbeAlertEmail(result);
      }
    }
  } catch (err) {
    logger.error({ err }, "[SandboxProbe] Probe tick threw unexpectedly");
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      tags: { probe: "sandbox" },
    });
  }
}

/**
 * Start the sandbox probe scheduler. Idempotent — subsequent calls are no-ops.
 *
 * @param baseUrl  Root URL of this API server, e.g. "http://localhost:3001".
 *                 Used to construct the endpoint URLs the probe calls.
 */
export function startSandboxProbe(baseUrl: string): void {
  if (_probeInterval) return;

  logger.info({ baseUrl, intervalMs: PROBE_INTERVAL_MS }, "[SandboxProbe] Starting probe scheduler");

  // Run an initial tick shortly after startup (allow the server to warm up).
  const warmupDelay = 15_000;
  const warmupTimer = setTimeout(() => void tick(baseUrl), warmupDelay);
  // Allow the process to exit without waiting for the initial tick.
  if (warmupTimer.unref) warmupTimer.unref();

  _probeInterval = setInterval(() => void tick(baseUrl), PROBE_INTERVAL_MS);
  if (_probeInterval.unref) _probeInterval.unref();
}
