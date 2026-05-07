import { z } from "zod";

// ── Ping ──────────────────────────────────────────────────────────────────────
// Health-check job used to validate the queue round-trip on startup.

export const PingJobPayloadSchema = z.object({
  timestamp: z.number(),
});
export type PingJobPayload = z.infer<typeof PingJobPayloadSchema>;

// ── GeneratePdf ───────────────────────────────────────────────────────────────
// Enqueued by the public generate endpoint. Processed by the api-server
// BullMQ worker where all PDF-building helpers are in scope.
//
// The signature/initials images are base64 PNG data URLs (≤200KB / ≤100KB
// respectively) captured from the HTTP request before it returns 202.
// The signer audit context (IP, UA, geo) is also captured at request time.

// ── DeliverWebhook ─────────────────────────────────────────────────────────────
// Enqueued by the generate-pdf worker after the PDF job completes.
// Processed by the same worker process so it has DB access to fetch
// the signing secret and write to webhook_deliveries.
// The pre-built payload is captured at submission time (answers already redacted).

export const DeliverWebhookJobPayloadSchema = z.object({
  sessionToken: z.string(),
  packageId: z.number().int(),
  accountId: z.number().int(),
  eventType: z.string().default("interview.submitted"),
  webhookUrl: z.string().url(),
  payload: z.record(z.unknown()),
});
export type DeliverWebhookJobPayload = z.infer<typeof DeliverWebhookJobPayloadSchema>;

// ── GeneratePdf ───────────────────────────────────────────────────────────────
export const GeneratePdfJobPayloadSchema = z.object({
  sessionToken: z.string(),
  type: z.enum(["packet", "signed", "preview"]),
  accountId: z.string().nullable().optional(),
  esignEmail: z.string().nullable().optional(),
  esignSignerName: z.string().nullable().optional(),
  esignSignatureImage: z.string().nullable().optional(),
  esignInitialsImage: z.string().nullable().optional(),
  signerIp: z.string().nullable().optional(),
  signerUa: z.string().nullable().optional(),
  signerGeo: z.string().nullable().optional(),
});
export type GeneratePdfJobPayload = z.infer<typeof GeneratePdfJobPayloadSchema>;
