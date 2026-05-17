import { createHash, randomBytes } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { requireApiKeyAuth } from "../middleware/requireApiKeyAuth";
import { requireAccountId } from "../middleware/requireAccountId";
import { requireWithinPlanLimits } from "../middleware/requireWithinPlanLimits";
import { enqueueDeliverWebhookJob, enqueueGeneratePdfJob, isQueueEnabled, generatePdfQueue } from "../lib/queue";
import { sendInterviewLinkEmail, getOrgEmailSettings } from "../lib/email";

const router = Router();

const NEVER_EXPIRES = new Date("9999-12-31T23:59:59Z");
const ALLOWED_LOCALES = new Set(["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar"]);
const ALLOWED_STATUSES = new Set(["draft", "submitted", "signed", "generated", "voided"]);

// ── Shared helpers ─────────────────────────────────────────────────────────────

function parseId(v: string | number | undefined | null): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function sanitizePrefill(prefill: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (prefill && typeof prefill === "object") {
    for (const [k, v] of Object.entries(prefill as Record<string, unknown>)) {
      if (typeof k === "string" && typeof v === "string") {
        out[k.trim()] = v;
      }
    }
  }
  return out;
}

async function resolveOrgDefaults(accountId: number) {
  const db = getDb();
  try {
    const { rows } = await db.query<{
      interview_link_expiry_days: number | null;
      interview_default_locale: string | null;
      interview_reminder_enabled: boolean | null;
      interview_reminder_days: number | null;
      custom_domain: string | null;
      custom_domain_status: string | null;
    }>(
      `SELECT interview_link_expiry_days, interview_default_locale,
              interview_reminder_enabled, interview_reminder_days,
              custom_domain, custom_domain_status
         FROM accounts WHERE id = $1`,
      [accountId],
    );
    const d = rows[0];
    return {
      expiryDays: d?.interview_link_expiry_days ?? 90,
      locale: d?.interview_default_locale ?? "en",
      reminderEnabled: d?.interview_reminder_enabled ?? false,
      reminderDays: d?.interview_reminder_days ?? 2,
      customDomain:
        d?.custom_domain && d.custom_domain_status === "active"
          ? d.custom_domain
          : null,
    };
  } catch {
    return { expiryDays: 90, locale: "en", reminderEnabled: false, reminderDays: 2, customDomain: null };
  }
}

function buildInterviewUrl(token: string, customDomain: string | null): string {
  const appOrigin =
    process.env.APP_ORIGIN ??
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://docuplete.com");
  const origin = customDomain ? `https://${customDomain}` : appOrigin;
  return `${origin}/docuplete/public/${token}`;
}

