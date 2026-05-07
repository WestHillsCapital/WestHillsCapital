/**
 * Master key rotation script — re-encrypts all per-account DEKs under a new master key.
 *
 * Usage (from project root):
 *   node artifacts/api-server/scripts/rotate-master-key.mjs [--dry-run]
 *
 * Options:
 *   --dry-run   Print what would be changed without writing anything to the database.
 *
 * Required env vars:
 *   DATABASE_URL                — Postgres connection string
 *   OLD_ENCRYPTION_MASTER_KEY   — Current master key (64 hex chars = 32 bytes)
 *   NEW_ENCRYPTION_MASTER_KEY   — Replacement master key (64 hex chars = 32 bytes)
 *
 * Safety notes:
 *   - Run with --dry-run first to verify the account count and that the old key decrypts correctly.
 *   - All updates are committed in a single serializable transaction. If anything fails mid-run,
 *     the transaction is rolled back and no rows are changed.
 *   - After a successful run, update ENCRYPTION_MASTER_KEY to the new key value and restart
 *     the API server and worker. Do NOT leave the old key in place — see docs/deployment.md.
 *   - The script is idempotent: rows already encrypted under the new key (same ciphertext prefix
 *     round-trips correctly) are re-encrypted again, which is harmless.
 */

import { createRequire } from "module";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

// ── CLI flags ───────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");

// ── Helpers ─────────────────────────────────────────────────────────────────────

function requireHexKey(envVar) {
  const raw = process.env[envVar];
  if (!raw) {
    console.error(`ERROR: ${envVar} is not set.`);
    process.exit(1);
  }
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) {
    console.error(`ERROR: ${envVar} must be 32 bytes (64 hex chars). Got ${buf.length} bytes.`);
    process.exit(1);
  }
  return buf;
}

/**
 * AES-256-GCM decrypt. Ciphertext format: "ivHex:tagHex:ctHex"
 * Matches the format produced by encryption.ts aesEncrypt().
 */
function aesDecrypt(encoded, key) {
  const parts = encoded.split(":");
  if (parts.length !== 3) {
    throw new Error(`Invalid ciphertext format — expected 3 colon-separated parts, got ${parts.length}`);
  }
  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * AES-256-GCM encrypt. Returns "ivHex:tagHex:ctHex".
 * Matches the format produced by encryption.ts aesEncrypt().
 */
function aesEncrypt(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[rotate-master-key] ${DRY_RUN ? "DRY RUN — no changes will be written" : "LIVE RUN"}`);
  console.log();

  const oldKey = requireHexKey("OLD_ENCRYPTION_MASTER_KEY");
  const newKey = requireHexKey("NEW_ENCRYPTION_MASTER_KEY");

  if (oldKey.equals(newKey)) {
    console.error("ERROR: OLD_ENCRYPTION_MASTER_KEY and NEW_ENCRYPTION_MASTER_KEY are identical. Nothing to do.");
    process.exit(1);
  }

  const db = new Pool({ connectionString: process.env.DATABASE_URL });

  // ── Query all accounts that have a DEK ──────────────────────────────────────
  const { rows } = await db.query(
    `SELECT id, encrypted_dek, dek_version FROM accounts WHERE encrypted_dek IS NOT NULL ORDER BY id`,
  );

  console.log(`Accounts with a DEK: ${rows.length}`);
  if (rows.length === 0) {
    console.log("Nothing to rotate.");
    await db.end();
    return;
  }
  console.log();

  // ── Decrypt + re-encrypt each DEK ──────────────────────────────────────────
  const rotated = [];
  let errors = 0;

  for (const row of rows) {
    try {
      const dek = aesDecrypt(row.encrypted_dek, oldKey);
      const newEncryptedDek = aesEncrypt(dek, newKey);
      rotated.push({ id: row.id, newEncryptedDek, oldVersion: row.dek_version ?? 1 });
      console.log(`  account ${row.id}: OK  (dek_version ${row.dek_version ?? 1} → ${(row.dek_version ?? 1) + 1})`);
    } catch (err) {
      console.error(`  account ${row.id}: FAILED to decrypt — ${err.message}`);
      errors++;
    }
  }

  console.log();

  if (errors > 0) {
    console.error(`ERROR: ${errors} account(s) failed to decrypt. Aborting — no changes written.`);
    console.error("Check that OLD_ENCRYPTION_MASTER_KEY matches the key currently in ENCRYPTION_MASTER_KEY.");
    await db.end();
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(`DRY RUN complete. ${rotated.length} account(s) would be re-encrypted.`);
    console.log("Re-run without --dry-run to apply changes.");
    await db.end();
    return;
  }

  // ── Write all updates in a single serializable transaction ─────────────────
  const client = await db.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

    for (const { id, newEncryptedDek, oldVersion } of rotated) {
      await client.query(
        `UPDATE accounts SET encrypted_dek = $1, dek_version = $2 WHERE id = $3`,
        [newEncryptedDek, oldVersion + 1, id],
      );
    }

    await client.query("COMMIT");
    console.log(`SUCCESS: ${rotated.length} account(s) re-encrypted under the new master key.`);
    console.log();
    console.log("Next steps:");
    console.log("  1. Update ENCRYPTION_MASTER_KEY secret to the value of NEW_ENCRYPTION_MASTER_KEY.");
    console.log("  2. Restart the API server and worker processes.");
    console.log("  3. Verify startup logs show normal operation (no decryption errors).");
    console.log("  4. Delete OLD_ENCRYPTION_MASTER_KEY from secrets — it is no longer valid.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`ERROR: Transaction rolled back — ${err.message}`);
    console.error("No rows were modified.");
    client.release();
    await db.end();
    process.exit(1);
  }

  client.release();
  await db.end();
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
