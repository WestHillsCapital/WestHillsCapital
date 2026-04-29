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
export declare function verifyWebhookSignature(rawBody: string, signature: string, secret: string): Promise<boolean>;
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
export declare function constructWebhookEvent(rawBody: string, signature: string, secret: string): Promise<WebhookPayload>;
//# sourceMappingURL=webhooks.d.ts.map