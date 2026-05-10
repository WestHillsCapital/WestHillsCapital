/**
 * Master key rotation script — re-encrypts all per-account DEKs under a new master key.
 *
 * Usage (from project root):
 *   node artifacts/api-server/scripts/rotate-master-key.mjs [--dry-run] [--from-version N]
 *
 * Options:
 *   --dry-run            Print what would be changed without writing anything.
 *   --from-version N     Only rotate accounts whose dek_version = N (default: 1).
 *                        Use this to target a specific generation of DEKs.
 *
 * Required env vars:
 *   DATABASE_URL                — Postgres connection string
 *   OLD_ENCRYPTION_MASTER_KEY   — Current master key (64 hex chars = 32 bytes)
 *   NEW_ENCRYPTION_MASTER_KEY   — Replacement master key (64 hex chars = 32 bytes)
 *
 * Safety notes:
 *   - Run with --dry-run first to verify the account count and that the old key decrypts correctly.
 *   - All updates are committed in a single serializable transaction that also holds row-level
 *     locks (SELECT … FOR UPDATE). Concurrent modifications to those rows are blocked for the
 *     duration of the transaction, preventing a mixed-key state on existing accounts.
 *   - The --from-version filter makes the script truly re-runnable: after a successful run,
 *     all rotated rows are at version N+1. Re-running with the same --from-version N will find
 *     0 rows and exit cleanly.
 *   - New accounts created while the script is running will have DEKs wrapped by the old key.
 *     After committing, run the script once more (same flags) to catch stragglers, then update
 *     ENCRYPTION_MASTER_KEY and restart services. See docs/deployment.md for the full procedure.
 *   - After a successful run, update ENCRYPTION_MASTER_KEY to the value of NEW_ENCRYPTION_MASTER_KEY
 *     and restart the API server and worker.
 */

import { createRequire } from "module";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

// ── CLI flags ───────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");

const fromVersionArg = process.argv.indexOf("--from-version");
const FROM_VERSION = fromVersionArg !== -1 ? parseInt(process.argv[fromVersionArg + 1], 10) : 1;

if (isNaN(FROM_VERSION) || FROM_VERSION < 1) {
  console.error("ERROR: --from-version must be a positive integer.");
  process.exit(1);
}

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
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
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
  console.log(`Targeting accounts at dek_version = ${FROM_VERSION}`);
  console.log();

  const oldKey = requireHexKey("OLD_ENCRYPTION_MASTER_KEY");
  const newKey = requireHexKey("NEW_ENCRYPTION_MASTER_KEY");

  if (oldKey.equals(newKey)) {
    console.error("ERROR: OLD_ENCRYPTION_MASTER_KEY and NEW_ENCRYPTION_MASTER_KEY are identical. Nothing to do.");
    process.exit(1);
  }

  const db = new Pool({ connectionString: process.env.DATABASE_URL });

  if (DRY_RUN) {
    // Dry run: query without locking to preview what would change.
    const { rows } = await db.query(
      `SELECT id, encrypted_dek, dek_version
       FROM accounts
       WHERE encrypted_dek IS NOT NULL AND dek_version = $1
       ORDER BY id`,
      [FROM_VERSION],
    );

    console.log(`Accounts at dek_version ${FROM_VERSION}: ${rows.length}`);
    if (rows.length === 0) {
      console.log("Nothing to rotate. Either already rotated or no accounts have a DEK at this version.");
      await db.end();
      return;
    }
    console.log();

    let errors = 0;
    for (const row of rows) {
      try {
        aesDecrypt(row.encrypted_dek, oldKey);
        console.log(`  account ${row.id}: OK  (dek_version ${row.dek_version} → ${row.dek_version + 1})`);
      } catch (err) {
        console.error(`  account ${row.id}: FAILED to decrypt — ${err.message}`);
        errors++;
      }
    }

    console.log();
    if (errors > 0) {
      console.error(`DRY RUN: ${errors} account(s) would fail. Check that OLD_ENCRYPTION_MASTER_KEY matches ENCRYPTION_MASTER_KEY.`);
    } else {
      console.log(`DRY RUN complete. ${rows.length} account(s) would be re-encrypted from dek_version ${FROM_VERSION} → ${FROM_VERSION + 1}.`);
      console.log("Re-run without --dry-run to apply changes.");
    }

    await db.end();
    return;
  }

  // ── Live run: all work inside ONE serializable transaction with row locks ──
  const client = await db.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

    // SELECT … FOR UPDATE acquires row-level locks, blocking concurrent DEK
    // writes for these accounts until our transaction commits.
    const { rows } = await client.query(
      `SELECT id, encrypted_dek, dek_version
       FROM accounts
       WHERE encrypted_dek IS NOT NULL AND dek_version = $1
       ORDER BY id
       FOR UPDATE`,
      [FROM_VERSION],
    );

    console.log(`Accounts at dek_version ${FROM_VERSION}: ${rows.length}`);
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      console.log("Nothing to rotate. Re-run check: all accounts at this version have already been migrated.");
      client.release();
      await db.end();
      return;
    }
    console.log();

    // Decrypt + re-encrypt in memory; abort the entire transaction on any failure.
    const rotated = [];
    for (const row of rows) {
      try {
        const dek = aesDecrypt(row.encrypted_dek, oldKey);
        const newEncryptedDek = aesEncrypt(dek, newKey);
        rotated.push({ id: row.id, newEncryptedDek, oldVersion: row.dek_version });
        console.log(`  account ${row.id}: OK  (dek_version ${row.dek_version} → ${row.dek_version + 1})`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error();
        console.error(`ERROR: account ${row.id} failed to decrypt — ${err.message}`);
        console.error("Transaction rolled back. No rows were modified.");
        console.error("Check that OLD_ENCRYPTION_MASTER_KEY matches the current ENCRYPTION_MASTER_KEY.");
        client.release();
        await db.end();
        process.exit(1);
      }
    }

    // Write all re-encrypted DEKs.
    for (const { id, newEncryptedDek, oldVersion } of rotated) {
      await client.query(
        `UPDATE accounts SET encrypted_dek = $1, dek_version = $2 WHERE id = $3`,
        [newEncryptedDek, oldVersion + 1, id],
      );
    }

    await client.query("COMMIT");

    console.log();
    console.log(`SUCCESS: ${rotated.length} account(s) re-encrypted (dek_version ${FROM_VERSION} → ${FROM_VERSION + 1}).`);
    console.log();
    console.log("Next steps:");
    console.log(`  1. Re-run this script (--from-version ${FROM_VERSION}) to catch any accounts created during rotation.`);
    console.log("     If output is 'Nothing to rotate', all accounts are migrated.");
    console.log("  2. Update ENCRYPTION_MASTER_KEY secret to the value of NEW_ENCRYPTION_MASTER_KEY.");
    console.log("  3. Restart the API server and worker processes.");
    console.log("  4. Verify startup logs show normal operation (no decryption errors).");
    console.log("  5. Delete OLD_ENCRYPTION_MASTER_KEY from secrets — it is no longer valid.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`ERROR: Unexpected failure — ${err.message}`);
    console.error("Transaction rolled back. No rows were modified.");
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
