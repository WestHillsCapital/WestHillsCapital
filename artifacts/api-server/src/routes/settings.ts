import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { ObjectStorageService, objectStorageClient } from "../lib/objectStorage";
import { extractBrandColors, isSafeUrl } from "../lib/brandColorExtractor";
import { requireAdminRole } from "../middleware/requireRole";
import { sendTeamInvitationEmail } from "../lib/email";
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

/** GET /team — list all members visible to the current account */
router.get("/team", async (req, res) => {
  try {
    const accountId  = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;

    const { rows } = await getDb().query(
      `SELECT id, email, display_name, role, status, last_seen_at, invited_at, invited_by,
              (clerk_user_id IS NOT DISTINCT FROM $2) AS is_current_user
         FROM account_users
        WHERE account_id = $1
        ORDER BY role = 'admin' DESC, created_at ASC`,
      [accountId, clerkUserId],
    );

    const seatCount = rows.filter((r: Record<string, unknown>) => r.status !== "pending").length;

    res.json({
      members: rows.map((r: Record<string, unknown>) => ({
        id:               r.id,
        email:            r.email,
        display_name:     r.display_name ?? null,
        role:             r.role,
        role_label:       roleLabel(r.role as string),
        status:           r.status,
        last_seen_at:     r.last_seen_at ?? null,
        invited_at:       r.invited_at ?? null,
        invited_by:       r.invited_by ?? null,
        is_current_user:  r.is_current_user,
      })),
      seat_count: seatCount,
      is_admin:   req.productUserRole === "admin",
    });
  } catch (err) {
    logger.error({ err }, "[Team] Failed to list members");
    res.status(500).json({ error: "Failed to load team." });
  }
});

/** POST /team/invite — send an invitation to a new member (admin only) */
router.post("/team/invite", requireAdminRole, async (req, res) => {
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

    // Send invitation email (fire-and-forget — don't block if RESEND_API_KEY is not set)
    const origin = process.env.APP_ORIGIN
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://app.docuplete.com");
    const signUpUrl = `${origin}/app`;

    sendTeamInvitationEmail({
      recipientEmail: email,
      inviterName,
      orgName,
      role,
      signUpUrl,
    }).catch((err) => logger.warn({ err, email }, "[Team] Invitation email failed"));

    return void res.status(201).json({
      member: {
        id:           member.id,
        email:        member.email,
        role:         member.role,
        role_label:   roleLabel(member.role as string),
        status:       member.status,
        invited_at:   member.invited_at,
      },
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

export default router;
