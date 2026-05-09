/**
 * Webhook verification helpers.
 *
 * Docuplete signs every outbound webhook delivery with a per-package HMAC-SHA256
 * secret. The signature is sent in the `X-Docuplete-Signature` header as:
 *
 *   sha256=<hex-encoded-hmac>
 *
 * Always verify this signature before processing the payload.
 */

// ── Event payload types ───────────────────────────────────────────────────────

/** Common fields present on every webhook event. */
interface BaseWebhookPayload {
  /** The event type. */
  event: string;
  /** Numeric ID of the package this session belongs to. */
  packageId: number;
  /** Human-readable package name. */
  packageName: string;
  /** The unique session token (`df_...`). */
  sessionToken: string;
}

/** Fired when a new session is created via the API. */
export interface SessionCreatedPayload extends BaseWebhookPayload {
  event: "session.created";
  createdAt: string;
  /** Prefill values passed at creation time. */
  prefill: Record<string, unknown>;
  expiresAt: string | null;
  source: string;
}

/** Fired the first time a recipient opens the interview link. */
export interface SessionViewedPayload extends BaseWebhookPayload {
  event: "session.viewed";
  viewedAt: string;
  prefill: Record<string, unknown>;
}

/** Fired when a recipient submits their first answer (interview started). */
export interface SessionStartedPayload extends BaseWebhookPayload {
  event: "session.started";
  startedAt: string;
  prefill: Record<string, unknown>;
}

/** Fired when the recipient completes the full interview form. */
export interface SessionSubmittedPayload extends BaseWebhookPayload {
  event: "session.submitted";
  submittedAt: string;
  prefill: Record<string, unknown>;
  /** Submitted answers — sensitive fields are redacted. */
  answers: Record<string, unknown>;
}

/**
 * Fired when the final PDF packet has been generated and is ready.
 * Includes a 24-hour signed download URL.
 *
 * @deprecated Use `pdf.generated` for new integrations. `interview.submitted`
 * is kept for backward compatibility and fires at the same moment.
 */
export interface InterviewSubmittedPayload extends BaseWebhookPayload {
  event: "interview.submitted";
  submittedAt: string;
  prefill: Record<string, unknown>;
  answers: Record<string, unknown>;
  generatedPdfUrl: string | null;
}

/** Fired when the final PDF packet is generated and ready to download. */
export interface PdfGeneratedPayload extends BaseWebhookPayload {
  event: "pdf.generated";
  generatedAt: string;
  prefill: Record<string, unknown>;
  answers: Record<string, unknown>;
  /** Signed download URL valid for 24 hours. */
  downloadUrl: string | null;
}

/** Fired when a session is voided (link invalidated). */
export interface SessionVoidedPayload extends BaseWebhookPayload {
  event: "session.voided";
  voidedAt: string;
  reason: string | null;
  prefill: Record<string, unknown>;
}

/** Fired when a session link passes its expiry timestamp without submission. */
export interface SessionExpiredPayload extends BaseWebhookPayload {
  event: "session.expired";
  expiredAt: string;
  prefill: Record<string, unknown>;
}

/** Fired when a specific signer in a multi-party flow completes their portion. */
export interface SignerCompletedPayload extends BaseWebhookPayload {
  event: "signer.completed";
  signedAt: string;
  signerOrder: number;
  signerEmail: string;
  signerName: string | null;
  allSigned: boolean;
}

/**
 * Discriminated union of all possible Docuplete webhook payloads.
 *
 * Use the `event` field to narrow to the specific payload type:
 *
 * @example
 * ```ts
 * const payload = await constructWebhookEvent(rawBody, sig, secret);
 * switch (payload.event) {
 *   case "session.created":   handleCreated(payload);   break;
 *   case "session.submitted": handleSubmitted(payload); break;
 *   case "pdf.generated":     handleGenerated(payload); break;
 *   case "session.voided":    handleVoided(payload);    break;
 * }
 * ```
 */
export type WebhookPayload =
  | SessionCreatedPayload
  | SessionViewedPayload
  | SessionStartedPayload
  | SessionSubmittedPayload
  | InterviewSubmittedPayload
  | PdfGeneratedPayload
  | SessionVoidedPayload
  | SessionExpiredPayload
  | SignerCompletedPayload;

export type WebhookEventType = WebhookPayload["event"];

// ── Signature verification ────────────────────────────────────────────────────

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
 *
 * @example
 * ```ts
 * import express from "express";
 * import { constructWebhookEvent } from "@docuplete/sdk";
 *
 * app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
 *   const sig = req.headers["x-docuplete-signature"] as string;
 *   const payload = await constructWebhookEvent(req.body.toString(), sig, process.env.WEBHOOK_SECRET!);
 *   switch (payload.event) {
 *     case "pdf.generated": console.log("PDF ready:", payload.downloadUrl); break;
 *     case "session.voided": console.log("Session voided:", payload.reason); break;
 *   }
 *   res.sendStatus(200);
 * });
 * ```
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
