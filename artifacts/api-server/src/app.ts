import "./instrument.js";
import * as Sentry from "@sentry/node";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "node:path";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import sitemapRouter from "./routes/sitemap";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/errorHandler";
import { requireInternalAuth } from "./middleware/requireInternalAuth";
import { dbReady, dbError, getDb } from "./db";
import { getQueueStatus } from "./lib/queue";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import { WebhookHandlers, verifyAndParseWebhook } from "./lib/stripeWebhookHandlers";
import { handleStripeSubscriptionEvent } from "./lib/stripeBillingSync";
import { verifyAndParseClerkWebhook, handleClerkWebhookEvent } from "./lib/clerkWebhookHandlers";

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
// In production, restrict to the actual Vercel frontend domain plus any
// verified custom domains stored in the database (e.g. forms.acme.com).
// In development (CORS_ALLOWED_ORIGINS not set) allow all origins so the
// Replit dev preview can reach the API.
const CORS_ORIGINS_RAW =
  process.env.CORS_ALLOWED_ORIGINS ??
  process.env.FRONTEND_URL ??
  "";

const staticAllowedOrigins = CORS_ORIGINS_RAW
  ? new Set(CORS_ORIGINS_RAW.split(",").map((o) => o.trim()).filter(Boolean))
  : null; // null → allow all in dev

// Verified custom domains loaded from DB — refreshed every 60 seconds so new
// customer domains are picked up without a server restart.
let customDomainOrigins = new Set<string>();

async function refreshCustomDomainOrigins(): Promise<void> {
  try {
    const db = getDb();
    const { rows } = await db.query<{ custom_domain: string }>(
      `SELECT custom_domain FROM accounts
       WHERE custom_domain IS NOT NULL
         AND custom_domain <> ''
         AND custom_domain_status = 'verified'`
    );
    const next = new Set<string>();
    for (const { custom_domain } of rows) {
      next.add(`https://${custom_domain}`);
      if (process.env.NODE_ENV !== "production") {
        next.add(`http://${custom_domain}`); // allow http in dev/staging only
      }
    }
    customDomainOrigins = next;
  } catch {
    // Non-fatal: keep the previous set if the DB is temporarily unavailable.
  }
}

// Called once from index.ts after the DB is ready — seeds the cache immediately
// and starts a 60-second refresh interval so new verified domains go live within
// a minute of being confirmed, with no server restart needed.
let customDomainRefreshInterval: ReturnType<typeof setInterval> | null = null;
export function startCustomDomainCors(): void {
  if (customDomainRefreshInterval) return;
  void refreshCustomDomainOrigins();
  customDomainRefreshInterval = setInterval(() => void refreshCustomDomainOrigins(), 60_000);
}

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

