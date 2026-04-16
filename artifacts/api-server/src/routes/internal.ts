import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { getDb } from "../db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /api/internal/leads
// Returns all leads from the DB, newest first (up to 200)
router.get("/leads", async (_req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(`
      SELECT
        id, form_type, first_name, last_name, email, phone, state,
        allocation_type, allocation_range, timeline, current_custodian,
        status, notes, follow_up_date, owner, linked_confirmation_id,
        created_at, updated_at
      FROM leads
      ORDER BY created_at DESC
      LIMIT 200
    `);
    res.json({ leads: rows });
  } catch (err) {
    logger.error({ err }, "[Internal] Failed to fetch leads");
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

// GET /api/internal/appointments
// Returns all appointments from the DB, newest first (up to 200)
router.get("/appointments", async (_req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(`
      SELECT
        id, confirmation_id, slot_id, scheduled_time, day_label, time_label,
        first_name, last_name, email, phone, state,
        allocation_type, allocation_range, timeline, status,
        lead_id, calendar_event_id, notes, created_at, updated_at
      FROM appointments
      ORDER BY created_at DESC
      LIMIT 200
    `);
    res.json({ appointments: rows });
  } catch (err) {
    logger.error({ err }, "[Internal] Failed to fetch appointments");
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

// GET /api/internal/health/google
// Non-destructive diagnostic: tests Deals tab read + Drive folder list.
// Useful for diagnosing Sheets/Drive issues without needing Railway log access.
router.get("/health/google", async (_req, res) => {
  const results: Record<string, unknown> = {};

  // ── Env var presence ──────────────────────────────────────────────────────
  results.env = {
    GOOGLE_SERVICE_ACCOUNT_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID ? "set" : "MISSING",
    GOOGLE_BOOKING_CALENDAR_ID: process.env.GOOGLE_BOOKING_CALENDAR_ID ? "set" : "MISSING",
    GOOGLE_DRIVE_DEALS_FOLDER_ID: process.env.GOOGLE_DRIVE_DEALS_FOLDER_ID ? "set" : "MISSING",
    GOOGLE_DEALS_OPS_SHEET_ID: process.env.GOOGLE_DEALS_OPS_SHEET_ID ? process.env.GOOGLE_DEALS_OPS_SHEET_ID : "(not set — using master sheet)",
  };

  // ── Build auth ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let auth: any = null;
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
    const credentials = JSON.parse(raw);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    });
    results.auth = "ok";
  } catch (err) {
    results.auth = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  // ── Sheets: read Deals tab header row ────────────────────────────────────
  if (auth && process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    try {
      const sheets = google.sheets({ version: "v4", auth });
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
        range: "Deals!1:1",
      });
      const headers = (resp.data.values?.[0] ?? []) as string[];
      results.sheets_deals_tab = {
        status: "ok",
        header_count: headers.length,
        first_5_headers: headers.slice(0, 5),
      };
    } catch (err) {
      results.sheets_deals_tab = {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    results.sheets_deals_tab = "skipped (auth or spreadsheet ID missing)";
  }

  // ── Drive: list files in root deals folder ────────────────────────────────
  if (auth && process.env.GOOGLE_DRIVE_DEALS_FOLDER_ID) {
    try {
      const drive = google.drive({ version: "v3", auth });
      const resp = await drive.files.list({
        q: `'${process.env.GOOGLE_DRIVE_DEALS_FOLDER_ID}' in parents and trashed=false`,
        fields: "files(id, name, mimeType)",
        pageSize: 5,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      results.drive_root_folder = {
        status: "ok",
        files_found: resp.data.files?.length ?? 0,
        sample: resp.data.files?.slice(0, 3).map((f) => f.name),
      };
    } catch (err) {
      results.drive_root_folder = {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    results.drive_root_folder = "skipped (auth or folder ID missing)";
  }

  logger.info(results, "[Internal] Google health check");
  return res.json(results);
});

export default router;
