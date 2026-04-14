/**
 * Global Express error handler.
 *
 * Catches any error thrown (or passed to next(err)) from a route handler and
 * returns a consistent JSON error response. Without this, Express falls back to
 * an HTML error page, which breaks API clients.
 *
 * Register LAST in app.ts — after all routes.
 */
import type { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const status: number =
    typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;

  const message: string =
    err instanceof Error ? err.message : "Internal server error";

  logger.error(
    {
      err,
      method: req.method,
      url:    req.url?.split("?")[0],
      status,
    },
    `Unhandled error: ${message}`
  );

  if (!res.headersSent) {
    res.status(status).json({ error: message });
  }
};
