/**
 * Webhook verification helpers.
 *
 * Docuplete signs every outbound webhook delivery with a per-package HMAC-SHA256
 * secret. The signature is sent in the `X-Docuplete-Signature` header as:
 *
 *   sha256=<hex-encoded-hmac>
 *
 * Always verify this signature before processing the payload.
 *
 * Retrieve your package's signing secret via:
 *   GET /api/v1/packages/:id/webhook-secret  (admin API key required)
 */

/** Shape of a `interview.submitted` webhook payload. */
export interface WebhookPayload {
  event: "interview.submitted";
  packageId: number;
  packageName: string;
  sessionToken: string;
  submittedAt: string;
  prefill: Record<string, unknown>;
  answers: Record<string, unknown>;
  generatedPdfUrl: string | null;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Only safe for strings of the same length (both are hex digests here).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function computeHmac(secret: string, payload: string): Promise<string> {
  // Node.js ≥ 18 — use the Web Crypto API (works in edge runtimes too)
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback: Node.js `node:crypto` module (CommonJS / older environments)
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verifies the `X-Docuplete-Signature` header on an incoming webhook.
 *
 * @param rawBody   The raw request body as a string (do NOT parse as JSON first)
 * @param signature The value of the `X-Docuplete-Signature` header
 * @param secret    Your package's webhook signing secret (`wh_...`)
 * @returns `true` if the signature is valid, `false` otherwise
 *
 * @example
 * ```ts
 * import express from "express";
 * import { verifyWebhookSignature } from "@docuplete/sdk";
 *
 * app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
 *   const sig = req.headers["x-docuplete-signature"] as string;
 *   const valid = await verifyWebhookSignature(req.body.toString(), sig, process.env.WEBHOOK_SECRET!);
 *   if (!valid) return res.status(401).send("Invalid signature");
 *   const payload = JSON.parse(req.body.toString());
 *   // handle payload ...
 *   res.sendStatus(200);
 * });
 * ```
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const expected = "sha256=" + (await computeHmac(secret, rawBody));
  const received = signature.trim();
  return timingSafeEqual(expected, received);
}

/**
 * Parses and verifies a webhook request in one step.
 * Throws if the signature is invalid.
 *
 * @param rawBody   The raw request body as a string
 * @param signature The value of the `X-Docuplete-Signature` header
 * @param secret    Your package's webhook signing secret
 * @returns The parsed `WebhookPayload`
 * @throws  `Error` with message "Invalid webhook signature" if verification fails
 */
export async function constructWebhookEvent(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<WebhookPayload> {
  const valid = await verifyWebhookSignature(rawBody, signature, secret);
  if (!valid) throw new Error("Invalid webhook signature");
  return JSON.parse(rawBody) as WebhookPayload;
}
