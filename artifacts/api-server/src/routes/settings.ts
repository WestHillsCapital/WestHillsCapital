import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { ObjectStorageService, objectStorageClient, StorageMisconfigError, assertStorageCredentials, wrapGcsError } from "../lib/objectStorage";
import { extractBrandColors, isSafeUrl } from "../lib/brandColorExtractor";
import { requireAdminRole } from "../middleware/requireRole";
import { requireWithinPlanLimits } from "../middleware/requireWithinPlanLimits";
import { brandColorRateLimit } from "../middleware/brandColorRateLimit";
import { sendTeamInvitationEmail } from "../lib/email";
import { getPlanLimits } from "../lib/plans";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { isIpAllowed } from "../lib/cidr";
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
  // Fail fast with a typed error if credentials or path are missing before
  // attempting a GCS write that would fail with a cryptic auth error.
  assertStorageCredentials();
  const privateDir = objectStorageService.getPrivateObjectDir(); // throws StorageMisconfigError if unset
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
  try {
    await file.save(buffer, { contentType, resumable: false });
  } catch (gcsErr) {
    wrapGcsError(gcsErr); // rethrows as StorageMisconfigError for auth/sidecar errors; otherwise rethrows as-is
  }
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
      let rawLogoPath: string;
      try {
        rawLogoPath = await uploadLogoBuffer(buffer, contentType);
      } catch (uploadErr) {
        logger.error({ err: uploadErr }, "[Settings] Logo upload failed");
        if (uploadErr instanceof StorageMisconfigError) {
          res.status(503).json({
            error: "Storage is not configured on this server. Set PRIVATE_OBJECT_DIR and GOOGLE_SERVICE_ACCOUNT_KEY in the deployment environment.",
          });
        } else {
          res.status(500).json({ error: "Logo upload failed. Please try again." });
        }
        return;
      }
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
      logger.error({ err }, "[Settings] Unexpected error during logo upload");
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
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
 *       429:
 *         description: Rate limit exceeded (5 requests per minute per account or IP)
 *         headers:
 *           Retry-After:
 *             schema:
 *               type: integer
 *             description: Seconds to wait before retrying
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
 *       429:
 *         description: Rate limit exceeded (5 requests per minute per account or IP)
 *         headers:
 *           Retry-After:
 *             schema:
 *               type: integer
 *             description: Seconds to wait before retrying
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/extract-brand-colors", brandColorRateLimit, async (req, res) => {
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
    const memberId  = parseInt(String(req.params.id ?? ""), 10);
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
    const memberId  = parseInt(String(req.params.id ?? ""), 10);
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
  // Default: first of the calendar month (UTC for consistency with anchor logic above)
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
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

/** GET /onboarding — returns onboarding checklist state derived from DB + stored dismissed flag */
router.get("/onboarding", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();

    const [accountRes, packagesRes, sessionsRes] = await Promise.all([
      db.query(
        `SELECT onboarding_completed_steps FROM accounts WHERE id = $1`,
        [accountId],
      ),
      db.query(
        `SELECT tags FROM docufill_packages
          WHERE account_id = $1 AND status <> 'deleted'`,
        [accountId],
      ),
      db.query(
        `SELECT source FROM docufill_interview_sessions
          WHERE account_id = $1
          LIMIT 200`,
        [accountId],
      ),
    ]);

    const stored = (accountRes.rows[0]?.onboarding_completed_steps ?? {}) as Record<string, unknown>;

    const packages = packagesRes.rows as Array<{ tags: unknown }>;
    const sessions = sessionsRes.rows as Array<{ source: string }>;

    const hasDemoPackage = packages.some((p) => {
      const tags = Array.isArray(p.tags) ? p.tags : [];
      return tags.includes("Demo");
    });

    const hasOwnPackage = packages.some((p) => {
      const tags = Array.isArray(p.tags) ? p.tags : [];
      return !tags.includes("Demo");
    });

    const hasAnySessions = sessions.length > 0;
    const hasSentCustomerLink = sessions.some((s) => s.source === "customer_link");

    res.json({
      onboarding: {
        dismissed: stored.dismissed === true,
        demo_package_exists: hasDemoPackage,
        steps: {
          explore_demo: hasAnySessions,
          create_package: hasOwnPackage,
          send_interview: hasSentCustomerLink,
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "[Onboarding] Failed to get onboarding state");
    res.status(500).json({ error: "Failed to load onboarding state" });
  }
});

/** PATCH /onboarding — stores the dismissed flag (and any future step overrides) */
router.patch("/onboarding", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();
    const body = req.body as Record<string, unknown>;

    const { rows } = await db.query(
      `SELECT onboarding_completed_steps FROM accounts WHERE id = $1`,
      [accountId],
    );
    const current = (rows[0]?.onboarding_completed_steps ?? {}) as Record<string, unknown>;

    const updated: Record<string, unknown> = { ...current };
    if (typeof body.dismissed === "boolean") updated.dismissed = body.dismissed;

    await db.query(
      `UPDATE accounts SET onboarding_completed_steps = $1::jsonb WHERE id = $2`,
      [JSON.stringify(updated), accountId],
    );

    res.json({ onboarding: { dismissed: updated.dismissed === true } });
  } catch (err) {
    logger.error({ err }, "[Onboarding] Failed to update onboarding state");
    res.status(500).json({ error: "Failed to update onboarding state" });
  }
});

