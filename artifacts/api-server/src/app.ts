import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/errorHandler";
import { dbReady, dbError } from "./db";

// Request timeout: abort any request that hasn't completed within 30 s.
// Prevents slow upstream calls (Sheets, Google Calendar, Dillon Gage API)
// from holding connections open indefinitely.
const REQUEST_TIMEOUT_MS = 30_000;

const app: Express = express();

// ── Structured request logging ─────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id:     req.id,
          method: req.method,
          url:    req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 200,
  }),
);

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Request timeout ────────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: "Request timed out" });
    }
  });
  next();
});

// ── Health check ───────────────────────────────────────────────────────────────
// Always returns HTTP 200 so Railway's network probe succeeds immediately.
// The `db` field exposes readiness state for monitoring without blocking.
app.get("/healthz", (_req, res) => {
  const db = dbReady ? "ready" : dbError ? "error" : "initializing";
  res.json({
    ok:     true,
    db,
    uptime: Math.floor(process.uptime()),
  });
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

export default app;