/** Write a structured audit log entry for this session. Non-fatal — never throws. */
async function writeAuditLog(opts: {
  sessionId: number | null;
  sessionToken: string;
  accountId: number;
  event: string;
  actorType?: string;
  actorEmail?: string | null;
  actorIp?: string | null;
  actorUa?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = getDb();
    await db.query(
      `INSERT INTO docuplete_audit_logs
         (session_id, session_token, account_id, event, actor_type, actor_email, actor_ip, actor_ua, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        opts.sessionId ?? null,
        opts.sessionToken,
        opts.accountId,
        opts.event,
        opts.actorType ?? "system",
        opts.actorEmail ?? null,
        opts.actorIp ?? null,
        opts.actorUa ?? null,
        JSON.stringify(opts.metadata ?? {}),
      ],
    );
  } catch (err) {
    logger.warn({ err, event: opts.event, token: opts.sessionToken }, "[AuditLog] Failed to write audit log entry (non-fatal)");
  }
}

/** Fire a lifecycle webhook for this session if the package has webhooks enabled. Non-fatal. */
async function fireLifecycleWebhook(opts: {
  accountId: number;
  sessionToken: string;
  packageId: number;
  event: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = getDb();
    const { rows } = await db.query<{
      webhook_enabled: boolean;
      webhook_url: string | null;
    }>(
      `SELECT webhook_enabled, webhook_url FROM docuplete_packages WHERE id = $1 AND account_id = $2`,
      [opts.packageId, opts.accountId],
    );
    const pkg = rows[0];
    if (!pkg?.webhook_enabled || !pkg.webhook_url) return;

    await enqueueDeliverWebhookJob({
      sessionToken: opts.sessionToken,
      packageId: opts.packageId,
      accountId: opts.accountId,
      eventType: opts.event,
      webhookUrl: pkg.webhook_url,
      payload: opts.payload,
    });
  } catch (err) {
    logger.warn({ err, event: opts.event, token: opts.sessionToken }, "[HeadlessSessions] Lifecycle webhook fire failed (non-fatal)");
  }
}

// ── Schema ─────────────────────────────────────────────────────────────────────

const RemindersSchema = z.object({
  enabled: z.boolean(),
  intervalDays: z.number().int().min(1).max(30).optional(),
}).optional();

const HeadlessSessionBodySchema = z.object({
  packageId: z.union([z.string(), z.number()]),
  prefill: z.record(z.string(), z.string()).optional(),
  linkExpiryDays: z.number().int().min(1).max(3650).nullable().optional(),
  locale: z.enum(["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar"]).optional(),
  reminders: RemindersSchema,
  signers: z.array(z.object({
    email: z.string().email(),
    name: z.string().max(200).optional(),
    order: z.number().int().min(0).optional(),
  })).max(10).optional(),
});

const BulkHeadlessSessionBodySchema = z.object({
  sessions: z.array(HeadlessSessionBodySchema).min(1).max(100),
});

// ── Core session creation logic (shared by single + bulk) ─────────────────────

interface CreateOneResult {
  ok: true;
  sessionToken: string;
  interviewUrl: string;
  expiresAt: string | null;
  sessionId: number;
}

interface CreateOneError {
  ok: false;
  error: string;
}

async function createOneSession(
  params: z.infer<typeof HeadlessSessionBodySchema>,
  accountId: number,
): Promise<CreateOneResult | CreateOneError> {
  const db = getDb();
  const packageId = parseId(params.packageId);
  if (!packageId) return { ok: false, error: "packageId must be a positive integer." };

  const pkgResult = await db.query<{
    id: number;
    version: number | null;
    status: string;
    transaction_scope: string | null;
  }>(
    `SELECT id, version, status, transaction_scope
       FROM docuplete_packages
      WHERE id = $1 AND account_id = $2
      LIMIT 1`,
    [packageId, accountId],
  );
  const pkg = pkgResult.rows[0];
  if (!pkg) return { ok: false, error: "Package not found." };
  if (pkg.status !== "active") return { ok: false, error: "Package must be active before creating a session." };

  const org = await resolveOrgDefaults(accountId);

  const effectiveLinkExpiryDays: number | null =
    params.linkExpiryDays !== undefined ? params.linkExpiryDays : org.expiryDays;
  const effectiveLocale =
    params.locale && ALLOWED_LOCALES.has(params.locale) ? params.locale : org.locale;
  const finalExpiresAt: Date =
    effectiveLinkExpiryDays === null
      ? NEVER_EXPIRES
      : new Date(Date.now() + effectiveLinkExpiryDays * 86_400_000);

  const reminderEnabled = params.reminders?.enabled ?? org.reminderEnabled;
  const reminderDays = params.reminders?.intervalDays ?? org.reminderDays;

  const token = `df_${randomBytes(20).toString("hex")}`;
  const cleanPrefill = sanitizePrefill(params.prefill);

  const insertResult = await db.query<{ id: number }>(
    `INSERT INTO docuplete_interview_sessions
       (token, package_id, package_version, transaction_scope, source, status,
        test_mode, prefill, answers, expires_at, account_id, locale,
        reminder_enabled, reminder_days)
     VALUES ($1, $2, $3, $4, 'api', 'draft',
             false, $5::jsonb, '{}'::jsonb, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      token,
      pkg.id,
      pkg.version ?? 1,
      pkg.transaction_scope ?? "",
      JSON.stringify(cleanPrefill),
      finalExpiresAt,
      accountId,
      effectiveLocale,
      reminderEnabled,
      reminderDays,
    ],
  );
  const sessionId = insertResult.rows[0]?.id;

  // Register multi-party signers if provided
  const signers = params.signers;
  if (signers && signers.length > 0 && sessionId) {
    const sortedSigners = [...signers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (let i = 0; i < sortedSigners.length; i++) {
      const s = sortedSigners[i];
      const signerToken = `df_sgn_${randomBytes(16).toString("hex")}`;
      await db.query(
        `INSERT INTO docuplete_session_signers
           (session_id, account_id, signer_order, email, name, status, token)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          sessionId,
          accountId,
          i,
          s.email,
          s.name ?? null,
          i === 0 ? "pending" : "awaiting",
          signerToken,
        ],
      );
    }
  }

  const interviewUrl = buildInterviewUrl(token, org.customDomain);
  const expiresAt = finalExpiresAt.getFullYear() >= 9999 ? null : finalExpiresAt.toISOString();

  // Fire session.created audit log + webhook (non-blocking)
  void writeAuditLog({
    sessionId: sessionId ?? null,
    sessionToken: token,
    accountId,
    event: "session.created",
    actorType: "api",
    metadata: { packageId, source: "api", prefillKeys: Object.keys(cleanPrefill), multiPartySigners: signers?.length ?? 0 },
  });
  void fireLifecycleWebhook({
    accountId,
    sessionToken: token,
    packageId,
    event: "session.created",
    payload: {
      event: "session.created",
      packageId,
      sessionToken: token,
      createdAt: new Date().toISOString(),
      prefill: cleanPrefill,
      expiresAt,
      source: "api",
    },
  });

  return { ok: true, sessionToken: token, interviewUrl, expiresAt, sessionId: sessionId ?? 0 };
}

// ── GET /api/v1/sessions ───────────────────────────────────────────────────────

/**
 * GET /api/v1/sessions
 *
 * List sessions for the account with optional filters.
 *
 * @query packageId   Filter by package ID.
 * @query status      Filter by status: draft | submitted | signed | generated | voided.
 * @query limit       Page size 1–200 (default 50).
 * @query offset      Pagination offset (default 0).
 * @query updatedAfter ISO-8601 timestamp — only sessions updated after this time.
 * @query search      Full-text search across prefill values.
 */
router.get(
  "/",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const accountId = req.internalAccountId!;
      const db = getDb();

      const packageId = req.query.packageId ? parseId(String(req.query.packageId)) : null;
      const status = typeof req.query.status === "string" && ALLOWED_STATUSES.has(req.query.status)
        ? req.query.status
        : null;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 200);
      const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
      const updatedAfter = typeof req.query.updatedAfter === "string" ? req.query.updatedAfter : null;
      const search = typeof req.query.search === "string" && req.query.search.trim()
        ? req.query.search.trim()
        : null;

      const conditions: string[] = ["dis.account_id = $1"];
      const params: unknown[] = [accountId];
      let idx = 2;

      if (packageId) {
        conditions.push(`dis.package_id = $${idx++}`);
        params.push(packageId);
      }
      if (status) {
        conditions.push(`dis.status = $${idx++}`);
        params.push(status);
      }
      if (updatedAfter) {
        const dt = new Date(updatedAfter);
        if (!isNaN(dt.getTime())) {
          conditions.push(`dis.updated_at > $${idx++}`);
          params.push(dt.toISOString());
        }
      }
      if (search) {
        conditions.push(`dis.prefill::text ILIKE $${idx++}`);
        params.push(`%${search.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`);
      }

      const where = conditions.join(" AND ");

      const [dataResult, countResult] = await Promise.all([
        db.query(
          `SELECT dis.id, dis.token, dis.package_id, dp.name AS package_name,
                  dis.status, dis.source, dis.prefill, dis.locale,
                  dis.created_at, dis.updated_at, dis.expires_at,
                  dis.submitted_at, dis.voided_at, dis.test_mode
             FROM docuplete_interview_sessions dis
             JOIN docuplete_packages dp ON dp.id = dis.package_id
            WHERE ${where}
            ORDER BY dis.created_at DESC
            LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, limit, offset],
        ),
        db.query(
          `SELECT COUNT(*) AS total
             FROM docuplete_interview_sessions dis
            WHERE ${where}`,
          params,
        ),
      ]);

      const total = parseInt(String(countResult.rows[0]?.total ?? "0"), 10);
      const sessions = dataResult.rows.map((r) => ({
        id: r.id,
        token: r.token,
        packageId: r.package_id,
        packageName: r.package_name,
        status: r.status,
        source: r.source,
        prefill: r.prefill ?? {},
        locale: r.locale,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        expiresAt: r.expires_at,
        submittedAt: r.submitted_at ?? null,
        voidedAt: r.voided_at ?? null,
        testMode: r.test_mode ?? false,
      }));

      return void res.json({ sessions, total, limit, offset });
    } catch (err) {
      logger.error({ err }, "[HeadlessSessions] Failed to list sessions");
      return void res.status(500).json({ error: "Failed to list sessions." });
    }
  },
);

