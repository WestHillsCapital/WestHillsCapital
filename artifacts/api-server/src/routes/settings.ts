import { Router, type IRouter } from "express";
import { randomUUID, randomBytes } from "crypto";
import { getAuth } from "@clerk/express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { ObjectStorageService, objectStorageClient, StorageMisconfigError, assertStorageCredentials, wrapGcsError } from "../lib/objectStorage";
import { extractBrandColors, isSafeUrl } from "../lib/brandColorExtractor";
import { requireAdminRole } from "../middleware/requireRole";
import { requireWithinPlanLimits } from "../middleware/requireWithinPlanLimits";
import { requirePlanFeature } from "../middleware/requirePlanFeature";
import { brandColorRateLimit } from "../middleware/brandColorRateLimit";
import { sendTeamInvitationEmail, sendDataExportEmail, sendEmailVerificationEmail } from "../lib/email";
import { getPlanLimits, getEffectiveSubmissionLimit, SUBMISSION_PACKS, getPackTier } from "../lib/plans";
import { getBankBalance } from "../lib/submissionBank";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { isIpAllowed } from "../lib/cidr";
import express from "express";
import { insertAuditLog, getActorEmail } from "../lib/auditLog";
import { getUserEmailsToNotify, sendInAppNotifications } from "../lib/notificationPrefs";
import { sendOrgAlertEmails } from "../lib/email";
import { isGDriveConfigured, generateGDriveAuthUrl, exchangeGDriveCode, parseFolderIdFromInput, verifyFolderAccess } from "../lib/google-drive-account";
import { isHubSpotConfigured, generateHubSpotAuthUrl, exchangeHubSpotCode } from "../lib/hubspot-account";
import archiver from "archiver";
import { PassThrough } from "node:stream";
import { generateSecret as totpGenerateSecret, generateURI as totpGenerateURI, verifySync as totpVerifySync } from "otplib";
import QRCode from "qrcode";
import { createHash } from "crypto";
import geoip from "../lib/geoip";

// In-process LRU cache for geoip results (max 1000 entries).
// ES Maps preserve insertion order; true LRU is achieved by deleting and
// re-inserting the key on every hit so it moves to the "most recently used"
// tail, and evicting from the head (oldest) on capacity overflow.
const IP_GEO_CACHE_MAX = 1000;
const ipGeoCache = new Map<string, string | null>();

function lookupIpLocation(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const cleanIp = ip.trim();
  // Skip loopback and private ranges — geoip-lite returns null for these anyway
  if (
    cleanIp === "127.0.0.1" ||
    cleanIp === "::1" ||
    cleanIp.startsWith("10.") ||
    cleanIp.startsWith("192.168.") ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(cleanIp)
  ) {
    return null;
  }
  if (ipGeoCache.has(cleanIp)) {
    // Refresh recency: move the key to the tail so it isn't evicted while still hot.
    const cached = ipGeoCache.get(cleanIp) ?? null;
    ipGeoCache.delete(cleanIp);
    ipGeoCache.set(cleanIp, cached);
    return cached;
  }
  const geo = geoip.lookup(cleanIp);
  const parts: string[] = [];
  if (geo?.city) parts.push(geo.city);
  if (geo?.country) parts.push(geo.country);
  const result = parts.length > 0 ? parts.join(", ") : null;
  // Evict the least-recently-used (head) entry before adding if at capacity
  if (ipGeoCache.size >= IP_GEO_CACHE_MAX) {
    const oldest = ipGeoCache.keys().next().value;
    if (oldest !== undefined) ipGeoCache.delete(oldest);
  }
  ipGeoCache.set(cleanIp, result);
  return result;
}

function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase()).digest("hex");
}

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

function buildFormLogoServingUrl(accountId: number): string {
  return `/api/storage/org-form-logo/${accountId}`;
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
      `SELECT id, name, slug, logo_url, form_logo_url, brand_color, logo_on_white, timezone, date_format,
              pkg_default_interview, pkg_default_csv, pkg_default_customer_link,
              pkg_default_notify_staff, pkg_default_notify_client, pkg_default_esign
         FROM accounts WHERE id = $1`,
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
        form_logo_url: row.form_logo_url ? buildFormLogoServingUrl(accountId) : null,
        brand_color: row.brand_color ?? "#C49A38",
        logo_on_white: row.logo_on_white !== false,
        timezone:    (row.timezone    as string) || "America/New_York",
        date_format: (row.date_format as string) || "MM/DD/YYYY",
        pkg_default_interview:      row.pkg_default_interview      !== false,
        pkg_default_csv:            row.pkg_default_csv            !== false,
        pkg_default_customer_link:  row.pkg_default_customer_link  !== false,
        pkg_default_notify_staff:   row.pkg_default_notify_staff   !== false,
        pkg_default_notify_client:  row.pkg_default_notify_client  === true,
        pkg_default_esign:          row.pkg_default_esign          === true,
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
      `SELECT id, name, logo_url, form_logo_url, brand_color, logo_on_white, timezone, date_format,
              pkg_default_interview, pkg_default_csv, pkg_default_customer_link,
              pkg_default_notify_staff, pkg_default_notify_client, pkg_default_esign
         FROM accounts WHERE id = $1`,
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

    let rawFormLogoPath = current.form_logo_url as string | null;
    if ("clearFormLogo" in body && body.clearFormLogo === true) {
      rawFormLogoPath = null;
    }

    // Package channel defaults — accept optional boolean overrides
    const pkgDefaultInterview     = "pkgDefaultInterview"    in body ? body.pkgDefaultInterview    !== false : (current.pkg_default_interview    !== false);
    const pkgDefaultCsv           = "pkgDefaultCsv"          in body ? body.pkgDefaultCsv          !== false : (current.pkg_default_csv          !== false);
    const pkgDefaultCustomerLink  = "pkgDefaultCustomerLink" in body ? body.pkgDefaultCustomerLink !== false : (current.pkg_default_customer_link !== false);
    const pkgDefaultNotifyStaff   = "pkgDefaultNotifyStaff"  in body ? body.pkgDefaultNotifyStaff  !== false : (current.pkg_default_notify_staff  !== false);
    const pkgDefaultNotifyClient  = "pkgDefaultNotifyClient" in body ? body.pkgDefaultNotifyClient === true  : (current.pkg_default_notify_client  === true);
    const pkgDefaultEsign         = "pkgDefaultEsign"        in body ? body.pkgDefaultEsign        === true  : (current.pkg_default_esign         === true);
    const logoOnWhite             = "logoOnWhite"             in body ? body.logoOnWhite            !== false : (current.logo_on_white              !== false);

    const { rows } = await db.query(
      `UPDATE accounts
          SET name=$1, logo_url=$2, brand_color=$3, form_logo_url=$11,
              pkg_default_interview=$5, pkg_default_csv=$6,
              pkg_default_customer_link=$7, pkg_default_notify_staff=$8, pkg_default_notify_client=$9,
              pkg_default_esign=$10, logo_on_white=$12
        WHERE id=$4
        RETURNING id, name, slug, logo_url, form_logo_url, brand_color, logo_on_white, timezone, date_format,
                  pkg_default_interview, pkg_default_csv, pkg_default_customer_link,
                  pkg_default_notify_staff, pkg_default_notify_client, pkg_default_esign`,
      [name, rawLogoPath, brandColor, accountId,
       pkgDefaultInterview, pkgDefaultCsv, pkgDefaultCustomerLink, pkgDefaultNotifyStaff, pkgDefaultNotifyClient,
       pkgDefaultEsign, rawFormLogoPath, logoOnWhite],
    );
    const row = rows[0] as Record<string, unknown>;

    const clerkUserId = getAuth(req)?.userId ?? null;
    const actorEmail = await getActorEmail(accountId, clerkUserId);
    const auditBase = { accountId, actorEmail, actorUserId: clerkUserId };
    if (body.name !== undefined && name !== (current.name as string)) {
      void insertAuditLog({ ...auditBase, action: "branding.update_name", resourceType: "org", resourceLabel: name as string, metadata: { from: current.name as string, to: name as string } });
    }
    if (body.brandColor !== undefined && brandColor !== (current.brand_color as string)) {
      void insertAuditLog({ ...auditBase, action: "branding.update_color", resourceType: "org", resourceLabel: brandColor as string, metadata: { from: current.brand_color as string, to: brandColor as string } });
    }
    if ("clearLogo" in body && body.clearLogo === true) {
      void insertAuditLog({ ...auditBase, action: "branding.remove_logo", resourceType: "org" });
    }
    if ("clearFormLogo" in body && body.clearFormLogo === true) {
      void insertAuditLog({ ...auditBase, action: "branding.remove_form_logo", resourceType: "org" });
    }

    res.json({
      org: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        logo_url: row.logo_url ? buildLogoServingUrl(accountId) : null,
        form_logo_url: row.form_logo_url ? buildFormLogoServingUrl(accountId) : null,
        brand_color: row.brand_color ?? "#C49A38",
        logo_on_white: row.logo_on_white !== false,
        timezone:    (row.timezone    as string) || "America/New_York",
        date_format: (row.date_format as string) || "MM/DD/YYYY",
        pkg_default_interview:      row.pkg_default_interview      !== false,
        pkg_default_csv:            row.pkg_default_csv            !== false,
        pkg_default_customer_link:  row.pkg_default_customer_link  !== false,
        pkg_default_notify_staff:   row.pkg_default_notify_staff   !== false,
        pkg_default_notify_client:  row.pkg_default_notify_client  === true,
        pkg_default_esign:          row.pkg_default_esign          === true,
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
            error: uploadErr.message,
          });
        } else {
          const detail = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          res.status(500).json({ error: `Logo upload failed: ${detail}` });
        }
        return;
      }
      const { rows } = await db.query(
        `UPDATE accounts SET logo_url=$1 WHERE id=$2 RETURNING id, name, slug, logo_url, brand_color, logo_on_white, timezone, date_format`,
        [rawLogoPath, accountId],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Account not found" });
        return;
      }
      const row = rows[0] as Record<string, unknown>;
      const clerkUserId = getAuth(req)?.userId ?? null;
      void insertAuditLog({
        accountId,
        actorEmail: await getActorEmail(accountId, clerkUserId),
        actorUserId: clerkUserId,
        action: "branding.upload_logo",
        resourceType: "org",
      });
      res.json({
        org: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          logo_url: buildLogoServingUrl(accountId),
          brand_color: row.brand_color ?? "#C49A38",
          logo_on_white: row.logo_on_white !== false,
          timezone:    (row.timezone    as string) || "America/New_York",
          date_format: (row.date_format as string) || "MM/DD/YYYY",
        },
      });
    } catch (err) {
      logger.error({ err }, "[Settings] Unexpected error during logo upload");
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  },
);

