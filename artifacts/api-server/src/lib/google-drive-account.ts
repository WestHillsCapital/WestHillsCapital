/**
 * Google Drive — per-account OAuth access.
 *
 * Unlike google-drive.ts (service-account, system-level), this module uses
 * per-account OAuth2 tokens stored in the accounts table. Each Docuplete
 * tenant can connect their own Google account and have session packets
 * uploaded to a folder of their choosing.
 *
 * Token refresh is handled automatically by the googleapis library when a
 * refresh_token is present. The caller does not need to persist a refreshed
 * access token — the refresh_token is permanent until the user revokes access.
 */

import { google } from "googleapis";
import { Readable } from "stream";
import { logger } from "./logger";

const GDRIVE_DEFAULT_FOLDER_NAME = "Docuplete Submissions";

interface AccountDriveCredentials {
  accessToken: string;
  refreshToken: string;
}

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret);
}

function getAccountDriveClient(creds: AccountDriveCredentials) {
  const oauth2 = getOAuth2Client();
  if (!oauth2) return null;
  oauth2.setCredentials({
    access_token: creds.accessToken,
    refresh_token: creds.refreshToken,
  });
  return google.drive({ version: "v3", auth: oauth2 });
}

// ── OAuth flow helpers ────────────────────────────────────────────────────────

export function isGDriveConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/**
 * Generates the Google OAuth URL. The redirectUri must be pre-registered in
 * Google Cloud Console as an authorized redirect URI.
 */
export function generateGDriveAuthUrl(state: string, redirectUri: string): string | null {
  const oauth2 = getOAuth2Client();
  if (!oauth2) return null;
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive"],
    state,
    redirect_uri: redirectUri,
  });
}

interface ExchangeResult {
  accessToken: string;
  refreshToken: string;
  email: string;
  folderId: string;
  folderName: string;
}

/**
 * Exchanges an OAuth authorization code for access + refresh tokens.
 * Also fetches the user's email and creates (or finds) the default
 * "Docuplete Submissions" folder in their Drive.
 */
export async function exchangeGDriveCode(code: string, redirectUri: string): Promise<ExchangeResult> {
  const oauth2 = getOAuth2Client();
  if (!oauth2) throw new Error("Google OAuth is not configured on this server.");

  const { tokens } = await oauth2.getToken({ code, redirect_uri: redirectUri });
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Token exchange did not return required tokens. Make sure prompt=consent is set.");
  }
  oauth2.setCredentials(tokens);

  // Fetch email
  const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
  const userInfo = await oauth2Api.userinfo.get();
  const email = userInfo.data.email ?? "";

  // Create (or find) default submissions folder in My Drive root
  const drive = google.drive({ version: "v3", auth: oauth2 });
  const folderId = await getOrCreateRootFolder(drive, GDRIVE_DEFAULT_FOLDER_NAME);
  const folderName = GDRIVE_DEFAULT_FOLDER_NAME;

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    email,
    folderId,
    folderName,
  };
}

// ── Folder helpers ────────────────────────────────────────────────────────────

async function getOrCreateRootFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
): Promise<string> {
  const safe = name.replace(/['"\\]/g, "");
  const q = `name='${safe}' and 'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const list = await drive.files.list({ q, fields: "files(id)", spaces: "drive" });
  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id as string;
  }
  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });
  return created.data.id as string;
}

async function getOrCreateSubfolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId: string,
): Promise<string> {
  const safe = name.replace(/['"\\]/g, "");
  const q = `name='${safe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const list = await drive.files.list({ q, fields: "files(id)", spaces: "drive" });
  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id as string;
  }
  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
  });
  return created.data.id as string;
}

/**
 * Given a Google Drive folder URL or raw folder ID, extracts and returns the
 * folder ID string. Returns null if the input is empty or unrecognisable.
 */
export function parseFolderIdFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // URL form: https://drive.google.com/drive/folders/<id> or /drive/u/0/folders/<id>
  const urlMatch = trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  // Raw ID — alphanumeric+dash+underscore, typically 28-44 chars
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Verifies that the stored OAuth tokens can access the specified folder.
 * Returns the folder name if accessible, throws if not.
 */
export async function verifyFolderAccess(
  creds: AccountDriveCredentials,
  folderId: string,
): Promise<string> {
  const drive = getAccountDriveClient(creds);
  if (!drive) throw new Error("Google Drive is not configured on this server.");
  const file = await drive.files.get({ fileId: folderId, fields: "id,name,mimeType" });
  if (file.data.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("The specified item is not a folder.");
  }
  return file.data.name ?? folderId;
}

// ── Upload ────────────────────────────────────────────────────────────────────

export interface AccountDriveUploadResult {
  fileId: string;
  webViewLink: string;
}

/**
 * Uploads a session PDF to the account's connected Google Drive.
 * Files are organized: {rootFolder}/{YYYY}/{MM – Month}/{firstName lastName}/filename.pdf
 */
export async function uploadSessionPdfToAccountDrive(
  creds: AccountDriveCredentials,
  rootFolderId: string,
  pdfBuffer: Buffer,
  packet: {
    firstName: string;
    lastName: string;
    packageName: string;
    generatedAt: string;
  },
): Promise<AccountDriveUploadResult> {
  const drive = getAccountDriveClient(creds);
  if (!drive) throw new Error("Google Drive is not configured on this server.");

  const d = new Date(packet.generatedAt);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "long" });
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = yyyy.slice(2);

  const firstInitial = (packet.firstName.trim()[0] ?? "").toUpperCase();
  const lastName = packet.lastName.trim() || "Client";
  const clientLabel = firstInitial ? `${firstInitial} ${lastName}` : lastName;
  const dateLabel = `${mm}${dd}${yy}`;
  const pkgLabel = packet.packageName.replace(/[^\w.\- ()]+/g, " ").replace(/\s+/g, " ").trim() || "Docuplete";
  const fileName = `${dateLabel} ${clientLabel} ${pkgLabel} Packet.pdf`;

  const yearFolderId = await getOrCreateSubfolder(drive, yyyy, rootFolderId);
  const monthFolderId = await getOrCreateSubfolder(drive, `${mm} \u2013 ${month}`, yearFolderId);
  const clientFolderId = await getOrCreateSubfolder(drive, clientLabel, monthFolderId);

  const uploaded = await drive.files.create({
    requestBody: { name: fileName, parents: [clientFolderId] },
    media: { mimeType: "application/pdf", body: Readable.from(pdfBuffer) },
    fields: "id,webViewLink",
  });

  const fileId = uploaded.data.id as string;
  const webViewLink = (uploaded.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`) as string;
  logger.info({ fileId, clientFolder: clientLabel, fileName }, "[AccountDrive] PDF uploaded");
  return { fileId, webViewLink };
}
