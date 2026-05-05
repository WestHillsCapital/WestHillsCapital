/**
 * Unified storage provider abstraction.
 *
 * Dispatches upload calls to whichever cloud storage provider the account has
 * connected (Google Drive, OneDrive, or Dropbox). Callers pass the account
 * row and a PDF buffer; this module handles the rest.
 *
 * The account row is expected to contain:
 *   storage_provider   TEXT  ('gdrive' | 'onedrive' | 'dropbox' | null)
 *   storage_access_token  TEXT
 *   storage_refresh_token TEXT
 *   storage_folder_id  TEXT
 */

import { uploadSessionPdfToAccountDrive } from "./google-drive-account";
import { uploadPdfToOneDrive } from "./onedrive-account";
import { uploadPdfToDropbox } from "./dropbox-account";
import { logger } from "./logger";

export type StorageProvider = "gdrive" | "onedrive" | "dropbox";

export interface StorageUploadResult {
  fileId: string;
  webViewLink: string;
}

interface AccountStorageFields {
  storage_provider?: string | null;
  storage_access_token?: string | null;
  storage_refresh_token?: string | null;
  storage_folder_id?: string | null;
}

interface PacketInfo {
  firstName: string;
  lastName: string;
  packageName: string;
  generatedAt: string;
}

/**
 * Uploads a PDF packet to whichever storage provider the account has connected.
 * Returns null if no provider is connected or credentials are incomplete.
 */
export async function uploadToStorageProvider(
  account: AccountStorageFields,
  pdfBuffer: Buffer,
  packet: PacketInfo,
): Promise<StorageUploadResult | null> {
  const provider = account.storage_provider as StorageProvider | null | undefined;
  const accessToken = account.storage_access_token;
  const refreshToken = account.storage_refresh_token;
  const folderId = account.storage_folder_id;

  if (!provider || !accessToken || !refreshToken || !folderId) {
    return null;
  }

  const creds = { accessToken, refreshToken };

  try {
    if (provider === "gdrive") {
      return await uploadSessionPdfToAccountDrive(creds, folderId, pdfBuffer, packet);
    }
    if (provider === "onedrive") {
      return await uploadPdfToOneDrive(creds, folderId, pdfBuffer, packet);
    }
    if (provider === "dropbox") {
      return await uploadPdfToDropbox(creds, folderId, pdfBuffer, packet);
    }
    logger.warn({ provider }, "[Storage] Unknown storage provider — skipping upload");
    return null;
  } catch (err) {
    logger.error({ err, provider }, "[Storage] Upload failed");
    throw err;
  }
}
