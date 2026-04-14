import { Server } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { initDb } from "./db";
import { validateConfig } from "./lib/config";

// ── 1. Validate configuration before anything else ────────────────────────────
// Logs all env var statuses and exits immediately if required vars are missing.
// Also logs the DB hostname so Railway logs confirm the correct Postgres target.
validateConfig();

// ── 2. Resolve port ───────────────────────────────────────────────────────────
const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── 3. Start listening immediately ────────────────────────────────────────────
// Railway's healthcheck probe hits /healthz within seconds of container start.
// Starting the server before initDb() ensures the probe always finds a live
// server rather than timing out while Postgres schema migrations run.
const server: Server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

// ── 4. Initialise the database ────────────────────────────────────────────────
// Runs concurrently with the server. If it fails, the process exits so
// Railway restarts the container (typically because DATABASE_URL is misconfigured).
initDb()
  .then(() => {
    logger.info("Database ready — all systems operational");
  })
  .catch((err) => {
    const detail = err instanceof Error ? err.message : String(err);
    logger.error({ err }, `Database initialisation failed: ${detail} — exiting`);
    server.close(() => process.exit(1));
    setTimeout(() => process.exit(1), 5_000).unref();
  });

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
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — exiting");
  process.exit(1);
});
