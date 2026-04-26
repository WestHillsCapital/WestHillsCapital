import { Router, type IRouter } from "express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { ObjectStorageService } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidBrandColor(value: unknown): boolean {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function logoServingUrl(rawPath: string | null | undefined): string | null {
  if (!rawPath) return null;
  return `/api/storage${rawPath}`;
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
        logo_url: logoServingUrl(row.logo_url as string | null),
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
    if (body.logoPath !== undefined) {
      rawLogoPath = typeof body.logoPath === "string" ? body.logoPath : null;
    }

    if (rawLogoPath !== null && rawLogoPath !== (current.logo_url as string | null)) {
      try {
        await objectStorageService.trySetObjectEntityAclPolicy(rawLogoPath, {
          owner: `account:${accountId}`,
          visibility: "public",
        });
      } catch (aclErr) {
        logger.warn({ aclErr, rawLogoPath }, "[Settings] Could not set logo ACL policy; object may not yet exist");
      }
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
        logo_url: logoServingUrl(row.logo_url as string | null),
        brand_color: row.brand_color ?? "#C49A38",
      },
    });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to update org settings");
    res.status(500).json({ error: "Failed to update org settings" });
  }
});

router.post("/org/logo", async (req, res) => {
  try {
    const body = req.body as { contentType?: unknown };
    const contentType = cleanText(body.contentType) || "image/png";
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(contentType)) {
      res.status(400).json({ error: "Only PNG, JPG, and WebP images are accepted" });
      return;
    }

    const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
    const rawObjectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);

    res.json({ uploadUrl, rawObjectPath });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to generate logo upload URL");
    res.status(500).json({ error: "Failed to generate logo upload URL" });
  }
});

export default router;
