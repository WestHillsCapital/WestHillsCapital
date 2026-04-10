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
  "Priority", "Call Outcome", "Next Action", "Next Action Due",
  "Invoice Sent", "Funds Received", "Order Placed", "Shipped",
  "Delivered", "Referral Requested", "Notes",
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
  "Next Action Due", "Loss Reason", "Won Date", "Notes", "Owner",
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
 * headers. Returns both the authoritative header name → 0-based column-index
 * map and the numeric sheetId for batchUpdate dimension operations.
 */
async function ensureTabHeaders(
  sheets: SheetsClient,
  tabName: string,
  allHeaders: readonly string[]
): Promise<{ nameToCol: Map<string, number>; sheetId: number }> {
  // 1. Create the tab if it doesn't exist; always capture sheetId
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  let sheetMeta = meta.data.sheets?.find(
    (s) => s.properties?.title === tabName
  );
  if (!sheetMeta) {
    const addResp = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
    const added = addResp.data.replies?.[0]?.addSheet;
    sheetMeta = { properties: added?.properties ?? { title: tabName, sheetId: 0 } };
    logger.info({ tabName }, "[Sheets] Tab created");
  }
  const sheetId: number = sheetMeta?.properties?.sheetId ?? 0;

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

  return { nameToCol, sheetId };
}

// ── Core upsert: header-name-aware ───────────────────────────────────────────

/**
 * Upserts a row identified by `keyValue` in the column whose header matches
 * `keyHeader`. The key column is resolved by name from the actual sheet header
 * row, so the lookup remains correct even if an operator reorders columns.
 *
 * INSERT path: appends a full row (system + operator columns) with operator
 *   cells left blank.
 *
 * UPDATE path: writes ONLY the cells whose header names are in
 *   `systemHeaderSet`. Operator columns are never touched.
 *
 * Column order in the sheet is irrelevant — all positions are derived from the
 * actual header row at sync time.
 */
async function upsertByHeaderName(
  sheets: SheetsClient,
  tabName: string,
  allHeaders: readonly string[],
  systemHeaderSet: ReadonlySet<string>,
  keyHeader: string,
  keyValue: string,
  systemData: Record<string, string>
): Promise<void> {
  // Ensure tab exists and all headers are present; get name→col map + sheetId
  const { nameToCol, sheetId } = await ensureTabHeaders(sheets, tabName, allHeaders);

  // Resolve the key column from the header map (not assumed to be column A)
  const keyCol = nameToCol.get(keyHeader);
  if (keyCol === undefined) {
    logger.warn({ tabName, keyHeader }, "[Sheets] Key header not found in sheet — skipping upsert");
    return;
  }
  const keyColLetter = colLetter(keyCol);

  // Find existing row by scanning the key column
  const keyColResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!${keyColLetter}:${keyColLetter}`,
  });
  const keyColRows = keyColResp.data.values ?? [];
  let matchRow = -1;
  for (let i = 1; i < keyColRows.length; i++) {
    if (keyColRows[i]?.[0] === keyValue) {
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
    // ── INSERT: insert a blank row at index 1 (row 2), then write data ────
    // This keeps row 1 (the frozen header) in place and puts the newest entry
    // at row 2, pushing older rows further down.

    // Step 1: physically insert a blank row at 0-based index 1 (= sheet row 2)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: 1,
              endIndex: 2,
            },
            inheritFromBefore: false,
          },
        }],
      },
    });

    // Step 2: write ONLY system-managed cells (same as the update path).
    // Operator columns are never written — leaving them as truly null cells so
    // any data validation, star rating chips, or formulas set up on those
    // columns are preserved intact.
    const insertData: { range: string; values: string[][] }[] = [];
    for (const header of systemHeaderSet) {
      const col = nameToCol.get(header);
      if (col === undefined) continue;
      insertData.push({
        range: `${tabName}!${colLetter(col)}2`,
        values: [[systemData[header] ?? ""]],
      });
    }
    if (insertData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: "RAW", data: insertData },
      });
    }
  }
}

// ── Constant sets for fast lookup ─────────────────────────────────────────────

const APPOINTMENT_SYSTEM_SET = new Set<string>(APPOINTMENT_SYSTEM_HEADERS);
const LEAD_SYSTEM_SET = new Set<string>(LEAD_SYSTEM_HEADERS);

// ── Public: test the Sheets connection ───────────────────────────────────────
//
// Returns null on success, or a diagnostic string describing what is wrong.

export async function testSheetsConnection(): Promise<string | null> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return "GOOGLE_SHEETS_SPREADSHEET_ID is not set";

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return "GOOGLE_SERVICE_ACCOUNT_KEY is not set";

  let credentials: unknown;
  try {
    credentials = JSON.parse(keyJson);
  } catch {
    return "GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON — check for missing quotes or line breaks in Railway";
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const resp = await sheets.spreadsheets.get({ spreadsheetId });
    const title = resp.data.properties?.title ?? "(untitled)";
    logger.info({ title }, "[Sheets] Connection test passed");
    return null; // success
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Sheets API error: ${msg}`;
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
}): Promise<void> {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error("[Sheets] Client not available — check GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY");

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
      "Confirmation ID",
      params.confirmationId,
      systemData
    );
    logger.info({ confirmationId: params.confirmationId }, "[Sheets] Appointment synced");
  } catch (err) {
    logger.error({ err }, "[Sheets] Failed to sync appointment");
    throw err;
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
  if (!sheets) throw new Error("[Sheets] Client not available — check GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY");

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
      "Lead ID",
      params.id,
      systemData
    );
    logger.info({ leadId: params.id }, "[Sheets] Lead synced");
  } catch (err) {
    logger.error({ err }, "[Sheets] Failed to sync lead");
    throw err;
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
    // booking_attempts is fully system-managed; insert at row 2 (newest first)
    const { sheetId } = await ensureTabHeaders(sheets, TABS.bookingAttempts, ATTEMPT_HEADERS);
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
    // Step 1: physically insert a blank row at 0-based index 1 (= sheet row 2)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: 1,
              endIndex: 2,
            },
            inheritFromBefore: false,
          },
        }],
      },
    });
    // Step 2: write the row data into the newly-created row 2
    const endLetter = colLetter(row.length - 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TABS.bookingAttempts}!A2:${endLetter}2`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
    logger.info({ id: params.id, success: params.success }, "[Sheets] Booking attempt logged");
  } catch (err) {
    logger.error({ err }, "[Sheets] Failed to log booking attempt");
  }
}
