import { google } from "googleapis";
import { logger } from "./logger";

// ── Configuration ─────────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? "";

const TABS = {
  appointments:     "appointments",
  leads:            "leads",
  bookingAttempts:  "booking_attempts",
} as const;

// ── Column headers ────────────────────────────────────────────────────────────

const APPOINTMENT_HEADERS = [
  "Confirmation ID", "Slot ID", "Scheduled Time", "Day", "Time",
  "First Name", "Last Name", "Email", "Phone", "State",
  "Structure", "Allocation", "Timeline", "Status", "Lead ID",
  "Calendar Event ID", "Created", "Updated", "Notes",
];

const LEAD_HEADERS = [
  "Lead ID", "First Name", "Last Name", "Email", "Phone", "State",
  "Structure", "Allocation", "Timeline", "Source", "Status",
  "Current Custodian", "Form Type", "Linked Appointment",
  "Created", "Updated", "Notes", "Follow-Up Date", "Owner",
];

const ATTEMPT_HEADERS = [
  "Attempt ID", "Email", "Slot ID", "IP Address", "Result",
  "Error Code", "Error Detail", "Confirmation ID", "Attempted At",
];

// ── Human-readable labels ─────────────────────────────────────────────────────

const ALLOCATION_LABELS: Record<string, string> = {
  physical_delivery: "Physical Home/Vault Delivery",
  ira_rollover: "IRA Rollover / Transfer",
  not_sure: "Not sure yet",
};

const RANGE_LABELS: Record<string, string> = {
  under_50k: "Under $50,000",
  "50k_150k": "$50,000 – $150,000",
  "150k_500k": "$150,000 – $500,000",
  "500k_plus": "$500,000+",
};

const TIMELINE_LABELS: Record<string, string> = {
  ready: "Ready to move forward now",
  within_30_days: "Planning within next 30 days",
  researching: "Just researching options",
};

function label(map: Record<string, string>, val?: string | null): string {
  if (!val) return "";
  return map[val] ?? val;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

type SheetsClient = ReturnType<typeof google.sheets>;

function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;
  try {
    const credentials = JSON.parse(keyJson);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  } catch {
    logger.error("[Sheets] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY");
    return null;
  }
}

function getSheetsClient(): SheetsClient | null {
  if (!SPREADSHEET_ID) return null;
  const auth = getAuth();
  if (!auth) return null;
  return google.sheets({ version: "v4", auth });
}

// ── Ensure tab + headers exist ────────────────────────────────────────────────

async function ensureTab(
  sheets: SheetsClient,
  tabName: string,
  headers: string[]
): Promise<void> {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const exists = meta.data.sheets?.some(
      (s) => s.properties?.title === tabName
    );

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: tabName } } }],
        },
      });
      logger.info({ tabName }, "[Sheets] Tab created");
    }

    // Write headers if row 1 is empty
    const lastCol = String.fromCharCode(64 + headers.length);
    const headerRange = `${tabName}!A1:${lastCol}1`;
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: headerRange,
    });
    if (!existing.data.values?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: headerRange,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
      logger.info({ tabName }, "[Sheets] Headers written");
    }
  } catch (err) {
    logger.warn({ err, tabName }, "[Sheets] ensureTab failed");
  }
}

// ── Upsert: find row by key in col A, update or append ───────────────────────

async function upsertRow(
  sheets: SheetsClient,
  tabName: string,
  headers: string[],
  keyValue: string,
  rowData: string[]
): Promise<void> {
  await ensureTab(sheets, tabName, headers);

  const colA = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A:A`,
  });

  const rows = colA.data.values ?? [];
  let matchRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]?.[0] === keyValue) {
      matchRow = i + 1; // 1-indexed row number for the API
      break;
    }
  }

  const lastCol = String.fromCharCode(64 + headers.length);

  if (matchRow > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A${matchRow}:${lastCol}${matchRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [rowData] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A:A`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowData] },
    });
  }
}

// ── Public: sync appointment ──────────────────────────────────────────────────

export async function syncAppointmentToSheet(params: {
  confirmationId: string;
  slotId: string;
  scheduledTime: string;
  dayLabel: string;
  timeLabel: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  state: string;
  allocationType: string;
  allocationRange: string;
  timeline: string;
  status: string;
  leadId?: string | null;
  calendarEventId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  notes?: string | null;
}): Promise<void> {
  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    const row = [
      params.confirmationId,
      params.slotId,
      params.scheduledTime,
      params.dayLabel,
      params.timeLabel,
      params.firstName,
      params.lastName,
      params.email,
      params.phone,
      params.state,
      label(ALLOCATION_LABELS, params.allocationType),
      label(RANGE_LABELS, params.allocationRange),
      label(TIMELINE_LABELS, params.timeline),
      params.status,
      params.leadId ?? "",
      params.calendarEventId ?? "",
      params.createdAt,
      params.updatedAt ?? "",
      params.notes ?? "",
    ];
    await upsertRow(
      sheets, TABS.appointments, APPOINTMENT_HEADERS,
      params.confirmationId, row
    );
    logger.info({ confirmationId: params.confirmationId }, "[Sheets] Appointment synced");
  } catch (err) {
    logger.error({ err }, "[Sheets] Failed to sync appointment");
  }
}

// ── Public: sync lead ─────────────────────────────────────────────────────────

export async function syncLeadToSheet(params: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  state?: string | null;
  allocationType?: string | null;
  allocationRange?: string | null;
  timeline?: string | null;
  formType: string;
  status?: string | null;
  currentCustodian?: string | null;
  linkedConfirmationId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  notes?: string | null;
  followUpDate?: string | null;
  owner?: string | null;
}): Promise<void> {
  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    const row = [
      params.id,
      params.firstName,
      params.lastName,
      params.email,
      params.phone ?? "",
      params.state ?? "",
      label(ALLOCATION_LABELS, params.allocationType),
      label(RANGE_LABELS, params.allocationRange),
      label(TIMELINE_LABELS, params.timeline),
      params.formType,        // source
      params.status ?? "new",
      params.currentCustodian ?? "",
      params.formType,
      params.linkedConfirmationId ?? "",
      params.createdAt,
      params.updatedAt ?? "",
      params.notes ?? "",
      params.followUpDate ?? "",
      params.owner ?? "",
    ];
    await upsertRow(
      sheets, TABS.leads, LEAD_HEADERS,
      params.id, row
    );
    logger.info({ leadId: params.id }, "[Sheets] Lead synced");
  } catch (err) {
    logger.error({ err }, "[Sheets] Failed to sync lead");
  }
}

// ── Public: append booking attempt ───────────────────────────────────────────

export async function appendBookingAttemptToSheet(params: {
  id: string;
  email: string;
  slotId: string;
  ipAddress?: string | null;
  success: boolean;
  errorCode?: string | null;
  errorDetail?: string | null;
  confirmationId?: string | null;
  attemptedAt: string;
}): Promise<void> {
  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    await ensureTab(sheets, TABS.bookingAttempts, ATTEMPT_HEADERS);
    const row = [
      params.id,
      params.email,
      params.slotId,
      params.ipAddress ?? "",
      params.success ? "✓ Success" : "✗ Failed",
      params.errorCode ?? "",
      params.errorDetail ?? "",
      params.confirmationId ?? "",
      params.attemptedAt,
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TABS.bookingAttempts}!A:A`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
    logger.info({ id: params.id, success: params.success }, "[Sheets] Booking attempt logged");
  } catch (err) {
    logger.error({ err }, "[Sheets] Failed to log booking attempt");
  }
}
