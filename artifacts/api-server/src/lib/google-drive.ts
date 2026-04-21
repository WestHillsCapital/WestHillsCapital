/**
 * Google Drive — deal invoice PDF storage.
 *
 * Folder structure under the root deals folder:
 *   {ROOT_FOLDER_ID}
 *     └─ {YYYY}                          e.g. "2026"
 *          └─ {MM – Month Name}          e.g. "04 – April"
 *               └─ {FI} {LastName}       e.g. "J Smith"
 *                    └─ {MMDDYY} {FI} {LastName} Invoice.pdf
 *                                        e.g. "041526 J Smith Invoice.pdf"
 *
 * Uses the same service-account credentials as google-sheets.ts.
 */
import { google } from "googleapis";
import { Readable } from "stream";
import { logger } from "./logger";

// ── Auth ──────────────────────────────────────────────────────────────────────

function getDriveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  let credentials: unknown;
  try { credentials = JSON.parse(raw); } catch { return null; }

  const auth = new google.auth.GoogleAuth({
    credentials: credentials as never,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
  return google.drive({ version: "v3", auth });
}

// ── Folder helpers ────────────────────────────────────────────────────────────

type DriveClient = ReturnType<typeof google.drive>;

async function getOrCreateFolder(
  drive: DriveClient,
  name: string,
  parentId: string,
): Promise<string> {
  const safe = name.replace(/['"\\]/g, "");
  const q = `name='${safe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const list = await drive.files.list({
    q,
    fields: "files(id)",
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id as string;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents:  [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  return created.data.id as string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface DriveUploadResult {
  fileId:      string;
  webViewLink: string;
}

/**
 * Uploads the deal invoice PDF to Google Drive under a date/client folder
 * hierarchy inside `rootFolderId`.
 *
 * IMPORTANT — rootFolderId must be a folder inside a **Shared Drive**
 * (Google Workspace Team Drive). Service accounts have no personal Drive
 * storage quota, so uploads to regular My Drive folders fail with:
 *   "Service Accounts do not have storage quota. Leverage shared drives."
 * `supportsAllDrives` is set on every API call so Shared Drive folders
 * are located and written to correctly.
 *
 * Errors thrown by this function are caught by the deal execute route
 * (src/routes/deals.ts) and surfaced in the Deal Builder amber warning
 * block — they do not abort invoice generation or other execution steps.
 *
 * Setup: create a Shared Drive in Google Workspace, add the service
 * account email (GOOGLE_SERVICE_ACCOUNT_KEY → client_email) as a
 * Contributor, create a "WHC Deals" folder inside it, and set
 * GOOGLE_DRIVE_DEALS_FOLDER_ID in Railway to that folder's ID.
 * See artifacts/api-server/docs/google-sheets-setup.md for full steps.
 */
export async function saveDealPdfToDrive(
  pdfBuffer:    Buffer,
  deal: {
    id:         number;
    firstName:  string;
    lastName:   string;
    dealType:   string;
    lockedAt:   string;
  },
  rootFolderId: string,
): Promise<DriveUploadResult> {
  const drive = getDriveClient();
  if (!drive) throw new Error("Google Drive client unavailable (check GOOGLE_SERVICE_ACCOUNT_KEY)");

  const d     = new Date(deal.lockedAt);
  const yyyy  = String(d.getFullYear());
  const mm    = String(d.getMonth() + 1).padStart(2, "0");
  const dd    = String(d.getDate()).padStart(2, "0");
  const yy    = yyyy.slice(2);
  const month = d.toLocaleString("en-US", { month: "long" });

  // First initial + last name
  const firstInitial = (deal.firstName.trim()[0] ?? "").toUpperCase();
  const lastName     = deal.lastName.trim();
  const clientLabel  = `${firstInitial} ${lastName}`;   // e.g. "J Smith"
  const dateLabel    = `${mm}${dd}${yy}`;               // e.g. "041526"

  const yearName    = yyyy;                             // "2026"
  const monthName   = `${mm} \u2013 ${month}`;         // "04 – April"
  const clientFolder = clientLabel;                     // "J Smith"
  const fileName    = `${dateLabel} ${clientLabel} Invoice.pdf`; // "041526 J Smith Invoice.pdf"

  // Traverse / create folder hierarchy
  const yearFolderId   = await getOrCreateFolder(drive, yearName,    rootFolderId);
  const monthFolderId  = await getOrCreateFolder(drive, monthName,   yearFolderId);
  const clientFolderId = await getOrCreateFolder(drive, clientFolder, monthFolderId);

  // Wrap the Buffer in a Readable stream for the Drive multipart upload
  const stream = Readable.from(pdfBuffer);

  const uploaded = await drive.files.create({
    requestBody: {
      name:    fileName,
      parents: [clientFolderId],
    },
    media: {
      mimeType: "application/pdf",
      body:     stream,
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  const fileId      = uploaded.data.id      as string;
  const webViewLink = (uploaded.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`) as string;

  logger.info({ dealId: deal.id, fileId, clientFolder, fileName }, "[Drive] PDF uploaded");
  return { fileId, webViewLink };
}
