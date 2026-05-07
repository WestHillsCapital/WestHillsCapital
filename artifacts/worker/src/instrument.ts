import * as Sentry from "@sentry/node";

if (process.env["SENTRY_DSN"]) {
  Sentry.init({
    dsn: process.env["SENTRY_DSN"],
    environment: process.env["NODE_ENV"] ?? "development",
    sendDefaultPii: false,
  });
  console.log("[Worker] Sentry initialized");
} else if (process.env["NODE_ENV"] === "production") {
  console.error("[Worker] WARNING: SENTRY_DSN is not set — error monitoring disabled in production");
}