router.post(
  "/org/form-logo",
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
        res.status(400).json({ error: "Form logo must be under 5 MB" });
        return;
      }
      const db = getDb();
      let rawFormLogoPath: string;
      try {
        rawFormLogoPath = await uploadLogoBuffer(buffer, contentType);
      } catch (uploadErr) {
        logger.error({ err: uploadErr }, "[Settings] Form logo upload failed");
        if (uploadErr instanceof StorageMisconfigError) {
          res.status(503).json({ error: (uploadErr as Error).message });
        } else {
          const detail = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          res.status(500).json({ error: `Form logo upload failed: ${detail}` });
        }
        return;
      }
      const { rows } = await db.query(
        `UPDATE accounts SET form_logo_url=$1 WHERE id=$2 RETURNING id, name, slug, form_logo_url, brand_color, logo_on_white, timezone, date_format`,
        [rawFormLogoPath, accountId],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Account not found" });
        return;
      }
      const row = rows[0] as Record<string, unknown>;
      const clerkUserId = getAuth(req)?.userId ?? null;
      void insertAuditLog({
        accountId,
        actorEmail: await getActorEmail(accountId, clerkUserId),
        actorUserId: clerkUserId,
        action: "branding.upload_form_logo",
        resourceType: "org",
      });
      res.json({
        org: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          form_logo_url: buildFormLogoServingUrl(accountId),
          brand_color: row.brand_color ?? "#C49A38",
          logo_on_white: row.logo_on_white !== false,
          timezone:    (row.timezone    as string) || "America/New_York",
          date_format: (row.date_format as string) || "MM/DD/YYYY",
        },
      });
    } catch (err) {
      logger.error({ err }, "[Settings] Unexpected error during form logo upload");
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

    void insertAuditLog({
      accountId,
      actorEmail: inviterEmail,
      actorUserId: getAuth(req)?.userId ?? null,
      action: "team.invite",
      resourceType: "team_member",
      resourceId: String(member.id),
      resourceLabel: email,
      metadata: { role },
    });

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
    const { rows: targets } = await db.query<{ role: string; email: string }>(
      `SELECT role, email FROM account_users WHERE id = $1 AND account_id = $2`,
      [memberId, accountId],
    );
    if (!targets[0]) return void res.status(404).json({ error: "Team member not found." });

    // Guard: cannot demote if they are the last admin (count all admin-role users, active or pending)
    if (targets[0].role === "admin" && newRole !== "admin") {
      const { rows: adminCount } = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM account_users
          WHERE account_id = $1 AND role = 'admin'`,
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

    const clerkUserId = getAuth(req)?.userId ?? null;
    void insertAuditLog({
      accountId,
      actorEmail: await getActorEmail(accountId, clerkUserId),
      actorUserId: clerkUserId,
      action: "team.role_change",
      resourceType: "team_member",
      resourceId: String(memberId),
      resourceLabel: targets[0].email,
      metadata: { from_role: targets[0].role, to_role: newRole },
    });

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
    const { rows: targets } = await db.query<{ role: string; status: string; email: string }>(
      `SELECT role, status, email FROM account_users WHERE id = $1 AND account_id = $2`,
      [memberId, accountId],
    );
    if (!targets[0]) return void res.status(404).json({ error: "Team member not found." });

    // Guard: cannot remove the last admin (count all admin-role users, active or pending)
    if (targets[0].role === "admin") {
      const { rows: adminCount } = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM account_users
          WHERE account_id = $1 AND role = 'admin'`,
        [accountId],
      );
      if (parseInt(adminCount[0].count, 10) <= 1) {
        return void res.status(409).json({ error: "Cannot remove the only admin. Promote another member to admin first." });
      }
    }

    await db.query(`DELETE FROM account_users WHERE id = $1 AND account_id = $2`, [memberId, accountId]);

    const clerkUserId = getAuth(req)?.userId ?? null;
    const removeActorEmail = await getActorEmail(accountId, clerkUserId);
    const removedEmail = targets[0].email;
    void insertAuditLog({
      accountId,
      actorEmail: removeActorEmail,
      actorUserId: clerkUserId,
      action: "team.remove",
      resourceType: "team_member",
      resourceId: String(memberId),
      resourceLabel: removedEmail,
      metadata: { role: targets[0].role },
    });

    // Notify remaining org members who want team_member_removed notifications
    void (async () => {
      try {
        const { rows: orgRows } = await db.query<{ name: string }>(
          `SELECT name FROM accounts WHERE id = $1`, [accountId],
        );
        const orgName = orgRows[0]?.name ?? "Docuplete";
        const notifTitle = "Team member removed";
        const notifBody  = `${removedEmail} was removed from your organization${removeActorEmail ? ` by ${removeActorEmail}` : ""}.`;
        const [emails] = await Promise.all([
          getUserEmailsToNotify(accountId, "team_member_removed").then(list =>
            list.filter(e => e !== removedEmail && e !== removeActorEmail),
          ),
          sendInAppNotifications(
            accountId,
            "team_member_removed",
            notifTitle,
            notifBody,
            clerkUserId ? [clerkUserId] : [],
          ),
        ]);
        await sendOrgAlertEmails({
          recipientEmails: emails,
          orgName,
          subject:  `${orgName}: team member removed`,
          heading:  "A team member was removed",
          bodyHtml: `<p><strong>${removedEmail}</strong> has been removed from your organization${removeActorEmail ? ` by <strong>${removeActorEmail}</strong>` : ""}.</p>`,
        });
      } catch (err) {
        logger.error({ err, accountId }, "[Team] Failed to send team_member_removed notification emails");
      }
    })();

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
    const effectiveSubLimit = getEffectiveSubmissionLimit(acct.plan_tier, acct.seat_limit);

    // Try to pull next renewal date and trial end from the stripe.subscriptions table if synced
    let nextRenewalAt: string | null = null;
    let trialEnd: string | null = null;
    if (acct.stripe_subscription_id) {
      try {
        const { rows: subRows } = await db.query<{ current_period_end: Date | null; trial_end: Date | null }>(
          `SELECT current_period_end, trial_end FROM stripe.subscriptions WHERE id = $1`,
          [acct.stripe_subscription_id],
        );
        if (subRows[0]?.current_period_end) {
          nextRenewalAt = new Date(subRows[0].current_period_end).toISOString();
        }
        if (subRows[0]?.trial_end) {
          trialEnd = new Date(subRows[0].trial_end).toISOString();
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
        trial_end:               trialEnd,
        has_stripe_customer:     !!acct.stripe_customer_id,
        has_stripe_subscription: !!acct.stripe_subscription_id,
        limits: {
          max_packages:              limits.maxPackages,
          max_submissions_per_month: effectiveSubLimit,
          max_seats:                 acct.seat_limit,
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

    const planTier = typeof body.plan === "string" ? body.plan.toLowerCase() : "";
    if (planTier !== "starter" && planTier !== "pro" && planTier !== "enterprise") {
      res.status(400).json({ error: "Invalid plan. Must be 'starter', 'pro', or 'enterprise'." });
      return;
    }

    const interval: "monthly" | "annual" = body.interval === "annual" ? "annual" : "monthly";
    const extraSeats          = Math.max(0, Math.min(50, Number(body.extraSeats          ?? 0)));
    const extraSubmissionPacks = Math.max(0, Math.min(50, Number(body.extraSubmissionPacks ?? 0)));

    const db     = getDb();
    const stripe = await getUncachableStripeClient();

    // Resolve account + check for existing subscription (determines trial eligibility)
    const { rows: acctRows } = await db.query<{
      name: string;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      subscription_status: string | null;
    }>(
      `SELECT name, stripe_customer_id, stripe_subscription_id, subscription_status FROM accounts WHERE id = $1`,
      [accountId],
    );
    const acct = acctRows[0];
    if (!acct) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    // Find or create Stripe customer — self-heal stale IDs (e.g. created with
    // a revoked key or in test mode) by catching resource_missing and retrying.
    let customerId = acct.stripe_customer_id;
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch (stripeErr: unknown) {
        if ((stripeErr as { code?: string }).code === "resource_missing") {
          await db.query(`UPDATE accounts SET stripe_customer_id = NULL WHERE id = $1`, [accountId]);
          customerId = null;
        } else {
          throw stripeErr;
        }
      }
    }
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

    // ── Resolve plan price ID ──────────────────────────────────────────────────
    // Priority: env var shortcut → live Stripe API lookup → synced DB fallback
    const stripeInterval = interval === "annual" ? "year" : "month";
    const envKey = `STRIPE_${planTier.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`;
    let priceId: string | null = process.env[envKey] ?? null;

    // Legacy env var fallback (old naming convention)
    if (!priceId && interval === "monthly") {
      if (planTier === "pro")        priceId = process.env.STRIPE_PRO_PRICE_ID        ?? null;
      if (planTier === "enterprise") priceId = process.env.STRIPE_ENTERPRISE_PRICE_ID ?? null;
    }

    if (!priceId) {
      try {
        const products = await stripe.products.list({ active: true, limit: 100 });
        const product = products.data.find(
          (p) => p.metadata?.plan_tier?.toLowerCase() === planTier,
        );
        if (product) {
          const prices = await stripe.prices.list({ product: product.id, active: true, type: "recurring", limit: 20 });
          const match = prices.data.find((p) => p.recurring?.interval === stripeInterval);
          priceId = match?.id ?? prices.data[0]?.id ?? null;
        }
      } catch {
        // Stripe API unavailable
      }
    }

    if (!priceId) {
      try {
        const { rows: priceRows } = await db.query<{ id: string }>(
          `SELECT pr.id
             FROM stripe.prices pr
             JOIN stripe.products p ON p.id = pr.product
            WHERE pr.active = true
              AND p.active = true
              AND lower(p.metadata->>'plan_tier') = $1
              AND pr.recurring->>'interval' = $2
            ORDER BY pr.unit_amount ASC
            LIMIT 1`,
          [planTier, stripeInterval],
        );
        priceId = priceRows[0]?.id ?? null;
      } catch {
        // stripe schema not yet synced
      }
    }

    if (!priceId) {
      res.status(503).json({
        error: "Plan prices have not been configured yet. Please contact support.",
        setup_required: true,
      });
      return;
    }

    // ── Build line items ───────────────────────────────────────────────────────
    const lineItems: { price: string; quantity: number }[] = [
      { price: priceId, quantity: 1 },
    ];

    if (extraSeats > 0) {
      const seatPriceId =
        process.env[`STRIPE_EXTRA_SEAT_${interval.toUpperCase()}_PRICE_ID`] ??
        process.env.STRIPE_EXTRA_SEAT_MONTHLY_PRICE_ID ??
        null;
      if (seatPriceId) lineItems.push({ price: seatPriceId, quantity: extraSeats });
    }

    if (extraSubmissionPacks > 0) {
      const packPriceId =
        process.env[`STRIPE_EXTRA_SUBMISSION_${interval.toUpperCase()}_PRICE_ID`] ??
        process.env.STRIPE_EXTRA_SUBMISSION_MONTHLY_PRICE_ID ??
        null;
      if (packPriceId) lineItems.push({ price: packPriceId, quantity: extraSubmissionPacks });
    }

    // ── Subscription options (trial only for brand-new subscribers) ────────────
    const isNewSubscriber =
      !acct.stripe_subscription_id ||
      acct.subscription_status === null ||
      acct.subscription_status === "canceled" ||
      acct.subscription_status === "cancelled";

    const subscriptionData: {
      trial_period_days?: number;
      metadata: Record<string, string>;
    } = {
      metadata: { account_id: String(accountId) },
    };
    if (isNewSubscriber) {
      subscriptionData.trial_period_days = 14;
    }

    const origin = process.env.APP_ORIGIN
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://app.docuplete.com");

    const session = await stripe.checkout.sessions.create({
      customer:                  customerId,
      // Omit payment_method_types so Stripe auto-selects the right methods for
      // the account's country. Specifying ["card"] can conflict with
      // payment_method_collection on newer API versions.
      line_items:                lineItems,
      mode:                      "subscription",
      success_url:               `${origin}/app/settings?billing=success`,
      cancel_url:                `${origin}/app/settings?billing=cancel`,
      subscription_data:         subscriptionData,
      allow_promotion_codes:     true,
      // No card required during trial — card is collected before trial ends
      payment_method_collection: isNewSubscriber ? "if_required" : "always",
    });

    const clerkUserId = getAuth(req)?.userId ?? null;
    void insertAuditLog({
      accountId,
      actorEmail: await getActorEmail(accountId, clerkUserId),
      actorUserId: clerkUserId,
      action: "plan.checkout_initiated",
      resourceType: "subscription",
      resourceLabel: planTier,
      metadata: { plan: planTier, interval, extra_seats: String(extraSeats), extra_submission_packs: String(extraSubmissionPacks) },
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "[Billing] Failed to create checkout session");
    // Surface the Stripe error message so operators can diagnose configuration issues.
    const stripeMsg = err instanceof Error ? err.message : null;
    res.status(500).json({
      error: stripeMsg
        ? `Stripe error: ${stripeMsg}`
        : "Failed to create checkout session. Please contact support.",
    });
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

/** GET /billing/bank — returns the submission bank balance and pack tiers */
router.get("/billing/bank", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const bank = await getBankBalance(accountId);
    res.json({ bank, packs: SUBMISSION_PACKS });
  } catch (err) {
    logger.error({ err }, "[Billing] Failed to get bank balance");
    res.status(500).json({ error: "Failed to get bank balance" });
  }
});

/** POST /billing/pack/checkout — create a Stripe Checkout session for a submission pack */
router.post("/billing/pack/checkout", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const body = req.body as { packSize?: unknown; packType?: unknown };
    const packSize = typeof body.packSize === "number" ? body.packSize : null;
    const packType = typeof body.packType === "string" ? body.packType : null;

    if (!packSize || !packType) {
      res.status(400).json({ error: "packSize and packType are required." });
      return;
    }
    if (!["one_off", "monthly", "annual"].includes(packType)) {
      res.status(400).json({ error: "packType must be one_off, monthly, or annual." });
      return;
    }
    const pack = getPackTier(packSize);
    if (!pack) {
      res.status(400).json({ error: `Invalid packSize. Choose from: ${SUBMISSION_PACKS.map((p) => p.size).join(", ")}.` });
      return;
    }

    const db = getDb();
    const { rows } = await db.query<{ stripe_customer_id: string | null }>(
      `SELECT stripe_customer_id FROM accounts WHERE id = $1`,
      [accountId],
    );
    const customerId = rows[0]?.stripe_customer_id ?? null;

    const stripe = await getUncachableStripeClient();
    const origin = process.env.APP_ORIGIN
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://app.docuplete.com");

    const meta: Record<string, string> = {
      type:       packType === "one_off" ? "pack_purchase" : "pack_subscription",
      pack_size:  String(pack.size),
      pack_type:  packType,
      account_id: String(accountId),
    };

    let session;
    if (packType === "one_off") {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        ...(customerId ? { customer: customerId } : {}),
        line_items: [{
          quantity: 1,
          price_data: {
            currency:     "usd",
            unit_amount:  pack.monthly * 100,
            product_data: { name: `${pack.size} Submission Pack (One-time)` },
          },
        }],
        metadata:       meta,
        success_url:    `${origin}/app/settings?tab=billing&pack_success=1`,
        cancel_url:     `${origin}/app/settings?tab=billing`,
        payment_intent_data: { metadata: meta },
      });
    } else {
      const isAnnual  = packType === "annual";
      const unitPrice = isAnnual ? pack.annual * 100 : pack.monthly * 100;
      const interval  = isAnnual ? "year" : "month";
      const label     = isAnnual ? "Annual" : "Monthly";
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ...(customerId ? { customer: customerId } : {}),
        line_items: [{
          quantity: 1,
          price_data: {
            currency:     "usd",
            unit_amount:  unitPrice,
            recurring:    { interval },
            product_data: { name: `${pack.size} Submission Pack (${label})` },
          },
        }],
        metadata:          meta,
        subscription_data: { metadata: meta },
        success_url:       `${origin}/app/settings?tab=billing&pack_success=1`,
        cancel_url:        `${origin}/app/settings?tab=billing`,
      });
    }

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "[Billing] Failed to create pack checkout session");
    res.status(500).json({ error: "Failed to create checkout session" });
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
        `SELECT id, tags FROM docufill_packages
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

    const packages = packagesRes.rows as Array<{ id: number; tags: unknown }>;
    const sessions = sessionsRes.rows as Array<{ source: string }>;

    const demoPackage = packages.find((p) => {
      const tags = Array.isArray(p.tags) ? p.tags : [];
      return tags.includes("Demo");
    });
    const hasDemoPackage = Boolean(demoPackage);

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
        demo_package_id: demoPackage?.id ?? null,
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
      db.query<{
        slack_webhook_url: string | null;
        slack_channel_name: string | null;
        slack_connected_at: Date | null;
        gdrive_connected_email: string | null;
        gdrive_folder_name: string | null;
        gdrive_connected_at: Date | null;
        gdrive_refresh_token: string | null;
        hubspot_refresh_token: string | null;
        hubspot_hub_domain: string | null;
        hubspot_connected_at: Date | null;
      }>(
        `SELECT slack_webhook_url, slack_channel_name, slack_connected_at,
                gdrive_connected_email, gdrive_folder_name, gdrive_connected_at,
                gdrive_refresh_token,
                hubspot_refresh_token, hubspot_hub_domain, hubspot_connected_at
           FROM accounts WHERE id = $1`,
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
        gdrive: {
          connected: !!acct?.gdrive_refresh_token,
          email: acct?.gdrive_connected_email ?? null,
          folder_name: acct?.gdrive_folder_name ?? null,
          connected_at: acct?.gdrive_connected_at?.toISOString() ?? null,
          available: !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
        },
        hubspot: {
          connected: !!acct?.hubspot_refresh_token,
          hub_domain: acct?.hubspot_hub_domain ?? null,
          connected_at: acct?.hubspot_connected_at?.toISOString() ?? null,
          available: isHubSpotConfigured(),
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

// ── Google Drive — per-account OAuth ─────────────────────────────────────────

/**
 * POST /integrations/gdrive/connect — generates Google OAuth URL.
 * The frontend redirects the user to the returned URL. Google redirects back
 * to the redirectUri (the frontend settings page with ?gdrive=1) with
 * ?code=...&state=..., which the client exchanges via /exchange.
 */
router.post("/integrations/gdrive/connect", requireAdminRole, requirePlanFeature("googleDrive"), async (req, res) => {
  if (!isGDriveConfigured()) {
    res.status(503).json({ error: "Google Drive integration is not configured on this server." });
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
    await db.query(`UPDATE accounts SET gdrive_oauth_state = $1 WHERE id = $2`, [state, accountId]);
    const url = generateGDriveAuthUrl(state, body.redirectUri);
    if (!url) {
      res.status(503).json({ error: "Failed to generate Google OAuth URL." });
      return;
    }
    res.json({ url });
  } catch (err) {
    logger.error({ err }, "[Integrations] Failed to generate Google Drive OAuth URL");
    res.status(500).json({ error: "Failed to initiate Google Drive connection" });
  }
});

/**
 * POST /integrations/gdrive/exchange — exchanges the OAuth code for tokens.
 * Called by the frontend after Google redirects back with ?code=...&state=...
 */
router.post("/integrations/gdrive/exchange", requireAdminRole, requirePlanFeature("googleDrive"), async (req, res) => {
  if (!isGDriveConfigured()) {
    res.status(503).json({ error: "Google Drive integration is not configured." });
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
    const { rows } = await db.query<{ gdrive_oauth_state: string | null }>(
      `SELECT gdrive_oauth_state FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!rows[0] || rows[0].gdrive_oauth_state !== body.state) {
      res.status(400).json({ error: "Invalid or expired OAuth state. Please try connecting again." });
      return;
    }
    const result = await exchangeGDriveCode(body.code, body.redirectUri ?? "");
    await db.query(
      `UPDATE accounts
          SET gdrive_access_token = $1, gdrive_refresh_token = $2,
              gdrive_connected_email = $3, gdrive_folder_id = $4, gdrive_folder_name = $5,
              gdrive_connected_at = NOW(), gdrive_oauth_state = NULL
        WHERE id = $6`,
      [result.accessToken, result.refreshToken, result.email, result.folderId, result.folderName, accountId],
    );
    res.json({ success: true, email: result.email, folder_name: result.folderName });
  } catch (err) {
    logger.error({ err }, "[Integrations] Google Drive exchange failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to connect Google Drive" });
  }
});