// ── POST /api/v1/sessions/bulk ─────────────────────────────────────────────────

/**
 * POST /api/v1/sessions/bulk
 *
 * Create up to 100 sessions in a single request.
 * Each item in `sessions` follows the same schema as POST /sessions.
 * Returns per-item results — failures do not abort the batch.
 */
router.post(
  "/bulk",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const _parse = BulkHeadlessSessionBodySchema.safeParse(req.body);
      if (!_parse.success) {
        return void res.status(400).json({
          error: "Invalid request body",
          issues: _parse.error.issues.map((i) => i.message),
        });
      }

      const accountId = req.internalAccountId!;
      const { sessions } = _parse.data;

      const results = await Promise.all(
        sessions.map(async (s, index) => {
          try {
            const result = await createOneSession(s, accountId);
            if (result.ok) {
              return {
                index,
                ok: true as const,
                sessionToken: result.sessionToken,
                interviewUrl: result.interviewUrl,
                expiresAt: result.expiresAt,
              };
            }
            return { index, ok: false as const, error: result.error };
          } catch (err) {
            logger.warn({ err, index }, "[HeadlessSessions] Bulk create item failed");
            return { index, ok: false as const, error: "Internal error creating session." };
          }
        }),
      );

      const succeeded = results.filter((r) => r.ok).length;
      logger.info({ accountId, total: sessions.length, succeeded }, "[HeadlessSessions] Bulk session creation completed");

      return void res.status(207).json({ results, total: sessions.length, succeeded, failed: sessions.length - succeeded });
    } catch (err) {
      logger.error({ err }, "[HeadlessSessions] Bulk session creation failed");
      return void res.status(500).json({ error: "Failed to process bulk session creation." });
    }
  },
);

