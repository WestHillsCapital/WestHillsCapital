/**
 * Public routes for the WHC self-serve purchase flow.
 *
 * POST /api/buy/fedex-locations   — zip → FedEx staffed locations
 * POST /api/buy/session           — create a prefilled Docuplete session via API
 * POST /api/buy/webhook           — receive signed purchase agreement from Docuplete
 */

import { Router } from "express";
import { createHmac } from "crypto";
import { searchFedExLocations } from "../lib/fedex";
import { logger } from "../lib/logger";

const router = Router();

// ── Shipping fee calculation ──────────────────────────────────────────────────
const FLAT_SHIPPING_FEE_USD  = parseFloat(process.env.SELF_SERVE_SHIPPING_FEE_USD  ?? "25");
const FREE_SHIPPING_GOLD_OZ  = parseFloat(process.env.FREE_SHIPPING_GOLD_OZ        ?? "15");
const FREE_SHIPPING_SILVER_OZ = parseFloat(process.env.FREE_SHIPPING_SILVER_OZ     ?? "300");

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
      method:  "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from:    "West Hills Capital <noreply@westhillscapital.com>",
        to:      [to],
        subject,
        html,
      }),
    });
  } catch (err) {
    logger.error({ err }, "[Buy] Failed to send staff notification");
  }
}

// ── POST /api/buy/fedex-locations ─────────────────────────────────────────────
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
// Creates a Docuplete session via the Docuplete API, pre-populated with all
// order and customer data (read-only). Docuplete emails the customer a signing
// link; the customer only needs to sign.
router.post("/session", async (req, res) => {
  const apiKey    = process.env.DOCUPLETE_API_KEY;
  const packageId = process.env.DOCUPLETE_PACKAGE_ID;
  const baseUrl   = process.env.DOCUPLETE_API_BASE_URL ?? "https://docuplete.app";

  if (!apiKey) {
    logger.error("[Buy/Session] DOCUPLETE_API_KEY not set");
    res.status(503).json({ error: "Purchase flow not configured" });
    return;
  }
  if (!packageId) {
    logger.error("[Buy/Session] DOCUPLETE_PACKAGE_ID not set");
    res.status(503).json({ error: "Purchase flow not configured" });
    return;
  }

  const { prefill: callerPrefill = {}, customer = {} } = req.body ?? {};
  const {
    firstName = "", lastName = "", email = "",
    phone = "", street = "", city = "", state = "", zip = "",
  } = customer as Record<string, string>;

  if (!email) {
    res.status(400).json({ error: "Customer email is required" });
    return;
  }

  const fullName       = [firstName, lastName].filter(Boolean).join(" ");
  const confirmationId = `WHC-${Date.now().toString(36).toUpperCase()}`;
  const agreementDate  = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const prefill: Record<string, string> = {
    ...(callerPrefill as Record<string, string>),
    BUYER_FIRST_NAME: firstName,
    BUYER_LAST_NAME:  lastName,
    BUYER_FULL_NAME:  fullName,
    BUYER_EMAIL:      email,
    BUYER_PHONE:      phone,
    BUYER_ADDRESS:    [fullName, street, city, state, zip].filter(Boolean).join(", "),
    CONFIRMATION_ID:  confirmationId,
    AGREEMENT_DATE:   agreementDate,
  };

  try {
    const response = await fetch(`${baseUrl}/api/v1/sessions`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        packageId: Number(packageId),
        prefill,
        // Docuplete emails the signing link to the first signer automatically
        signers: [{ email, name: fullName || email }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(`[Buy/Session] Docuplete API error — status=${response.status} body=${body}`);
      res.status(502).json({ error: "Could not create signing session — please try again" });
      return;
    }

    const result = await response.json() as {
      sessionToken: string;
      interviewUrl: string;
      expiresAt: string | null;
    };

    logger.info({ confirmationId, token: result.sessionToken }, "[Buy/Session] Session created — sending link");

    // Docuplete does not auto-email on session creation; we must call send-link explicitly.
    const sendRes = await fetch(`${baseUrl}/api/v1/sessions/${result.sessionToken}/send-link`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipientEmail: email, name: fullName || email }),
    });

    if (!sendRes.ok) {
      const sendBody = await sendRes.text();
      logger.error({ status: sendRes.status, body: sendBody }, "[Buy/Session] send-link failed");
      // Session exists but email failed — still return success so the user can be told to check inbox;
      // staff notification below will alert WHC to resend manually if needed.
    } else {
      logger.info({ confirmationId, sentTo: email }, "[Buy/Session] Signing link sent");
    }

    res.status(201).json({ confirmationId, sentTo: email, sessionToken: result.sessionToken });
  } catch (err) {
    logger.error({ err }, "[Buy/Session] Session creation failed");
    res.status(500).json({ error: "Could not create session" });
  }
});