/**
 * PATCH /integrations/gdrive/folder — updates the destination folder.
 * Accepts a folder URL or raw folder ID in the body.
 */
router.patch("/integrations/gdrive/folder", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const body = req.body as { folderInput?: string };
    const folderId = parseFolderIdFromInput(body.folderInput ?? "");
    if (!folderId) {
      res.status(400).json({ error: "Provide a valid Google Drive folder URL or ID." });
      return;
    }
    const db = getDb();
    const { rows } = await db.query<{ gdrive_access_token: string | null; gdrive_refresh_token: string | null }>(
      `SELECT gdrive_access_token, gdrive_refresh_token FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!rows[0]?.gdrive_access_token || !rows[0]?.gdrive_refresh_token) {
      res.status(400).json({ error: "Connect Google Drive first." });
      return;
    }
    let folderName: string;
    try {
      folderName = await verifyFolderAccess(
        { accessToken: rows[0].gdrive_access_token, refreshToken: rows[0].gdrive_refresh_token },
        folderId,
      );
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Cannot access that folder. Make sure it is shared with your Google account." });
      return;
    }
    await db.query(
      `UPDATE accounts SET gdrive_folder_id = $1, gdrive_folder_name = $2 WHERE id = $3`,
      [folderId, folderName, accountId],
    );
    res.json({ success: true, folder_name: folderName });
  } catch (err) {
    logger.error({ err }, "[Integrations] Failed to update Google Drive folder");
    res.status(500).json({ error: "Failed to update folder" });
  }
});

/** DELETE /integrations/gdrive — clears stored Google Drive credentials */
router.delete("/integrations/gdrive", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();
    await db.query(
      `UPDATE accounts
          SET gdrive_access_token = NULL, gdrive_refresh_token = NULL,
              gdrive_connected_email = NULL, gdrive_folder_id = NULL,
              gdrive_folder_name = NULL, gdrive_connected_at = NULL,
              gdrive_oauth_state = NULL
        WHERE id = $1`,
      [accountId],
    );
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Integrations] Failed to disconnect Google Drive");
    res.status(500).json({ error: "Failed to disconnect Google Drive" });
  }
});

// ── HubSpot OAuth ─────────────────────────────────────────────────────────────

/** POST /integrations/hubspot/connect — initiates HubSpot OAuth flow */
router.post("/integrations/hubspot/connect", requireAdminRole, requirePlanFeature("hubspot"), async (req, res) => {
  try {
    const body = req.body as { redirectUri?: string };
    if (!body.redirectUri || typeof body.redirectUri !== "string") {
      res.status(400).json({ error: "redirectUri is required" }); return;
    }
    if (!isHubSpotConfigured()) {
      res.status(503).json({ error: "HubSpot integration is not configured on this server." }); return;
    }
    const state = randomBytes(16).toString("hex");
    const accountId = req.internalAccountId ?? 1;
    await getDb().query(`UPDATE accounts SET hubspot_oauth_state=$1 WHERE id=$2`, [state, accountId]);
    const url = generateHubSpotAuthUrl(state, body.redirectUri);
    if (!url) { res.status(503).json({ error: "Could not generate HubSpot auth URL." }); return; }
    res.json({ url });
  } catch (err) {
    logger.error({ err }, "[HubSpot] connect error");
    res.status(500).json({ error: "Failed to initiate HubSpot connection." });
  }
});

/** POST /integrations/hubspot/exchange — exchanges OAuth code for tokens */
router.post("/integrations/hubspot/exchange", requireAdminRole, requirePlanFeature("hubspot"), async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();
    const body = req.body as { code?: string; state?: string; redirectUri?: string };
    if (!body.code || !body.state || !body.redirectUri) {
      res.status(400).json({ error: "code, state, and redirectUri are required" }); return;
    }
    const { rows } = await db.query<{ hubspot_oauth_state: string | null }>(
      `SELECT hubspot_oauth_state FROM accounts WHERE id=$1`, [accountId],
    );
    if (!rows[0]?.hubspot_oauth_state || rows[0].hubspot_oauth_state !== body.state) {
      res.status(400).json({ error: "Invalid OAuth state. Please try connecting again." }); return;
    }
    const result = await exchangeHubSpotCode(body.code, body.redirectUri);
    await db.query(
      `UPDATE accounts SET
          hubspot_access_token=$1, hubspot_refresh_token=$2,
          hubspot_hub_id=$3, hubspot_hub_domain=$4,
          hubspot_connected_at=NOW(), hubspot_oauth_state=NULL
        WHERE id=$5`,
      [result.accessToken, result.refreshToken, String(result.hubId), result.hubDomain, accountId],
    );
    res.json({ success: true, hub_domain: result.hubDomain });
  } catch (err) {
    logger.error({ err }, "[HubSpot] exchange error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to connect HubSpot." });
  }
});

/** DELETE /integrations/hubspot — clears stored HubSpot credentials */
router.delete("/integrations/hubspot", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    await getDb().query(
      `UPDATE accounts SET
          hubspot_access_token=NULL, hubspot_refresh_token=NULL,
          hubspot_hub_id=NULL, hubspot_hub_domain=NULL,
          hubspot_connected_at=NULL, hubspot_oauth_state=NULL
        WHERE id=$1`,
      [accountId],
    );
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[HubSpot] disconnect error");
    res.status(500).json({ error: "Failed to disconnect HubSpot." });
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
      stripe_subscription_id: string | null;
      churn_risk: boolean;
    }>(
      `WITH last_activity AS (
         SELECT account_id, MAX(created_at) AS last_at
           FROM docufill_interview_sessions
          GROUP BY account_id
       )
       SELECT
           a.id,
           a.name,
           a.slug,
           a.plan_tier,
           a.subscription_status,
           a.billing_period_start,
           a.seat_limit,
           a.created_at,
           a.stripe_customer_id,
           a.stripe_subscription_id,
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
           la.last_at AS last_activity_at,
           CASE
             WHEN a.subscription_status IN ('active', 'manual', 'trialing')
              AND (la.last_at IS NULL OR la.last_at < NOW() - INTERVAL '30 days')
             THEN true ELSE false
           END AS churn_risk
         FROM accounts a
         LEFT JOIN last_activity la ON la.account_id = a.id
        ORDER BY a.created_at DESC`,
    );

    // ── Batch-fetch Stripe subscription data (MRR + trial_end) ─────────────────
    const stripeDataMap = new Map<string, { mrr_cents: number | null; trial_end: string | null }>();
    const subIds = rows
      .map((r) => r.stripe_subscription_id)
      .filter((id): id is string => !!id);

    if (subIds.length > 0) {
      try {
        const stripe = await getUncachableStripeClient();
        const settled = await Promise.allSettled(
          subIds.map((id) =>
            stripe.subscriptions.retrieve(id, { expand: ["items.data.price"] }),
          ),
        );
        subIds.forEach((subId, i) => {
          const result = settled[i];
          if (result.status !== "fulfilled") return;
          const sub = result.value;
          const price = sub.items.data[0]?.price;
          // trial_end lives on the raw subscription object
          const rawSub = sub as unknown as Record<string, unknown>;
          const trialEnd =
            typeof rawSub["trial_end"] === "number"
              ? new Date((rawSub["trial_end"] as number) * 1000).toISOString()
              : null;
          // Normalise to monthly recurring revenue
          let mrr: number | null = price?.unit_amount ?? null;
          if (mrr !== null && price?.recurring?.interval === "year") {
            mrr = Math.round(mrr / 12);
          }
          stripeDataMap.set(subId, { mrr_cents: mrr, trial_end: trialEnd });
        });
      } catch {
        // Stripe unavailable — omit MRR/trial data gracefully
      }
    }

    res.json({
      accounts: rows.map((r) => {
        const stripeExtra = r.stripe_subscription_id
          ? (stripeDataMap.get(r.stripe_subscription_id) ?? { mrr_cents: null, trial_end: null })
          : { mrr_cents: null, trial_end: null };
        return {
          id:                     r.id,
          name:                   r.name,
          slug:                   r.slug,
          plan_tier:              r.plan_tier,
          subscription_status:    r.subscription_status ?? null,
          billing_period_start:   r.billing_period_start?.toISOString().slice(0, 10) ?? null,
          seat_limit:             r.seat_limit,
          seat_count:             parseInt(r.seat_count, 10),
          submission_count:       parseInt(r.submission_count, 10),
          package_count:          parseInt(r.package_count, 10),
          last_activity_at:       r.last_activity_at?.toISOString() ?? null,
          created_at:             r.created_at.toISOString(),
          stripe_customer_id:     r.stripe_customer_id ?? null,
          stripe_subscription_id: r.stripe_subscription_id ?? null,
          churn_risk:             r.churn_risk,
          mrr_cents:              stripeExtra.mrr_cents,
          trial_end:              stripeExtra.trial_end,
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, "[Admin] Failed to list accounts");
    res.status(500).json({ error: "Failed to load accounts" });
  }
});

// ── Super-admin account detail ────────────────────────────────────────────────

/**
 * GET /admin/accounts/:id — returns detailed info for a single account:
 *   - monthly submission counts for the last 6 months
 *   - team member list
 *   - current Stripe subscription details (if available)
 */
router.get("/admin/accounts/:id", async (req, res) => {
  if (!req.internalEmail) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rawId = req.params.id ?? "";
  if (!/^\d+$/.test(rawId)) {
    res.status(400).json({ error: "Invalid account ID" });
    return;
  }
  const accountId = parseInt(rawId, 10);
  try {
    const db = getDb();

    // Verify account exists
    const { rows: acctRows } = await db.query<{
      id: number;
      name: string;
      plan_tier: string;
      subscription_status: string | null;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      created_at: Date;
    }>(
      `SELECT id, name, plan_tier, subscription_status, stripe_customer_id, stripe_subscription_id, created_at
         FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!acctRows[0]) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const acct = acctRows[0];

    // Monthly submission counts for the last 6 months
    const { rows: usageRows } = await db.query<{ month: string; count: string }>(
      `SELECT TO_CHAR(gs.month, 'YYYY-MM') AS month,
              COALESCE(ue.cnt, 0)::TEXT AS count
         FROM (
           SELECT generate_series(
             DATE_TRUNC('month', NOW()) - INTERVAL '5 months',
             DATE_TRUNC('month', NOW()),
             '1 month'::INTERVAL
           ) AS month
         ) gs
         LEFT JOIN (
           SELECT period_start, COUNT(*) AS cnt
             FROM usage_events
            WHERE account_id = $1 AND event_type = 'submission'
            GROUP BY period_start
         ) ue ON ue.period_start = gs.month::DATE
        ORDER BY gs.month ASC`,
      [accountId],
    );

    // Team members
    const { rows: memberRows } = await db.query<{
      id: number;
      email: string;
      role: string;
      status: string;
      display_name: string | null;
      last_seen_at: Date | null;
      invited_at: Date | null;
    }>(
      `SELECT id, email, role, status, display_name, last_seen_at, invited_at
         FROM account_users
        WHERE account_id = $1
        ORDER BY role = 'admin' DESC, lower(email) ASC`,
      [accountId],
    );

    // Stripe subscription details + invoice history (best-effort, parallel)
    let stripeSubscription: {
      plan_name: string;
      amount: number | null;
      currency: string | null;
      interval: string | null;
      current_period_end: string | null;
      status: string | null;
    } | null = null;

    type InvoiceRow = {
      id: string; status: string | null; amount_due: number;
      amount_paid: number; currency: string; created: string;
      invoice_pdf: string | null; hosted_invoice_url: string | null;
      number: string | null;
    };
    let invoices: InvoiceRow[] = [];

    if (acct.stripe_subscription_id || acct.stripe_customer_id) {
      try {
        const stripe = await getUncachableStripeClient();
        const [subResult, invoiceResult] = await Promise.allSettled([
          acct.stripe_subscription_id
            ? stripe.subscriptions.retrieve(acct.stripe_subscription_id, {
                expand: ["items.data.price.product"],
              })
            : Promise.resolve(null),
          acct.stripe_customer_id
            ? stripe.invoices.list({ customer: acct.stripe_customer_id, limit: 12 })
            : Promise.resolve(null),
        ]);

        if (subResult.status === "fulfilled" && subResult.value) {
          const sub = subResult.value;
          const item = sub.items.data[0];
          const price = item?.price;
          const product = price?.product;
          const productName = product && typeof product === "object" && "name" in product
            ? (product as { name: string }).name
            : null;
          const rawSub = sub as unknown as Record<string, unknown>;
          const periodEnd = typeof rawSub["current_period_end"] === "number"
            ? new Date((rawSub["current_period_end"] as number) * 1000).toISOString()
            : null;
          stripeSubscription = {
            plan_name:          productName ?? acct.plan_tier,
            amount:             price?.unit_amount ?? null,
            currency:           price?.currency ?? null,
            interval:           price?.recurring?.interval ?? null,
            current_period_end: periodEnd,
            status:             sub.status,
          };
        }

        if (invoiceResult.status === "fulfilled" && invoiceResult.value) {
          invoices = invoiceResult.value.data.map((inv) => {
            const rawInv = inv as unknown as Record<string, unknown>;
            return {
              id:                  inv.id,
              status:              inv.status ?? null,
              amount_due:          inv.amount_due,
              amount_paid:         inv.amount_paid,
              currency:            inv.currency,
              created:             new Date((rawInv["created"] as number) * 1000).toISOString(),
              invoice_pdf:         (rawInv["invoice_pdf"] as string | null) ?? null,
              hosted_invoice_url:  (rawInv["hosted_invoice_url"] as string | null) ?? null,
              number:              (rawInv["number"] as string | null) ?? null,
            };
          });
        }
      } catch {
        // Stripe unavailable — omit gracefully
      }
    }

    // Adoption flags (single DB round-trip)
    const { rows: adoptionRows } = await db.query<{
      active_api_keys: string;
      webhook_count: string;
      has_custom_domain: boolean;
      has_slack: boolean;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM account_api_keys k
           WHERE k.account_id = $1 AND k.revoked_at IS NULL) AS active_api_keys,
         (SELECT COUNT(*) FROM webhook_deliveries wd
           WHERE wd.account_id = $1) AS webhook_count,
         (a.custom_domain IS NOT NULL AND a.custom_domain <> '') AS has_custom_domain,
         (a.slack_webhook_url IS NOT NULL AND a.slack_webhook_url <> '') AS has_slack
       FROM accounts a WHERE a.id = $1`,
      [accountId],
    );
    const adoption = adoptionRows[0] ?? { active_api_keys: "0", webhook_count: "0", has_custom_domain: false, has_slack: false };

    // Internal admin notes
    const { rows: noteRows } = await db.query<{
      id: number; note: string; created_by: string; created_at: Date;
    }>(
      `SELECT id, note, created_by, created_at
         FROM account_admin_notes
        WHERE account_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [accountId],
    );

    res.json({
      monthly_usage: usageRows.map((r) => ({ month: r.month, count: parseInt(r.count, 10) })),
      team_members: memberRows.map((r) => ({
        id:           r.id,
        email:        r.email,
        role:         r.role,
        status:       r.status,
        display_name: r.display_name ?? null,
        last_seen_at: r.last_seen_at?.toISOString() ?? null,
        invited_at:   r.invited_at?.toISOString() ?? null,
      })),
      stripe_subscription: stripeSubscription,
      invoices,
      adoption: {
        active_api_keys:  parseInt(adoption.active_api_keys, 10),
        webhook_count:    parseInt(adoption.webhook_count, 10),
        has_custom_domain: adoption.has_custom_domain,
        has_slack:         adoption.has_slack,
      },
      notes: noteRows.map((n) => ({
        id:         n.id,
        note:       n.note,
        created_by: n.created_by,
        created_at: n.created_at.toISOString(),
      })),
    });
  } catch (err) {
    logger.error({ err }, "[Admin] Failed to load account detail");
    res.status(500).json({ error: "Failed to load account detail" });
  }
});