// ── POST /api/v1/sessions ──────────────────────────────────────────────────────

/**
 * POST /api/v1/sessions
 *
 * Create a single headless interview session.
 */
router.post(
  "/",
  requireApiKeyAuth,
  requireAccountId,
  requireWithinPlanLimits("submission"),
  async (req, res) => {
    try {
      const _parse = HeadlessSessionBodySchema.safeParse(req.body);
      if (!_parse.success) {
        return void res.status(400).json({
          error: "Invalid request body",
          issues: _parse.error.issues.map((i) => i.message),
        });
      }

      const accountId = req.internalAccountId!;
      const result = await createOneSession(_parse.data, accountId);

      if (!result.ok) {
        const status = result.error.includes("not found") ? 404 : 400;
        return void res.status(status).json({ error: result.error });
      }

      logger.info({ accountId, packageId: _parse.data.packageId, token: result.sessionToken }, "[HeadlessSessions] Session created via API key");
      return void res.status(201).json({
        sessionToken: result.sessionToken,
        interviewUrl: result.interviewUrl,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      logger.error({ err }, "[HeadlessSessions] Failed to create session");
      return void res.status(500).json({ error: "Failed to create session." });
    }
  },
);

// ── GET /api/v1/sessions/:token ────────────────────────────────────────────────

/**
 * GET /api/v1/sessions/:token
 *
 * Retrieve current state of a session including status and submitted answers.
 * Sensitive fields are redacted in the response.
 */
router.get(
  "/:token",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const accountId = req.internalAccountId!;
      const { token } = req.params;
      const db = getDb();

      const { rows } = await db.query(
        `SELECT dis.id, dis.token, dis.package_id, dp.name AS package_name,
                dis.status, dis.source, dis.prefill, dis.answers,
                dis.locale, dis.test_mode, dis.expires_at,
                dis.created_at, dis.updated_at, dis.submitted_at,
                dis.voided_at, dis.voided_reason, dis.link_email_recipient,
                dis.generated_pdf_url, dis.signer_name, dis.signer_email,
                dis.signed_at, dis.batch_run_id,
                dp.fields AS package_fields
           FROM docuplete_interview_sessions dis
           JOIN docuplete_packages dp ON dp.id = dis.package_id
          WHERE dis.token = $1 AND dis.account_id = $2
          LIMIT 1`,
        [token, accountId],
      );

      const session = rows[0];
      if (!session) {
        return void res.status(404).json({ error: "Session not found." });
      }

      // Redact sensitive fields
      const fields: Array<{ id: string; sensitive?: boolean }> =
        Array.isArray(session.package_fields) ? session.package_fields : [];
      const sensitiveIds = new Set(
        fields.filter((f) => f.sensitive === true).map((f) => String(f.id ?? "")),
      );
      const answers: Record<string, unknown> = session.answers ?? {};
      const redactedAnswers: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(answers)) {
        redactedAnswers[k] = sensitiveIds.has(k) ? "[redacted]" : v;
      }

      return void res.json({
        session: {
          id: session.id,
          token: session.token,
          packageId: session.package_id,
          packageName: session.package_name,
          status: session.status,
          source: session.source,
          prefill: session.prefill ?? {},
          answers: redactedAnswers,
          locale: session.locale,
          testMode: session.test_mode,
          expiresAt: session.expires_at,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          submittedAt: session.submitted_at ?? null,
          voidedAt: session.voided_at ?? null,
          voidedReason: session.voided_reason ?? null,
          linkEmailRecipient: session.link_email_recipient ?? null,
          generatedPdfUrl: session.generated_pdf_url ?? null,
          signerName: session.signer_name ?? null,
          signerEmail: session.signer_email ?? null,
          signedAt: session.signed_at ?? null,
          batchRunId: session.batch_run_id ?? null,
        },
      });
    } catch (err) {
      logger.error({ err }, "[HeadlessSessions] Failed to get session");
      return void res.status(500).json({ error: "Failed to retrieve session." });
    }
  },
);

