import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
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

// ── Trust proxy ────────────────────────────────────────────────────────────────
// Railway (and most PaaS providers) sit behind a load-balancer / reverse proxy.
// Without this setting, req.ip always resolves to the proxy's IP address, which
// breaks IP-based rate limiting (all clients share one bucket).
app.set("trust proxy", 1);

// ── Security headers (Helmet) ──────────────────────────────────────────────────
// Sets X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, etc.
// Content-Security-Policy is left to the frontend (Vite handles it).
app.use(
  helmet({
    contentSecurityPolicy: false, // managed by the Vite/CDN layer
    crossOriginEmbedderPolicy: false, // needed for Google OAuth iframe
  }),
);

// ── CORS ───────────────────────────────────────────────────────────────────────
// In production, restrict to the actual Vercel frontend domain.
// In development (CORS_ALLOWED_ORIGINS not set) allow all origins so the
// Replit dev preview can reach the API.
const CORS_ORIGINS_RAW =
  process.env.CORS_ALLOWED_ORIGINS ??
  process.env.FRONTEND_URL ??
  "";

const allowedOrigins = CORS_ORIGINS_RAW
  ? new Set(CORS_ORIGINS_RAW.split(",").map((o) => o.trim()).filter(Boolean))
  : null; // null → allow all

app.use(
  cors({
    origin: allowedOrigins
      ? (origin, cb) => {
          // Allow server-to-server requests (no Origin header) and listed origins
          if (!origin || allowedOrigins.has(origin)) {
            cb(null, true);
          } else {
            cb(new Error(`CORS: origin ${origin} is not allowed`));
          }
        }
      : "*",
    methods:          ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders:   ["Content-Type", "Authorization", "X-Requested-With"],
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
// `dryRun` is exposed so the frontend Deal Builder can display a warning banner.
app.get("/healthz", (_req, res) => {
  const db = dbReady ? "ready" : dbError ? "error" : "initializing";
  res.json({
    ok:     true,
    db,
    uptime: Math.floor(process.uptime()),
    dryRun: process.env.FIZTRADE_DRY_RUN === "true",
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
