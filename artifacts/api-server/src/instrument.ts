import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // sendDefaultPii defaults to false — explicitly kept false to prevent
    // Sentry from capturing IP addresses, cookies, and request bodies and
    // transmitting them to a third-party service (SOC 2 CC6.1).
    sendDefaultPii: false,
    environment: process.env.NODE_ENV ?? "development",
  });
} else if (process.env.NODE_ENV === "production") {
  // Emit to stderr so this is always visible in Railway logs even before the
  // pino logger is initialised. index.ts will also emit a structured
  // logger.error once the logger is available.
  console.error("[Sentry] ERROR: SENTRY_DSN is not set — error monitoring disabled in production");
} else {
  console.warn("[Sentry] SENTRY_DSN not set — error reporting disabled");
}