// ── GET /api/v1/sessions/:token/audit-log ─────────────────────────────────────

/**
 * GET /api/v1/sessions/:token/audit-log
 *
 * Returns a chronological, tamper-evident audit trail for a session.
 * Each entry is a structured event recording who did what and when.
 *
 * @query limit   Max entries to return (1–500, default 200).
 */
router.get(
  "/:token/audit-log",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const accountId = req.internalAccountId!;
      const { token } = req.params;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "200"), 10) || 200, 1), 500);
      const db = getDb();

      // Verify session ownership
      const { rows: sessionRows } = await db.query<{ id: number }>(
        `SELECT id FROM docuplete_interview_sessions WHERE token = $1 AND account_id = $2 LIMIT 1`,
        [token, accountId],
      );
      if (!sessionRows[0]) {
        return void res.status(404).json({ error: "Session not found." });
      }

      const { rows } = await db.query(
        `SELECT id, event, actor_type, actor_email, actor_ip, metadata, created_at
           FROM docuplete_audit_logs
          WHERE session_token = $1 AND account_id = $2
          ORDER BY created_at ASC
          LIMIT $3`,
        [token, accountId, limit],
      );

      const entries = rows.map((r) => ({
        id: r.id,
        event: r.event,
        actorType: r.actor_type,
        actorEmail: r.actor_email ?? null,
        actorIp: r.actor_ip ?? null,
        metadata: r.metadata ?? {},
        createdAt: r.created_at,
      }));

      return void res.json({ token, entries, total: entries.length });
    } catch (err) {
      logger.error({ err }, "[HeadlessSessions] Failed to get audit log");
      return void res.status(500).json({ error: "Failed to retrieve audit log." });
    }
  },
);

// ── GET /api/v1/sessions/:token/signers ───────────────────────────────────────

/**
 * GET /api/v1/sessions/:token/signers
 *
 * Returns the ordered list of signers for a multi-party signing session.
 */
router.get(
  "/:token/signers",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const accountId = req.internalAccountId!;
      const { token } = req.params;
      const db = getDb();

      const { rows: sessionRows } = await db.query<{ id: number }>(
        `SELECT id FROM docuplete_interview_sessions WHERE token = $1 AND account_id = $2 LIMIT 1`,
        [token, accountId],
      );
      if (!sessionRows[0]) {
        return void res.status(404).json({ error: "Session not found." });
      }

      const { rows } = await db.query(
        `SELECT id, signer_order, email, name, status, token AS signer_token,
                notified_at, signed_at, declined_at, declined_reason, created_at
           FROM docuplete_session_signers
          WHERE session_id = $1
          ORDER BY signer_order ASC`,
        [sessionRows[0].id],
      );

      const signers = rows.map((r) => ({
        id: r.id,
        order: r.signer_order,
        email: r.email,
        name: r.name ?? null,
        status: r.status,
        signerToken: r.signer_token,
        notifiedAt: r.notified_at ?? null,
        signedAt: r.signed_at ?? null,
        declinedAt: r.declined_at ?? null,
        declinedReason: r.declined_reason ?? null,
        createdAt: r.created_at,
      }));

      const allSigned = signers.length > 0 && signers.every((s) => s.status === "signed");
      return void res.json({ token, signers, allSigned });
    } catch (err) {
      logger.error({ err }, "[HeadlessSessions] Failed to get signers");
      return void res.status(500).json({ error: "Failed to retrieve signers." });
    }
  },
);

