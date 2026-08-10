/**
 * Public routes for the WHC self-serve purchase flow.
 *
 * POST /api/buy/fedex-locations   — zip → FedEx staffed locations (public)
 * POST /api/buy/session           — create a prefilled Docuplete session (public)
 * POST /api/buy/webhook           — receive signed purchase agreement from Docuplete
 */

import { Router } from "express";
import { randomBytes, createHmac } from "crypto";
import { getDb } from "../db";
import { searchFedExLocations } from "../lib/fedex";
import { logger } from "../lib/logger";

const router = Router();

// ── Shipping fee calculation ──────────────────────────────────────────────────
const FLAT_SHIPPING_FEE_USD = parseFloat(process.env.SELF_SERVE_SHIPPING_FEE_USD ?? "35");
const FREE_SHIPPING_GOLD_OZ  = parseFloat(process.env.FREE_SHIPPING_GOLD_OZ  ?? "15");
const FREE_SHIPPING_SILVER_OZ = parseFloat(process.env.FREE_SHIPPING_SILVER_OZ ?? "300");

export function calcShipping(metal: string, totalOz: number): number {
  if (metal === "gold"   && totalOz >= FREE_SHIPPING_GOLD_OZ)   return 0;
  if (metal === "silver" && totalOz >= FREE_SHIPPING_SILVER_OZ) return 0;
  return FLAT_SHIPPING_FEE_USD;
}

// ── Staff notification ────────────────────────────────────────────────────────
async function notifyStaff(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to     = process.env.STAFF_EMAIL || "info@westhillscapital.com";
  if (!apiKey) { logger.warn("[Buy] RESEND_API_KEY not set — skipping staff notification"); return; }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "West Hills Capital <noreply@westhillscapital.com>",
        to: [to],
        subject,
        html,
      }),
    });
  } catch (err) {
    logger.error({ err }, "[Buy] Failed to send staff notification");
  }
}

