import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { ObjectStorageService, objectStorageClient } from "../lib/objectStorage";
import { extractBrandColors, isSafeUrl } from "../lib/brandColorExtractor";
import { requireAdminRole } from "../middleware/requireRole";
import { requireWithinPlanLimits } from "../middleware/requireWithinPlanLimits";
import { sendTeamInvitationEmail } from "../lib/email";
import { getPlanLimits } from "../lib/plans";
import { getUncachableStripeClient } from "../lib/stripeClient";
import express from "express";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"] as const;
type ImageContentType = (typeof ALLOWED_IMAGE_TYPES)[number];

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidBrandColor(value: unknown): boolean {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function buildLogoServingUrl(accountId: number): string {
  return `/api/storage/org-logo/${accountId}`;
}

// UUID v4 pattern — logo paths must always be non-guessable (/objects/<uuid>).
// This shape is intentional: the org-logo route is unauthenticated, so the
// backing object path must never be predictable or sequential.
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function uploadLogoBuffer(buffer: Buffer, contentType: ImageContentType): Promise<string> {
  const privateDir = objectStorageService.getPrivateObjectDir();
  const entityDir = privateDir.endsWith("/") ? privateDir : `${privateDir}/`;
  const entityId = randomUUID();

  // Regression guard: catch any future refactor that might produce a
  // guessable or non-UUID path before it reaches the database.
  if (!UUID_V4_RE.test(entityId)) {
    throw new Error(`Logo object ID is not a valid UUID v4: "${entityId}". ` +
      "Logo paths must use non-guessable UUIDs because the serving route is unauthenticated.");
  }

  const objectEntityPath = `${entityDir}${entityId}`;
  const withSlash = objectEntityPath.startsWith("/") ? objectEntityPath : `/${objectEntityPath}`;
  const parts = withSlash.slice(1).split("/");
  const bucketName = parts[0];
  const objectName = parts.slice(1).join("/");
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  await file.save(buffer, { contentType, resumable: false });
  return `/objects/${entityId}`;
}

/**
 * @openapi
 * /internal/settings/org:
 *   get:
 *     tags:
 *       - Internal — Settings
 *     summary: Get org settings (internal)
 *     description: Returns the authenticated organisation's name, logo URL, and brand color.
 *     security:
 *       - internalAuth: []
 *     responses:
 *       200:
 *         description: Org settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 org:
 *                   $ref: '#/components/schemas/OrgSettings'
 *       401:
 *         description: Missing or invalid session token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * /product/settings/org:
 *   get:
 *     tags:
 *       - Product Portal — Settings
 *     summary: Get org settings
 *     description: Returns the authenticated organisation's name, logo URL, and brand color.
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Org settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 org:
 *                   $ref: '#/components/schemas/OrgSettings'
 *       401:
 *         description: Missing or invalid Clerk JWT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/org", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();
    const { rows } = await db.query(
      `SELECT id, name, slug, logo_url, brand_color FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const row = rows[0] as Record<string, unknown>;
    res.json({
      org: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        logo_url: row.logo_url ? buildLogoServingUrl(accountId) : null,
        brand_color: row.brand_color ?? "#C49A38",
      },
    });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to get org settings");
    res.status(500).json({ error: "Failed to get org settings" });
  }
});

/**
 * @openapi
 * /internal/settings/org:
 *   patch:
 *     tags:
 *       - Internal — Settings
 *     summary: Update org settings (internal)
 *     description: |
 *       Partially updates the org's display name and/or accent color.
 *       All fields are optional — omitted fields keep their current values.
 *       Send `clearLogo: true` to remove the current logo.
 *     security:
 *       - internalAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: West Hills Capital
 *               brandColor:
 *                 type: string
 *                 example: '#C49A38'
 *               clearLogo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated org settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 org:
 *                   $ref: '#/components/schemas/OrgSettings'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * /product/settings/org:
 *   patch:
 *     tags:
 *       - Product Portal — Settings
 *     summary: Update org settings
 *     description: |
 *       Partially updates the org's display name and/or accent color.
 *       All fields are optional — omitted fields keep their current values.
 *       Send `clearLogo: true` to remove the current logo.
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Acme Capital
 *               brandColor:
 *                 type: string
 *                 example: '#3B6CB7'
 *               clearLogo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated org settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 org:
 *                   $ref: '#/components/schemas/OrgSettings'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/org", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const body = req.body as Record<string, unknown>;
    const db = getDb();

    const { rows: existing } = await db.query(
      `SELECT id, name, logo_url, brand_color FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!existing[0]) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const current = existing[0] as Record<string, unknown>;

    const name = body.name !== undefined
      ? cleanText(body.name) || (current.name as string)
      : (current.name as string);

    const brandColor = body.brandColor !== undefined
      ? (isValidBrandColor(body.brandColor) ? (body.brandColor as string).trim() : (current.brand_color as string))
      : (current.brand_color as string);

    let rawLogoPath = current.logo_url as string | null;
    if ("clearLogo" in body && body.clearLogo === true) {
      rawLogoPath = null;
    }

    const { rows } = await db.query(
      `UPDATE accounts SET name=$1, logo_url=$2, brand_color=$3
         WHERE id=$4 RETURNING id, name, slug, logo_url, brand_color`,
      [name, rawLogoPath, brandColor, accountId],
    );
    const row = rows[0] as Record<string, unknown>;
    res.json({
      org: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        logo_url: row.logo_url ? buildLogoServingUrl(accountId) : null,
        brand_color: row.brand_color ?? "#C49A38",
      },
    });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to update org settings");
    res.status(500).json({ error: "Failed to update org settings" });
  }
});

/**
 * @openapi
 * /internal/settings/org/logo:
 *   post:
 *     tags:
 *       - Internal — Settings
 *     summary: Upload org logo (internal)
 *     description: |
 *       Replaces the organisation's logo with the uploaded image.
 *       Upload the raw image binary in the request body and set
 *       `Content-Type` to the image MIME type.
 *
 *       Maximum size: **5 MB**. Accepted types: `image/png`, `image/jpeg`, `image/webp`.
 *     security:
 *       - internalAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         image/png:
 *           schema:
 *             type: string
 *             format: binary
 *         image/jpeg:
 *           schema:
 *             type: string
 *             format: binary
 *         image/webp:
 *           schema:
 *             type: string
 *             format: binary
 *     responses:
 *       200:
 *         description: Updated org (with new logo_url)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 org:
 *                   $ref: '#/components/schemas/OrgSettings'
 *       400:
 *         description: Unsupported MIME type or empty body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * /product/settings/org/logo:
 *   post:
 *     tags:
 *       - Product Portal — Settings
 *     summary: Upload org logo
 *     description: |
 *       Replaces the organisation's logo with the uploaded image.
 *       Upload the raw image binary in the request body and set
 *       `Content-Type` to the image MIME type.
 *
 *       Maximum size: **5 MB**. Accepted types: `image/png`, `image/jpeg`, `image/webp`.
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         image/png:
 *           schema:
 *             type: string
 *             format: binary
 *         image/jpeg:
 *           schema:
 *             type: string
 *             format: binary
 *         image/webp:
 *           schema:
 *             type: string
 *             format: binary
 *     responses:
 *       200:
 *         description: Updated org (with new logo_url)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 org:
 *                   $ref: '#/components/schemas/OrgSettings'
 *       400:
 *         description: Unsupported MIME type or empty body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/org/logo",
  requireAdminRole,
  express.raw({ type: ALLOWED_IMAGE_TYPES as unknown as string[], limit: "5mb" }),
  async (req, res) => {
    try {
      const accountId = req.internalAccountId ?? 1;
      const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim() as ImageContentType;
      if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
        res.status(400).json({ error: "Only PNG, JPG, and WebP images are accepted" });
        return;
      }
      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        res.status(400).json({ error: "Empty image body" });
        return;
      }
      if (buffer.length > 5 * 1024 * 1024) {
        res.status(400).json({ error: "Logo must be under 5 MB" });
        return;
      }
      const db = getDb();
      const rawLogoPath = await uploadLogoBuffer(buffer, contentType);
      const { rows } = await db.query(
        `UPDATE accounts SET logo_url=$1 WHERE id=$2 RETURNING id, name, slug, logo_url, brand_color`,
        [rawLogoPath, accountId],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Account not found" });
        return;
      }
      const row = rows[0] as Record<string, unknown>;
      res.json({
        org: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          logo_url: buildLogoServingUrl(accountId),
          brand_color: row.brand_color ?? "#C49A38",
        },
      });
    } catch (err) {
      logger.error({ err }, "[Settings] Failed to upload logo");
      res.status(500).json({ error: "Failed to upload logo" });
    }
  },
);

/**
 * @openapi
 * /internal/settings/extract-brand-colors:
 *   post:
 *     tags:
 *       - Internal — Settings
 *     summary: Extract brand colors from a website (internal)
 *     description: |
 *       Fetches the given URL and extracts prominent brand colors from its CSS
 *       and inline styles. Returns an ordered list of hex color strings.
 *
 *       The endpoint refuses private/internal IP ranges (SSRF protection).
 *     security:
 *       - internalAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: 'https://example.com'
 *     responses:
 *       200:
 *         description: Extracted hex colors ordered by prominence
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 colors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ['#1A2B3C', '#C49A38']
 *       422:
 *         description: Could not fetch or parse the URL
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * /product/settings/extract-brand-colors:
 *   post:
 *     tags:
 *       - Product Portal — Settings
 *     summary: Extract brand colors from a website
 *     description: |
 *       Fetches the given URL and extracts prominent brand colors from its CSS
 *       and inline styles. Returns an ordered list of hex color strings.
 *
 *       The endpoint refuses private/internal IP ranges (SSRF protection).
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: 'https://example.com'
 *     responses:
 *       200:
 *         description: Extracted hex colors ordered by prominence
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 colors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ['#1A2B3C', '#3B6CB7']
 *       422:
 *         description: Could not fetch or parse the URL
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/extract-brand-colors", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) {
      res.status(400).json({ error: "A URL is required." });
      return;
    }
    if (!isSafeUrl(url)) {
      res.status(400).json({ error: "URL must be a public http/https address." });
      return;
    }
    const colors = await extractBrandColors(url);
    res.json({ colors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not extract colors from that URL.";
    res.status(422).json({ error: msg });
  }
});

// ── Team management ──────────────────────────────────────────────────────────

const VALID_ROLES = new Set(["admin", "member", "readonly"]);

function roleLabel(role: string): string {
  if (role === "admin")    return "Admin";
  if (role === "readonly") return "Read-only";
  return "Member";
}

/**
 * GET /team — list all team members for the authenticated account.
 *
 * Intentionally accessible to all authenticated product users (admin, member,
 * readonly) because every member of an account should be able to see the team
 * roster and know who the admins are to request changes.
 */
router.get("/team", async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;

    const [membersResult, accountResult] = await Promise.all([
      getDb().query(
        `SELECT id, email, display_name, role, status, last_seen_at, invited_at, invited_by,
                (clerk_user_id IS NOT DISTINCT FROM $2) AS is_current_user
           FROM account_users
          WHERE account_id = $1
          ORDER BY role = 'admin' DESC, created_at ASC`,
        [accountId, clerkUserId],
      ),
      getDb().query<{ seat_limit: number }>(
        `SELECT seat_limit FROM accounts WHERE id = $1`,
        [accountId],
      ),
    ]);

    const rows      = membersResult.rows as Record<string, unknown>[];
    const seatCount = rows.filter((r) => r.status !== "pending").length;
    const seatLimit = accountResult.rows[0]?.seat_limit ?? 10;

    res.json({
      members: rows.map((r) => ({
        id:              r.id,
        email:           r.email,
        display_name:    r.display_name ?? null,
        role:            r.role,
        role_label:      roleLabel(r.role as string),
        status:          r.status,
        last_seen_at:    r.last_seen_at ?? null,
        invited_at:      r.invited_at ?? null,
        invited_by:      r.invited_by ?? null,
        is_current_user: r.is_current_user,
      })),
      seat_count: seatCount,
      seat_limit: seatLimit,
      is_admin:   req.productUserRole === "admin",
    });
  } catch (err) {
    logger.error({ err }, "[Team] Failed to list members");
    res.status(500).json({ error: "Failed to load team." });
  }
});

