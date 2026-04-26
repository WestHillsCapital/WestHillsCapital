import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { getDb } from "../db";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// ─── Security note: intentionally public routes ───────────────────────────────
//
// Both routes below are unauthenticated by design so that customer-facing forms
// can load assets (logos, public files) without requiring auth headers.
//
// Enumeration risk is mitigated as follows:
//   • /storage/public-objects/*  — files are looked up across pre-configured
//     search paths; the caller must already know the exact filename.
//   • /storage/org-logo/:accountId — the accountId is an integer that maps to
//     an account's logo. The underlying GCS object is stored at a random UUID
//     path (see uploadLogoBuffer in settings.ts), so even if someone guesses a
//     valid accountId they can only retrieve the publicly-intended logo image,
//     not any other private object. Direct access to GCS object paths is not
//     possible through this endpoint.
//
// Do NOT expose raw /objects/* paths through an unauthenticated route; all
// private-object access (other than logos) must go through authenticated routes
// that check objectStorageService.canAccessObjectEntity().
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /storage/public-objects/{filePath}:
 *   get:
 *     tags:
 *       - Storage
 *     summary: Serve a public asset file
 *     description: |
 *       Streams a file from the configured public-objects GCS search paths.
 *       The caller must know the exact filename. No authentication required.
 *     parameters:
 *       - name: filePath
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *           Relative path of the file (e.g. `logos/sample.png`).
 *           The path may contain forward slashes for nested directories.
 *           OpenAPI 3.x does not natively model wildcard path segments —
 *           this parameter represents the full remainder of the URL path.
 *     responses:
 *       200:
 *         description: File contents streamed with original Content-Type
 *       404:
 *         description: File not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    logger.error({ err }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * @openapi
 * /storage/org-logo/{accountId}:
 *   get:
 *     tags:
 *       - Storage
 *     summary: Serve an org logo
 *     description: |
 *       Returns the logo image for the given account. No authentication required.
 *
 *       The underlying GCS object is stored at a random UUID path so guessing a
 *       valid `accountId` only returns the publicly-intended logo, never a private asset.
 *     parameters:
 *       - name: accountId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numeric account / organisation ID
 *     responses:
 *       200:
 *         description: Image data (PNG, JPEG, or WebP)
 *       404:
 *         description: Account not found or no logo configured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/storage/org-logo/:accountId", async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    if (isNaN(accountId) || accountId <= 0) {
      res.status(400).json({ error: "Invalid account ID" });
      return;
    }
    const db = getDb();
    const { rows } = await db.query(
      `SELECT logo_url FROM accounts WHERE id = $1`,
      [accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const logoUrl = (rows[0] as Record<string, unknown>).logo_url as string | null;
    if (!logoUrl) {
      res.status(404).json({ error: "No logo configured" });
      return;
    }
    const objectFile = await objectStorageService.getObjectEntityFile(logoUrl);
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Logo not found" });
      return;
    }
    logger.error({ err }, "Error serving org logo");
    res.status(500).json({ error: "Failed to serve logo" });
  }
});

export default router;