// ── POST /api/buy/fedex-locations ─────────────────────────────────────────────
// Public. Returns FedEx staffed locations near a ZIP code.
router.post("/fedex-locations", async (req, res) => {
  const { postalCode } = (req.body ?? {}) as { postalCode?: string };
  const code = String(postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  if (code.length !== 5) {
    res.status(400).json({ error: "Valid 5-digit ZIP code required" });
    return;
  }
  try {
    const locations = await searchFedExLocations(code);
    res.json({ locations });
  } catch (err) {
    logger.error({ err }, "[Buy/FedEx] Location search error");
    res.status(502).json({ error: "FedEx location search temporarily unavailable", locations: [] });
  }
});

// ── POST /api/buy/session ─────────────────────────────────────────────────────
// Public. Creates a Docuplete interview session for the purchase agreement
// package, pre-populated with product, pricing, and FedEx location data.
// Returns { interviewUrl, sessionToken, confirmationId }.
router.post("/session", async (req, res) => {
  const embedKey = process.env.DOCUPLETE_PURCHASE_EMBED_KEY;
  if (!embedKey) {
    res.status(503).json({ error: "Purchase flow not configured" });
    return;
  }

  try {
    const db = getDb();

    // Look up the active purchase agreement package
    const { rows } = await db.query<{
      id: string;
      account_id: string;
      version: number | null;
      transaction_scope: string | null;
      custom_domain: string | null;
      custom_domain_status: string | null;
    }>(
      `SELECT p.id, p.account_id, p.version, p.transaction_scope,
              a.custom_domain, a.custom_domain_status
         FROM docuplete_packages p
         JOIN accounts a ON a.id = p.account_id
        WHERE p.embed_key = $1 AND p.enable_embed = true AND p.status = 'active'
        LIMIT 1`,
      [embedKey],
    );

    const pkg = rows[0];
    if (!pkg) {
      res.status(503).json({ error: "Purchase package not available" });
      return;
    }

    // Generate identifiers
    const token         = randomBytes(32).toString("base64url");
    const confirmationId = `WHC-${Date.now().toString(36).toUpperCase()}`;
    const expiresAt     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Merge caller prefill with server-generated fields
    const prefill: Record<string, string> = {
      ...(req.body?.prefill ?? {}),
      CONFIRMATION_ID:  confirmationId,
      AGREEMENT_DATE:   new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    };

    await db.query(
      `INSERT INTO docuplete_interview_sessions
         (token, package_id, package_version, transaction_scope, source, status,
          test_mode, prefill, answers, expires_at, account_id)
       VALUES ($1, $2, $3, $4, 'embed', 'draft', false, $5::jsonb, '{}'::jsonb, $6, $7)`,
      [
        token,
        pkg.id,
        pkg.version ?? 1,
        pkg.transaction_scope ?? "",
        JSON.stringify(prefill),
        expiresAt,
        pkg.account_id,
      ],
    );

    // Build interview URL — respect custom domain if active
    const appOrigin = process.env.APP_ORIGIN
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://westhillscapital.com");
    const interviewOrigin =
      pkg.custom_domain && pkg.custom_domain_status === "active"
        ? `https://${pkg.custom_domain}`
        : appOrigin;

    res.status(201).json({
      interviewUrl: `${interviewOrigin}/docuplete/public/${token}`,
      sessionToken: token,
      confirmationId,
    });
  } catch (err) {
    logger.error({ err }, "[Buy/Session] Session creation failed");
    res.status(500).json({ error: "Could not create session" });
  }
});

// ── POST /api/buy/webhook ─────────────────────────────────────────────────────
// Receives the Docuplete webhook when a purchase agreement is signed.
// Verifies the session token exists in our DB, then notifies staff.
router.post("/webhook", async (req, res) => {
  // Optional HMAC verification — requires DOCUPLETE_PURCHASE_WEBHOOK_SECRET
  const secret = process.env.DOCUPLETE_PURCHASE_WEBHOOK_SECRET;
  const sig    = req.headers["x-docuplete-signature"] as string | undefined;
  if (secret && sig) {
    const rawBody = JSON.stringify(req.body);
    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    if (sig !== expected) {
      logger.warn("[Buy/Webhook] Signature mismatch");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  const payload = req.body as {
    event?: string;
    packageId?: string;
    sessionToken?: string;
    token?: string;
    prefill?: Record<string, string>;
    answers?: Record<string, unknown>;
  };

  const eventType = payload.event ?? "";
  const sessionToken = payload.sessionToken ?? payload.token ?? "";

  // Only process completion events
  if (!["pdf.generated", "interview.submitted", "signed"].includes(eventType)) {
    res.json({ ok: true, skipped: true });
    return;
  }

  if (!sessionToken) {
    res.status(400).json({ error: "Missing sessionToken" });
    return;
  }

  try {
    const db = getDb();
    const embedKey = process.env.DOCUPLETE_PURCHASE_EMBED_KEY;

    // Verify the session token was issued by us for the purchase package
    const { rows } = await db.query(
      `SELECT s.id, s.prefill
         FROM docuplete_interview_sessions s
         JOIN docuplete_packages p ON p.id = s.package_id
        WHERE s.token = $1
          AND ($2::text IS NULL OR p.embed_key = $2)
        LIMIT 1`,
      [sessionToken, embedKey ?? null],
    );

    if (!rows[0]) {
      logger.warn({ sessionToken }, "[Buy/Webhook] Unknown session token");
      res.status(401).json({ error: "Unknown session" });
      return;
    }

    // Merge prefill + answers (prefill has WHC-generated data; answers has buyer-entered data)
    const data: Record<string, string> = {
      ...(rows[0].prefill ?? {}),
      ...(payload.prefill ?? {}),
    };

    logger.info({ sessionToken, confirmationId: data.CONFIRMATION_ID }, "[Buy/Webhook] Purchase agreement signed");

    // Notify staff
    const fmtCurrency = (val?: string) =>
      val ? `$${parseFloat(val).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

    await notifyStaff(
      `🔒 New Self-Serve Purchase — ${data.CONFIRMATION_ID ?? sessionToken}`,
      `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fafaf8;">
  <img src="https://westhillscapital.com/logo.webp" alt="West Hills Capital" style="height:40px;margin-bottom:24px;" />
  <h2 style="margin:0 0 4px;color:#1a1a1a;">Purchase Agreement Signed</h2>
  <p style="margin:0 0 24px;color:#555;">A customer has completed the self-serve purchase flow and signed their agreement.</p>

  <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;">
    <tr style="background:#f5f0e8;">
      <td colspan="2" style="padding:12px 16px;font-weight:600;font-size:13px;color:#8B6914;text-transform:uppercase;letter-spacing:.05em;">Order Details</td>
    </tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;border-bottom:1px solid #f0f0f0;">Confirmation ID</td><td style="padding:10px 16px;font-weight:600;font-size:14px;border-bottom:1px solid #f0f0f0;">${data.CONFIRMATION_ID ?? "—"}</td></tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;border-bottom:1px solid #f0f0f0;">Product</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f0f0f0;">${data.PRODUCT_NAME ?? "—"}</td></tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;border-bottom:1px solid #f0f0f0;">Quantity</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f0f0f0;">${data.QUANTITY ?? "—"}</td></tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;border-bottom:1px solid #f0f0f0;">Unit Price</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f0f0f0;">${fmtCurrency(data.PER_UNIT_PRICE)}</td></tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;border-bottom:1px solid #f0f0f0;">Shipping</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f0f0f0;">${fmtCurrency(data.SHIPPING_FEE)}</td></tr>
    <tr style="background:#f5f0e8;"><td style="padding:12px 16px;font-weight:700;font-size:14px;">Total Due</td><td style="padding:12px 16px;font-weight:700;font-size:16px;">${fmtCurrency(data.ESTIMATED_TOTAL)}</td></tr>
  </table>

  <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;margin-top:16px;">
    <tr style="background:#f5f0e8;">
      <td colspan="2" style="padding:12px 16px;font-weight:600;font-size:13px;color:#8B6914;text-transform:uppercase;letter-spacing:.05em;">Delivery</td>
    </tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;border-bottom:1px solid #f0f0f0;">FedEx Location</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f0f0f0;">${data.FEDEX_LOCATION_NAME ?? "—"}</td></tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;">Address</td><td style="padding:10px 16px;font-size:14px;">${[data.FEDEX_LOCATION_ADDRESS, data.FEDEX_LOCATION_CITY, data.FEDEX_LOCATION_STATE, data.FEDEX_LOCATION_ZIP].filter(Boolean).join(", ") || "—"}</td></tr>
  </table>

  <p style="margin:24px 0 0;font-size:13px;color:#888;">
    Session: <code>${sessionToken}</code><br />
    Date: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CST
  </p>
  <p style="margin:8px 0 0;font-size:13px;color:#888;">
    The customer will wire funds by end of next business day. Execute the trade with DG once payment clears.
  </p>
</div>`,
    );

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[Buy/Webhook] Processing error");
    // Always return 200 to Docuplete so it doesn't retry
    res.json({ ok: true, warning: "Internal processing error — check logs" });
  }
});

export default router;
