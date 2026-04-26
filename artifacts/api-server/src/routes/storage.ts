import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { getDb } from "../db";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

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
