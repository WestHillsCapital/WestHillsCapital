import "./instrument.js";
import * as Sentry from "@sentry/node";
import { Server } from "node:http";
import app, { startCustomDomainCors } from "./app";
import { logger } from "./lib/logger";
import { initDb, runDrizzleMigrations } from "./db";
import { validateConfig } from "./lib/config";
import { ObjectStorageService } from "./lib/objectStorage";
import { enqueuePingJob } from "./lib/queue";

// ── 1. Resolve port ───────────────────────────────────────────────────────────
const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── 2. Start listening immediately ────────────────────────────────────────────
// Railway's healthcheck probe hits /healthz within seconds of container start.
// The server binds and responds to /healthz BEFORE config validation or DB init
// runs, so Railway always receives at least one healthy probe regardless of
// whether DATABASE_URL or other required vars are present.
const server: Server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
  logger.info(
    { logoUrl: "https://workspaceapi-server-production-987b.up.railway.app/images/logo.png" },
    "[Logo] Stable logo URL — use this in your email client signature",
  );

  // ── 3. Validate configuration after port is bound ─────────────────────────
  // Logs all env var statuses. If a required var is missing, close the server
  // and exit gracefully — Railway will have already received a healthy probe.
  try {
    validateConfig();
  } catch (err) {
    logger.error({ err }, "Configuration invalid — shutting down");
    server.close(() => process.exit(1));
    setTimeout(() => process.exit(1), 5_000).unref();
    return;
  }

  // ── 3b. Sentry monitoring assertion ───────────────────────────────────────
  // instrument.ts already emits console.error before pino is available. This
  // structured logger.error fires once the logger is ready so the absence of
  // error monitoring is visible as a distinct ERROR-level entry in Railway logs
  // and in any log-based alerting (SOC 2 CC6.1 compliance).
  if (process.env.NODE_ENV === "production" && !process.env.SENTRY_DSN) {
    logger.error(
      "[Sentry] SENTRY_DSN is not set — error monitoring is disabled in production. " +
      "Set SENTRY_DSN in environment variables to enable Sentry error reporting."
    );
  }

  // ── 3c. Storage readiness probe ───────────────────────────────────────────
  // Non-fatal: warns immediately if PRIVATE_OBJECT_DIR or GCS credentials are
  // absent so the issue is visible in Railway logs at deploy time rather than
  // surfacing silently as a 500 when someone first tries to upload a logo.
  try {
    new ObjectStorageService().getPrivateObjectDir();
    const hasCredentials = !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.REPL_ID || process.env.REPLIT_DOMAINS);
    if (!hasCredentials) {
      logger.warn(
        "Object storage: GOOGLE_SERVICE_ACCOUNT_KEY is not set and Replit sidecar is unavailable — logo uploads will fail. " +
        "Set GOOGLE_SERVICE_ACCOUNT_KEY in Railway environment variables."
      );
    } else {
      logger.info("Object storage: PRIVATE_OBJECT_DIR and GCS credentials present");
    }
  } catch {
    logger.warn(
      "Object storage: PRIVATE_OBJECT_DIR is not set — logo and file uploads will return 503. " +
      "Set PRIVATE_OBJECT_DIR in Railway environment variables."
    );
  }

  // ── 3d. Content Engine AI integration probe ───────────────────────────────
  const hasReplitProxy = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const hasDirectKey   = !!process.env.ANTHROPIC_API_KEY;
  if (hasReplitProxy) {
    logger.info("[Content] Anthropic AI integration present (Replit proxy) — draft generation enabled.");
  } else if (hasDirectKey) {
    logger.info("[Content] Anthropic AI integration present (direct API key) — draft generation enabled.");
  } else {
    logger.warn(
      "[Content] Anthropic AI not configured — draft generation will fail. " +
      "Set ANTHROPIC_API_KEY in Railway environment variables."
    );
  }

  // ── 3e. Encryption-at-rest key probe ──────────────────────────────────────
  if (!process.env.ENCRYPTION_MASTER_KEY) {
    logger.warn(
      "[Encryption] ENCRYPTION_MASTER_KEY is not set — PII fields will be stored in plaintext. " +
      "Set a 64-char hex value (32 random bytes) in environment variables to enable encryption at rest."
    );
  } else {
    const keyLen = Buffer.from(process.env.ENCRYPTION_MASTER_KEY, "hex").length;
    if (keyLen !== 32) {
      logger.warn(
        `[Encryption] ENCRYPTION_MASTER_KEY is ${keyLen} bytes — expected 32 bytes (64 hex chars). Encryption disabled.`
      );
    } else {
      logger.info("[Encryption] ENCRYPTION_MASTER_KEY present — AES-256-GCM encryption at rest enabled.");
    }
  }

  // ── 4. Initialise the database ──────────────────────────────────────────────
  // Runs after the server is confirmed listening and config is valid.
  // runDrizzleMigrations is non-fatal: it baselines existing DBs and runs all
  // tracked SQL migrations on fresh ones. initDb() then applies any remaining
  // idempotent CREATE TABLE IF NOT EXISTS / ALTER TABLE operations.
  // If initDb fails, close the server so Railway restarts the container.
  // Drizzle tracked migrations run automatically in development (and in
  // production when RUN_MIGRATIONS=true is set for on-demand rollouts).
  const shouldMigrate = process.env.NODE_ENV !== "production" || process.env.RUN_MIGRATIONS === "true";
  (shouldMigrate ? runDrizzleMigrations() : Promise.resolve())
    .then(() => initDb())
    .then(async () => {
      logger.info("Database ready — all systems operational");
      // Seed CORS custom-domain cache immediately and start 60-second refresh.
      startCustomDomainCors();
      // Verify job queue round-trip on startup (non-fatal if Redis not configured)
      void enqueuePingJob();
      // Initialize Stripe after DB is ready (non-fatal if it fails)
      void initStripe();
      // Fulfillment scheduler and tracking sync now run as BullMQ repeatable
      // jobs in the worker process — see worker.ts for the registration.
    })
    .catch((err) => {
      const detail = err instanceof Error ? err.message : String(err);
      logger.error({ err }, `Database initialisation failed: ${detail} — exiting`);
      server.close(() => process.exit(1));
      setTimeout(() => process.exit(1), 5_000).unref();
    });
});