// ── POST /api/v1/sessions/:token/void ─────────────────────────────────────────

/**
 * POST /api/v1/sessions/:token/void
 *
 * Immediately invalidates the interview link. Voiding cannot be undone.
 */
router.post(
  "/:token/void",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const accountId = req.internalAccountId!;
      const token      = String(req.params.token);
      const reason     = typeof req.body?.reason === "string" ? req.body.reason : null;
      const db         = getDb();

      const { rows } = await db.query<{ id: number; status: string }>(
        `SELECT id, status FROM docuplete_interview_sessions
          WHERE token = $1 AND account_id = $2 LIMIT 1`,
        [token, accountId],
      );
      const session = rows[0];
      if (!session) return void res.status(404).json({ error: "Session not found." });
      if (session.status === "voided") return void res.status(409).json({ error: "Session is already voided." });
      if (session.status === "generated") return void res.status(409).json({ error: "Session has already been submitted and cannot be voided." });

      const { rows: updated } = await db.query<{ voided_at: Date }>(
        `UPDATE docuplete_interview_sessions
            SET status = 'voided', voided_at = NOW(), voided_reason = $1, updated_at = NOW()
          WHERE token = $2 AND account_id = $3
          RETURNING voided_at`,
        [reason, token, accountId],
      );

      writeAuditLog({ sessionId: session.id, sessionToken: token, accountId, event: "session.voided", actorType: "api_key", metadata: { reason } }).catch(() => {});

      return void res.json({ voided_at: updated[0]?.voided_at ?? new Date() });
    } catch (err) {
      logger.error({ err }, "[HeadlessSessions] Failed to void session");
      return void res.status(500).json({ error: "Failed to void session." });
    }
  },
);

// ── POST /api/v1/sessions/:token/send-link ────────────────────────────────────

/**
 * POST /api/v1/sessions/:token/send-link
 *
 * Send (or resend) the interview link to a client by email.
 */
router.post(
  "/:token/send-link",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const accountId      = req.internalAccountId!;
      const token          = String(req.params.token);
      const recipientEmail = typeof req.body?.recipientEmail === "string" ? req.body.recipientEmail.trim() : null;
      const recipientName  = typeof req.body?.recipientName  === "string" ? req.body.recipientName.trim()  : "";
      const customMessage  = typeof req.body?.customMessage  === "string" ? req.body.customMessage.trim()  : null;

      if (!recipientEmail) return void res.status(400).json({ error: "recipientEmail is required." });

      const db = getDb();

      const { rows } = await db.query<{
        id: number; status: string; custom_domain: string | null;
      }>(
        `SELECT dis.id, dis.status, a.custom_domain
           FROM docuplete_interview_sessions dis
           JOIN accounts a ON a.id = dis.account_id
          WHERE dis.token = $1 AND dis.account_id = $2 LIMIT 1`,
        [token, accountId],
      );
      const session = rows[0];
      if (!session) return void res.status(404).json({ error: "Session not found." });
      if (session.status === "voided")    return void res.status(409).json({ error: "Cannot send link for a voided session." });
      if (session.status === "generated") return void res.status(409).json({ error: "Session has already been completed." });

      const { rows: orgRows } = await db.query<{ name: string; logo_url: string | null; brand_color: string | null }>(
        `SELECT name, logo_url, brand_color FROM accounts WHERE id = $1 LIMIT 1`,
        [accountId],
      );
      const org = orgRows[0];
      const emailSettings = await getOrgEmailSettings(accountId);
      const interviewUrl  = buildInterviewUrl(token, session.custom_domain ?? null);

      await sendInterviewLinkEmail({
        recipientEmail,
        recipientName,
        interviewUrl,
        orgName:       org?.name || "Docuplete",
        orgLogoUrl:    org?.logo_url ?? null,
        orgBrandColor: org?.brand_color ?? null,
        customMessage: customMessage ?? null,
        emailSettings,
      });

      await db.query(
        `UPDATE docuplete_interview_sessions
            SET link_emailed_at = NOW(), link_email_recipient = $1, updated_at = NOW()
          WHERE token = $2 AND account_id = $3`,
        [recipientEmail, token, accountId],
      );

      writeAuditLog({ sessionId: session.id, sessionToken: token, accountId, event: "session.link_sent", actorType: "api_key", metadata: { recipientEmail } }).catch(() => {});

      return void res.json({ sent: true });
    } catch (err) {
      logger.error({ err }, "[HeadlessSessions] Failed to send link");
      return void res.status(500).json({ error: "Failed to send interview link." });
    }
  },
);

