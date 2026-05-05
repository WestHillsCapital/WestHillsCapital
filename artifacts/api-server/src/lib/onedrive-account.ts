/**
 * OneDrive (Microsoft Graph API) — per-account OAuth access.
 *
 * Uses per-account OAuth2 tokens stored in the accounts table via the
 * provider-agnostic storage_* columns. Uploads PDF packets to the user's
 * OneDrive under a date/client folder hierarchy.
 *
 * Token refresh: Microsoft refresh tokens are long-lived. The access token
 * expires in 1 hour; we refresh it on every upload call.
 */

import { logger } from "./logger";

const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_FOLDER_NAME = "Docuplete Submissions";

export interface OneDriveCredentials {
  accessToken: string;
  refreshToken: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface DriveItem {
  id: string;
  name?: string;
  folder?: object;
  webUrl?: string;
}

function getClientCredentials() {
  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function isOneDriveConfigured(): boolean {
  return !!getClientCredentials();
}

export function generateOneDriveAuthUrl(state: string, redirectUri: string): string | null {
  const creds = getClientCredentials();
  if (!creds) return null;
  const params = new URLSearchParams({
    client_id: creds.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "Files.ReadWrite offline_access User.Read",
    state,
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export interface OneDriveExchangeResult {
  accessToken: string;
  refreshToken: string;
  email: string;
  folderId: string;
  folderName: string;
}

export async function exchangeOneDriveCode(code: string, redirectUri: string): Promise<OneDriveExchangeResult> {
  const creds = getClientCredentials();
  if (!creds) throw new Error("OneDrive integration is not configured on this server.");

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  const tokenData = await tokenRes.json() as TokenResponse;
  if (tokenData.error || !tokenData.access_token || !tokenData.refresh_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? "OneDrive token exchange failed.");
  }

  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;

  const userRes = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const userData = await userRes.json() as { mail?: string; userPrincipalName?: string };
  const email = userData.mail ?? userData.userPrincipalName ?? "";

  const folderId = await getOrCreateRootFolder(accessToken, DEFAULT_FOLDER_NAME);

  return { accessToken, refreshToken, email, folderId, folderName: DEFAULT_FOLDER_NAME };
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const creds = getClientCredentials();
  if (!creds) throw new Error("OneDrive not configured.");
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "Files.ReadWrite offline_access User.Read",
    }).toString(),
  });
  const data = await tokenRes.json() as TokenResponse;
  if (data.error || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "OneDrive token refresh failed.");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
  };
}

async function graphRequest(accessToken: string, path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("https://") ? path : `${GRAPH_BASE}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers ?? {}),
    },
  });
}

async function getOrCreateRootFolder(accessToken: string, name: string): Promise<string> {
  const checkRes = await graphRequest(accessToken, `/me/drive/root:/${encodeURIComponent(name)}`);
  if (checkRes.ok) {
    const item = await checkRes.json() as DriveItem;
    return item.id;
  }
  const createRes = await graphRequest(accessToken, "/me/drive/root/children", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create OneDrive folder: ${err}`);
  }
  const item = await createRes.json() as DriveItem;
  return item.id;
}

async function getOrCreateSubfolder(accessToken: string, name: string, parentId: string): Promise<string> {
  const checkRes = await graphRequest(accessToken, `/me/drive/items/${parentId}:/${encodeURIComponent(name)}`);
  if (checkRes.ok) {
    const item = await checkRes.json() as DriveItem;
    if (item.folder !== undefined) return item.id;
  }
  const createRes = await graphRequest(accessToken, `/me/drive/items/${parentId}/children`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create OneDrive subfolder "${name}": ${err}`);
  }
  const item = await createRes.json() as DriveItem;
  return item.id;
}

export async function verifyOneDriveFolderAccess(
  creds: OneDriveCredentials,
  folderId: string,
): Promise<string> {
  const { accessToken } = await refreshAccessToken(creds.refreshToken);
  const res = await graphRequest(accessToken, `/me/drive/items/${folderId}`);
  if (!res.ok) {
    throw new Error("Cannot access that OneDrive folder. Make sure the item ID is correct and accessible.");
  }
  const item = await res.json() as DriveItem;
  if (!item.folder) {
    throw new Error("The specified OneDrive item is not a folder.");
  }
  return item.name ?? folderId;
}

export interface OneDriveUploadResult {
  fileId: string;
  webViewLink: string;
}

export async function uploadPdfToOneDrive(
  creds: OneDriveCredentials,
  rootFolderId: string,
  pdfBuffer: Buffer,
  packet: {
    firstName: string;
    lastName: string;
    packageName: string;
    generatedAt: string;
  },
): Promise<OneDriveUploadResult> {
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

  const yearFolderId = await getOrCreateSubfolder(accessToken, yyyy, rootFolderId);
  const monthFolderId = await getOrCreateSubfolder(accessToken, `${mm} \u2013 ${month}`, yearFolderId);
  const clientFolderId = await getOrCreateSubfolder(accessToken, clientLabel, monthFolderId);

  const uploadRes = await graphRequest(
    accessToken,
    `/me/drive/items/${clientFolderId}:/${encodeURIComponent(fileName)}:/content`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: pdfBuffer,
    },
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`OneDrive upload failed: ${err}`);
  }

  const item = await uploadRes.json() as DriveItem & { id: string; webUrl?: string };
  const fileId = item.id;
  const webViewLink = item.webUrl ?? `https://onedrive.live.com/edit.aspx?resid=${fileId}`;
  logger.info({ fileId, clientFolder: clientLabel, fileName }, "[OneDrive] PDF uploaded");
  return { fileId, webViewLink };
}