/** POST /team/invite — send an invitation to a new member (admin only) */
router.post("/team/invite", requireAdminRole, requireWithinPlanLimits("seat"), async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const body = req.body as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role  = typeof body.role  === "string" ? body.role.trim().toLowerCase() : "member";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return void res.status(400).json({ error: "A valid email address is required." });
    }
    if (!VALID_ROLES.has(role)) {
      return void res.status(400).json({ error: "Invalid role. Must be admin, member, or readonly." });
    }

    const db = getDb();

    // Resolve org name and inviter email
    const [orgResult, inviterResult] = await Promise.all([
      db.query<{ name: string }>(`SELECT name FROM accounts WHERE id = $1`, [accountId]),
      db.query<{ email: string; display_name: string | null }>(
        `SELECT email, display_name FROM account_users WHERE account_id = $1 AND clerk_user_id = $2 LIMIT 1`,
        [accountId, getAuth(req)?.userId ?? null],
      ),
    ]);
    const orgName     = orgResult.rows[0]?.name ?? "Your organization";
    const inviterEmail = inviterResult.rows[0]?.email ?? "";
    const inviterName  = inviterResult.rows[0]?.display_name || inviterEmail;

    // Upsert pending invitation (idempotent — if re-invited, update role)
    const { rows } = await db.query(
      `INSERT INTO account_users (account_id, email, role, status, invited_by, invited_at)
       VALUES ($1, $2, $3, 'pending', $4, NOW())
       ON CONFLICT (account_id, email)
       DO UPDATE SET role = $3, invited_by = $4, invited_at = NOW(), status = CASE
         WHEN account_users.clerk_user_id IS NULL THEN 'pending'
         ELSE account_users.status
       END
       RETURNING id, email, role, status, invited_at`,
      [accountId, email, role, inviterEmail],
    );
    const member = rows[0] as Record<string, unknown>;

    const origin = process.env.APP_ORIGIN
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://app.docuplete.com");
    const signUpUrl = `${origin}/app`;

    // Attempt to send the invitation email. We track success and surface it in
    // the API response so admins know if delivery failed (e.g. RESEND_API_KEY
    // not configured) and can share the sign-up link another way.
    let emailSent = false;
    try {
      await sendTeamInvitationEmail({ recipientEmail: email, inviterName, orgName, role, signUpUrl });
      emailSent = true;
    } catch (emailErr) {
      logger.warn({ emailErr, email }, "[Team] Invitation email failed — DB record still created");
    }

    return void res.status(201).json({
      member: {
        id:           member.id,
        email:        member.email,
        role:         member.role,
        role_label:   roleLabel(member.role as string),
        status:       member.status,
        invited_at:   member.invited_at,
      },
      emailSent,
    });
  } catch (err) {
    logger.error({ err }, "[Team] Failed to invite member");
    res.status(500).json({ error: "Failed to send invitation." });
  }
});

