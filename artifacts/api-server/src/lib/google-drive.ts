/**
 * Google Drive — deal invoice PDF storage.
 *
 * Folder structure under the root deals folder:
 *   {ROOT_FOLDER_ID}
 *     └─ {YYYY}
 *          └─ {MM – Month Name}
 *               └─ {YYYYMMDD}-{LastName}-{DealType}
 *                    └─ WHC-{dealId}-{YYYYMMDD}.pdf
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
    credentials,
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
  });

  return created.data.id as string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface DriveUploadResult {
  fileId:      string;
  webViewLink: string;
}

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

  const d = new Date(deal.lockedAt);
  const yyyy  = String(d.getFullYear());
  const mm    = String(d.getMonth() + 1).padStart(2, "0");
  const dd    = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "long" });

  const yearName  = yyyy;
  const monthName = `${mm} – ${month}`;
  const dealFolder = `${yyyy}${mm}${dd}-${deal.lastName}-${deal.dealType.toUpperCase()}`;
  const fileName   = `WHC-${deal.id}-${yyyy}${mm}${dd}.pdf`;

  // Traverse / create folder hierarchy
  const yearFolderId  = await getOrCreateFolder(drive, yearName,  rootFolderId);
  const monthFolderId = await getOrCreateFolder(drive, monthName, yearFolderId);
  const dealFolderId  = await getOrCreateFolder(drive, dealFolder, monthFolderId);

  // Convert Buffer → Readable stream (required by Drive API)
  const stream = Readable.from(pdfBuffer);

  const uploaded = await drive.files.create({
    requestBody: {
      name:    fileName,
      parents: [dealFolderId],
    },
    media: {
      mimeType: "application/pdf",
      body:     stream,
    },
    fields: "id, webViewLink",
  });

  const fileId      = uploaded.data.id      as string;
  const webViewLink = uploaded.data.webViewLink as string;

  logger.info({ dealId: deal.id, fileId, dealFolder }, "[Drive] PDF uploaded");
  return { fileId, webViewLink };
}