// ── Super-admin plan override ──────────────────────────────────────────────────

/**
 * PATCH /admin/accounts/:id — override plan tier, seat limit, or subscription
 * status for any account. Internal portal only.
 */
router.patch("/admin/accounts/:id", async (req, res) => {
  if (!req.internalEmail) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rawId = req.params.id ?? "";
  if (!/^\d+$/.test(rawId)) {
    res.status(400).json({ error: "Invalid account ID" });
    return;
  }
  const accountId = parseInt(rawId, 10);

  const VALID_TIERS    = new Set(["free", "pro", "enterprise"]);
  const VALID_STATUSES = new Set(["active", "trialing", "canceled", "past_due", "manual", "none"]);

  const body = req.body as Record<string, unknown>;
  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.plan_tier !== undefined) {
    if (typeof body.plan_tier !== "string" || !VALID_TIERS.has(body.plan_tier)) {
      res.status(400).json({ error: "Invalid plan_tier. Must be free, pro, or enterprise." });
      return;
    }
    params.push(body.plan_tier);
    updates.push(`plan_tier = $${params.length}`);
  }

  if (body.seat_limit !== undefined) {
    const n = Number(body.seat_limit);
    if (!Number.isInteger(n) || n < 1 || n > 10000) {
      res.status(400).json({ error: "Invalid seat_limit. Must be an integer between 1 and 10000." });
      return;
    }
    params.push(n);
    updates.push(`seat_limit = $${params.length}`);
  }

  if (body.subscription_status !== undefined) {
    const s = body.subscription_status === "" ? null : body.subscription_status;
    if (s !== null && (typeof s !== "string" || !VALID_STATUSES.has(s))) {
      res.status(400).json({ error: "Invalid subscription_status." });
      return;
    }
    params.push(s);
    updates.push(`subscription_status = $${params.length}`);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No valid fields to update." });
    return;
  }

  try {
    params.push(accountId);
    const { rows } = await getDb().query<{
      id: number; name: string; plan_tier: string;
      subscription_status: string | null; seat_limit: number;
    }>(
      `UPDATE accounts SET ${updates.join(", ")} WHERE id = $${params.length}
       RETURNING id, name, plan_tier, subscription_status, seat_limit`,
      params,
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    logger.info({ accountId, updates: body, by: req.internalEmail }, "[Admin] Plan override applied");
    res.json({ account: rows[0] });
  } catch (err) {
    logger.error({ err }, "[Admin] Failed to apply plan override");
    res.status(500).json({ error: "Failed to apply override" });
  }
});

// ── Super-admin account notes ─────────────────────────────────────────────────

router.post("/admin/accounts/:id/notes", async (req, res) => {
  if (!req.internalEmail) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rawId = req.params.id ?? "";
  if (!/^\d+$/.test(rawId)) {
    res.status(400).json({ error: "Invalid account ID" });
    return;
  }
  const accountId = parseInt(rawId, 10);
  const body = req.body as Record<string, unknown>;
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note) {
    res.status(400).json({ error: "Note text is required." });
    return;
  }
  if (note.length > 4000) {
    res.status(400).json({ error: "Note must be 4000 characters or fewer." });
    return;
  }
  try {
    const { rows } = await getDb().query<{ id: number; note: string; created_by: string; created_at: Date }>(
      `INSERT INTO account_admin_notes (account_id, note, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, note, created_by, created_at`,
      [accountId, note, req.internalEmail],
    );
    res.status(201).json({ note: { ...rows[0], created_at: rows[0]!.created_at.toISOString() } });
  } catch (err) {
    logger.error({ err }, "[Admin] Failed to save note");
    res.status(500).json({ error: "Failed to save note" });
  }
});

router.delete("/admin/accounts/:id/notes/:noteId", async (req, res) => {
  if (!req.internalEmail) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rawId     = req.params.id     ?? "";
  const rawNoteId = req.params.noteId ?? "";
  if (!/^\d+$/.test(rawId) || !/^\d+$/.test(rawNoteId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  try {
    const { rowCount } = await getDb().query(
      `DELETE FROM account_admin_notes WHERE id = $1 AND account_id = $2`,
      [parseInt(rawNoteId, 10), parseInt(rawId, 10)],
    );
    if (!rowCount) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[Admin] Failed to delete note");
    res.status(500).json({ error: "Failed to delete note" });
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

// ── Per-user notification preferences ────────────────────────────────────────

const NOTIFICATION_EVENT_KEYS = [
  "submission_received",
  "team_member_joined",
  "team_member_removed",
  "billing_plan_change",
  "billing_payment_failed",
  "api_key_created",
  "api_key_revoked",
  "plan_limit_warning",
] as const;
type NotificationEventKey = (typeof NOTIFICATION_EVENT_KEYS)[number];
const NOTIFICATION_EVENT_KEYS_SET = new Set<string>(NOTIFICATION_EVENT_KEYS);

router.get("/notifications", async (req, res) => {
  const clerkUserId = getAuth(req)?.userId ?? null;
  if (!clerkUserId) {
    return void res.status(401).json({ error: "User authentication required for notification preferences." });
  }
  const accountId = req.internalAccountId ?? 1;
  try {
    const { rows } = await getDb().query<{ event_key: NotificationEventKey; email_enabled: boolean; in_app_enabled: boolean }>(
      `SELECT event_key, email_enabled, in_app_enabled
         FROM user_notification_prefs
        WHERE account_id = $1 AND clerk_user_id = $2`,
      [accountId, clerkUserId],
    );
    const saved = new Map(rows.map(r => [r.event_key, r]));
    const prefs = NOTIFICATION_EVENT_KEYS.map(key => ({
      event_key: key,
      email_enabled: saved.get(key)?.email_enabled ?? true,
      in_app_enabled: saved.get(key)?.in_app_enabled ?? true,
    }));
    return void res.json({ prefs });
  } catch (err) {
    logger.error({ err }, "[Notifications] Failed to get preferences");
    res.status(500).json({ error: "Failed to load notification preferences." });
  }
});

router.put("/notifications", async (req, res) => {
  const clerkUserId = getAuth(req)?.userId ?? null;
  if (!clerkUserId) {
    return void res.status(401).json({ error: "User authentication required for notification preferences." });
  }
  const accountId = req.internalAccountId ?? 1;
  const body = req.body as Record<string, unknown>;
  const rawPrefs = body.prefs;
  if (!Array.isArray(rawPrefs)) {
    return void res.status(400).json({ error: "prefs must be an array." });
  }
  try {
    const db = getDb();
    for (const raw of rawPrefs) {
      const pref = raw as Record<string, unknown>;
      const key = typeof pref.event_key === "string" ? pref.event_key : "";
      if (!NOTIFICATION_EVENT_KEYS_SET.has(key)) continue;
      const emailEnabled = pref.email_enabled !== false;
      const inAppEnabled = pref.in_app_enabled !== false;
      await db.query(
        `INSERT INTO user_notification_prefs
           (account_id, clerk_user_id, event_key, email_enabled, in_app_enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (account_id, clerk_user_id, event_key)
         DO UPDATE SET email_enabled = $4, in_app_enabled = $5, updated_at = NOW()`,
        [accountId, clerkUserId, key, emailEnabled, inAppEnabled],
      );
    }
    return void res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Notifications] Failed to save preferences");
    res.status(500).json({ error: "Failed to save notification preferences." });
  }
});

// ── In-app notification inbox ─────────────────────────────────────────────────

router.get("/notifications/inbox", async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId;
    if (!clerkUserId) return void res.status(401).json({ error: "Unauthorized" });

    const db = getDb();
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 100);
    const unreadOnly = req.query.unread === "true";

    const whereExtra = unreadOnly ? "AND read_at IS NULL" : "";
    const { rows } = await db.query<{
      id: number;
      event_key: string;
      title: string;
      body: string;
      read_at: string | null;
      created_at: string;
    }>(
      `SELECT id, event_key, title, body, read_at, created_at
         FROM user_in_app_notifications
        WHERE account_id = $1 AND clerk_user_id = $2 ${whereExtra}
        ORDER BY created_at DESC
        LIMIT ${limit}`,
      [accountId, clerkUserId],
    );
    return void res.json({ notifications: rows });
  } catch (err) {
    logger.error({ err }, "[Notifications] Failed to fetch inbox");
    res.status(500).json({ error: "Failed to fetch notifications." });
  }
});

router.patch("/notifications/inbox/:id/read", async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId;
    if (!clerkUserId) return void res.status(401).json({ error: "Unauthorized" });

    const db = getDb();
    const notifId = parseInt(req.params["id"]!, 10);
    if (isNaN(notifId)) return void res.status(400).json({ error: "Invalid notification ID." });

    const { rowCount } = await db.query(
      `UPDATE user_in_app_notifications
          SET read_at = NOW()
        WHERE id = $1 AND account_id = $2 AND clerk_user_id = $3 AND read_at IS NULL`,
      [notifId, accountId, clerkUserId],
    );
    if (!rowCount) return void res.status(404).json({ error: "Notification not found or already read." });
    return void res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Notifications] Failed to mark as read");
    res.status(500).json({ error: "Failed to mark notification as read." });
  }
});

