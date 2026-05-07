import {
  isQueueEnabled,
  createQueue,
  QUEUE_NAMES,
  type PingJobPayload,
} from "@workspace/queues";
import { logger } from "./logger.js";

// ── Queues ────────────────────────────────────────────────────────────────────
// Each queue is created once and exported for use anywhere in the API server.
// All queues are null when REDIS_URL is not configured (disabled / dev mode).

export const pingQueue = createQueue<PingJobPayload>(QUEUE_NAMES.PING);

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

// ── Queue status (for /api/internal/queue-status) ────────────────────────────
export async function getQueueStatus(): Promise<Record<string, unknown>> {
  if (!isQueueEnabled() || !pingQueue) {
    return { enabled: false, reason: "REDIS_URL not configured" };
  }
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      pingQueue.getWaitingCount(),
      pingQueue.getActiveCount(),
      pingQueue.getCompletedCount(),
      pingQueue.getFailedCount(),
      pingQueue.getDelayedCount(),
    ]);
    return {
      enabled: true,
      queues: {
        [QUEUE_NAMES.PING]: { waiting, active, completed, failed, delayed },
      },
    };
  } catch (err) {
    return { enabled: true, error: err instanceof Error ? err.message : String(err) };
  }
}
