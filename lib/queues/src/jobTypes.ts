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