// ── Integrations hub ─────────────────────────────────────────────────────────

/** GET /integrations — returns connection status for all supported integrations */
router.get("/integrations", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();
    const [{ rows: acctRows }, { rows: keyRows }] = await Promise.all([
      db.query<{ slack_webhook_url: string | null; slack_channel_name: string | null; slack_connected_at: Date | null }>(
        `SELECT slack_webhook_url, slack_channel_name, slack_connected_at FROM accounts WHERE id = $1`,
        [accountId],
      ),
      db.query<{ count: string; first_prefix: string | null }>(
        `SELECT COUNT(*) AS count,
                MIN(key_prefix) FILTER (WHERE revoked_at IS NULL) AS first_prefix
           FROM account_api_keys
          WHERE account_id = $1`,
        [accountId],
      ),
    ]);
    const acct = acctRows[0];
    const apiKeyCount = parseInt(keyRows[0]?.count ?? "0", 10);
    res.json({
      integrations: {
        zapier: {
          api_key_count: apiKeyCount,
          first_key_prefix: keyRows[0]?.first_prefix ?? null,
          available: true,
        },
        slack: {
          connected: !!acct?.slack_webhook_url,
          channel_name: acct?.slack_channel_name ?? null,
          connected_at: acct?.slack_connected_at?.toISOString() ?? null,
          available: !!process.env.SLACK_CLIENT_ID,
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "[Integrations] Failed to load integration status");
    res.status(500).json({ error: "Failed to load integrations" });
  }
});

/**
 * POST /integrations/slack/connect — generates a Slack OAuth URL.
 * The client redirects the user to the returned URL. After authorizing,
 * Slack redirects back to the `redirectUri` (the frontend settings page)
 * with `?code=...&state=...`, which the client then exchanges via /exchange.
 */
router.post("/integrations/slack/connect", requireAdminRole, async (req, res) => {
  const slackClientId = process.env.SLACK_CLIENT_ID;
  if (!slackClientId) {
    res.status(503).json({ error: "Slack integration is not configured on this server." });
    return;
  }
  try {
    const accountId = req.internalAccountId ?? 1;
    const body = req.body as { redirectUri?: string };
    if (!body.redirectUri || typeof body.redirectUri !== "string") {
      res.status(400).json({ error: "redirectUri is required" });
      return;
    }
    const state = randomUUID();
    const db = getDb();
    await db.query(`UPDATE accounts SET slack_oauth_state = $1 WHERE id = $2`, [state, accountId]);
    const params = new URLSearchParams({
      client_id: slackClientId,
      scope: "incoming-webhook",
      redirect_uri: body.redirectUri,
      state,
    });
    res.json({ url: `https://slack.com/oauth/v2/authorize?${params.toString()}` });
  } catch (err) {
    logger.error({ err }, "[Integrations] Failed to generate Slack OAuth URL");
    res.status(500).json({ error: "Failed to initiate Slack connection" });
  }
});

/**
 * POST /integrations/slack/exchange — exchanges the OAuth code for a webhook.
 * Called by the frontend after Slack redirects back with ?code=...&state=...
 */
router.post("/integrations/slack/exchange", requireAdminRole, async (req, res) => {
  const slackClientId = process.env.SLACK_CLIENT_ID;
  const slackClientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!slackClientId || !slackClientSecret) {
    res.status(503).json({ error: "Slack integration is not configured." });
    return;
  }
  try {
    const accountId = req.internalAccountId ?? 1;
    const body = req.body as { code?: string; state?: string; redirectUri?: string };
    if (!body.code || !body.state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const db = getDb();
    const { rows } = await db.query<{ slack_oauth_state: string | null }>(
      `SELECT slack_oauth_state FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!rows[0] || rows[0].slack_oauth_state !== body.state) {
      res.status(400).json({ error: "Invalid or expired OAuth state. Please try connecting again." });
      return;
    }
    // Exchange code for token
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: slackClientId,
        client_secret: slackClientSecret,
        code: body.code,
        redirect_uri: body.redirectUri ?? "",
      }).toString(),
    });
    const tokenData = await tokenRes.json() as {
      ok: boolean;
      incoming_webhook?: { url: string; channel: string; channel_id: string };
      error?: string;
    };
    if (!tokenData.ok || !tokenData.incoming_webhook) {
      logger.warn({ slackError: tokenData.error }, "[Integrations] Slack token exchange failed");
      res.status(400).json({ error: tokenData.error ?? "Slack authorization failed. Please try again." });
      return;
    }
    const { url: webhookUrl, channel } = tokenData.incoming_webhook;
    await db.query(
      `UPDATE accounts
          SET slack_webhook_url = $1, slack_channel_name = $2,
              slack_connected_at = NOW(), slack_oauth_state = NULL
        WHERE id = $3`,
      [webhookUrl, channel, accountId],
    );
    // Send a test message — non-fatal
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "✅ Docuplete is now connected to this channel. You'll receive submission notifications here." }),
      });
    } catch {
      // Ignore — test message is best-effort
    }
    res.json({ success: true, channel_name: channel });
  } catch (err) {
    logger.error({ err }, "[Integrations] Slack exchange failed");
    res.status(500).json({ error: "Failed to connect Slack" });
  }
});

/** DELETE /integrations/slack — clears stored Slack credentials */
router.delete("/integrations/slack", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();
    await db.query(
      `UPDATE accounts
          SET slack_webhook_url = NULL, slack_channel_name = NULL,
              slack_connected_at = NULL, slack_oauth_state = NULL
        WHERE id = $1`,
      [accountId],
    );
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Integrations] Failed to disconnect Slack");
    res.status(500).json({ error: "Failed to disconnect Slack" });
  }
});

// ── Super-admin accounts list (internal-auth-only) ────────────────────────────

/**
 * GET /admin/accounts — lists all accounts with key metrics.
 * Only accessible when the request comes via the internal portal
 * (req.internalEmail is set). Product-portal callers get 403.
 */
router.get("/admin/accounts", async (req, res) => {
  if (!req.internalEmail) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const db = getDb();

    const { rows } = await db.query<{
      id: number;
      name: string;
      slug: string;
      plan_tier: string;
      subscription_status: string | null;
      billing_period_start: Date | null;
      seat_limit: number;
      seat_count: string;
      submission_count: string;
      package_count: string;
      last_activity_at: Date | null;
      created_at: Date;
      stripe_customer_id: string | null;
    }>(
      `SELECT
          a.id,
          a.name,
          a.slug,
          a.plan_tier,
          a.subscription_status,
          a.billing_period_start,
          a.seat_limit,
          a.created_at,
          a.stripe_customer_id,
          (SELECT COUNT(*)
             FROM account_users au
            WHERE au.account_id = a.id AND au.status != 'pending') AS seat_count,
          (SELECT COUNT(*)
             FROM usage_events ue
            WHERE ue.account_id = a.id
              AND ue.event_type = 'submission'
              AND ue.created_at >= COALESCE(a.billing_period_start, DATE_TRUNC('month', NOW()))
          ) AS submission_count,
          (SELECT COUNT(*)
             FROM docufill_packages dp
            WHERE dp.account_id = a.id) AS package_count,
          (SELECT MAX(s.created_at)
             FROM docufill_interview_sessions s
            WHERE s.account_id = a.id) AS last_activity_at
         FROM accounts a
        ORDER BY a.created_at DESC`,
    );

    res.json({
      accounts: rows.map((r) => ({
        id:                   r.id,
        name:                 r.name,
        slug:                 r.slug,
        plan_tier:            r.plan_tier,
        subscription_status:  r.subscription_status ?? null,
        billing_period_start: r.billing_period_start?.toISOString().slice(0, 10) ?? null,
        seat_limit:           r.seat_limit,
        seat_count:           parseInt(r.seat_count, 10),
        submission_count:     parseInt(r.submission_count, 10),
        package_count:        parseInt(r.package_count, 10),
        last_activity_at:     r.last_activity_at?.toISOString() ?? null,
        created_at:           r.created_at.toISOString(),
        stripe_customer_id:   r.stripe_customer_id ?? null,
      })),
    });
  } catch (err) {
    logger.error({ err }, "[Admin] Failed to list accounts");
    res.status(500).json({ error: "Failed to load accounts" });
  }
});

// ── IP allowlist management (admin only) ──────────────────────────────────────
//
// GET  /security/ip-allowlist  → { allowed_ip_ranges: string[] }
// PUT  /security/ip-allowlist  → { allowed_ip_ranges: string[] }
//
// Empty array = no IP restriction (default). Populated = only listed CIDRs can
// use this account's API keys. The account's own current request IP is validated
// against the proposed list before saving to prevent self-lockout.

const CIDR_PATTERN = /^(\d{1,3}\.){3}\d{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/;

function isValidCidr(entry: string): boolean {
  if (!CIDR_PATTERN.test(entry.trim())) return false;
  // Validate each octet
  const [addr] = entry.split("/");
  return (addr ?? "").split(".").every((p) => parseInt(p, 10) <= 255);
}

router.get("/security/ip-allowlist", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const { rows } = await getDb().query<{ allowed_ip_ranges: string[] }>(
      `SELECT allowed_ip_ranges FROM accounts WHERE id = $1`,
      [accountId],
    );
    res.json({ allowed_ip_ranges: rows[0]?.allowed_ip_ranges ?? [] });
  } catch (err) {
    logger.error({ err }, "[IPAllowlist] Failed to fetch");
    res.status(500).json({ error: "Failed to load IP allowlist" });
  }
});

router.put("/security/ip-allowlist", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const body = req.body as Record<string, unknown>;
    const rawRanges = body.allowed_ip_ranges;

    if (!Array.isArray(rawRanges)) {
      return void res.status(400).json({ error: "allowed_ip_ranges must be an array of CIDR strings" });
    }
    if (rawRanges.length > 50) {
      return void res.status(400).json({ error: "Maximum of 50 IP ranges allowed" });
    }

    const ranges: string[] = rawRanges.map((r) => String(r).trim()).filter(Boolean);
    const invalid = ranges.filter((r) => !isValidCidr(r));
    if (invalid.length) {
      return void res.status(400).json({
        error: `Invalid CIDR entries: ${invalid.join(", ")}. Use format 1.2.3.4 or 1.2.3.0/24`,
        invalid_entries: invalid,
      });
    }

    // Self-lockout guard: if the list is non-empty, the admin's own IP must be included.
    const requestIp = req.ip ?? req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ?? "";
    if (ranges.length > 0 && !isIpAllowed(requestIp, ranges)) {
      return void res.status(400).json({
        error: `Your current IP (${requestIp}) is not in the proposed allowlist. Add it before saving to avoid locking yourself out.`,
        code: "SELF_LOCKOUT_PREVENTED",
        your_ip: requestIp,
      });
    }

    await getDb().query(
      `UPDATE accounts SET allowed_ip_ranges = $1::text[] WHERE id = $2`,
      [ranges, accountId],
    );

    logger.info({ accountId, rangeCount: ranges.length }, "[IPAllowlist] Updated");
    res.json({ allowed_ip_ranges: ranges });
  } catch (err) {
    logger.error({ err }, "[IPAllowlist] Failed to update");
    res.status(500).json({ error: "Failed to update IP allowlist" });
  }
});

// ── PDF audit trail (admin read-only) ────────────────────────────────────────
//
// GET /security/pdf-audit?sessionToken=&limit=&offset=
// Returns the event log for a session or the whole account.
// This is the same event stream that e-sign providers will append to.

router.get("/security/pdf-audit", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const { sessionToken, limit: rawLimit, offset: rawOffset } = req.query as Record<string, string | undefined>;

    const limit  = Math.min(parseInt(rawLimit ?? "50", 10) || 50, 200);
    const offset = parseInt(rawOffset ?? "0", 10) || 0;

    const params: unknown[] = [accountId, limit, offset];
    const tokenFilter = sessionToken ? `AND session_token = $${params.push(sessionToken)}` : "";

    const { rows } = await getDb().query(
      `SELECT id, session_token, event_type, actor_type, actor_email, actor_ip, actor_ua, metadata, created_at
         FROM pdf_audit_events
        WHERE account_id = $1 ${tokenFilter}
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      params,
    );

    res.json({ events: rows });
  } catch (err) {
    logger.error({ err }, "[PdfAudit] Failed to fetch events");
    res.status(500).json({ error: "Failed to load PDF audit events" });
  }
});

export default router;
