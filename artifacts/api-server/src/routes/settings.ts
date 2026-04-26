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
