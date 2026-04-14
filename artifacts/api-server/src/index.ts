import app from "./app";
import { logger } from "./lib/logger";
import { initDb } from "./db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Start listening immediately so Railway's healthcheck can reach /healthz
// before the database finishes initialising (cold-start DB connections on
// Railway can take 20-40 s, which exceeds the default 30 s healthcheck timeout).
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

// Initialise the database after the server is already accepting requests.
// If initDb fails the process exits and Railway will restart the container.
initDb()
  .then(() => {
    logger.info("Database tables and indexes ready");
  })
  .catch((err) => {
    const detail = err instanceof Error ? err.message : String(err);
    logger.error({ err }, `Database initialisation failed: ${detail} — exiting`);
    process.exit(1);
  });