// ── Org audit log (admin read-only) ──────────────────────────────────────────

router.get("/audit-log", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const limit = Math.min(parseInt(String(req.query.limit ?? "25"), 10) || 25, 100);
    const page  = Math.max(parseInt(String(req.query.page  ?? "1"),  10) || 1,  1);
    const offset = (page - 1) * limit;
    const actionFilter = typeof req.query.action === "string" && req.query.action ? req.query.action : null;
    const search = typeof req.query.search === "string" && req.query.search ? req.query.search.toLowerCase() : null;

    const whereParts: string[] = ["account_id = $1"];
    const params: unknown[] = [accountId];
    let pIdx = 2;

    if (actionFilter) {
      whereParts.push(`action = $${pIdx++}`);
      params.push(actionFilter);
    }
    if (search) {
      whereParts.push(`(LOWER(COALESCE(actor_email,'')) LIKE $${pIdx} OR LOWER(COALESCE(resource_label,'')) LIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }

    const whereClause = whereParts.join(" AND ");
    const [{ rows: rawEntries }, { rows: countRows }] = await Promise.all([
      getDb().query(
        `SELECT id, actor_email, actor_user_id, action, resource_type, resource_id, resource_label, metadata, ip_address, created_at
           FROM org_audit_log
          WHERE ${whereClause}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      getDb().query(`SELECT COUNT(*)::int AS total FROM org_audit_log WHERE ${whereClause}`, params),
    ]);

    const entries = (rawEntries as Array<Record<string, unknown>>).map(e => ({
      ...e,
      location: lookupIpLocation(e.ip_address as string | null),
    }));

    return void res.json({
      entries,
      total: (countRows[0] as { total: number })?.total ?? 0,
      page,
      limit,
    });
  } catch (err) {
    logger.error({ err }, "[AuditLog] Failed to fetch org audit log");
    res.status(500).json({ error: "Failed to fetch audit log." });
  }
});

// ── Email customization settings (Task #284) ──────────────────────────────────

// Extract the bare email address from a "Display Name <email@domain>" string.
function extractSenderEmail(fromEnv: string): string {
  const m = fromEnv.match(/<([^>]+)>/);
  return m ? m[1] : fromEnv;
}

router.get("/email", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();
    const { rows } = await db.query(
      `SELECT email_sender_name, email_reply_to, email_footer FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const row = rows[0] as Record<string, unknown>;
    res.json({
      email: {
        senderName:  (row.email_sender_name as string | null) ?? null,
        replyTo:     (row.email_reply_to    as string | null) ?? null,
        footer:      (row.email_footer      as string | null) ?? null,
        senderEmail: extractSenderEmail(process.env.FROM_EMAIL ?? "noreply@westhillscapital.com"),
      },
    });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to get email settings");
    res.status(500).json({ error: "Failed to get email settings" });
  }
});

router.patch("/email", requireAdminRole, requirePlanFeature("emailBranding"), async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const body = req.body as Record<string, unknown>;
    const db = getDb();

    const { rows: existing } = await db.query(
      `SELECT email_sender_name, email_reply_to, email_footer FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!existing[0]) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const current = existing[0] as Record<string, unknown>;

    // senderName: strip header-injection chars (\r \n < >) then trim/cap length
    const rawSenderName = "senderName" in body
      ? (typeof body.senderName === "string"
          ? body.senderName.replace(/[\r\n<>]/g, "").trim().slice(0, 100) || null
          : null)
      : (current.email_sender_name as string | null);

    // Reject names that contain characters not safe for email display names
    if (rawSenderName !== null && /[^\x20-\x7E]/.test(rawSenderName)) {
      res.status(400).json({ error: "senderName contains unsupported characters" });
      return;
    }
    const senderName = rawSenderName;

    const replyTo = "replyTo" in body
      ? (typeof body.replyTo === "string" && body.replyTo.trim()
          ? body.replyTo.replace(/[\r\n]/g, "").trim().toLowerCase().slice(0, 254)
          : null)
      : (current.email_reply_to as string | null);

    const footer = "footer" in body
      ? (typeof body.footer === "string" ? body.footer.trim().slice(0, 500) || null : null)
      : (current.email_footer as string | null);

    // Basic email format validation for replyTo
    if (replyTo !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
      res.status(400).json({ error: "replyTo must be a valid email address" });
      return;
    }

    await db.query(
      `UPDATE accounts SET email_sender_name=$1, email_reply_to=$2, email_footer=$3 WHERE id=$4`,
      [senderName, replyTo, footer, accountId],
    );

    const clerkUserId = getAuth(req)?.userId ?? null;
    const actorEmail = await getActorEmail(accountId, clerkUserId);
    void insertAuditLog({
      accountId,
      actorEmail,
      actorUserId: clerkUserId,
      action: "email_settings.update",
      resourceType: "org",
      metadata: { senderName, replyTo, footerLength: footer?.length ?? 0 },
    });

    res.json({
      email: { senderName, replyTo, footer },
    });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to update email settings");
    res.status(500).json({ error: "Failed to update email settings" });
  }
});

// ── Interview defaults settings (Task #285) ───────────────────────────────────

const ALLOWED_LOCALES = ["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar"] as const;
type AllowedLocale = (typeof ALLOWED_LOCALES)[number];

function isAllowedLocale(v: unknown): v is AllowedLocale {
  return typeof v === "string" && (ALLOWED_LOCALES as readonly string[]).includes(v);
}

router.get("/interview-defaults", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();
    const { rows } = await db.query(
      `SELECT interview_link_expiry_days, interview_reminder_enabled,
              interview_reminder_days, interview_default_locale
         FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const row = rows[0] as Record<string, unknown>;
    res.json({
      interviewDefaults: {
        linkExpiryDays:    (row.interview_link_expiry_days   as number | null) ?? null,
        reminderEnabled:   (row.interview_reminder_enabled   as boolean) ?? false,
        reminderDays:      (row.interview_reminder_days      as number) ?? 2,
        defaultLocale:     (row.interview_default_locale     as string) ?? "en",
      },
    });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to get interview defaults");
    res.status(500).json({ error: "Failed to get interview defaults" });
  }
});

router.patch("/interview-defaults", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const body = req.body as Record<string, unknown>;
    const db = getDb();

    const { rows: existing } = await db.query(
      `SELECT interview_link_expiry_days, interview_reminder_enabled,
              interview_reminder_days, interview_default_locale
         FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!existing[0]) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const cur = existing[0] as Record<string, unknown>;

    // linkExpiryDays: null (never) or a positive integer
    let linkExpiryDays: number | null = cur.interview_link_expiry_days as number | null;
    if ("linkExpiryDays" in body) {
      if (body.linkExpiryDays === null) {
        linkExpiryDays = null;
      } else {
        const days = Number(body.linkExpiryDays);
        if (!Number.isInteger(days) || days < 1 || days > 3650) {
          res.status(400).json({ error: "linkExpiryDays must be null or an integer between 1 and 3650" });
          return;
        }
        linkExpiryDays = days;
      }
    }

    // reminderEnabled: strict boolean (reject strings, numbers, etc.)
    let reminderEnabled: boolean = Boolean(cur.interview_reminder_enabled);
    if ("reminderEnabled" in body) {
      if (typeof body.reminderEnabled !== "boolean") {
        res.status(400).json({ error: "reminderEnabled must be a boolean" });
        return;
      }
      reminderEnabled = body.reminderEnabled;
    }

    // reminderDays: positive integer 1–90
    let reminderDays: number = Number(cur.interview_reminder_days ?? 2);
    if ("reminderDays" in body) {
      const days = Number(body.reminderDays);
      if (!Number.isInteger(days) || days < 1 || days > 90) {
        res.status(400).json({ error: "reminderDays must be an integer between 1 and 90" });
        return;
      }
      reminderDays = days;
    }

    // defaultLocale: one of the allowed locales
    let defaultLocale: string = (cur.interview_default_locale as string) ?? "en";
    if ("defaultLocale" in body) {
      if (!isAllowedLocale(body.defaultLocale)) {
        res.status(400).json({ error: `defaultLocale must be one of: ${ALLOWED_LOCALES.join(", ")}` });
        return;
      }
      defaultLocale = body.defaultLocale;
    }

    await db.query(
      `UPDATE accounts
          SET interview_link_expiry_days=$1,
              interview_reminder_enabled=$2,
              interview_reminder_days=$3,
              interview_default_locale=$4
        WHERE id=$5`,
      [linkExpiryDays, reminderEnabled, reminderDays, defaultLocale, accountId],
    );

    const clerkUserId = getAuth(req)?.userId ?? null;
    const actorEmail = await getActorEmail(accountId, clerkUserId);
    void insertAuditLog({
      accountId,
      actorEmail,
      actorUserId: clerkUserId,
      action: "interview_defaults.update",
      resourceType: "org",
      metadata: { linkExpiryDays, reminderEnabled, reminderDays, defaultLocale },
    });

    res.json({
      interviewDefaults: { linkExpiryDays, reminderEnabled, reminderDays, defaultLocale },
    });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to update interview defaults");
    res.status(500).json({ error: "Failed to update interview defaults" });
  }
});

// ── Timezone & Locale settings ────────────────────────────────────────────────

const VALID_DATE_FORMATS = new Set(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]);

router.get("/locale", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();
    const { rows } = await db.query(
      `SELECT timezone, date_format FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!rows[0]) { res.status(404).json({ error: "Account not found" }); return; }
    const row = rows[0] as Record<string, unknown>;
    res.json({
      timezone:   (row.timezone   as string) || "America/New_York",
      dateFormat: (row.date_format as string) || "MM/DD/YYYY",
    });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to get locale settings");
    res.status(500).json({ error: "Failed to get locale settings" });
  }
});

router.patch("/locale", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const body      = req.body as Record<string, unknown>;
    const db        = getDb();

    const { rows: cur } = await db.query(
      `SELECT timezone, date_format FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!cur[0]) { res.status(404).json({ error: "Account not found" }); return; }
    const current = cur[0] as Record<string, unknown>;

    // Validate timezone using Intl (throws for unknown identifiers)
    let timezone = (current.timezone as string) || "America/New_York";
    if ("timezone" in body) {
      const tz = typeof body.timezone === "string" ? body.timezone.trim() : "";
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        timezone = tz;
      } catch {
        res.status(400).json({ error: "Invalid IANA timezone identifier." });
        return;
      }
    }

    let dateFormat = (current.date_format as string) || "MM/DD/YYYY";
    if ("dateFormat" in body) {
      const fmt = typeof body.dateFormat === "string" ? body.dateFormat : "";
      if (!VALID_DATE_FORMATS.has(fmt)) {
        res.status(400).json({ error: "dateFormat must be one of: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD." });
        return;
      }
      dateFormat = fmt;
    }

    await db.query(
      `UPDATE accounts SET timezone = $1, date_format = $2 WHERE id = $3`,
      [timezone, dateFormat, accountId],
    );

    const clerkUserId = getAuth(req)?.userId ?? null;
    const actorEmail  = await getActorEmail(accountId, clerkUserId);
    void insertAuditLog({
      accountId, actorEmail, actorUserId: clerkUserId,
      action: "settings.update_locale",
      resourceType: "org",
      metadata: { timezone, dateFormat },
    });

    res.json({ timezone, dateFormat });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to update locale settings");
    res.status(500).json({ error: "Failed to update locale settings" });
  }
});

// ── Data & Privacy settings ───────────────────────────────────────────────────

