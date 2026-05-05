/**
 * Dropbox API v2 — per-account OAuth access.
 *
 * Uses per-account OAuth2 tokens stored in the accounts table via the
 * provider-agnostic storage_* columns. Uploads PDF packets to a user-chosen
 * Dropbox path under a date/client folder hierarchy.
 *
 * For Dropbox, the storage_folder_id column stores the folder path
 * (e.g. "/Docuplete Submissions") rather than an opaque ID.
 */

import { logger } from "./logger";

const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const API_BASE = "https://api.dropboxapi.com/2";
const CONTENT_BASE = "https://content.dropboxapi.com/2";
const DEFAULT_FOLDER_PATH = "/Docuplete Submissions";

export interface DropboxCredentials {
  accessToken: string;
  refreshToken: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface DropboxError {
  error_summary?: string;
  error?: unknown;
}

function getClientCredentials() {
  const clientId = process.env.DROPBOX_CLIENT_ID;
  const clientSecret = process.env.DROPBOX_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function isDropboxConfigured(): boolean {
  return !!getClientCredentials();
}

export function generateDropboxAuthUrl(state: string, redirectUri: string): string | null {
  const creds = getClientCredentials();
  if (!creds) return null;
  const params = new URLSearchParams({
    client_id: creds.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    token_access_type: "offline",
  });
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

export interface DropboxExchangeResult {
  accessToken: string;
  refreshToken: string;
  email: string;
  folderId: string;
  folderName: string;
}

export async function exchangeDropboxCode(code: string, redirectUri: string): Promise<DropboxExchangeResult> {
  const creds = getClientCredentials();
  if (!creds) throw new Error("Dropbox integration is not configured on this server.");

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  const tokenData = await tokenRes.json() as TokenResponse;
  if (tokenData.error || !tokenData.access_token || !tokenData.refresh_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? "Dropbox token exchange failed.");
  }

  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;

  const userRes = await fetch(`${API_BASE}/users/get_current_account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: "null",
  });
  const userData = await userRes.json() as { email?: string };
  const email = userData.email ?? "";

  const folderId = await getOrCreateFolder(accessToken, DEFAULT_FOLDER_PATH);

  return { accessToken, refreshToken, email, folderId, folderName: DEFAULT_FOLDER_PATH };
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const creds = getClientCredentials();
  if (!creds) throw new Error("Dropbox not configured.");
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const data = await tokenRes.json() as TokenResponse;
  if (data.error || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "Dropbox token refresh failed.");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
  };
}

async function dropboxApiCall(accessToken: string, endpoint: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function getOrCreateFolder(accessToken: string, path: string): Promise<string> {
  const checkRes = await dropboxApiCall(accessToken, "/files/get_metadata", { path });
  if (checkRes.ok) {
    return path;
  }
  const createRes = await dropboxApiCall(accessToken, "/files/create_folder_v2", {
    path,
    autorename: false,
  });
  if (createRes.ok) {
    return path;
  }
  const err = await createRes.json() as DropboxError;
  if ((err.error_summary ?? "").includes("path/conflict/folder")) {
    return path;
  }
  throw new Error(`Failed to create Dropbox folder "${path}": ${err.error_summary ?? JSON.stringify(err)}`);
}

async function getOrCreateNestedFolder(accessToken: string, path: string): Promise<string> {
  return getOrCreateFolder(accessToken, path);
}

export async function verifyDropboxFolderAccess(
  creds: DropboxCredentials,
  folderPath: string,
): Promise<string> {
  const { accessToken } = await refreshAccessToken(creds.refreshToken);
  const normalizedPath = folderPath.startsWith("/") ? folderPath : `/${folderPath}`;
  const checkRes = await dropboxApiCall(accessToken, "/files/get_metadata", { path: normalizedPath });
  if (!checkRes.ok) {
    throw new Error("Cannot access that Dropbox path. Make sure the folder exists and is accessible.");
  }
  const data = await checkRes.json() as { ".tag"?: string; name?: string };
  if (data[".tag"] !== "folder") {
    throw new Error("The specified Dropbox path is not a folder.");
  }
  return data.name ?? folderPath.split("/").pop() ?? folderPath;
}

export interface DropboxUploadResult {
  fileId: string;
  webViewLink: string;
}

export async function uploadPdfToDropbox(
  creds: DropboxCredentials,
  rootFolderPath: string,
  pdfBuffer: Buffer,
  packet: {
    firstName: string;
    lastName: string;
    packageName: string;
    generatedAt: string;
  },
): Promise<DropboxUploadResult> {
  const refreshed = await refreshAccessToken(creds.refreshToken);
  const accessToken = refreshed.accessToken;

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

  const normalizedRoot = rootFolderPath.startsWith("/") ? rootFolderPath : `/${rootFolderPath}`;

  await getOrCreateNestedFolder(accessToken, `${normalizedRoot}/${yyyy}`);
  await getOrCreateNestedFolder(accessToken, `${normalizedRoot}/${yyyy}/${mm} \u2013 ${month}`);
  await getOrCreateNestedFolder(accessToken, `${normalizedRoot}/${yyyy}/${mm} \u2013 ${month}/${clientLabel}`);

  const filePath = `${normalizedRoot}/${yyyy}/${mm} \u2013 ${month}/${clientLabel}/${fileName}`;

  const uploadRes = await fetch(`${CONTENT_BASE}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: filePath,
        mode: "add",
        autorename: true,
        mute: false,
      }),
    },
    body: pdfBuffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Dropbox upload failed: ${err}`);
  }

  const item = await uploadRes.json() as { id?: string; path_lower?: string };
  const fileId = item.id ?? filePath;
  const webViewLink = `https://www.dropbox.com/home${filePath}`;
  logger.info({ fileId, clientFolder: clientLabel, fileName }, "[Dropbox] PDF uploaded");
  return { fileId, webViewLink };
}
