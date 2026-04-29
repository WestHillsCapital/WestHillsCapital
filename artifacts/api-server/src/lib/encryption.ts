import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import type { Pool } from "pg";

// ── Key material ───────────────────────────────────────────────────────────────

function getMasterKey(): Buffer {
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) throw new Error("[Encryption] ENCRYPTION_MASTER_KEY env var is not set");
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) throw new Error("[Encryption] ENCRYPTION_MASTER_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

export function isEncryptionEnabled(): boolean {
  return !!process.env.ENCRYPTION_MASTER_KEY;
}

// ── AES-256-GCM primitives ─────────────────────────────────────────────────────

function aesEncrypt(plaintext: Buffer, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function aesDecrypt(encoded: string, key: Buffer): Buffer {
  const parts = encoded.split(":");
  if (parts.length !== 3) throw new Error("[Encryption] Invalid ciphertext format — expected 3 colon-separated parts");
  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

// ── DEK management ─────────────────────────────────────────────────────────────

export function generateDek(): Buffer {
  return randomBytes(32);
}

export function encryptDek(dek: Buffer): string {
  return aesEncrypt(dek, getMasterKey());
}

export function decryptDek(encryptedDek: string): Buffer {
  return aesDecrypt(encryptedDek, getMasterKey());
}

// ── Session answers encryption ─────────────────────────────────────────────────

export function encryptAnswers(answers: Record<string, unknown>, dek: Buffer): string {
  const json = JSON.stringify(answers);
  return aesEncrypt(Buffer.from(json, "utf8"), dek);
}

export function decryptAnswers(ciphertext: string, dek: Buffer): Record<string, unknown> {
  const json = aesDecrypt(ciphertext, dek).toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

// ── In-process DEK cache + auto-provision ─────────────────────────────────────
// DEKs are cached per account so the DB is only hit once per process lifetime
// per account. On server restart the cache is warm-filled on first access.

const dekCache = new Map<number, Buffer>();

export async function getOrCreateAccountDek(accountId: number, db: Pool): Promise<Buffer> {
  const cached = dekCache.get(accountId);
  if (cached) return cached;

  const { rows } = await db.query<{ encrypted_dek: string | null }>(
    `SELECT encrypted_dek FROM accounts WHERE id = $1`,
    [accountId],
  );
  const row = rows[0];
  if (!row) throw new Error(`[Encryption] Account ${accountId} not found when looking up DEK`);

  let dek: Buffer;
  if (row.encrypted_dek) {
    dek = decryptDek(row.encrypted_dek);
  } else {
    dek = generateDek();
    const encryptedDek = encryptDek(dek);
    await db.query(`UPDATE accounts SET encrypted_dek = $1 WHERE id = $2`, [encryptedDek, accountId]);
  }

  dekCache.set(accountId, dek);
  return dek;
}

export function clearDekCache(accountId?: number): void {
  if (accountId !== undefined) {
    dekCache.delete(accountId);
  } else {
    dekCache.clear();
  }
}