router.get("/data-privacy", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();
    const { rows } = await db.query(
      `SELECT submission_retention_days, deletion_requested_at, deletion_requested_by
         FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!rows[0]) { res.status(404).json({ error: "Account not found" }); return; }
    const row = rows[0] as Record<string, unknown>;
    res.json({
      submissionRetentionDays: row.submission_retention_days ?? null,
      deletionRequestedAt:     row.deletion_requested_at ?? null,
      deletionRequestedBy:     row.deletion_requested_by ?? null,
    });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to get data privacy settings");
    res.status(500).json({ error: "Failed to get data privacy settings" });
  }
});

router.patch("/data-privacy", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const body = req.body as Record<string, unknown>;
    const db = getDb();

    if (!("submissionRetentionDays" in body)) {
      // No recognised fields to update — return current value unchanged
      const { rows: cur } = await db.query(
        `SELECT submission_retention_days FROM accounts WHERE id = $1`,
        [accountId],
      );
      if (!cur[0]) { res.status(404).json({ error: "Account not found" }); return; }
      res.json({ submissionRetentionDays: (cur[0] as Record<string, unknown>).submission_retention_days ?? null });
      return;
    }

    let retentionDays: number | null = null;
    if (body.submissionRetentionDays === null) {
      retentionDays = null;
    } else if (typeof body.submissionRetentionDays === "number" && body.submissionRetentionDays > 0) {
      retentionDays = Math.floor(body.submissionRetentionDays);
    } else {
      res.status(400).json({ error: "submissionRetentionDays must be a positive integer or null." });
      return;
    }

    const { rows } = await db.query(
      `UPDATE accounts SET submission_retention_days = $1
         WHERE id = $2 RETURNING submission_retention_days`,
      [retentionDays, accountId],
    );
    if (!rows[0]) { res.status(404).json({ error: "Account not found" }); return; }

    const clerkUserId = getAuth(req)?.userId ?? null;
    const actorEmail  = await getActorEmail(accountId, clerkUserId);
    void insertAuditLog({
      accountId, actorEmail, actorUserId: clerkUserId,
      action: "data.update_retention",
      resourceType: "org",
      metadata: { submissionRetentionDays: retentionDays },
    });

    const row = rows[0] as Record<string, unknown>;
    res.json({ submissionRetentionDays: row.submission_retention_days ?? null });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to update data privacy settings");
    res.status(500).json({ error: "Failed to update data privacy settings" });
  }
});

// ── Data export — durable job queue ──────────────────────────────────────────

router.post("/data/request-export", requireAdminRole, async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;
    const actorEmail  = await getActorEmail(accountId, clerkUserId);

    if (!actorEmail) {
      res.status(400).json({ error: "Could not determine your email address for export delivery." });
      return;
    }

    if (!process.env.FRONTEND_URL) {
      logger.warn("[Settings] FRONTEND_URL is not set — export download link will be broken; request rejected");
      res.status(503).json({ error: "Data export is not available in this environment (server misconfiguration). Please contact support." });
      return;
    }

    const db    = getDb();
    const token = randomUUID();
    await db.query(
      `INSERT INTO data_export_requests (account_id, requested_by, download_token, status)
       VALUES ($1, $2, $3, 'pending')`,
      [accountId, actorEmail, token],
    );

    void insertAuditLog({
      accountId, actorEmail, actorUserId: clerkUserId,
      action: "data.export_requested",
      resourceType: "org",
    });

    res.json({ success: true, message: "Export queued. You'll receive an email with a download link shortly." });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to queue data export");
    res.status(500).json({ error: "Failed to queue data export" });
  }
});

router.get("/data/download-export", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const token     = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      res.status(400).json({ error: "Missing export token." });
      return;
    }
    const db = getDb();
    const { rows } = await db.query(
      `SELECT id, account_id, export_json, export_format, expires_at, status FROM data_export_requests
        WHERE download_token = $1`,
      [token],
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: "Export not found or has expired." });
      return;
    }
    if ((row.account_id as number) !== accountId) {
      res.status(403).json({ error: "This export does not belong to your organization." });
      return;
    }
    if (row.status !== "completed" || !row.export_json) {
      res.status(202).json({ error: "Export is still being prepared. Please try again in a moment." });
      return;
    }
    if (row.expires_at && new Date(row.expires_at as string) < new Date()) {
      res.status(410).json({ error: "This export link has expired. Please request a new export." });
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    if (row.export_format === "zip") {
      const zipBuffer = Buffer.from(row.export_json as string, "base64");
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="docuplete_export_${date}.zip"`);
      res.send(zipBuffer);
    } else {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="docuplete_export_${date}.json"`);
      res.send(row.export_json as string);
    }
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to serve data export download");
    res.status(500).json({ error: "Failed to download export" });
  }
});

// ── Account deletion ──────────────────────────────────────────────────────────

router.post("/data/request-deletion", requireAdminRole, async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const body        = req.body as Record<string, unknown>;
    const db          = getDb();

    const { rows: orgRows } = await db.query<{ name: string; stripe_subscription_id: string | null }>(
      `SELECT name, stripe_subscription_id FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!orgRows[0]) { res.status(404).json({ error: "Account not found" }); return; }
    const orgName            = orgRows[0].name;
    const stripeSubId        = orgRows[0].stripe_subscription_id;

    const confirmName = typeof body.confirmName === "string" ? body.confirmName.trim() : "";
    if (confirmName !== orgName.trim()) {
      res.status(400).json({ error: `Organization name does not match. Please type "${orgName}" exactly.` });
      return;
    }

    const clerkUserId = getAuth(req)?.userId ?? null;
    const actorEmail  = await getActorEmail(accountId, clerkUserId);

    const { rows } = await db.query(
      `UPDATE accounts
          SET deletion_requested_at = NOW(), deletion_requested_by = $1
        WHERE id = $2
        RETURNING deletion_requested_at, deletion_requested_by`,
      [actorEmail, accountId],
    );
    const row = rows[0] as Record<string, unknown>;

    // Cancel any active Stripe subscription immediately so the account is not
    // charged again. cancel_at_period_end = true means access continues until
    // the current period ends (within the 7-day grace window) but no renewal fires.
    if (stripeSubId) {
      try {
        const stripe = await getUncachableStripeClient();
        await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true });
        logger.info({ accountId, stripeSubId }, "[Settings] Stripe subscription set to cancel at period end on account deletion request");
      } catch (stripeErr) {
        // Non-fatal — log and continue. Data deletion still proceeds.
        logger.warn({ err: stripeErr, accountId, stripeSubId }, "[Settings] Failed to cancel Stripe subscription on deletion request — continuing");
      }
    }

    void insertAuditLog({
      accountId, actorEmail, actorUserId: clerkUserId,
      action: "data.deletion_requested",
      resourceType: "org",
      metadata: { graceWindowDays: 7, stripeCancelled: !!stripeSubId },
    });

    res.json({
      deletionRequestedAt: row.deletion_requested_at,
      deletionRequestedBy: row.deletion_requested_by,
      message: "Account deletion scheduled. You have 7 days to cancel before all data is permanently removed.",
    });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to request account deletion");
    res.status(500).json({ error: "Failed to request account deletion" });
  }
});

router.delete("/data/cancel-deletion", requireAdminRole, async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const db          = getDb();

    await db.query(
      `UPDATE accounts
          SET deletion_requested_at = NULL, deletion_requested_by = NULL
        WHERE id = $1`,
      [accountId],
    );

    const clerkUserId = getAuth(req)?.userId ?? null;
    const actorEmail  = await getActorEmail(accountId, clerkUserId);
    void insertAuditLog({
      accountId, actorEmail, actorUserId: clerkUserId,
      action: "data.deletion_cancelled",
      resourceType: "org",
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Settings] Failed to cancel account deletion");
    res.status(500).json({ error: "Failed to cancel account deletion" });
  }
});

// ── ZIP archive helper ────────────────────────────────────────────────────────

function buildZipBuffer(files: Array<{ name: string; content: string }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const passthrough = new PassThrough();
    passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));
    passthrough.on("end", () => resolve(Buffer.concat(chunks)));
    passthrough.on("error", reject);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    archive.pipe(passthrough);
    for (const file of files) {
      archive.append(file.content, { name: file.name });
    }
    archive.finalize().catch(reject);
  });
}

// ── Export request processor — polls DB every 60 s, generates ZIP and emails link ──

async function processExportRequests(): Promise<void> {
  let db: ReturnType<typeof getDb>;
  try { db = getDb(); } catch { return; }

  // Atomic claim: transition to 'processing' in a single statement so concurrent
  // server instances never double-process the same export job.
  const { rows } = await db.query<{
    id: number;
    account_id: number;
    requested_by: string;
    download_token: string;
  }>(
    `UPDATE data_export_requests
        SET status = 'processing'
      WHERE id IN (
        SELECT id FROM data_export_requests
         WHERE status = 'pending'
         ORDER BY requested_at ASC
         LIMIT 5
         FOR UPDATE SKIP LOCKED
      )
      RETURNING id, account_id, requested_by, download_token`,
  );

  for (const job of rows) {
    try {
      const [orgRes, teamRes, packagesRes, sessionsRes] = await Promise.all([
        db.query(
          `SELECT id, name, slug, plan_tier, email_sender_name, email_reply_to, email_footer,
                  interview_link_expiry_days, interview_reminder_enabled, interview_reminder_days,
                  interview_default_locale, submission_retention_days, created_at
             FROM accounts WHERE id = $1`,
          [job.account_id],
        ),
        db.query(
          `SELECT email, role, status, created_at FROM account_users
            WHERE account_id = $1 ORDER BY created_at`,
          [job.account_id],
        ),
        db.query(
          `SELECT id, name, status, created_at FROM docufill_packages
            WHERE account_id = $1 ORDER BY created_at`,
          [job.account_id],
        ),
        db.query(
          `SELECT id, interview_token, status, respondent_email, created_at, submitted_at
             FROM docufill_interview_sessions
            WHERE account_id = $1 ORDER BY created_at DESC`,
          [job.account_id],
        ),
      ]);

      const date = new Date().toISOString().slice(0, 10);
      const exportPayload = JSON.stringify({
        exportedAt:  new Date().toISOString(),
        org:         orgRes.rows[0] ?? null,
        team:        teamRes.rows,
        packages:    packagesRes.rows,
        submissions: sessionsRes.rows,
      }, null, 2);

      const zipBuffer = await buildZipBuffer([
        { name: `docuplete_export_${date}.json`, content: exportPayload },
      ]);
      const exportData = zipBuffer.toString("base64");

      await db.query(
        `UPDATE data_export_requests
            SET status = 'completed',
                export_json = $1,
                export_format = 'zip',
                completed_at = NOW(),
                expires_at = NOW() + INTERVAL '48 hours'
          WHERE id = $2`,
        [exportData, job.id],
      );

      const frontendBase = process.env.FRONTEND_URL ?? "";
      const downloadLink = `${frontendBase}/api/v1/product/settings/data/download-export?token=${job.download_token}`;
      const orgName = (orgRes.rows[0] as Record<string, unknown>)?.name as string ?? "Your Organization";
      await sendDataExportEmail({ to: job.requested_by, orgName, downloadLink });

    } catch (err) {
      logger.error({ err, jobId: job.id }, "[Settings] Export job processing failed");
      await db.query(
        `UPDATE data_export_requests SET status = 'failed' WHERE id = $1`,
        [job.id],
      ).catch(() => {});
    }
  }
}

setInterval(() => processExportRequests().catch(() => {}), 60 * 1000).unref();
processExportRequests().catch(() => {});

// ── User profile routes ───────────────────────────────────────────────────────

function buildAvatarServingUrl(avatarToken: string): string {
  return `/api/storage/user-avatar/${avatarToken}`;
}

