import "./instrument.js";
import * as Sentry from "@sentry/node";
import { isQueueEnabled, QUEUE_NAMES, createQueueWorker, type SchedulerJobPayload } from "@workspace/queues";
import { logger } from "./lib/logger.js";
import { initDb, runDrizzleMigrations } from "./db.js";
import {
  pruneAuditTables,
  pruneRetainedSubmissions,
  pruneSessionData,
  processScheduledDeletions,
  purgeExpiredTrialData,
  purgeExpiredExports,
} from "./db.js";
import { schedulerQueue } from "./lib/queue.js";
import { pruneInternalSessions, runFulfillmentScheduler, runTrackingSync } from "./lib/schedulers.js";
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
  .then(async () => {
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

    // ── scheduler processor ─────────────────────────────────────────────────
    // Single worker handles all repeatable scheduler jobs by dispatching on
    // job.name. concurrency:1 ensures jobs don't run concurrently within one
    // worker instance; BullMQ's distributed lock prevents double-execution
    // across multiple worker instances.
    const schedulerWorker = createQueueWorker<SchedulerJobPayload>(
      QUEUE_NAMES.SCHEDULER,
      async (job) => {
        switch (job.name) {
          case "prune:sessions":            return pruneInternalSessions();
          case "prune:audit-tables":        return pruneAuditTables();
          case "prune:submissions":         return pruneRetainedSubmissions();
          case "prune:session-data":        return pruneSessionData();
          case "purge:scheduled-deletions": return processScheduledDeletions();
          case "purge:trial-data":          return purgeExpiredTrialData();
          case "expire:exports":            return purgeExpiredExports();
          case "scheduler:fulfillment":     return runFulfillmentScheduler();
          case "scheduler:tracking-sync":   return runTrackingSync();
          default:
            logger.warn({ jobName: job.name }, "[Scheduler] Unknown scheduler job name — skipping");
        }
      },
      { concurrency: 1 },
    );

    if (!schedulerWorker) {
      logger.warn("[PDFWorker] Scheduler worker not registered — queue not available");
    } else {
      schedulerWorker.on("failed", (job: { id?: string; name?: string } | undefined, err: unknown) => {
        logger.error({ jobId: job?.id, jobName: job?.name, err }, "[Scheduler] Scheduler job failed");
        Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
          tags: { queue: "scheduler", jobName: job?.name ?? "unknown" },
        });
      });
    }

    // ── Register repeatable job schedulers ──────────────────────────────────
    // upsertJobScheduler is idempotent — safe to call on every worker restart.
    // BullMQ deduplicates by schedulerId and only updates timing if it changed.
    if (schedulerQueue) {
      const SCHEDULER_JOBS: Array<{ id: string; every: number }> = [
        { id: "prune:sessions",            every: 15 * 60 * 1000        },
        { id: "prune:audit-tables",        every: 24 * 60 * 60 * 1000  },
        { id: "prune:submissions",         every: 24 * 60 * 60 * 1000  },
        { id: "prune:session-data",        every: 24 * 60 * 60 * 1000  },
        { id: "purge:scheduled-deletions", every:  6 * 60 * 60 * 1000  },
        { id: "purge:trial-data",          every:  6 * 60 * 60 * 1000  },
        { id: "expire:exports",            every:  6 * 60 * 60 * 1000  },
        { id: "scheduler:fulfillment",     every: 15 * 60 * 1000        },
        { id: "scheduler:tracking-sync",   every: 15 * 60 * 1000        },
      ];

      for (const { id, every } of SCHEDULER_JOBS) {
        try {
          await schedulerQueue.upsertJobScheduler(id, { every }, { name: id, data: {} });
          logger.debug({ schedulerId: id, everyMs: every }, "[Scheduler] Job scheduler registered");
        } catch (err) {
          logger.error({ err, schedulerId: id }, "[Scheduler] Failed to register job scheduler");
        }
      }

      logger.info(
        { count: SCHEDULER_JOBS.length },
        "[PDFWorker] All scheduler jobs registered — listening for jobs",
      );
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