async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return; // no DB — skip silently (healthcheck will catch it)

  try {
    const { runMigrations } = await import("stripe-replit-sync");
    logger.info("[Stripe] Initializing stripe schema...");
    await runMigrations({ databaseUrl });
    logger.info("[Stripe] stripe schema ready");

    // Managed webhook setup and backfill — non-fatal individually
    const { getStripeSync } = await import("./lib/stripeClient");
    const stripeSync = await getStripeSync();

    const webhookBaseUrl = process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : process.env.APP_ORIGIN ?? "";

    if (webhookBaseUrl) {
      try {
        await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
        logger.info("[Stripe] Webhook configured");
      } catch (webhookErr) {
        logger.warn({ err: webhookErr }, "[Stripe] Managed webhook setup failed — configure webhook manually in Stripe Dashboard if needed");
      }
    }

    // Sync backfill in background (non-fatal)
    stripeSync.syncBackfill()
      .then(() => logger.info("[Stripe] Backfill complete"))
      .catch((err: unknown) => logger.warn({ err }, "[Stripe] Backfill failed (non-fatal)"));

  } catch (err) {
    // Log but do not exit — Stripe is degraded, not fatal
    logger.warn({ err }, "[Stripe] Stripe initialization failed (non-fatal — billing may be unavailable)");
  }
}

// ── 5. Graceful shutdown ──────────────────────────────────────────────────────
// Railway sends SIGTERM before killing the container. Waiting for in-flight
// requests to finish avoids dropped connections and mid-write data corruption.
function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received — draining connections");
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error during server close");
      process.exit(1);
    }
    logger.info("Server closed cleanly");
    process.exit(0);
  });
  // Force exit after 10 s in case connections don't drain
  setTimeout(() => {
    logger.warn("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// ── 6. Catch unhandled rejections and exceptions ──────────────────────────────
// These are programming errors. Log them clearly and exit so Railway restarts.
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection — exiting");
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — exiting");
  Sentry.captureException(err);
  process.exit(1);
});
