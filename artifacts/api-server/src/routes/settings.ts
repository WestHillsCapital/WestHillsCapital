import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { ObjectStorageService, objectStorageClient } from "../lib/objectStorage";
import { extractBrandColors, isSafeUrl } from "../lib/brandColorExtractor";
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
router.patch("/org", async (req, res) => {
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

export default router;
