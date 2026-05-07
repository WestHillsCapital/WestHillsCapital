import { z } from "zod";

// ── Ping ─────────────────────────────────────────────────────────────────────
// Health-check job used to validate the queue round-trip on startup.

export const PingJobPayloadSchema = z.object({
  timestamp: z.number(),
});
export type PingJobPayload = z.infer<typeof PingJobPayloadSchema>;