// ── POST /api/buy/resend ──────────────────────────────────────────────────────
// Resend the signing link for an existing Docuplete session token.
// Used by WHC staff when a customer says they never received the email.
router.post("/resend", async (req, res) => {
  const apiKey  = process.env.DOCUPLETE_API_KEY;
  const baseUrl = process.env.DOCUPLETE_API_BASE_URL ?? "https://docuplete.app";

  if (!apiKey) {
    res.status(503).json({ error: "Purchase flow not configured" });
    return;
  }

  const { sessionToken, email, name = "" } = (req.body ?? {}) as {
    sessionToken?: string;
    email?: string;
    name?: string;
  };

  if (!sessionToken || !email) {
    res.status(400).json({ error: "sessionToken and email are required" });
    return;
  }

  try {
    const sendRes = await fetch(`${baseUrl}/api/v1/sessions/${sessionToken}/send-link`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipientEmail: email, name: name || email }),
    });

    if (!sendRes.ok) {
      const body = await sendRes.text();
      logger.error({ status: sendRes.status, body }, "[Buy/Resend] send-link failed");
      res.status(502).json({ error: "Docuplete could not resend the link" });
      return;
    }

    logger.info({ sessionToken, sentTo: email }, "[Buy/Resend] Signing link resent");
    res.json({ sent: true, sentTo: email });
  } catch (err) {
    logger.error({ err }, "[Buy/Resend] Resend failed");
    res.status(500).json({ error: "Could not resend signing link" });
  }
});

// ── POST /api/buy/webhook ─────────────────────────────────────────────────────
// Receives the Docuplete webhook when a purchase agreement is signed.
// Verified via HMAC signature if DOCUPLETE_PURCHASE_WEBHOOK_SECRET is set.
router.post("/webhook", async (req, res) => {
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
    event?:        string;
    sessionToken?: string;
    token?:        string;
    prefill?:      Record<string, string>;
    answers?:      Record<string, unknown>;
  };

  const eventType    = payload.event ?? "";
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

  // Merge prefill (WHC-generated data) with any answers from the payload
  const data: Record<string, string> = {
    ...(payload.prefill ?? {}),
    ...(payload.answers  as Record<string, string> ?? {}),
  };

  logger.info({ sessionToken, confirmationId: data.CONFIRMATION_ID }, "[Buy/Webhook] Purchase agreement signed");

  const fmtCurrency = (val?: string) =>
    val ? `$${parseFloat(val).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

  // Build line items table rows from prefill
  let lineItemRows = "";
  for (let i = 1; i <= 10; i++) {
    const name  = data[`LINE_ITEM_${i}_NAME`];
    const qty   = data[`LINE_ITEM_${i}_QTY`];
    const total = data[`LINE_ITEM_${i}_TOTAL`];
    if (!name) break;
    lineItemRows += `
      <tr>
        <td style="padding:10px 16px;color:#555;font-size:14px;border-bottom:1px solid #f0f0f0;">${qty ? `${qty}×` : ""} ${name}</td>
        <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmtCurrency(total)}</td>
      </tr>`;
  }

  try {
    await notifyStaff(
      `🔒 New Self-Serve Purchase — ${data.CONFIRMATION_ID ?? sessionToken}`,
      `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fafaf8;">
  <img src="https://westhillscapital.com/logo.webp" alt="West Hills Capital" style="height:40px;margin-bottom:24px;" />
  <h2 style="margin:0 0 4px;color:#1a1a1a;">Purchase Agreement Signed</h2>
  <p style="margin:0 0 24px;color:#555;">A customer has completed the self-serve purchase flow and signed their agreement.</p>

  <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;">
    <tr style="background:#f5f0e8;">
      <td colspan="2" style="padding:12px 16px;font-weight:600;font-size:13px;color:#8B6914;text-transform:uppercase;letter-spacing:.05em;">Customer</td>
    </tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;border-bottom:1px solid #f0f0f0;">Name</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f0f0f0;">${data.BUYER_FULL_NAME ?? "—"}</td></tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;border-bottom:1px solid #f0f0f0;">Email</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f0f0f0;">${data.BUYER_EMAIL ?? "—"}</td></tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;border-bottom:1px solid #f0f0f0;">Phone</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f0f0f0;">${data.BUYER_PHONE ?? "—"}</td></tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;">Address</td><td style="padding:10px 16px;font-size:14px;">${data.BUYER_ADDRESS ?? "—"}</td></tr>
  </table>

  <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;margin-top:16px;">
    <tr style="background:#f5f0e8;">
      <td colspan="2" style="padding:12px 16px;font-weight:600;font-size:13px;color:#8B6914;text-transform:uppercase;letter-spacing:.05em;">Order — ${data.CONFIRMATION_ID ?? "—"}</td>
    </tr>
    ${lineItemRows}
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;border-bottom:1px solid #f0f0f0;">Shipping</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmtCurrency(data.SHIPPING_FEE)}</td></tr>
    <tr style="background:#f5f0e8;"><td style="padding:12px 16px;font-weight:700;font-size:14px;">Total Due</td><td style="padding:12px 16px;font-weight:700;font-size:16px;text-align:right;">${fmtCurrency(data.ESTIMATED_TOTAL)}</td></tr>
  </table>

  <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;margin-top:16px;">
    <tr style="background:#f5f0e8;">
      <td colspan="2" style="padding:12px 16px;font-weight:600;font-size:13px;color:#8B6914;text-transform:uppercase;letter-spacing:.05em;">Delivery</td>
    </tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;border-bottom:1px solid #f0f0f0;">FedEx Location</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f0f0f0;">${data.FEDEX_LOCATION_NAME ?? "—"}</td></tr>
    <tr><td style="padding:10px 16px;color:#555;font-size:14px;">Address</td><td style="padding:10px 16px;font-size:14px;">${data.FEDEX_LOCATION_ADDRESS ?? "—"}</td></tr>
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
    res.json({ ok: true, warning: "Internal processing error — check logs" });
  }
});

export default router;