/** GET /profile — returns the current user's profile data */
router.get("/profile", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;
    const db = getDb();

    const { rows } = await db.query(
      `SELECT id, email, display_name, avatar_url, avatar_token, pending_email
         FROM account_users
        WHERE account_id = $1 AND clerk_user_id = $2
        LIMIT 1`,
      [accountId, clerkUserId],
    );

    if (!rows[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const row = rows[0] as Record<string, unknown>;
    res.json({
      profile: {
        id:            row.id,
        email:         row.email,
        display_name:  row.display_name ?? null,
        avatar_url:    (row.avatar_url && row.avatar_token) ? buildAvatarServingUrl(row.avatar_token as string) : null,
        pending_email: row.pending_email ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, "[Profile] Failed to get profile");
    res.status(500).json({ error: "Failed to load profile" });
  }
});

/** PATCH /profile — update display_name, cancel pending email, and/or request an email change */
router.patch("/profile", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;
    const body = req.body as Record<string, unknown>;
    const db = getDb();

    const { rows: current } = await db.query(
      `SELECT id, email, display_name, avatar_url, avatar_token, pending_email
         FROM account_users
        WHERE account_id = $1 AND clerk_user_id = $2
        LIMIT 1`,
      [accountId, clerkUserId],
    );

    if (!current[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const row = current[0] as Record<string, unknown>;
    const userId = row.id as number;

    let displayName = row.display_name as string | null;
    if ("display_name" in body) {
      displayName = cleanText(body.display_name) || null;
    }

    let pendingEmail = row.pending_email as string | null;
    let emailVerificationSent = false;

    // cancel_pending_email: true — clears the pending email change without
    // committing it, so the user's email stays as-is.
    if (body.cancel_pending_email === true) {
      await db.query(
        `UPDATE account_users
            SET pending_email = NULL, pending_email_token = NULL, pending_email_expires_at = NULL
          WHERE id = $1`,
        [userId],
      );
      pendingEmail = null;
    } else if ("email" in body && typeof body.email === "string") {
      const newEmail = body.email.trim().toLowerCase();
      if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        res.status(400).json({ error: "A valid email address is required." });
        return;
      }

      if (newEmail !== (row.email as string).toLowerCase()) {
        // Check the new email is not already taken by another user in this account
        const { rows: conflict } = await db.query(
          `SELECT id FROM account_users WHERE account_id = $1 AND lower(email) = $2 AND id != $3`,
          [accountId, newEmail, userId],
        );
        if (conflict.length > 0) {
          res.status(409).json({ error: "That email address is already in use by another team member." });
          return;
        }

        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        await db.query(
          `UPDATE account_users
              SET pending_email = $1, pending_email_token = $2, pending_email_expires_at = $3
            WHERE id = $4`,
          [newEmail, token, expiresAt, userId],
        );
        pendingEmail = newEmail;

        const origin = process.env.APP_ORIGIN
          ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://app.docuplete.com");
        const verifyUrl = `${origin}/app/settings?verify_email=${token}`;

        try {
          await sendEmailVerificationEmail({
            to: newEmail,
            displayName: displayName ?? (row.display_name as string | null),
            verifyUrl,
          });
          emailVerificationSent = true;
        } catch (emailErr) {
          logger.warn({ emailErr, newEmail }, "[Profile] Verification email failed — pending record still saved");
        }
      }
    }

    const { rows: updated } = await db.query(
      `UPDATE account_users SET display_name = $1 WHERE id = $2
         RETURNING id, email, display_name, avatar_url, avatar_token, pending_email`,
      [displayName, userId],
    );
    const u = updated[0] as Record<string, unknown>;

    res.json({
      profile: {
        id:            u.id,
        email:         u.email,
        display_name:  u.display_name ?? null,
        avatar_url:    (u.avatar_url && u.avatar_token) ? buildAvatarServingUrl(u.avatar_token as string) : null,
        pending_email: pendingEmail,
      },
      email_verification_sent: emailVerificationSent,
    });
  } catch (err) {
    logger.error({ err }, "[Profile] Failed to update profile");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/** POST /profile/avatar — upload a profile photo */
router.post(
  "/profile/avatar",
  express.raw({ type: ALLOWED_IMAGE_TYPES as unknown as string[], limit: "5mb" }),
  async (req, res) => {
    try {
      const accountId = req.internalAccountId ?? 1;
      const clerkUserId = getAuth(req)?.userId ?? null;
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
        res.status(400).json({ error: "Avatar must be under 5 MB" });
        return;
      }

      const db = getDb();
      const { rows: current } = await db.query(
        `SELECT id FROM account_users WHERE account_id = $1 AND clerk_user_id = $2 LIMIT 1`,
        [accountId, clerkUserId],
      );
      if (!current[0]) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const userId = (current[0] as Record<string, unknown>).id as number;

      let rawAvatarPath: string;
      try {
        rawAvatarPath = await uploadLogoBuffer(buffer, contentType);
      } catch (uploadErr) {
        logger.error({ err: uploadErr }, "[Profile] Avatar upload failed");
        if (uploadErr instanceof StorageMisconfigError) {
          res.status(503).json({
            error: "Storage is not configured on this server. Avatar uploads are unavailable.",
          });
        } else {
          res.status(500).json({ error: "Avatar upload failed. Please try again." });
        }
        return;
      }

      const newAvatarToken = randomUUID();
      const { rows: updated } = await db.query(
        `UPDATE account_users SET avatar_url = $1, avatar_token = $2 WHERE id = $3
           RETURNING id, email, display_name, avatar_url, avatar_token, pending_email`,
        [rawAvatarPath, newAvatarToken, userId],
      );
      if (!updated[0]) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const u = updated[0] as Record<string, unknown>;
      res.json({
        profile: {
          id:            u.id,
          email:         u.email,
          display_name:  u.display_name ?? null,
          avatar_url:    buildAvatarServingUrl(newAvatarToken),
          pending_email: u.pending_email ?? null,
        },
      });
    } catch (err) {
      logger.error({ err }, "[Profile] Unexpected error during avatar upload");
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  },
);

/** DELETE /profile/avatar — remove profile photo */
router.delete("/profile/avatar", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;
    const db = getDb();

    const { rows } = await db.query(
      `UPDATE account_users SET avatar_url = NULL, avatar_token = NULL
         WHERE account_id = $1 AND clerk_user_id = $2
         RETURNING id, email, display_name, pending_email`,
      [accountId, clerkUserId],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const u = rows[0] as Record<string, unknown>;
    res.json({
      profile: {
        id:            u.id,
        email:         u.email,
        display_name:  u.display_name ?? null,
        avatar_url:    null,
        pending_email: u.pending_email ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, "[Profile] Failed to remove avatar");
    res.status(500).json({ error: "Failed to remove avatar" });
  }
});

/**
 * GET /profile/verify-email?token=<token>
 *
 * Verifies a pending email change. Called by the frontend when the user
 * clicks the verification link, which navigates to /app/settings?verify_email=<token>.
 */
router.get("/profile/verify-email", async (req, res) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (!token) {
      res.status(400).json({ error: "Verification token is required." });
      return;
    }

    const db = getDb();
    const { rows } = await db.query(
      `SELECT id, account_id, email, pending_email, pending_email_expires_at, display_name, avatar_url, avatar_token
         FROM account_users
        WHERE pending_email_token = $1`,
      [token],
    );

    if (!rows[0]) {
      res.status(404).json({ error: "Invalid or expired verification link." });
      return;
    }

    const row = rows[0] as Record<string, unknown>;
    const expiresAt = row.pending_email_expires_at as Date | null;
    if (!expiresAt || new Date(expiresAt) < new Date()) {
      res.status(410).json({ error: "This verification link has expired. Please request a new email change." });
      return;
    }

    const newEmail = row.pending_email as string;
    const userId = row.id as number;
    const accountId = row.account_id as number;

    // Re-check that the new email is still available (case-insensitive) at commit time
    const { rows: conflict } = await db.query(
      `SELECT id FROM account_users WHERE account_id = $1 AND lower(email) = $2 AND id != $3`,
      [accountId, newEmail.toLowerCase(), userId],
    );
    if (conflict.length > 0) {
      // Clear the pending state so the user gets a clean start
      await db.query(
        `UPDATE account_users
            SET pending_email = NULL, pending_email_token = NULL, pending_email_expires_at = NULL
          WHERE id = $1`,
        [userId],
      );
      res.status(409).json({ error: "That email address is already in use by another team member. Your pending email change has been cancelled." });
      return;
    }

    // Apply the email change
    const { rows: updated } = await db.query(
      `UPDATE account_users
          SET email = $1, pending_email = NULL, pending_email_token = NULL, pending_email_expires_at = NULL
        WHERE id = $2
        RETURNING id, email, display_name, avatar_url, avatar_token, pending_email`,
      [newEmail, userId],
    );

    const u = updated[0] as Record<string, unknown>;
    res.json({
      success: true,
      profile: {
        id:            u.id,
        email:         u.email,
        display_name:  u.display_name ?? null,
        avatar_url:    (u.avatar_url && u.avatar_token) ? buildAvatarServingUrl(u.avatar_token as string) : null,
        pending_email: null,
      },
    });
  } catch (err) {
    logger.error({ err }, "[Profile] Failed to verify email");
    res.status(500).json({ error: "Failed to verify email change" });
  }
});

// ── Security routes ──────────────────────────────────────────────────────────

function parseUserAgent(ua: string | null): { browser: string; os: string; device: string } {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Unknown" };
  let browser = "Unknown";
  let os = "Unknown";
  let device = "Desktop";

  if (/mobile|android|iphone|ipad/i.test(ua)) device = "Mobile";
  else if (/tablet/i.test(ua)) device = "Tablet";

  if (/chrome\/[\d.]+/i.test(ua) && !/chromium|edg|opr|brave/i.test(ua)) browser = "Chrome";
  else if (/firefox\/[\d.]+/i.test(ua)) browser = "Firefox";
  else if (/safari\/[\d.]+/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/edg\/[\d.]+/i.test(ua)) browser = "Edge";
  else if (/opr\/[\d.]+/i.test(ua)) browser = "Opera";

  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return { browser, os, device };
}

/** GET /security/2fa/status — returns current 2FA status for the current user */
router.get("/security/2fa/status", async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;
    const db = getDb();
    const { rows } = await db.query(
      `SELECT totp_enabled, totp_backup_codes FROM account_users
        WHERE account_id = $1 AND clerk_user_id = $2 LIMIT 1`,
      [accountId, clerkUserId],
    );
    if (!rows[0]) { res.status(404).json({ error: "User not found" }); return; }
    const row = rows[0] as Record<string, unknown>;
    res.json({
      enabled: Boolean(row.totp_enabled),
      backupCodesRemaining: ((row.totp_backup_codes as string[]) ?? []).length,
    });
  } catch (err) {
    logger.error({ err }, "[Security] Failed to get 2FA status");
    res.status(500).json({ error: "Failed to get 2FA status" });
  }
});

/** POST /security/2fa/setup — generate a TOTP secret and return QR code */
router.post("/security/2fa/setup", async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;
    const db = getDb();

    const { rows } = await db.query(
      `SELECT id, email, totp_enabled FROM account_users
        WHERE account_id = $1 AND clerk_user_id = $2 LIMIT 1`,
      [accountId, clerkUserId],
    );
    if (!rows[0]) { res.status(404).json({ error: "User not found" }); return; }
    const row = rows[0] as Record<string, unknown>;
    if (row.totp_enabled) { res.status(400).json({ error: "2FA is already enabled." }); return; }

    const secret = totpGenerateSecret();
    const otpauthUrl = totpGenerateURI({
      issuer: "Docuplete",
      label: row.email as string,
      secret,
    });
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // Store the pending secret (not yet enabled — user must verify first)
    await db.query(
      `UPDATE account_users SET totp_secret = $1 WHERE id = $2`,
      [secret, row.id],
    );

    res.json({ secret, qrCode, otpauthUrl });
  } catch (err) {
    logger.error({ err }, "[Security] Failed to setup 2FA");
    res.status(500).json({ error: "Failed to setup 2FA" });
  }
});

/** POST /security/2fa/enable — verify TOTP code and enable 2FA */
router.post("/security/2fa/enable", async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;
    const body = req.body as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim().replace(/\s/g, "") : "";

    if (!code) { res.status(400).json({ error: "Verification code is required." }); return; }

    const db = getDb();
    const { rows } = await db.query(
      `SELECT id, email, totp_secret, totp_enabled FROM account_users
        WHERE account_id = $1 AND clerk_user_id = $2 LIMIT 1`,
      [accountId, clerkUserId],
    );
    if (!rows[0]) { res.status(404).json({ error: "User not found" }); return; }
    const row = rows[0] as Record<string, unknown>;

    if (row.totp_enabled) { res.status(400).json({ error: "2FA is already enabled." }); return; }
    if (!row.totp_secret) { res.status(400).json({ error: "No pending 2FA setup found. Please start setup first." }); return; }

    const verifyResult = totpVerifySync({ token: code, secret: row.totp_secret as string });
    const isValid = verifyResult.valid;
    if (!isValid) { res.status(400).json({ error: "Invalid verification code. Please try again." }); return; }

    // Generate 8 one-time backup codes (stored as SHA-256 hashes; plaintext shown to user once)
    const backupCodesPlain: string[] = Array.from({ length: 8 }, () =>
      `${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`,
    );
    const backupCodesHashed = backupCodesPlain.map(hashBackupCode);

    await db.query(
      `UPDATE account_users SET totp_enabled = TRUE, totp_backup_codes = $1 WHERE id = $2`,
      [backupCodesHashed, row.id],
    );

    const actorEmail = await getActorEmail(accountId, clerkUserId);
    void insertAuditLog({
      accountId, actorEmail, actorUserId: clerkUserId,
      action: "security.2fa_enabled", resourceType: "user",
    });

    res.json({ success: true, backupCodes: backupCodesPlain });
  } catch (err) {
    logger.error({ err }, "[Security] Failed to enable 2FA");
    res.status(500).json({ error: "Failed to enable 2FA" });
  }
});

/** DELETE /security/2fa — disable 2FA (requires current TOTP code or backup code) */
router.delete("/security/2fa", async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;
    const body = req.body as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim().replace(/\s/g, "") : "";

    if (!code) { res.status(400).json({ error: "Verification code is required to disable 2FA." }); return; }

    const db = getDb();
    const { rows } = await db.query(
      `SELECT id, totp_secret, totp_enabled, totp_backup_codes FROM account_users
        WHERE account_id = $1 AND clerk_user_id = $2 LIMIT 1`,
      [accountId, clerkUserId],
    );
    if (!rows[0]) { res.status(404).json({ error: "User not found" }); return; }
    const row = rows[0] as Record<string, unknown>;

    if (!row.totp_enabled) { res.status(400).json({ error: "2FA is not enabled." }); return; }

    const secret = row.totp_secret as string;
    const storedHashes = (row.totp_backup_codes as string[]) ?? [];

    const validTotp   = totpVerifySync({ token: code, secret }).valid;
    const codeHash    = hashBackupCode(code);
    const backupIdx   = storedHashes.indexOf(codeHash);
    const validBackup = backupIdx !== -1;

    if (!validTotp && !validBackup) {
      res.status(400).json({ error: "Invalid verification code." }); return;
    }

    // Consume the backup code if used (remove it so it can't be reused)
    const remainingHashes = validBackup
      ? storedHashes.filter((_, i) => i !== backupIdx)
      : storedHashes;

    await db.query(
      `UPDATE account_users SET totp_enabled = FALSE, totp_secret = NULL, totp_backup_codes = $2 WHERE id = $1`,
      [row.id, remainingHashes],
    );

    const actorEmail = await getActorEmail(accountId, clerkUserId);
    void insertAuditLog({
      accountId, actorEmail, actorUserId: clerkUserId,
      action: "security.2fa_disabled", resourceType: "user",
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Security] Failed to disable 2FA");
    res.status(500).json({ error: "Failed to disable 2FA" });
  }
});

