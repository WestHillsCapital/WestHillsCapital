import { google } from "googleapis";
import { logger } from "./logger";

// ── Configuration ─────────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? "";

const TABS = {
  appointments:    "appointments",
  leads:           "leads",
  bookingAttempts: "booking_attempts",
} as const;

// ── Column definitions ─────────────────────────────────────────────────────────
//
// SYSTEM columns   — written by the app on every insert AND every update.
// OPERATOR columns — written once (empty) when the row is first inserted;
//                    never touched again by the app.

const APPOINTMENT_SYSTEM_HEADERS = [
  "Confirmation ID", "Slot ID", "Scheduled Time", "Day", "Time",
  "First Name", "Last Name", "Email", "Phone", "State",
  "Structure", "Allocation", "Timeline", "Status", "Lead ID",
  "Calendar Event ID", "Created", "Updated",
] as const;

const APPOINTMENT_OPERATOR_HEADERS = [
  "Call Outcome", "Next Action", "Invoice Sent", "Funds Received",
  "Order Placed", "Shipped", "Delivered", "Referral Requested", "Notes",
] as const;

const APPOINTMENT_ALL_HEADERS = [
  ...APPOINTMENT_SYSTEM_HEADERS,
  ...APPOINTMENT_OPERATOR_HEADERS,
];

const LEAD_SYSTEM_HEADERS = [
  "Lead ID", "First Name", "Last Name", "Email", "Phone", "State",
  "Structure", "Allocation", "Timeline", "Source", "Status",
  "Current Custodian", "Form Type", "Linked Appointment", "Created", "Updated",
] as const;

const LEAD_OPERATOR_HEADERS = [
  "Priority", "Deal Size Estimate", "Last Contact Date", "Next Action",
  "Next Action Due", "Loss Reason", "Won Date", "Notes", "Follow-Up Date", "Owner",
] as const;

const LEAD_ALL_HEADERS = [
  ...LEAD_SYSTEM_HEADERS,
  ...LEAD_OPERATOR_HEADERS,
];

const ATTEMPT_HEADERS = [
  "Attempt ID", "Email", "Slot ID", "IP Address", "Result",
  "Error Code", "Error Detail", "Confirmation ID", "Attempted At",
];

// ── Human-readable labels ─────────────────────────────────────────────────────

const ALLOCATION_LABELS: Record<string, string> = {
  physical_delivery: "Physical Home/Vault Delivery",
  ira_rollover:      "IRA Rollover / Transfer",
  not_sure:          "Not sure yet",
};

const RANGE_LABELS: Record<string, string> = {
  under_50k:    "Under $50,000",
  "50k_150k":   "$50,000 – $150,000",
  "150k_500k":  "$150,000 – $500,000",
  "500k_plus":  "$500,000+",
};

const TIMELINE_LABELS: Record<string, string> = {
  ready:          "Ready to move forward now",
  within_30_days: "Planning within next 30 days",
  researching:    "Just researching options",
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

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Convert a 0-based column index to a Sheets column letter (A, B, …, Z, AA, …). */
function colLetter(col: number): string {
  let letter = "";
  let n = col + 1; // 1-based
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

// ── Tab + header management ───────────────────────────────────────────────────

/**
 * Ensures the tab exists, then reads row 1 and appends any headers from
 * `allHeaders` that are not already present. Never moves or renames existing
 * headers. Returns the authoritative header name → 0-based column-index map.
 */
async function ensureTabHeaders(
  sheets: SheetsClient,
  tabName: string,
  allHeaders: readonly string[]
): Promise<Map<string, number>> {
  // 1. Create the tab if it doesn't exist
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const tabExists = meta.data.sheets?.some(
    (s) => s.properties?.title === tabName
  );
  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
    logger.info({ tabName }, "[Sheets] Tab created");
  }

  // 2. Read row 1
  const row1Resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!1:1`,
  });
  const existingRow: string[] = (row1Resp.data.values?.[0] ?? []) as string[];

  // 3. Build name → col map from what is already in the sheet
  const nameToCol = new Map<string, number>();
  existingRow.forEach((h, i) => {
    if (h) nameToCol.set(h, i);
  });

  // 4. Find headers in allHeaders that are not yet present
  const missing = allHeaders.filter((h) => !nameToCol.has(h));
  if (missing.length > 0) {
    // Append missing headers immediately after the last existing header
    const startCol = existingRow.length;
    const startLetter = colLetter(startCol);
    const endLetter = colLetter(startCol + missing.length - 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!${startLetter}1:${endLetter}1`,
      valueInputOption: "RAW",
      requestBody: { values: [missing] },
    });
    missing.forEach((h, i) => nameToCol.set(h, startCol + i));
    logger.info({ tabName, missing }, "[Sheets] Headers extended");
  }

  return nameToCol;
}

// ── Core upsert: header-name-aware ───────────────────────────────────────────