// ── POST /api/v1/sessions/:token/generate ────────────────────────────────────

/**
 * POST /api/v1/sessions/:token/generate
 *
 * Trigger server-side PDF generation. Returns immediately with a jobId when
 * the queue is available; falls back to a synchronous error when the session
 * has not been submitted yet.
 */
router.post(
  "/:token/generate",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const accountId = req.internalAccountId!;
      const token     = String(req.params.token);
      const db        = getDb();

      const { rows } = await db.query<{ id: number; status: string }>(
        `SELECT id, status FROM docuplete_interview_sessions
          WHERE token = $1 AND account_id = $2 LIMIT 1`,
        [token, accountId],
      );
      const session = rows[0];
      if (!session) return void res.status(404).json({ error: "Session not found." });

      if (session.status === "generated") {
        return void res.json({
          status:       "generated",
          download_url: `/api/v1/sessions/${token}/packet.pdf`,
        });
      }
      if (session.status === "voided") return void res.status(409).json({ error: "Cannot generate PDF for a voided session." });
      if (session.status === "expired") return void res.status(409).json({ error: "Cannot generate PDF for an expired session." });

      if (!isQueueEnabled()) {
        return void res.status(503).json({ error: "PDF generation is temporarily unavailable.", code: "queue_unavailable" });
      }

      const jobId = await enqueueGeneratePdfJob({
        sessionToken: token,
        type:         "packet",
        accountId:    String(accountId),
      });

      return void res.status(202).json({ status: "pending", job_id: jobId });
    } catch (err) {
      logger.error({ err }, "[HeadlessSessions] Failed to enqueue generate job");
      return void res.status(500).json({ error: "Failed to start document generation." });
    }
  },
);

// ── GET /api/v1/sessions/:token/generate-status ───────────────────────────────

/**
 * GET /api/v1/sessions/:token/generate-status?jobId=<id>
 *
 * Poll the status of an async PDF generation job.
 */
router.get(
  "/:token/generate-status",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const accountId = req.internalAccountId!;
      const token     = String(req.params.token);
      const jobId     = typeof req.query.jobId === "string" ? req.query.jobId : null;
      const db        = getDb();

      const { rows } = await db.query<{ status: string }>(
        `SELECT status FROM docuplete_interview_sessions
          WHERE token = $1 AND account_id = $2 LIMIT 1`,
        [token, accountId],
      );
      if (!rows[0]) return void res.status(404).json({ error: "Session not found." });

      if (rows[0].status === "generated") {
        return void res.json({ status: "ready", download_url: `/api/v1/sessions/${token}/packet.pdf` });
      }

      if (jobId && generatePdfQueue) {
        try {
          const job = await generatePdfQueue.getJob(jobId);
          if (job) {
            const state = await job.getState();
            if (state === "completed") return void res.json({ status: "ready", download_url: `/api/v1/sessions/${token}/packet.pdf` });
            if (state === "failed")    return void res.json({ status: "failed", error: "Document generation failed." });
            return void res.json({ status: state === "active" ? "processing" : "pending" });
          }
        } catch (qErr) {
          logger.warn({ qErr, jobId }, "[HeadlessSessions] Failed to check BullMQ job state (non-fatal)");
        }
      }

      return void res.json({ status: "pending" });
    } catch (err) {
      logger.error({ err }, "[HeadlessSessions] Failed to get generate status");
      return void res.status(500).json({ error: "Failed to get generation status." });
    }
  },
);

export { writeAuditLog, fireLifecycleWebhook };
export default router;