/** GET /security/sessions — list active sessions for the current user */
router.get("/security/sessions", async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;
    const clerkAuth   = getAuth(req);
    const currentSessionId = clerkAuth?.sessionId ?? null;

    const db = getDb();
    const { rows: userRows } = await db.query(
      `SELECT id FROM account_users WHERE account_id = $1 AND clerk_user_id = $2 LIMIT 1`,
      [accountId, clerkUserId],
    );
    if (!userRows[0]) { res.status(404).json({ error: "User not found" }); return; }
    const userId = (userRows[0] as Record<string, unknown>).id as number;

    const { rows } = await db.query(
      `SELECT id, clerk_session_id, ip_address, user_agent, last_active_at, created_at
         FROM user_active_sessions
        WHERE user_id = $1 AND revoked_at IS NULL
        ORDER BY last_active_at DESC
        LIMIT 20`,
      [userId],
    );

    const sessions = rows.map((r) => {
      const row = r as Record<string, unknown>;
      const ua = parseUserAgent(row.user_agent as string | null);
      const ipAddress = (row.ip_address as string | null) ?? null;
      return {
        id:             row.id,
        isCurrent:      row.clerk_session_id === currentSessionId,
        browser:        ua.browser,
        os:             ua.os,
        device:         ua.device,
        ipAddress,
        location:       lookupIpLocation(ipAddress),
        lastActiveAt:   row.last_active_at,
        createdAt:      row.created_at,
      };
    });

    res.json({ sessions });
  } catch (err) {
    logger.error({ err }, "[Security] Failed to list sessions");
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

/** DELETE /security/sessions/:sessionId — revoke a session by its DB id */
router.delete("/security/sessions/:sessionId", async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;
    const clerkAuth   = getAuth(req);
    const currentSessionId = clerkAuth?.sessionId ?? null;
    const sessionDbId = parseInt(req.params.sessionId ?? "", 10);
    if (isNaN(sessionDbId)) { res.status(400).json({ error: "Invalid session ID." }); return; }

    const db = getDb();
    const { rows: userRows } = await db.query(
      `SELECT id FROM account_users WHERE account_id = $1 AND clerk_user_id = $2 LIMIT 1`,
      [accountId, clerkUserId],
    );
    if (!userRows[0]) { res.status(404).json({ error: "User not found" }); return; }
    const userId = (userRows[0] as Record<string, unknown>).id as number;

    // Fetch the session to make sure it belongs to this user
    const { rows: sessionRows } = await db.query(
      `SELECT id, clerk_session_id FROM user_active_sessions
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [sessionDbId, userId],
    );
    if (!sessionRows[0]) { res.status(404).json({ error: "Session not found." }); return; }

    const session = sessionRows[0] as Record<string, unknown>;
    if (session.clerk_session_id === currentSessionId) {
      res.status(400).json({ error: "You cannot revoke your current session." }); return;
    }

    await db.query(
      `UPDATE user_active_sessions SET revoked_at = NOW() WHERE id = $1`,
      [sessionDbId],
    );

    const actorEmail = await getActorEmail(accountId, clerkUserId);
    void insertAuditLog({
      accountId, actorEmail, actorUserId: clerkUserId,
      action: "security.session_revoked", resourceType: "session",
      resourceId: String(sessionDbId),
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Security] Failed to revoke session");
    res.status(500).json({ error: "Failed to revoke session" });
  }
});

/** GET /security/trusted-devices — list trusted devices for the current user */
router.get("/security/trusted-devices", async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;
    const db = getDb();
    const { rows: userRows } = await db.query(
      `SELECT id FROM account_users WHERE account_id = $1 AND clerk_user_id = $2 LIMIT 1`,
      [accountId, clerkUserId],
    );
    if (!userRows[0]) { res.status(404).json({ error: "User not found" }); return; }
    const userId = (userRows[0] as Record<string, unknown>).id as number;

    const { rows } = await db.query(
      `SELECT id, label, ip_address, created_at, expires_at, last_used_at
         FROM trusted_devices
        WHERE user_id = $1 AND expires_at > NOW()
        ORDER BY last_used_at DESC NULLS LAST, created_at DESC
        LIMIT 20`,
      [userId],
    );

    res.json({
      trustedDevices: rows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          id:          row.id,
          label:       row.label,
          ipAddress:   row.ip_address ?? null,
          createdAt:   row.created_at,
          expiresAt:   row.expires_at,
          lastUsedAt:  row.last_used_at ?? null,
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, "[Security] Failed to list trusted devices");
    res.status(500).json({ error: "Failed to list trusted devices" });
  }
});

/** DELETE /security/trusted-devices/:deviceId — revoke a trusted device */
router.delete("/security/trusted-devices/:deviceId", async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;
    const deviceId    = parseInt(req.params.deviceId ?? "", 10);
    if (isNaN(deviceId)) { res.status(400).json({ error: "Invalid device ID." }); return; }

    const db = getDb();
    const { rows: userRows } = await db.query(
      `SELECT id FROM account_users WHERE account_id = $1 AND clerk_user_id = $2 LIMIT 1`,
      [accountId, clerkUserId],
    );
    if (!userRows[0]) { res.status(404).json({ error: "User not found" }); return; }
    const userId = (userRows[0] as Record<string, unknown>).id as number;

    const { rowCount } = await db.query(
      `DELETE FROM trusted_devices WHERE id = $1 AND user_id = $2`,
      [deviceId, userId],
    );

    if ((rowCount ?? 0) === 0) { res.status(404).json({ error: "Trusted device not found." }); return; }

    const actorEmail = await getActorEmail(accountId, clerkUserId);
    void insertAuditLog({
      accountId, actorEmail, actorUserId: clerkUserId,
      action: "security.trusted_device_revoked", resourceType: "trusted_device",
      resourceId: String(deviceId),
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Security] Failed to revoke trusted device");
    res.status(500).json({ error: "Failed to revoke trusted device" });
  }
});

// ─── Custom Domain ────────────────────────────────────────────────────────────

const CNAME_TARGET = "cname.vercel-dns.com";

/** GET /custom-domain — return the org's current custom domain info */
router.get("/custom-domain", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();
    const { rows } = await db.query<{
      plan_tier: string;
      custom_domain: string | null;
      custom_domain_status: string;
      custom_domain_verified_at: Date | null;
    }>(
      `SELECT plan_tier, custom_domain, custom_domain_status, custom_domain_verified_at
         FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!rows[0]) { res.status(404).json({ error: "Account not found" }); return; }
    const row = rows[0];
    res.json({
      plan_tier: row.plan_tier,
      custom_domain: row.custom_domain ?? null,
      status: row.custom_domain ?? null ? row.custom_domain_status : null,
      verified_at: row.custom_domain_verified_at?.toISOString() ?? null,
      cname_target: CNAME_TARGET,
    });
  } catch (err) {
    logger.error({ err }, "[CustomDomain] GET failed");
    res.status(500).json({ error: "Failed to get custom domain info" });
  }
});

/** PUT /custom-domain — save (or remove) a custom domain; sets status to unverified */
router.put("/custom-domain", requireAdminRole, requirePlanFeature("customDomain"), async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const body = req.body as Record<string, unknown>;
    const db = getDb();

    const { rows: acctRows } = await db.query<{ plan_tier: string }>(
      `SELECT plan_tier FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!acctRows[0]) { res.status(404).json({ error: "Account not found" }); return; }
    const planTier = acctRows[0].plan_tier;
    if (planTier === "free") {
      res.status(403).json({ error: "Custom domains require a Pro or Enterprise plan." });
      return;
    }

    const rawDomain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : null;
    if (rawDomain === null || rawDomain === "") {
      // Clear domain
      await db.query(
        `UPDATE accounts SET custom_domain = NULL, custom_domain_status = 'unverified', custom_domain_verified_at = NULL WHERE id = $1`,
        [accountId],
      );
      res.json({ custom_domain: null, status: null, cname_target: CNAME_TARGET });
      return;
    }

    // Basic hostname validation
    const hostnameRe = /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/;
    if (!hostnameRe.test(rawDomain) || rawDomain.length > 253) {
      res.status(400).json({ error: "Invalid domain name. Use a fully-qualified hostname like forms.yourcompany.com." });
      return;
    }

    const { rows } = await db.query<{ custom_domain: string; custom_domain_status: string }>(
      `UPDATE accounts
          SET custom_domain = $1, custom_domain_status = 'unverified', custom_domain_verified_at = NULL
        WHERE id = $2
        RETURNING custom_domain, custom_domain_status`,
      [rawDomain, accountId],
    );
    const row = rows[0];

    const clerkUserId = getAuth(req)?.userId ?? null;
    void insertAuditLog({
      accountId,
      actorEmail: await getActorEmail(accountId, clerkUserId),
      actorUserId: clerkUserId,
      action: "custom_domain.set",
      resourceType: "org",
      resourceLabel: rawDomain,
    });

    res.json({ custom_domain: row.custom_domain, status: row.custom_domain_status, cname_target: CNAME_TARGET });
  } catch (err) {
    logger.error({ err }, "[CustomDomain] PUT failed");
    res.status(500).json({ error: "Failed to save custom domain" });
  }
});

/** POST /custom-domain/verify — attempt DNS CNAME verification */
router.post("/custom-domain/verify", requireAdminRole, async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? 1;
    const db = getDb();

    const { rows: acctRows } = await db.query<{ plan_tier: string; custom_domain: string | null }>(
      `SELECT plan_tier, custom_domain FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!acctRows[0]) { res.status(404).json({ error: "Account not found" }); return; }
    const { plan_tier: planTier, custom_domain: domain } = acctRows[0];

    if (planTier === "free") {
      res.status(403).json({ error: "Custom domains require a Pro or Enterprise plan." });
      return;
    }
    if (!domain) {
      res.status(400).json({ error: "No custom domain saved. Please enter a domain first." });
      return;
    }

    // Mark as verifying
    await db.query(
      `UPDATE accounts SET custom_domain_status = 'verifying' WHERE id = $1`,
      [accountId],
    );

    // Resolve CNAME
    let cnamePoints: string[] = [];
    let dnsError: string | null = null;
    try {
      const { promises: dnsPromises } = await import("dns");
      const result = await dnsPromises.resolveCname(domain);
      cnamePoints = result.map((r) => r.toLowerCase().replace(/\.$/, ""));
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code ?? "";
      if (code === "ENOTFOUND" || code === "ENODATA") {
        dnsError = "DNS_NOT_FOUND";
      } else if (code === "ENOENT") {
        dnsError = "NO_CNAME";
      } else {
        dnsError = "DNS_ERROR";
      }
    }

    const target = CNAME_TARGET.toLowerCase();
    const verified = !dnsError && cnamePoints.some((c) => c === target || c.endsWith(`.${target}`));

    let newStatus: string;
    let verifiedAt: string | null = null;
    if (verified) {
      newStatus = "active";
      verifiedAt = new Date().toISOString();
      await db.query(
        `UPDATE accounts SET custom_domain_status = 'active', custom_domain_verified_at = NOW() WHERE id = $1`,
        [accountId],
      );
    } else {
      newStatus = "error";
      await db.query(
        `UPDATE accounts SET custom_domain_status = 'error' WHERE id = $1`,
        [accountId],
      );
    }

    const clerkUserId = getAuth(req)?.userId ?? null;
    void insertAuditLog({
      accountId,
      actorEmail: await getActorEmail(accountId, clerkUserId),
      actorUserId: clerkUserId,
      action: "custom_domain.verify",
      resourceType: "org",
      resourceLabel: domain,
      metadata: { status: newStatus, cnames: cnamePoints.slice(0, 5) },
    });

    res.json({
      verified,
      status: newStatus,
      domain,
      cname_target: CNAME_TARGET,
      cnames_found: cnamePoints,
      verified_at: verifiedAt,
      error: dnsError,
    });
  } catch (err) {
    logger.error({ err }, "[CustomDomain] verify failed");
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

/** GET /security/login-history — recent login events for the current user */
router.get("/security/login-history", async (req, res) => {
  try {
    const accountId   = req.internalAccountId ?? 1;
    const clerkUserId = getAuth(req)?.userId ?? null;

    const db = getDb();
    const { rows: userRows } = await db.query(
      `SELECT id FROM account_users WHERE account_id = $1 AND clerk_user_id = $2 LIMIT 1`,
      [accountId, clerkUserId],
    );
    if (!userRows[0]) { res.status(404).json({ error: "User not found" }); return; }
    const userId = (userRows[0] as Record<string, unknown>).id as number;

    const { rows } = await db.query(
      `SELECT id, ip_address, user_agent, created_at
         FROM user_login_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 30`,
      [userId],
    );

    const history = rows.map((r) => {
      const row = r as Record<string, unknown>;
      const ua = parseUserAgent(row.user_agent as string | null);
      const ipAddress = (row.ip_address as string | null) ?? null;
      return {
        id:         row.id,
        browser:    ua.browser,
        os:         ua.os,
        device:     ua.device,
        ipAddress,
        location:   lookupIpLocation(ipAddress),
        createdAt:  row.created_at,
      };
    });

    res.json({ history });
  } catch (err) {
    logger.error({ err }, "[Security] Failed to get login history");
    res.status(500).json({ error: "Failed to get login history" });
  }
});

export default router;
