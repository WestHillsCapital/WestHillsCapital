import "./instrument.js";
import * as Sentry from "@sentry/node";
import { isQueueEnabled } from "./lib/queue.js";
import { logger } from "./lib/logger.js";
import { initDb, runDrizzleMigrations } from "./db.js";
import { registerGeneratePdfProcessor, registerDeliverWebhookProcessor } from "./routes/docufill.js";

if (!isQueueEnabled()) {
  logger.error(
    "[PDFWorker] REDIS_URL is not set — worker cannot run without Redis. " +
      "Set REDIS_URL in Railway environment variables and restart.",
  );
  process.exit(1);
}

logger.info("[PDFWorker] Starting worker...");

const shouldMigrate =
  process.env.NODE_ENV !== "production" || process.env.RUN_MIGRATIONS === "true";

(shouldMigrate ? runDrizzleMigrations() : Promise.resolve())
  .then(() => initDb())
  .then(() => {
    logger.info("[PDFWorker] Database ready — registering processors");

    // ── generate-pdf processor ──────────────────────────────────────────────
    const pdfWorker = registerGeneratePdfProcessor();
    if (!pdfWorker) {
      logger.error("[PDFWorker] Failed to register generate-pdf processor — queue not available");
      process.exit(1);
    }

    pdfWorker.on("completed", (job: { id?: string }) => {
      logger.info({ jobId: job.id }, "[PDFWorker] generate-pdf job completed");
    });
    pdfWorker.on("failed", (job: { id?: string } | undefined, err: unknown) => {
      logger.error({ jobId: job?.id, err }, "[PDFWorker] generate-pdf job failed");
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
        tags: { queue: "generate-pdf" },
      });
    });

    // ── deliver-webhook processor ───────────────────────────────────────────
    const webhookWorker = registerDeliverWebhookProcessor();
    if (!webhookWorker) {
      logger.warn("[PDFWorker] deliver-webhook processor not registered — queue not available");
    } else {
      webhookWorker.on("failed", (job: { id?: string } | undefined, err: unknown) => {
        logger.error({ jobId: job?.id, err }, "[PDFWorker] deliver-webhook job exhausted all retries");
        Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
          tags: { queue: "deliver-webhook" },
        });
      });
    }

    logger.info("[PDFWorker] All workers ready");
  })
  .catch((err: unknown) => {
    logger.error({ err }, "[PDFWorker] Startup failed");
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
    process.exit(1);
  });

async function shutdown(signal: string) {
  logger.info({ signal }, "[PDFWorker] Shutdown signal received — exiting cleanly");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "[PDFWorker] Unhandled promise rejection — exiting");
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "[PDFWorker] Uncaught exception — exiting");
  Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