/** PATCH /team/:id/role — change a member's role (admin only) */
router.patch("/team/:id/role", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const memberId  = parseInt(req.params.id ?? "", 10);
    if (isNaN(memberId)) return void res.status(400).json({ error: "Invalid member id." });

    const body = req.body as Record<string, unknown>;
    const newRole = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";
    if (!VALID_ROLES.has(newRole)) {
      return void res.status(400).json({ error: "Invalid role. Must be admin, member, or readonly." });
    }

    const db = getDb();

    // Fetch target member
    const { rows: targets } = await db.query<{ role: string }>(
      `SELECT role FROM account_users WHERE id = $1 AND account_id = $2`,
      [memberId, accountId],
    );
    if (!targets[0]) return void res.status(404).json({ error: "Team member not found." });

    // Guard: cannot demote if they are the last admin
    if (targets[0].role === "admin" && newRole !== "admin") {
      const { rows: adminCount } = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM account_users
          WHERE account_id = $1 AND role = 'admin' AND status = 'active'`,
        [accountId],
      );
      if (parseInt(adminCount[0].count, 10) <= 1) {
        return void res.status(409).json({ error: "Cannot demote the only admin. Promote another member to admin first." });
      }
    }

    const { rows } = await db.query(
      `UPDATE account_users SET role = $1 WHERE id = $2 AND account_id = $3
       RETURNING id, email, display_name, role, status, last_seen_at`,
      [newRole, memberId, accountId],
    );

    return void res.json({
      member: {
        ...(rows[0] as Record<string, unknown>),
        role_label: roleLabel(newRole),
      },
    });
  } catch (err) {
    logger.error({ err }, "[Team] Failed to update role");
    res.status(500).json({ error: "Failed to update role." });
  }
});

/** DELETE /team/:id — remove a member (admin only) */
router.delete("/team/:id", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const memberId  = parseInt(req.params.id ?? "", 10);
    if (isNaN(memberId)) return void res.status(400).json({ error: "Invalid member id." });

    const db = getDb();

    // Fetch target
    const { rows: targets } = await db.query<{ role: string; status: string }>(
      `SELECT role, status FROM account_users WHERE id = $1 AND account_id = $2`,
      [memberId, accountId],
    );
    if (!targets[0]) return void res.status(404).json({ error: "Team member not found." });

    // Guard: cannot remove the last admin
    if (targets[0].role === "admin") {
      const { rows: adminCount } = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM account_users
          WHERE account_id = $1 AND role = 'admin' AND status = 'active'`,
        [accountId],
      );
      if (parseInt(adminCount[0].count, 10) <= 1) {
        return void res.status(409).json({ error: "Cannot remove the only admin. Promote another member to admin first." });
      }
    }

    await db.query(`DELETE FROM account_users WHERE id = $1 AND account_id = $2`, [memberId, accountId]);

    return void res.json({ success: true, deletedId: memberId });
  } catch (err) {
    logger.error({ err }, "[Team] Failed to remove member");
    res.status(500).json({ error: "Failed to remove member." });
  }
});

