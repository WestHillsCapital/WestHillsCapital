import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    environment: process.env.NODE_ENV ?? "development",
  });
} else {
  console.warn("[Sentry] SENTRY_DSN not set — error reporting disabled");
}
