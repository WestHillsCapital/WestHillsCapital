import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * GET /api/healthz/config
 *
 * Reports the configuration status of every feature-gated env var.
 * Safe to expose publicly — never reveals values, only whether each
 * variable is set (true/false) and a one-line impact description.
 *
 * Features are split into:
 *   critical  — Docuplete SaaS will be broken or insecure without these
 *   whc       — West Hills Capital internal tool (separate concern)
 *   optional  — graceful fallbacks exist, but behaviour is degraded
 */
router.get("/healthz/config", (_req, res) => {
  const check = (key: string) => Boolean(process.env[key]);

  // ── CRITICAL: Docuplete SaaS must-haves ──────────────────────────────────
  const critical = {
    clerkSecretKey: {
      configured: check("CLERK_SECRET_KEY"),
      impact: "[DOCUPLETE] Clerk auth — users cannot sign in without this",
    },
    database: {
      configured: check("DATABASE_URL"),
      impact: "[DOCUPLETE] PostgreSQL connection — entire app fails without this",
    },
    resendEmail: {
      configured: check("RESEND_API_KEY"),
      impact: "[DOCUPLETE] Transactional email — interview links and invite emails not sent",
    },
    appOrigin: {
      configured: check("APP_ORIGIN"),
      impact: "[DOCUPLETE] Base URL for interview links — generated URLs will be broken",
    },
    stripeIntegration: {
      configured: check("REPLIT_CONNECTORS_HOSTNAME") && (check("REPL_IDENTITY") || check("WEB_REPL_RENEWAL")),
      impact: "[DOCUPLETE] Stripe billing — upgrade/checkout will fail without Replit Stripe connector",
    },
    stripeProPriceId: {
      configured: check("STRIPE_PRO_PRICE_ID"),
      impact: "[DOCUPLETE] Pro plan price ID — can fall back to Stripe product lookup, but slower",
    },
    stripeEnterprisePriceId: {
      configured: check("STRIPE_ENTERPRISE_PRICE_ID"),
      impact: "[DOCUPLETE] Enterprise plan price ID — same fallback as above",
    },
    sentryDsn: {
      configured: check("SENTRY_DSN"),
      impact: "[DOCUPLETE] Error reporting — production errors will be invisible without this",
    },
  };

  // ── WEST HILLS CAPITAL: WHC internal tool ────────────────────────────────
  const whc = {
    dillonGageApi: {
      configured: check("DILLON_GAGE_API_KEY"),
      impact: "[WHC] Live spot pricing and product prices from Dillon Gage / Fiztrade",
    },
    fiztradeDryRun: {
      configured: process.env.FIZTRADE_DRY_RUN === "true",
      impact: "[WHC] DRY RUN mode — trades are simulated, no real DG orders placed",
    },
    fiztradeBaseUrl: {
      configured: check("FIZTRADE_BASE_URL"),
      impact: "[WHC] Fiztrade base URL (defaults to production if unset)",
    },
    googleServiceAccount: {
      configured: check("GOOGLE_SERVICE_ACCOUNT_KEY"),
      impact: "[WHC] Google Sheets, Drive, and Calendar service account access",
    },
    googleSheetsMain: {
      configured: check("GOOGLE_SHEETS_SPREADSHEET_ID"),
      impact: "[WHC] Master CRM spreadsheet sync (leads, appointments, deals)",
    },
    googleSheetsDealBuilder: {
      configured: check("GOOGLE_DEAL_BUILDER_SHEET_ID"),
      impact: "[WHC] Deal Builder tab write (falls back to master sheet if unset)",
    },
    googleSheetsOps: {
      configured: check("GOOGLE_DEALS_OPS_SHEET_ID"),
      impact: "[WHC] Operations tab write for fulfillment milestone tracking",
    },
    googleCalendar: {
      configured: check("GOOGLE_BOOKING_CALENDAR_ID"),
      impact: "[WHC] Appointment booking creates Google Calendar events",
    },
    googleBlockerCalendars: {
      configured: check("GOOGLE_BLOCKER_CALENDAR_IDS"),
      impact: "[WHC] Blocker calendar sync prevents double-booking",
    },
    googleDriveFolder: {
      configured: check("GOOGLE_DRIVE_DEALS_FOLDER_ID"),
      impact: "[WHC] Deal invoice PDFs uploaded to Google Drive",
    },
    googleOAuth: {
      configured: check("GOOGLE_CLIENT_ID"),
      impact: "[WHC] Internal portal Google OAuth sign-in (absent = dev bypass active)",
    },
    allowedEmails: {
      configured: check("INTERNAL_ALLOWED_EMAILS"),
      impact: "[WHC] Allowlist of Google accounts for the internal portal",
    },
    adminEmail: {
      configured: check("ADMIN_EMAIL"),
      impact: "[WHC] Admin notification emails for new leads and bookings",
    },
    wireBank: {
      configured: check("WIRE_BANK"),
      impact: "[WHC] Bank name on invoice wire instructions (hardcoded default if unset)",
    },
    wireBankAddress: {
      configured: check("WIRE_BANK_ADDRESS"),
      impact: "[WHC] Bank address on invoice wire instructions",
    },
    wireRouting: {
      configured: check("WIRE_ROUTING"),
      impact: "[WHC] Routing number on invoice wire instructions",
    },
    wireAccountName: {
      configured: check("WIRE_ACCOUNT_NAME"),
      impact: "[WHC] Account name on invoice wire instructions",
    },
    wireAccountAddr: {
      configured: check("WIRE_ACCOUNT_ADDR"),
      impact: "[WHC] Account address on invoice wire instructions",
    },
    wireAccountNum: {
      configured: check("WIRE_ACCOUNT_NUM"),
      impact: "[WHC] Account number on invoice wire instructions",
    },
    frontendUrl: {
      configured: check("FRONTEND_URL"),
      impact: "[WHC] Deal Builder deep-links in Google Sheets (disabled if unset)",
    },
    corsOrigins: {
      configured: check("CORS_ALLOWED_ORIGINS"),
      impact: "[WHC] CORS restricted to production domain (open to all if unset — OK for Railway)",
    },
  };

  const allFeatures = { ...critical, ...whc };
  const criticalConfigured  = Object.values(critical).filter((f) => f.configured).length;
  const criticalTotal       = Object.keys(critical).length;
  const criticalMissing     = Object.entries(critical)
    .filter(([, f]) => !f.configured)
    .map(([k]) => k);

  const total       = Object.keys(allFeatures).length;
  const configuredN = Object.values(allFeatures).filter((f) => f.configured).length;

  res.json({
    status: criticalMissing.length === 0 ? "ok" : "degraded",
    environment: process.env.NODE_ENV ?? "unknown",
    configuredCount: configuredN,
    totalCount: total,
    critical: {
      configured: criticalConfigured,
      total: criticalTotal,
      missing: criticalMissing,
    },
    features: allFeatures,
    checkedAt: new Date().toISOString(),
  });
});

export default router;