// ── Billing ───────────────────────────────────────────────────────────────────

function utcDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Computes the start of the current billing period for usage counting.
 * Uses the account's Stripe billing anchor day when available so that
 * submission caps align with the subscription renewal cycle rather than
 * the calendar month.
 *
 * Anchor day is clamped to the last valid day of the target month to handle
 * anchors of 29–31 in shorter months, matching Stripe's own behavior.
 */
function billingWindowStart(billingPeriodStartDate: Date | null): string {
  const now = new Date();
  if (billingPeriodStartDate) {
    const rawAnchor = billingPeriodStartDate.getUTCDate();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();

    const thisAnchorDay = Math.min(rawAnchor, utcDaysInMonth(y, m));
    const thisMonthAnchor = new Date(Date.UTC(y, m, thisAnchorDay));

    if (thisMonthAnchor <= now) {
      const ay = thisMonthAnchor.getUTCFullYear();
      const am = String(thisMonthAnchor.getUTCMonth() + 1).padStart(2, "0");
      const ad = String(thisMonthAnchor.getUTCDate()).padStart(2, "0");
      return `${ay}-${am}-${ad}`;
    }
    // Anchor hasn't passed this month — use previous month
    const prevYear  = m === 0 ? y - 1 : y;
    const prevMonth = m === 0 ? 11 : m - 1;
    const prevAnchorDay = Math.min(rawAnchor, utcDaysInMonth(prevYear, prevMonth));
    const prev = new Date(Date.UTC(prevYear, prevMonth, prevAnchorDay));
    return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/** GET /billing — returns current plan, usage, and subscription info */
router.get("/billing", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();

    // Fetch account first so we can anchor the billing window correctly
    const acctResult = await db.query<{
      plan_tier: string;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      subscription_status: string | null;
      billing_period_start: Date | null;
      seat_limit: number;
    }>(
      `SELECT plan_tier, stripe_customer_id, stripe_subscription_id, subscription_status, billing_period_start, seat_limit
         FROM accounts WHERE id = $1`,
      [accountId],
    );

    const acct = acctResult.rows[0];
    if (!acct) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const periodStart = billingWindowStart(acct.billing_period_start ?? null);

    const [pkgResult, usageResult, seatResult] = await Promise.all([
      db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM docufill_packages WHERE account_id = $1`,
        [accountId],
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM usage_events
          WHERE account_id = $1 AND event_type = 'submission' AND created_at >= $2::date`,
        [accountId, periodStart],
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM account_users WHERE account_id = $1 AND status != 'pending'`,
        [accountId],
      ),
    ]);

    const limits = getPlanLimits(acct.plan_tier);
    const pkgCount  = parseInt(pkgResult.rows[0]?.count ?? "0", 10);
    const subCount  = parseInt(usageResult.rows[0]?.count ?? "0", 10);
    const seatCount = parseInt(seatResult.rows[0]?.count ?? "0", 10);

    // Try to pull next renewal date from the stripe.subscriptions table if synced
    let nextRenewalAt: string | null = null;
    if (acct.stripe_subscription_id) {
      try {
        const { rows: subRows } = await db.query<{ current_period_end: Date | null }>(
          `SELECT current_period_end FROM stripe.subscriptions WHERE id = $1`,
          [acct.stripe_subscription_id],
        );
        if (subRows[0]?.current_period_end) {
          nextRenewalAt = new Date(subRows[0].current_period_end).toISOString();
        }
      } catch {
        // stripe schema not yet initialized — skip silently
      }
    }

    res.json({
      billing: {
        plan_tier:               acct.plan_tier,
        subscription_status:     acct.subscription_status ?? null,
        billing_period_start:    acct.billing_period_start?.toISOString() ?? null,
        next_renewal_at:         nextRenewalAt,
        has_stripe_customer:     !!acct.stripe_customer_id,
        has_stripe_subscription: !!acct.stripe_subscription_id,
        limits: {
          max_packages:              limits.maxPackages,
          max_submissions_per_month: limits.maxSubmissionsPerMonth,
          max_seats:                 limits.maxSeats,
        },
        usage: {
          packages:    pkgCount,
          submissions: subCount,
          seats:       seatCount,
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "[Billing] Failed to get billing info");
    res.status(500).json({ error: "Failed to load billing information" });
  }
});

/** POST /billing/checkout — create a Stripe Checkout session to subscribe / upgrade */
router.post("/billing/checkout", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const body = req.body as Record<string, unknown>;
    const planTier = typeof body.plan === "string" ? body.plan : "";
    if (planTier !== "pro" && planTier !== "enterprise") {
      res.status(400).json({ error: "Invalid plan. Must be 'pro' or 'enterprise'." });
      return;
    }

    const db     = getDb();
    const stripe = await getUncachableStripeClient();

    // Resolve account name + email for customer creation
    const { rows: acctRows } = await db.query<{
      name: string;
      stripe_customer_id: string | null;
    }>(
      `SELECT name, stripe_customer_id FROM accounts WHERE id = $1`,
      [accountId],
    );
    const acct = acctRows[0];
    if (!acct) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    // Find or create Stripe customer
    let customerId = acct.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name:     acct.name,
        metadata: { account_id: String(accountId) },
      });
      customerId = customer.id;
      await db.query(
        `UPDATE accounts SET stripe_customer_id = $1 WHERE id = $2`,
        [customerId, accountId],
      );
    }

    // Look up matching price via the Stripe API (primary) or env var (fallback)
    let priceId: string | null = null;

    // Env var shortcut (set after running seed-stripe-products)
    priceId = planTier === "pro"
      ? (process.env.STRIPE_PRO_PRICE_ID ?? null)
      : (process.env.STRIPE_ENTERPRISE_PRICE_ID ?? null);

    // Live Stripe API lookup by product metadata if env vars not set
    if (!priceId) {
      try {
        const products = await stripe.products.list({ active: true, limit: 100 });
        const product = products.data.find(
          (p) => p.metadata?.plan_tier?.toLowerCase() === planTier,
        );
        if (product) {
          const prices = await stripe.prices.list({
            product: product.id,
            active:  true,
            type:    "recurring",
            limit:   10,
          });
          // Prefer the lowest unit_amount (most accessible price)
          const sorted = prices.data.sort((a, b) => (a.unit_amount ?? 0) - (b.unit_amount ?? 0));
          priceId = sorted[0]?.id ?? null;
        }
      } catch {
        // Stripe API unavailable — fall through
      }
    }

    // Stripe-replit-sync DB fallback (when synced tables are available)
    if (!priceId) {
      try {
        const { rows: priceRows } = await db.query<{ id: string }>(
          `SELECT pr.id
             FROM stripe.prices pr
             JOIN stripe.products p ON p.id = pr.product
            WHERE pr.active = true
              AND p.active = true
              AND lower(p.metadata->>'plan_tier') = $1
              AND pr.recurring IS NOT NULL
            ORDER BY pr.unit_amount ASC
            LIMIT 1`,
          [planTier],
        );
        priceId = priceRows[0]?.id ?? null;
      } catch {
        // stripe schema not yet synced
      }
    }

    if (!priceId) {
      res.status(503).json({
        error: "Stripe products have not been seeded yet. Run the seed-products script first.",
        setup_required: true,
      });
      return;
    }

    const origin = process.env.APP_ORIGIN
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://app.docuplete.com");

    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      payment_method_types: ["card"],
      line_items:           [{ price: priceId, quantity: 1 }],
      mode:                 "subscription",
      success_url:          `${origin}/app/settings?billing=success`,
      cancel_url:           `${origin}/app/settings?billing=cancel`,
      subscription_data:    { metadata: { account_id: String(accountId) } },
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "[Billing] Failed to create checkout session");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/** POST /billing/portal — create a Stripe Customer Portal session */
router.post("/billing/portal", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();

    const { rows } = await db.query<{ stripe_customer_id: string | null }>(
      `SELECT stripe_customer_id FROM accounts WHERE id = $1`,
      [accountId],
    );
    const customerId = rows[0]?.stripe_customer_id;
    if (!customerId) {
      res.status(409).json({ error: "No billing account found. Subscribe first to access the billing portal." });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const origin = process.env.APP_ORIGIN
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://app.docuplete.com");

    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${origin}/app/settings`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    logger.error({ err }, "[Billing] Failed to create portal session");
    res.status(500).json({ error: "Failed to create billing portal session" });
  }
});

export default router;
