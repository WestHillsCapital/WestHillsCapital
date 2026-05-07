import "./instrument.js";
import * as Sentry from "@sentry/node";
import { isQueueEnabled, createQueueWorker, QUEUE_NAMES } from "@workspace/queues";
import { logger } from "./logger.js";
import { pingProcessor } from "./processors/ping.js";

if (!isQueueEnabled()) {
  logger.error(
    "[Worker] REDIS_URL is not set — worker cannot run without Redis. " +
      "Set REDIS_URL in Railway environment variables and restart."
  );
  process.exit(1);
}

logger.info("[Worker] Starting job worker...");

// ── Register processors ───────────────────────────────────────────────────────

const pingWorker = createQueueWorker(QUEUE_NAMES.PING, pingProcessor, {
  concurrency: 2,
});

if (!pingWorker) {
  logger.error("[Worker] Failed to create ping worker");
  process.exit(1);
}

pingWorker.on("completed", (job: { id?: string }) => {
  logger.info({ jobId: job.id }, "[Worker:Ping] Job completed");
});

pingWorker.on("failed", (job: { id?: string } | undefined, err: unknown) => {
  logger.error({ jobId: job?.id, err }, "[Worker:Ping] Job failed");
  Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
    tags: { queue: QUEUE_NAMES.PING },
  });
});

logger.info("[Worker] All processors registered — listening for jobs");

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  logger.info({ signal }, "[Worker] Shutdown signal received — draining workers");
  await Promise.allSettled([pingWorker!.close()]);
  logger.info("[Worker] Workers closed cleanly");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "[Worker] Unhandled promise rejection — exiting");
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "[Worker] Uncaught exception — exiting");
  Sentry.captureException(err);
  process.exit(1);
});