function isOriginAllowed(origin: string): boolean {
  if (!staticAllowedOrigins) return true; // dev: allow all
  if (staticAllowedOrigins.has(origin) || staticAllowedOrigins.has(normalizeOrigin(origin))) return true;
  if (customDomainOrigins.has(origin) || customDomainOrigins.has(normalizeOrigin(origin))) return true;
  return false;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

app.use(
  cors({
    origin: staticAllowedOrigins
      ? (origin, cb) => {
          // Allow server-to-server requests (no Origin header).
          if (!origin || isOriginAllowed(origin)) {
            cb(null, true);
          } else {
            cb(new Error(`CORS: origin ${origin} is not allowed`));
          }
        }
      : IS_PRODUCTION
        // In production, staticAllowedOrigins should always be set.
        // If missing, fail closed to avoid credentialed cross-origin exposure.
        ? (_origin, cb) => cb(new Error("CORS: CORS_ALLOWED_ORIGINS is not configured"))
        // In development (Replit preview), reflect the requesting origin so
        // credentialed requests (cookies) work from the preview iframe.
        : (origin, cb) => cb(null, origin ?? false),
    credentials:      true,
    methods:          ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders:   ["Content-Type", "Authorization", "X-Requested-With", "X-File-Name", "X-Document-Title"],
    optionsSuccessStatus: 200,
  }),
);

// ── Cookie secret ───────────────────────────────────────────────────────────
// Used to sign the trusted-device cookie so that the value cannot be tampered
// with client-side.  Set COOKIE_SECRET in the environment for production.
// In development, a predictable fallback is used — this is intentional and
// safe because signed cookies are only a tamper-prevention mechanism and the
// full security comes from the server-side hash lookup in the DB.
const COOKIE_SECRET =
  process.env.COOKIE_SECRET ??
  (IS_PRODUCTION
    ? (() => { throw new Error("COOKIE_SECRET must be set in production"); })()
    : "dev-only-cookie-secret-please-change-in-prod");

app.use(cookieParser(COOKIE_SECRET));

// ── Stripe webhook (must be before body parsers — needs raw Buffer) ───────────
// Primary path: verifyAndParseWebhook uses STRIPE_WEBHOOK_SECRET for direct
// Stripe SDK signature verification, then updates accounts via handleStripeSubscriptionEvent.
// Secondary (non-fatal): WebhookHandlers.processWebhook syncs data to stripe.* tables
// via stripe-replit-sync (may fail if managed webhook is not configured).
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

      // 1. Primary: verify signature with STRIPE_WEBHOOK_SECRET + parse the event.
      //    This is the reliable path that does not depend on stripe-replit-sync's
      //    managed webhook infrastructure (which requires a stripe.accounts table).
      const event = await verifyAndParseWebhook(req.body as Buffer, sig);

      // 2. Update our accounts table based on the verified event.
      //    Throw on failure so the outer catch returns non-2xx and Stripe retries.
      await handleStripeSubscriptionEvent(event);

      // 3. Secondary (non-fatal): also run stripe-replit-sync to populate the
      //    stripe.* schema tables (customers, subscriptions, products, etc.).
      //    Failure here does not abort the webhook response.
      WebhookHandlers.processWebhook(req.body as Buffer, sig).catch((syncErr: unknown) => {
        logger.warn({ err: syncErr }, "[StripeWebhook] stripe-replit-sync schema sync failed (non-fatal)");
      });

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

// ── Clerk webhook (must be before body parsers — needs raw Buffer) ────────────
// Handles session lifecycle events (session.ended, session.revoked, session.removed)
// to keep user_active_sessions in sync with Clerk's session state.
// Signature verification uses CLERK_WEBHOOK_SECRET (Svix).
app.post(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      logger.error("[ClerkWebhook] Body is not a Buffer — express.json() ran first");
      res.status(500).json({ error: "Webhook processing error" });
      return;
    }

    try {
      const event = verifyAndParseClerkWebhook(req.body as Buffer, req.headers as Record<string, string | string[] | undefined>);
      await handleClerkWebhookEvent(event);
      res.status(200).json({ received: true });
    } catch (err) {
      const isSignatureError = err instanceof Error &&
        (err.message.toLowerCase().includes("signature") ||
         err.message.toLowerCase().includes("invalid") ||
         err.message.toLowerCase().includes("svix") ||
         err.message.toLowerCase().includes("webhook_secret"));
      logger.error({ err }, "[ClerkWebhook] Webhook processing failed");
      res.status(isSignatureError ? 400 : 500).json({ error: "Webhook processing error" });
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

// ── Email signature image ──────────────────────────────────────────────────────
// URL: https://workspaceapi-server-production-987b.up.railway.app/images/email-signature.png
app.get("/images/email-signature.png", (_req, res) => {
  const imgPath = path.join(__dirname, "../public/images/email-signature.png");
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  res.sendFile(imgPath);
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Debug-only Sentry test route (must be before 404 catch-all) ───────────────
// Hit GET /api/debug-sentry to verify the Sentry connection after a deploy.
// Gated behind internal auth so external callers cannot spam Sentry events.
app.get("/api/debug-sentry", requireInternalAuth, (_req, _res) => {
  throw new Error("Sentry test error — if you see this in Sentry, the integration is working.");
});

// ── Queue status — internal monitoring ────────────────────────────────────────
// Returns live queue depth metrics for all BullMQ queues.
// Gated behind internal auth so only portal staff can access it.
app.get("/api/internal/queue-status", requireInternalAuth, async (_req, res) => {
  const status = await getQueueStatus();
  res.json(status);
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
