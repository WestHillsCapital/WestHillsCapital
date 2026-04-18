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
 * Reports the configuration status of every optional feature.
 * Safe to expose publicly — it never reveals env var values, only whether
 * each variable is set (true/false) and a one-line impact description.
 *
 * Useful for post-deployment verification on Railway without SSH access.
 */
router.get("/healthz/config", (_req, res) => {
  const check = (key: string) => Boolean(process.env[key]);

  const features = {
    // ── Core pricing ─────────────────────────────────────────────────────
    dillonGageApi: {
      configured: check("DILLON_GAGE_API_KEY"),
      impact: "Live spot pricing and product prices from Dillon Gage / Fiztrade",
    },
    fiztradeDryRun: {
      configured: process.env.FIZTRADE_DRY_RUN === "true",
      impact: "DRY RUN mode — trades are simulated, no real DG orders placed",
    },
    fiztradeBaseUrl: {
      configured: check("FIZTRADE_BASE_URL"),
      impact: "Fiztrade base URL (defaults to production connect.fiztrade.com if unset)",
    },

    // ── Google integrations ───────────────────────────────────────────────
    googleServiceAccount: {
      configured: check("GOOGLE_SERVICE_ACCOUNT_KEY"),
      impact: "Google Sheets, Drive, and Calendar service account access",
    },
    googleSheetsMain: {
      configured: check("GOOGLE_SHEETS_SPREADSHEET_ID"),
      impact: "Master CRM spreadsheet sync (leads, appointments, deals)",
    },
    googleSheetsDealBuilder: {
      configured: check("GOOGLE_DEAL_BUILDER_SHEET_ID"),
      impact: "Deal Builder tab write (falls back to master sheet if unset)",
    },
    googleSheetsOps: {
      configured: check("GOOGLE_DEALS_OPS_SHEET_ID"),
      impact: "Operations tab write for fulfillment milestone tracking",
    },
    googleCalendar: {
      configured: check("GOOGLE_BOOKING_CALENDAR_ID"),
      impact: "Appointment booking creates Google Calendar events",
    },
    googleBlockerCalendars: {
      configured: check("GOOGLE_BLOCKER_CALENDAR_IDS"),
      impact: "Blocker calendar sync prevents double-booking",
    },
    googleDriveFolder: {
      configured: check("GOOGLE_DRIVE_DEALS_FOLDER_ID"),
      impact: "Deal invoice PDFs uploaded to Google Drive",
    },

    // ── Auth ─────────────────────────────────────────────────────────────
    googleOAuth: {
      configured: check("GOOGLE_CLIENT_ID"),
      impact: "Internal portal Google OAuth sign-in (absent = dev bypass active)",
    },
    allowedEmails: {
      configured: check("INTERNAL_ALLOWED_EMAILS"),
      impact: "Allowlist of Google accounts permitted to access the internal portal",
    },

    // ── Email ─────────────────────────────────────────────────────────────
    resendEmail: {
      configured: check("RESEND_API_KEY"),
      impact: "Transactional email (booking confirmations, invoice, milestone follow-ups)",
    },
    adminEmail: {
      configured: check("ADMIN_EMAIL"),
      impact: "Admin notification emails for new leads and bookings",
    },

    // ── Wire instructions on invoices ────────────────────────────────────
    wireBank: {
      configured: check("WIRE_BANK"),
      impact: "Bank name on invoice wire instructions (uses hardcoded default if unset)",
    },
    wireBankAddress: {
      configured: check("WIRE_BANK_ADDRESS"),
      impact: "Bank address on invoice wire instructions",
    },
    wireRouting: {
      configured: check("WIRE_ROUTING"),
      impact: "Routing number on invoice wire instructions",
    },
    wireAccountName: {
      configured: check("WIRE_ACCOUNT_NAME"),
      impact: "Account name on invoice wire instructions",
    },
    wireAccountAddr: {
      configured: check("WIRE_ACCOUNT_ADDR"),
      impact: "Account address on invoice wire instructions",
    },
    wireAccountNum: {
      configured: check("WIRE_ACCOUNT_NUM"),
      impact: "Account number on invoice wire instructions",
    },

    // ── Misc ─────────────────────────────────────────────────────────────
    frontendUrl: {
      configured: check("FRONTEND_URL"),
      impact: "Deal Builder deep-links in Google Sheets (disabled if unset)",
    },
    corsOrigins: {
      configured: check("CORS_ALLOWED_ORIGINS"),
      impact: "CORS restricted to production domain (open to all if unset — OK for Railway)",
    },
  };

  const total        = Object.keys(features).length;
  const configuredN  = Object.values(features).filter((f) => f.configured).length;

  res.json({
    status: "ok",
    environment: process.env.NODE_ENV ?? "unknown",
    configuredCount: configuredN,
    totalCount: total,
    features,
    checkedAt: new Date().toISOString(),
  });
});

export default router;
