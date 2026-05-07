import {
  isQueueEnabled,
  createQueue,
  QUEUE_NAMES,
  type PingJobPayload,
  type GeneratePdfJobPayload,
  type DeliverWebhookJobPayload,
} from "@workspace/queues";
import { logger } from "./logger.js";

// ── Queues ────────────────────────────────────────────────────────────────────
// Each queue is created once and exported for use anywhere in the API server.
// All queues are null when REDIS_URL is not configured (disabled / dev mode).

export const pingQueue = createQueue<PingJobPayload>(QUEUE_NAMES.PING);
export const generatePdfQueue = createQueue<GeneratePdfJobPayload>(QUEUE_NAMES.GENERATE_PDF);
export const deliverWebhookQueue = createQueue<DeliverWebhookJobPayload>(QUEUE_NAMES.DELIVER_WEBHOOK);

// ── Startup probe ─────────────────────────────────────────────────────────────
// Enqueues a no-op ping job to verify the queue round-trip is working.
// Non-fatal: a queue failure must never crash the API server.
export async function enqueuePingJob(): Promise<void> {
  if (!isQueueEnabled()) {
    logger.warn(
      "[Queue] REDIS_URL is not set — job queue disabled. " +
        "Set REDIS_URL in Railway environment variables to enable background jobs."
    );
    return;
  }
  try {
    await pingQueue!.add(QUEUE_NAMES.PING, { timestamp: Date.now() });
    logger.info("[Queue] Startup ping job enqueued");
  } catch (err) {
    logger.error({ err }, "[Queue] Failed to enqueue startup ping job (non-fatal)");
  }
}

// ── Generate PDF job enqueue ──────────────────────────────────────────────────
// Throws if the queue is unavailable — callers must handle this and return 503.
export async function enqueueGeneratePdfJob(payload: GeneratePdfJobPayload): Promise<string> {
  if (!isQueueEnabled() || !generatePdfQueue) {
    throw new Error("Job queue is not available. REDIS_URL is not configured.");
  }
  const job = await generatePdfQueue.add(QUEUE_NAMES.GENERATE_PDF, payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 1_000 },
    removeOnFail: { count: 500 },
  });
  return job.id!;
}

// ── Deliver Webhook job enqueue ───────────────────────────────────────────────
// Non-throwing: returns null when queue unavailable so callers can fall back
// to the synchronous fireWebhookAsync path.
export async function enqueueDeliverWebhookJob(
  payload: DeliverWebhookJobPayload,
): Promise<string | null> {
  if (!isQueueEnabled() || !deliverWebhookQueue) {
    return null;
  }
  try {
    const job = await deliverWebhookQueue.add(QUEUE_NAMES.DELIVER_WEBHOOK, payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 500 },
    });
    return job.id!;
  } catch (err) {
    logger.error({ err }, "[Queue] Failed to enqueue deliver-webhook job");
    return null;
  }
}

// Re-export so route files can use without importing @workspace/queues directly
export { isQueueEnabled };

// ── Queue status (for /api/internal/queue-status) ────────────────────────────
export async function getQueueStatus(): Promise<Record<string, unknown>> {
  if (!isQueueEnabled()) {
    return { enabled: false, reason: "REDIS_URL not configured" };
  }
  try {
    const getCounts = async (q: { getWaitingCount(): Promise<number>; getActiveCount(): Promise<number>; getCompletedCount(): Promise<number>; getFailedCount(): Promise<number>; getDelayedCount(): Promise<number> } | null) =>
      q
        ? Promise.all([
            q.getWaitingCount(),
            q.getActiveCount(),
            q.getCompletedCount(),
            q.getFailedCount(),
            q.getDelayedCount(),
          ]).then(([waiting, active, completed, failed, delayed]) => ({
            waiting,
            active,
            completed,
            failed,
            delayed,
          }))
        : null;

    const [pingCounts, pdfCounts, webhookCounts] = await Promise.all([
      getCounts(pingQueue),
      getCounts(generatePdfQueue),
      getCounts(deliverWebhookQueue),
    ]);
    return {
      enabled: true,
      queues: {
        ...(pingCounts    ? { [QUEUE_NAMES.PING]:            pingCounts    } : {}),
        ...(pdfCounts     ? { [QUEUE_NAMES.GENERATE_PDF]:    pdfCounts     } : {}),
        ...(webhookCounts ? { [QUEUE_NAMES.DELIVER_WEBHOOK]: webhookCounts } : {}),
      },
    };
  } catch (err) {
    return { enabled: true, error: err instanceof Error ? err.message : String(err) };
  }
}
