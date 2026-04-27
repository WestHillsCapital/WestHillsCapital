import "./instrument.js";
import * as Sentry from "@sentry/node";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "node:path";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import sitemapRouter from "./routes/sitemap";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/errorHandler";
import { dbReady, dbError } from "./db";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import { WebhookHandlers } from "./lib/stripeWebhookHandlers";
import { handleStripeSubscriptionEvent } from "./lib/stripeBillingSync";

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

// Normalize an origin by stripping a leading "www." subdomain so that
// https://www.westhillscapital.com matches https://westhillscapital.com in
// the allowed-origins list (and vice-versa), handling both DNS configurations.
function normalizeOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    if (u.hostname.startsWith("www.")) {
      u.hostname = u.hostname.slice(4);
    }
    return u.origin;
  } catch {
    return origin;
  }
}

app.use(
  cors({
    origin: allowedOrigins
      ? (origin, cb) => {
          // Allow server-to-server requests (no Origin header).
          // Check both the raw origin and its www-normalized form so that
          // https://www.example.com matches an entry of https://example.com.
          if (!origin || allowedOrigins.has(origin) || allowedOrigins.has(normalizeOrigin(origin))) {
            cb(null, true);
          } else {
            cb(new Error(`CORS: origin ${origin} is not allowed`));
          }
        }
      : "*",
    methods:          ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders:   ["Content-Type", "Authorization", "X-Requested-With", "X-File-Name", "X-Document-Title"],
    optionsSuccessStatus: 200,
  }),
);

// ── Stripe webhook (must be before body parsers — needs raw Buffer) ───────────
// stripe-replit-sync verifies the signature and syncs data to stripe.* tables.
// handleStripeSubscriptionEvent also updates our own accounts table.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      if (!Buffer.isBuffer(req.body)) {
        logger.error("[StripeWebhook] Body is not a Buffer — express.json() ran first");
        res.status(500).json({ error: "Webhook processing error" });
        return;
      }
      // 1. Let StripeSync verify signature + sync to stripe schema (throws on invalid sig)
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      // 2. Parse event (already verified) and update our accounts table.
      // Throw on failure so the outer catch returns non-2xx and Stripe retries.
      const event = JSON.parse((req.body as Buffer).toString()) as {
        type: string;
        data: { object: Record<string, unknown> };
      };
      await handleStripeSubscriptionEvent(event);
      res.status(200).json({ received: true });
    } catch (err) {
      const isValidationError = err instanceof Error &&
        (err.message.includes("signature") || err.message.includes("invalid") || err.message.includes("timestamp"));
      logger.error({ err }, "[StripeWebhook] Webhook processing failed");
      // 400 → invalid signature / validation error (Stripe won't retry)
      // 500 → internal processing error (Stripe will retry per its retry schedule)
      res.status(isValidationError ? 400 : 500).json({ error: "Webhook processing error" });
    }
  },
);

// ── Clerk proxy (must be before body parsers — streams raw bytes) ──────────────
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Health check (must be before clerkMiddleware — no auth required) ──────────
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

// ── Clerk middleware (attaches auth state to every request) ───────────────────
app.use(clerkMiddleware());

// ── Request timeout ────────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: "Request timed out" });
    }
  });
  next();
});

// ── Root-level sitemap (must be before /api router) ───────────────────────────
app.use(sitemapRouter);

// ── Static logo — stable URL for emails and email signatures ──────────────────
// Served at the root level (not under /api) so the URL is independent of the
// marketing website and never breaks when the website changes.
// URL: https://workspaceapi-server-production-987b.up.railway.app/images/logo.png
app.get("/images/logo.png", (_req, res) => {
  const logoPath = path.join(__dirname, "../public/images/logo.png");
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  res.sendFile(logoPath);
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Debug-only Sentry test route (must be before 404 catch-all) ───────────────
// Hit GET /api/debug-sentry to verify the Sentry connection after a deploy.
app.get("/api/debug-sentry", (_req, _res) => {
  throw new Error("Sentry test error — if you see this in Sentry, the integration is working.");
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── Sentry error handler (must come before our error handler) ─────────────────
// Captures unhandled Express errors and attaches a Sentry event ID to the
// request so it can be referenced in support. Only active when SENTRY_DSN is set.
Sentry.setupExpressErrorHandler(app);

// ── Global error handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

export default app;
