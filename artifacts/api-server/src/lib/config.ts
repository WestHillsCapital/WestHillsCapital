/**
 * Startup configuration validator.
 *
 * Call validateConfig() once before the server starts. It will:
 *   - Exit with a clear error message if a REQUIRED variable is missing
 *   - Log a warning for each OPTIONAL variable that is absent, describing
 *     which feature is degraded
 *   - Log the database hostname (never the password) so Railway logs can
 *     confirm the server is pointing at the right Postgres instance
 */
import { logger } from "./logger.js";

// ── Required — server cannot function without these ───────────────────────────
const REQUIRED_VARS = ["PORT", "DATABASE_URL"] as const;

// ── Optional — absence degrades a specific feature but server still starts ────
const OPTIONAL_VARS: Record<string, string> = {
  GOOGLE_SERVICE_ACCOUNT_KEY:   "Google Sheets sync disabled",
  GOOGLE_SHEETS_SPREADSHEET_ID: "Master CRM sheet sync disabled",
  GOOGLE_DEAL_BUILDER_SHEET_ID: "Deal Builder sheet write disabled (falls back to master sheet if absent)",
  GOOGLE_DEALS_OPS_SHEET_ID:    "Deals ops sheet write disabled (falls back to master sheet if absent)",
  DILLON_GAGE_API_KEY:          "Live spot pricing disabled (will 404)",
  GOOGLE_BOOKING_CALENDAR_ID:   "Appointment calendar events disabled",
  GOOGLE_BLOCKER_CALENDAR_IDS:  "Blocker calendar sync disabled",
  RESEND_API_KEY:               "Transactional email disabled",
  GOOGLE_CLIENT_ID:             "Internal portal Google auth disabled",
  INTERNAL_ALLOWED_EMAILS:      "All internal users will be blocked after sign-in",
  FRONTEND_URL:                 "Open Deal Builder links in Sheets disabled",
  ADMIN_EMAIL:                  "Admin notification emails disabled",
  CORS_ALLOWED_ORIGINS:         "CORS open to all origins (set to restrict to production domain)",
  GOOGLE_DRIVE_DEALS_FOLDER_ID: "Deal invoice PDF Drive upload disabled",
  FIZTRADE_DRY_RUN:             "Set to 'true' to simulate DG trade execution without placing real orders",
  // Wire transfer instructions on invoices — hard-coded defaults used if unset
  WIRE_BANK:         "Invoice wire instructions will use hardcoded bank name (Commerce Bank)",
  WIRE_BANK_ADDRESS: "Invoice wire instructions will use hardcoded bank address",
  WIRE_ROUTING:      "Invoice wire instructions will use hardcoded routing number",
  WIRE_ACCOUNT_NAME: "Invoice wire instructions will use hardcoded account name",
  WIRE_ACCOUNT_ADDR: "Invoice wire instructions will use hardcoded account address",
  WIRE_ACCOUNT_NUM:  "Invoice wire instructions will use hardcoded account number",
};

export function validateConfig(): void {
  // ── Required vars ──────────────────────────────────────────────────────────
  const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error(
      { missing },
      `Server cannot start — required env vars are not set: ${missing.join(", ")}`
    );
    process.exit(1);
  }

  // ── Database host diagnostic (no credentials) ──────────────────────────────
  try {
    const u = new URL(process.env.DATABASE_URL!);
    logger.info(
      { host: u.hostname, port: u.port || "5432", database: u.pathname.replace(/^\//, "") },
      "Database target"
    );
  } catch {
    logger.error(
      "DATABASE_URL is set but is not a valid URL — connection will likely fail"
    );
  }

  // ── Optional vars ──────────────────────────────────────────────────────────
  const absent: string[] = [];
  for (const [key, impact] of Object.entries(OPTIONAL_VARS)) {
    if (!process.env[key]) {
      absent.push(`${key} (${impact})`);
    }
  }
  if (absent.length > 0) {
    logger.warn(
      { absent },
      `Optional env vars not set — some features are disabled`
    );
  }

  logger.info("Configuration validated");
}