/**
 * Upserts a row identified by `keyValue` in column A.
 *
 * INSERT path: appends a full row (system + operator columns) with operator
 *   cells left blank.
 *
 * UPDATE path: writes ONLY the cells whose header names are in
 *   `systemHeaderSet`. Operator columns are never touched.
 *
 * Column order in the sheet is irrelevant — positions are derived from the
 * actual header row at sync time.
 */
async function upsertByHeaderName(
  sheets: SheetsClient,
  tabName: string,
  allHeaders: readonly string[],
  systemHeaderSet: ReadonlySet<string>,
  keyValue: string,
  systemData: Record<string, string>
): Promise<void> {
  // Ensure tab exists and all headers are present; get name→col map
  const nameToCol = await ensureTabHeaders(sheets, tabName, allHeaders);

  // Find existing row by key (column A)
  const colAResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A:A`,
  });
  const colARows = colAResp.data.values ?? [];
  let matchRow = -1;
  for (let i = 1; i < colARows.length; i++) {
    if (colARows[i]?.[0] === keyValue) {
      matchRow = i + 1; // Sheets API is 1-indexed, row 1 is headers
      break;
    }
  }

  if (matchRow > 0) {
    // ── UPDATE: write only system-managed cells ───────────────────────────
    const data: { range: string; values: string[][] }[] = [];
    for (const header of systemHeaderSet) {
      const col = nameToCol.get(header);
      if (col === undefined) continue; // header not in sheet (shouldn't happen)
      const cellLetter = colLetter(col);
      data.push({
        range: `${tabName}!${cellLetter}${matchRow}`,
        values: [[systemData[header] ?? ""]],
      });
    }
    if (data.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: "RAW", data },
      });
    }
  } else {
    // ── INSERT: append full row, operator columns blank ───────────────────
    const totalCols = Math.max(...[...nameToCol.values()]) + 1;
    const row = new Array<string>(totalCols).fill("");
    for (const [header, col] of nameToCol) {
      row[col] = systemData[header] ?? ""; // operator headers not in systemData → stays ""
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A:A`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
}

// ── Constant sets for fast lookup ─────────────────────────────────────────────

const APPOINTMENT_SYSTEM_SET = new Set<string>(APPOINTMENT_SYSTEM_HEADERS);
const LEAD_SYSTEM_SET = new Set<string>(LEAD_SYSTEM_HEADERS);

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
}): Promise<void> {
  const sheets = getSheetsClient();
  if (!sheets) return;

  const systemData: Record<string, string> = {
    "Confirmation ID":  params.confirmationId,
    "Slot ID":          params.slotId,
    "Scheduled Time":   params.scheduledTime,
    "Day":              params.dayLabel,
    "Time":             params.timeLabel,
    "First Name":       params.firstName,
    "Last Name":        params.lastName,
    "Email":            params.email,
    "Phone":            params.phone,
    "State":            params.state,
    "Structure":        label(ALLOCATION_LABELS, params.allocationType),
    "Allocation":       label(RANGE_LABELS, params.allocationRange),
    "Timeline":         label(TIMELINE_LABELS, params.timeline),
    "Status":           params.status,
    "Lead ID":          params.leadId ?? "",
    "Calendar Event ID": params.calendarEventId ?? "",
    "Created":          params.createdAt,
    "Updated":          params.updatedAt ?? "",
  };

  try {
    await upsertByHeaderName(
      sheets,
      TABS.appointments,
      APPOINTMENT_ALL_HEADERS,
      APPOINTMENT_SYSTEM_SET,
      params.confirmationId,
      systemData
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
}): Promise<void> {
  const sheets = getSheetsClient();
  if (!sheets) return;

  const systemData: Record<string, string> = {
    "Lead ID":           params.id,
    "First Name":        params.firstName,
    "Last Name":         params.lastName,
    "Email":             params.email,
    "Phone":             params.phone ?? "",
    "State":             params.state ?? "",
    "Structure":         label(ALLOCATION_LABELS, params.allocationType),
    "Allocation":        label(RANGE_LABELS, params.allocationRange),
    "Timeline":          label(TIMELINE_LABELS, params.timeline),
    "Source":            params.formType,
    "Status":            params.status ?? "new",
    "Current Custodian": params.currentCustodian ?? "",
    "Form Type":         params.formType,
    "Linked Appointment": params.linkedConfirmationId ?? "",
    "Created":           params.createdAt,
    "Updated":           params.updatedAt ?? "",
  };

  try {
    await upsertByHeaderName(
      sheets,
      TABS.leads,
      LEAD_ALL_HEADERS,
      LEAD_SYSTEM_SET,
      params.id,
      systemData
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
    // booking_attempts is fully system-managed; use simple ensureTab + append
    await ensureTabHeaders(sheets, TABS.bookingAttempts, ATTEMPT_HEADERS);
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
