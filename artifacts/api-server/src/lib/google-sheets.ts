import { google } from "googleapis";
import { logger } from "./logger";

// ── Configuration ─────────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? "";
const FRONTEND_URL   = (process.env.FRONTEND_URL ?? "").replace(/\/$/, "");

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

// "Open Deal Builder" is a formula column — written with USER_ENTERED after the
// main upsert. Including it here ensures ensureTabHeaders creates it when needed.
const APPOINTMENT_ALL_HEADERS = [
  ...APPOINTMENT_SYSTEM_HEADERS,
  ...APPOINTMENT_OPERATOR_HEADERS,
  "Open Deal Builder",
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

// "Open Deal Builder" is a formula column — written with USER_ENTERED after the
// main upsert. Including it here ensures ensureTabHeaders creates it when needed.
const LEAD_ALL_HEADERS = [
  ...LEAD_SYSTEM_HEADERS,
  ...LEAD_OPERATOR_HEADERS,
  "Open Deal Builder",
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

/** Sheets client that doesn't require SPREADSHEET_ID — used for Deal Builder and Ops sheets. */
function getAnySheetsClient(): SheetsClient | null {
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

// ── Open Deal Builder hyperlink helper ───────────────────────────────────────
//
// Writes a USER_ENTERED HYPERLINK formula to the "Open Deal Builder" column
// of the given row (identified by keyHeader + keyValue).
//
// Column placement:
//   "Open Deal Builder" is declared in APPOINTMENT_ALL_HEADERS and
//   LEAD_ALL_HEADERS, so ensureTabHeaders creates it at the end of the
//   header row the first time this tab is synced. If the header is already
//   present (from a prior sync or from upsertByHeaderName), ensureTabHeaders
//   is a read-only no-op and returns the existing nameToCol map.
//   This approach never overwrites an existing operator header column.
//
// Non-fatal — callers must wrap in try/catch.

async function writeOpenDealBuilderLink(
  sheets:    SheetsClient,
  tabName:   string,
  keyHeader: string,
  keyValue:  string,
  formula:   string
): Promise<void> {
  const LINK_HEADER = "Open Deal Builder";

  // Ensure the column exists and get its position via the canonical mechanism.
  // Safe: ensureTabHeaders only appends headers that are absent; it never
  // overwrites occupied columns.
  const { nameToCol } = await ensureTabHeaders(sheets, tabName, [LINK_HEADER]);

  const keyCol  = nameToCol.get(keyHeader);
  const linkCol = nameToCol.get(LINK_HEADER);
  if (keyCol === undefined || linkCol === undefined) {
    logger.warn({ tabName, keyHeader }, "[Sheets] Columns not found for Open Deal Builder link");
    return;
  }

  // Scan the key column to find the target row
  const keyColLetter = colLetter(keyCol);
  const colResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!${keyColLetter}:${keyColLetter}`,
  });
  const colRows = colResp.data.values ?? [];
  let targetRow = -1;
  for (let i = 1; i < colRows.length; i++) {
    if (colRows[i]?.[0] === keyValue) {
      targetRow = i + 1; // 1-indexed (row 1 = headers)
      break;
    }
  }
  if (targetRow < 2) {
    logger.warn({ tabName, keyValue }, "[Sheets] Row not found for Open Deal Builder link");
    return;
  }

  // Write the formula with USER_ENTERED so Sheets parses it as a clickable hyperlink
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!${colLetter(linkCol)}${targetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[formula]] },
  });

  logger.info(
    { tabName, keyValue, col: colLetter(linkCol), row: targetRow },
    "[Sheets] Open Deal Builder link written"
  );
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

  // Write "Open Deal Builder" hyperlink — non-fatal
  if (FRONTEND_URL) {
    try {
      const qs = params.leadId
        ? `confirmationId=${encodeURIComponent(params.confirmationId)}&leadId=${encodeURIComponent(String(params.leadId))}`
        : `confirmationId=${encodeURIComponent(params.confirmationId)}`;
      const formula = `=HYPERLINK("${FRONTEND_URL}/internal/deal-builder?${qs}","Open Deal Builder")`;
      await writeOpenDealBuilderLink(sheets, TABS.appointments, "Confirmation ID", params.confirmationId, formula);
    } catch (err) {
      logger.warn({ err }, "[Sheets] Failed to write Open Deal Builder link to appointment — skipping");
    }
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

  // Write "Open Deal Builder" hyperlink — non-fatal
  if (FRONTEND_URL) {
    try {
      const formula = `=HYPERLINK("${FRONTEND_URL}/internal/deal-builder?leadId=${params.id}","Open Deal Builder")`;
      await writeOpenDealBuilderLink(sheets, TABS.leads, "Lead ID", params.id, formula);
    } catch (err) {
      logger.warn({ err }, "[Sheets] Failed to write Open Deal Builder link to lead — skipping");
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// Deal write-back helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEAL_BUILDER_SHEET_ID = process.env.GOOGLE_DEAL_BUILDER_SHEET_ID ?? "";
const DEALS_OPS_SHEET_ID    = process.env.GOOGLE_DEALS_OPS_SHEET_ID    ?? "";

type DealProduct = {
  productId:   string;
  productName: string;
  metal:       string;
  qty:         number;
  unitPrice:   number;
  lineTotal:   number;
};

export type DealPayload = {
  id:                number;
  leadId?:           number;
  confirmationId?:   string;
  dealType:          string;
  iraType?:          string;
  firstName:         string;
  lastName:          string;
  email:             string;
  phone?:            string;
  state?:            string;
  custodian?:        string;
  iraAccountNumber?: string;
  goldSpotAsk?:      number;
  silverSpotAsk?:    number;
  spotTimestamp?:    string;
  products:          DealProduct[];
  subtotal:          number;
  shipping:          number;
  total:             number;
  balanceDue:        number;
  shippingMethod:    string;
  fedexLocation?:    string;
  notes?:            string;
  lockedAt:          string;
};

// The Deal Builder sheet has exactly 3 product rows in fixed positions:
//   Row 22: Silver Eagle (silver-american-eagle-1oz)
//   Row 23: Gold Eagle   (gold-american-eagle-1oz)
//   Row 24: Gold Buffalo (gold-american-buffalo-1oz)

function fmt(n: number | undefined, decimals = 2): string {
  return n !== undefined ? n.toFixed(decimals) : "";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

// ── 1. Write deal data into the Deal Builder Google Sheet ────────────────────

/**
 * Populates the Deal Builder sheet with locked deal data so the Invoice tab
 * auto-generates from the sheet's existing formulas.
 *
 * Tab: "Deal Builder"  (spaces → must be quoted in A1 notation as 'Deal Builder')
 * Env var: GOOGLE_DEAL_BUILDER_SHEET_ID
 */
export async function writeDealToBuilderSheet(deal: DealPayload): Promise<void> {
  if (!DEAL_BUILDER_SHEET_ID) {
    logger.warn("[Sheets] GOOGLE_DEAL_BUILDER_SHEET_ID not set — skipping Deal Builder write");
    return;
  }

  const sheets = getAnySheetsClient();
  if (!sheets) {
    logger.warn("[Sheets] Auth not available — skipping Deal Builder write");
    return;
  }

  const tab = "'Deal Builder'";
  const clientName = `${deal.firstName} ${deal.lastName}`;
  const deliveryLabel =
    deal.shippingMethod === "fedex_hold" ? "FedEx Hold" : "Home Delivery";

  // Build product rows for each fixed row, filling blanks if not in deal
  function productRowValues(productId: string): string[] {
    const p = deal.products.find((p) => p.productId === productId);
    if (!p || !p.qty) return ["", "", "", "", ""];
    return [
      p.productName,
      p.metal.charAt(0).toUpperCase() + p.metal.slice(1),
      String(p.qty),
      fmt(p.unitPrice),
      fmt(p.lineTotal),
    ];
  }

  const data: { range: string; values: (string | number)[][] }[] = [
    // Customer info
    { range: `${tab}!B3`, values: [[clientName]] },
    { range: `${tab}!B4`, values: [[deal.email]] },
    { range: `${tab}!B5`, values: [[deal.phone ?? ""]] },
    { range: `${tab}!B6`, values: [[deal.state ?? ""]] },
    // Deal metadata
    { range: `${tab}!B8`, values: [[deal.dealType === "ira" ? "IRA" : "Cash"]] },
    { range: `${tab}!B9`, values: [[deal.iraType ?? ""]] },
    { range: `${tab}!B11`, values: [[deal.leadId ? String(deal.leadId) : ""]] },
    { range: `${tab}!B12`, values: [[deal.confirmationId ?? ""]] },
    { range: `${tab}!B13`, values: [[fmtDate(deal.lockedAt)]] },
    // Spot prices
    { range: `${tab}!B15`, values: [[fmt(deal.goldSpotAsk)]] },
    { range: `${tab}!B16`, values: [[fmt(deal.silverSpotAsk)]] },
    { range: `${tab}!B17`, values: [[deal.spotTimestamp ? new Date(deal.spotTimestamp).toLocaleString() : ""]] },
    // Product rows (A:E for each row)
    { range: `${tab}!A22:E22`, values: [productRowValues("silver-american-eagle-1oz")] },
    { range: `${tab}!A23:E23`, values: [productRowValues("gold-american-eagle-1oz")] },
    { range: `${tab}!A24:E24`, values: [productRowValues("gold-american-buffalo-1oz")] },
    // Delivery
    { range: `${tab}!B27`, values: [[deliveryLabel]] },
    { range: `${tab}!B28`, values: [[deal.fedexLocation ?? ""]] },
    { range: `${tab}!B29`, values: [[fmt(deal.shipping)]] },
    // Notes
    { range: `${tab}!B32`, values: [[deal.notes ?? ""]] },
    // Totals (column E)
    { range: `${tab}!E32`, values: [[fmt(deal.subtotal)]] },
    { range: `${tab}!E33`, values: [[fmt(deal.shipping)]] },
    { range: `${tab}!E34`, values: [[fmt(deal.total)]] },
    { range: `${tab}!E35`, values: [[fmt(deal.balanceDue)]] },
    // Status flags
    { range: `${tab}!B36`, values: [["FALSE"]] },
    { range: `${tab}!B37`, values: [["FALSE"]] },
  ];

  // Custodian & IRA account (right side of header block)
  if (deal.custodian) {
    data.push({ range: `${tab}!E3`, values: [[deal.custodian]] });
  }
  if (deal.iraAccountNumber) {
    data.push({ range: `${tab}!E4`, values: [[deal.iraAccountNumber]] });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: DEAL_BUILDER_SHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });

  logger.info({ dealId: deal.id }, "[Sheets] Deal Builder sheet populated");
}

// ── 2. Append deal to WHC Deals & Operations sheet ───────────────────────────

/**
 * Appends a row to the "Deals" tab in the WHC Deals & Operations spreadsheet.
 * Env var: GOOGLE_DEALS_OPS_SHEET_ID
 */
export async function appendDealToOpsSheet(deal: DealPayload): Promise<void> {
  if (!DEALS_OPS_SHEET_ID) {
    logger.warn("[Sheets] GOOGLE_DEALS_OPS_SHEET_ID not set — skipping Ops sheet write");
    return;
  }

  const sheets = getAnySheetsClient();
  if (!sheets) {
    logger.warn("[Sheets] Auth not available — skipping Ops sheet write");
    return;
  }

  const clientName = `${deal.firstName} ${deal.lastName}`;

  // Product summary: "15x Gold Eagle, 100x Silver Eagle"
  const productSummary = deal.products
    .filter((p) => p.qty > 0)
    .map((p) => `${p.qty}x ${p.productName}`)
    .join(", ");

  const totalQty = deal.products.reduce((acc, p) => acc + (p.qty || 0), 0);

  // Row matches the "Deals" tab header layout (28 columns including empties):
  // Deal ID | Date/Time | Client Name | Email | Phone | State | (empty) |
  // Lead ID | Confirmation ID | (empty) | Deal Type | (empty) |
  // Gold Spot | Silver Spot | (empty) | Product Summary | Total Quantity | (empty) |
  // Deal Amount | Cash Component | Actual Cash Transferred | (empty) |
  // Account Specialist | Deal Closer | (empty) | Invoice ID | (empty) | Notes
  const row = [
    String(deal.id),               // Deal ID
    deal.lockedAt,                  // Date/Time
    clientName,                     // Client Name
    deal.email,                     // Email
    deal.phone ?? "",               // Phone
    deal.state ?? "",               // State
    "",                             // (empty)
    deal.leadId ? String(deal.leadId) : "", // Lead ID
    deal.confirmationId ?? "",      // Confirmation ID
    "",                             // (empty)
    deal.dealType === "ira" ? "IRA" : "Cash", // Deal Type
    "",                             // (empty)
    fmt(deal.goldSpotAsk),          // Gold Spot
    fmt(deal.silverSpotAsk),        // Silver Spot
    "",                             // (empty)
    productSummary,                 // Product Summary
    String(totalQty),               // Total Quantity
    "",                             // (empty)
    fmt(deal.total),                // Deal Amount
    fmt(deal.total),                // Cash Component (same as total for cash deals)
    "",                             // Actual Cash Transferred (manual)
    "",                             // (empty)
    "",                             // Account Specialist (manual)
    "",                             // Deal Closer (manual)
    "",                             // (empty)
    "",                             // Invoice ID (generated from sheet)
    "",                             // (empty)
    deal.notes ?? "",               // Notes
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: DEALS_OPS_SHEET_ID,
    range: "Deals!A:A",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  logger.info({ dealId: deal.id }, "[Sheets] Deal appended to Ops sheet");
}

// ── 3. Write "Open Deal" hyperlink to Master Sheet columns U / Q ─────────────

/**
 * After a deal is locked, writes a HYPERLINK formula back into the Master
 * Appointment Lead Sheet:
 *   - Appointments tab → Column U of the row matching deal.confirmationId
 *   - Leads tab       → Column Q of the row matching deal.leadId
 *
 * Env var: FRONTEND_URL (e.g. https://west-hills-capital.vercel.app)
 * Falls back gracefully if the row is not found or SPREADSHEET_ID is not set.
 */
export async function writeDealLinkToMasterSheet(deal: DealPayload): Promise<void> {
  if (!SPREADSHEET_ID) {
    logger.warn("[Sheets] SPREADSHEET_ID not set — skipping master sheet link write");
    return;
  }

  const sheets = getAnySheetsClient();
  if (!sheets) return;

  const dealUrl = `${FRONTEND_URL}/internal/deal-builder?dealId=${deal.id}`;
  const formula = `=HYPERLINK("${dealUrl}","Open Deal")`;

  const tasks: Promise<void>[] = [];

  // Appointments: scan column A (Confirmation ID) → write to column U
  if (deal.confirmationId) {
    tasks.push(
      (async () => {
        try {
          const col = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `appointments!A:A`,
          });
          const rows = col.data.values ?? [];
          const matchIdx = rows.findIndex(
            (r, i) => i > 0 && r[0] === deal.confirmationId
          );
          if (matchIdx >= 0) {
            const sheetRow = matchIdx + 1; // 1-indexed
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `appointments!U${sheetRow}`,
              valueInputOption: "USER_ENTERED",
              requestBody: { values: [[formula]] },
            });
            logger.info(
              { dealId: deal.id, confirmationId: deal.confirmationId, sheetRow },
              "[Sheets] Appointment link written to column U"
            );
          }
        } catch (err) {
          logger.error({ err }, "[Sheets] Failed to write appointment deal link");
        }
      })()
    );
  }

  // Leads: scan column A (Lead ID) → write to column Q
  if (deal.leadId) {
    tasks.push(
      (async () => {
        try {
          const col = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `leads!A:A`,
          });
          const rows = col.data.values ?? [];
          const leadIdStr = String(deal.leadId);
          const matchIdx = rows.findIndex(
            (r, i) => i > 0 && r[0] === leadIdStr
          );
          if (matchIdx >= 0) {
            const sheetRow = matchIdx + 1;
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `leads!Q${sheetRow}`,
              valueInputOption: "USER_ENTERED",
              requestBody: { values: [[formula]] },
            });
            logger.info(
              { dealId: deal.id, leadId: deal.leadId, sheetRow },
              "[Sheets] Lead link written to column Q"
            );
          }
        } catch (err) {
          logger.error({ err }, "[Sheets] Failed to write lead deal link");
        }
      })()
    );
  }

  await Promise.allSettled(tasks);
}
