import { randomBytes } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { requireApiKeyAuth } from "../middleware/requireApiKeyAuth";
import { requireAccountId } from "../middleware/requireAccountId";
import { requireWithinPlanLimits } from "../middleware/requireWithinPlanLimits";

const router = Router();

const NEVER_EXPIRES = new Date("9999-12-31T23:59:59Z");
const ALLOWED_LOCALES = new Set(["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar"]);

const HeadlessSessionBodySchema = z.object({
  packageId: z.union([z.string(), z.number()]),
  prefill: z.record(z.string(), z.string()).optional(),
  linkExpiryDays: z.number().int().min(1).max(3650).nullable().optional(),
  locale: z.enum(["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar"]).optional(),
});

function parseId(v: string | number | undefined | null): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/**
 * POST /api/v1/sessions
 *
 * Headless session creation — designed for server-to-server API key integrations.
 * Accepts a Docuplete live API key (dp_live_…) via Authorization header,
 * a packageId, optional prefill values keyed by field source key, and
 * optional per-session link settings.
 *
 * Returns a signed interview URL the end-user can be redirected to.
 *
 * @openapi
 * /sessions:
 *   post:
 *     tags:
 *       - Developer API — Sessions
 *     summary: Create a headless interview session
 *     description: |
 *       Creates a new Docuplete interview session programmatically.
 *       Prefill values are keyed by field source key (the short identifier
 *       you see in the field editor, e.g. `firstName`, `email`, `ssn`).
 *       The returned `interviewUrl` can be sent directly to your client.
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [packageId]
 *             properties:
 *               packageId:
 *                 type: integer
 *                 description: ID of the active package to use for this session.
 *               prefill:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 description: |
 *                   Optional map of field source keys → values to pre-populate
 *                   before the client sees the interview.
 *                   Example: `{ "firstName": "Jane", "email": "jane@acme.com" }`
 *               linkExpiryDays:
 *                 type: integer
 *                 nullable: true
 *                 description: |
 *                   Days until the interview link expires (1–3650).
 *                   Pass `null` for a link that never expires.
 *                   Defaults to your organization's setting.
 *               locale:
 *                 type: string
 *                 enum: [en, es, fr, de, pt, zh, ja, ko, ar]
 *                 description: Interview language locale. Defaults to your organization setting.
 *     responses:
 *       201:
 *         description: Session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionToken:
 *                   type: string
 *                   example: df_a1b2c3d4e5f6...
 *                 interviewUrl:
 *                   type: string
 *                   example: https://docuplete.com/docuplete/public/df_a1b2c3d4...
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   description: ISO-8601 expiry timestamp, or null if the link never expires.
 *       400:
 *         description: Validation error or package not active
 *       401:
 *         description: Missing or invalid API key
 *       403:
 *         description: Plan does not include API access
 *       404:
 *         description: Package not found
 *       429:
 *         description: Rate limited
 *       500:
 *         description: Internal error
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

      const { prefill, linkExpiryDays, locale } = _parse.data;
      const packageId = parseId(_parse.data.packageId);
      if (!packageId) {
        return void res.status(400).json({ error: "packageId is required and must be a positive integer." });
      }

      const accountId = req.internalAccountId!;
      const db = getDb();

      // ── Resolve package ───────────────────────────────────────────────────────
      const pkgResult = await db.query<{
        id: number;
        version: number | null;
        status: string;
        transaction_scope: string | null;
      }>(
        `SELECT id, version, status, transaction_scope
           FROM docufill_packages
          WHERE id = $1 AND account_id = $2
          LIMIT 1`,
        [packageId, accountId],
      );

      const pkg = pkgResult.rows[0];
      if (!pkg) {
        return void res.status(404).json({ error: "Package not found." });
      }
      if (pkg.status !== "active") {
        return void res.status(400).json({ error: "Package must be active before creating a session." });
      }

      // ── Fetch org-level interview defaults ────────────────────────────────────
      let orgExpiryDays: number | null = 90;
      let orgLocale = "en";
      let orgReminderEnabled = false;
      let orgReminderDays = 2;
      try {
        const { rows: defaultRows } = await db.query<{
          interview_link_expiry_days: number | null;
          interview_default_locale: string | null;
          interview_reminder_enabled: boolean | null;
          interview_reminder_days: number | null;
        }>(
          `SELECT interview_link_expiry_days, interview_default_locale,
                  interview_reminder_enabled, interview_reminder_days
             FROM accounts WHERE id = $1`,
          [accountId],
        );
        if (defaultRows[0]) {
          const d = defaultRows[0];
          orgExpiryDays      = d.interview_link_expiry_days  ?? null;
          orgLocale          = d.interview_default_locale    ?? "en";
          orgReminderEnabled = d.interview_reminder_enabled  ?? false;
          orgReminderDays    = d.interview_reminder_days     ?? 2;
        }
      } catch (defErr) {
        logger.warn({ defErr }, "[HeadlessSessions] Could not fetch org defaults; using built-ins");
      }

      // ── Validate & resolve per-session overrides ──────────────────────────────
      const effectiveLinkExpiryDays: number | null =
        linkExpiryDays !== undefined ? linkExpiryDays : orgExpiryDays;

      const effectiveLocale: string =
        locale && ALLOWED_LOCALES.has(locale) ? locale : orgLocale;

      const finalExpiresAt: Date =
        effectiveLinkExpiryDays === null
          ? NEVER_EXPIRES
          : new Date(Date.now() + effectiveLinkExpiryDays * 86_400_000);

      // ── Generate token + insert session ───────────────────────────────────────
      const token = `df_${randomBytes(20).toString("hex")}`;
      const cleanPrefill: Record<string, string> = {};
      if (prefill && typeof prefill === "object") {
        for (const [k, v] of Object.entries(prefill)) {
          if (typeof k === "string" && typeof v === "string") {
            cleanPrefill[k.trim()] = v;
          }
        }
      }

      await db.query(
        `INSERT INTO docufill_interview_sessions
           (token, package_id, package_version, transaction_scope, source, status,
            test_mode, prefill, answers, expires_at, account_id, locale,
            reminder_enabled, reminder_days)
         VALUES ($1, $2, $3, $4, 'api', 'draft',
                 false, $5::jsonb, '{}'::jsonb, $6, $7, $8,
                 $9, $10)`,
        [
          token,
          pkg.id,
          pkg.version ?? 1,
          pkg.transaction_scope ?? "",
          JSON.stringify(cleanPrefill),
          finalExpiresAt,
          accountId,
          effectiveLocale,
          orgReminderEnabled,
          orgReminderDays,
        ],
      );

      // ── Build interview URL (custom domain when active) ───────────────────────
      const appOrigin =
        process.env.APP_ORIGIN ??
        (process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : "https://docuplete.com");

      let interviewOrigin = appOrigin;
      try {
        const { rows: domainRows } = await db.query<{
          custom_domain: string | null;
          custom_domain_status: string | null;
        }>(
          `SELECT custom_domain, custom_domain_status FROM accounts WHERE id = $1`,
          [accountId],
        );
        const dr = domainRows[0];
        if (dr?.custom_domain && dr.custom_domain_status === "active") {
          interviewOrigin = `https://${dr.custom_domain}`;
        }
      } catch (err) {
        logger.warn({ err, accountId }, "[HeadlessSessions] Custom domain lookup failed — using default");
      }

      const interviewUrl = `${interviewOrigin}/docuplete/public/${token}`;
      const expiresAt =
        finalExpiresAt.getFullYear() >= 9999 ? null : finalExpiresAt.toISOString();

      logger.info({ accountId, packageId, token }, "[HeadlessSessions] Session created via API key");

      return void res.status(201).json({ sessionToken: token, interviewUrl, expiresAt });
    } catch (err) {
      logger.error({ err }, "[HeadlessSessions] Failed to create session");
      return void res.status(500).json({ error: "Failed to create session." });
    }
  },
);

export default router;
