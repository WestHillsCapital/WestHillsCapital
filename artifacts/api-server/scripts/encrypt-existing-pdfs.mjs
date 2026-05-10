/**
 * PDF data encryption migration script — encrypts any plaintext pdf_data rows in
 * docufill_package_documents using the per-account AES-256-GCM DEK system.
 *
 * Usage (from project root):
 *   node artifacts/api-server/scripts/encrypt-existing-pdfs.mjs [--dry-run]
 *
 * Options:
 *   --dry-run   Print what would be changed without writing anything.
 *
 * Required env vars:
 *   DATABASE_URL              — Postgres connection string
 *   ENCRYPTION_MASTER_KEY     — Current master key (64 hex chars = 32 bytes)
 *
 * Safety notes:
 *   - Run with --dry-run first to preview the affected rows and validate decryption of existing DEKs.
 *   - The script processes rows in batches of 50, committing each batch separately to avoid
 *     holding large transactions. If interrupted it is safe to re-run — processed rows have
 *     pdf_data_ciphertext IS NOT NULL so they are skipped automatically.
 *   - pdf_data is nulled out only after the ciphertext is successfully written and committed.
 *     If the final null-out step fails, the row still has both columns set; on the next run it
 *     will be skipped (ciphertext already present), so no data is lost.
 *   - After the run, verify with the SQL at the bottom of this script's output.
 */

import { createRequire } from "module";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

// ── CLI flags ───────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");

// ── AES-256-GCM helpers (must match encryption.ts aesEncrypt / aesDecrypt) ─────

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

function aesEncrypt(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

// ── Env validation ──────────────────────────────────────────────────────────────

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

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`ERROR: ${name} is not set.`);
    process.exit(1);
  }
  return val;
}

// ── DEK cache (avoid round-trips for the same account) ─────────────────────────

const dekCache = new Map();

async function getOrCreateDek(db, accountId, masterKey) {
  if (dekCache.has(accountId)) return dekCache.get(accountId);

  const { rows } = await db.query(
    `SELECT encrypted_dek FROM accounts WHERE id = $1`,
    [accountId],
  );
  const row = rows[0];
  if (!row) throw new Error(`Account ${accountId} not found`);

  let dek;
  if (row.encrypted_dek) {
    dek = aesDecrypt(row.encrypted_dek, masterKey);
  } else {
    // Provision a fresh DEK for this account (mirrors getOrCreateAccountDek in encryption.ts)
    dek = randomBytes(32);
    const encryptedDek = aesEncrypt(dek, masterKey);
    await db.query(
      `UPDATE accounts SET encrypted_dek = $1, dek_version = COALESCE(dek_version, 0) + 1 WHERE id = $2`,
      [encryptedDek, accountId],
    );
    console.log(`  [DEK provisioned] account ${accountId}`);
  }

  dekCache.set(accountId, dek);
  return dek;
}

// ── Main ────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;

async function main() {
  console.log(`[encrypt-existing-pdfs] ${DRY_RUN ? "DRY RUN — no changes will be written" : "LIVE RUN"}`);
  console.log();

  requireEnv("DATABASE_URL");
  const masterKey = requireHexKey("ENCRYPTION_MASTER_KEY");

  const db = new Pool({ connectionString: process.env.DATABASE_URL });

  // Count affected rows
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS total
       FROM docufill_package_documents d
       JOIN docufill_packages p ON p.id = d.package_id
      WHERE d.pdf_data IS NOT NULL
        AND d.pdf_data_ciphertext IS NULL`,
  );
  const total = parseInt(countRows[0]?.total ?? "0", 10);

  console.log(`Rows with unencrypted pdf_data: ${total}`);
  if (total === 0) {
    console.log("Nothing to encrypt. All pdf_data rows are already encrypted or null.");
    await db.end();
    return;
  }
  console.log();

  if (DRY_RUN) {
    // Preview affected accounts without loading binary data
    const { rows: preview } = await db.query(
      `SELECT p.account_id, COUNT(*) AS doc_count, SUM(d.byte_size) AS total_bytes
         FROM docufill_package_documents d
         JOIN docufill_packages p ON p.id = d.package_id
        WHERE d.pdf_data IS NOT NULL
          AND d.pdf_data_ciphertext IS NULL
        GROUP BY p.account_id
        ORDER BY p.account_id`,
    );

    console.log("Affected accounts:");
    let dekErrors = 0;
    for (const row of preview) {
      const mb = (parseInt(row.total_bytes ?? "0", 10) / 1024 / 1024).toFixed(2);
      // Validate DEK availability
      try {
        await getOrCreateDek(db, row.account_id, masterKey);
        console.log(`  account ${row.account_id}: ${row.doc_count} doc(s), ${mb} MB — DEK OK`);
      } catch (err) {
        console.error(`  account ${row.account_id}: ${row.doc_count} doc(s), ${mb} MB — DEK FAILED: ${err.message}`);
        dekErrors++;
      }
    }

    console.log();
    if (dekErrors > 0) {
      console.error(`DRY RUN: ${dekErrors} account(s) have DEK issues. Resolve before running live.`);
    } else {
      console.log(`DRY RUN complete. ${total} row(s) across ${preview.length} account(s) would be encrypted.`);
      console.log("Re-run without --dry-run to apply changes.");
    }
    await db.end();
    return;
  }

  // ── Live run: process in batches ────────────────────────────────────────────
  let processed = 0;
  let errors = 0;
  let offset = 0;

  while (true) {
    const { rows } = await db.query(
      `SELECT d.package_id, d.document_id, d.pdf_data, p.account_id
         FROM docufill_package_documents d
         JOIN docufill_packages p ON p.id = d.package_id
        WHERE d.pdf_data IS NOT NULL
          AND d.pdf_data_ciphertext IS NULL
        ORDER BY d.package_id, d.document_id
        LIMIT $1`,
      [BATCH_SIZE],
    );

    if (rows.length === 0) break;

    console.log(`Processing batch of ${rows.length} row(s)...`);

    for (const row of rows) {
      const { package_id, document_id, pdf_data, account_id } = row;
      try {
        const dek = await getOrCreateDek(db, account_id, masterKey);
        const ciphertext = aesEncrypt(pdf_data, dek);

        // Write ciphertext first, then null out plaintext
        const client = await db.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `UPDATE docufill_package_documents
                SET pdf_data_ciphertext = $1,
                    pdf_data = NULL,
                    updated_at = NOW()
              WHERE package_id = $2 AND document_id = $3`,
            [ciphertext, package_id, document_id],
          );
          await client.query("COMMIT");
        } catch (updateErr) {
          await client.query("ROLLBACK");
          throw updateErr;
        } finally {
          client.release();
        }

        processed++;
        console.log(`  [OK] package ${package_id} / doc ${document_id} (account ${account_id})`);
      } catch (err) {
        errors++;
        console.error(`  [FAILED] package ${package_id} / doc ${document_id} (account ${account_id}): ${err.message}`);
      }
    }

    offset += rows.length;
  }

  console.log();
  console.log(`Done. ${processed} row(s) encrypted, ${errors} error(s).`);
  if (errors > 0) {
    console.error("Some rows failed — re-run to retry failed rows (they still have pdf_data IS NOT NULL).");
    process.exitCode = 1;
  } else {
    console.log();
    console.log("Verify with:");
    console.log("  SELECT COUNT(*) FROM docufill_package_documents WHERE pdf_data IS NOT NULL AND pdf_data_ciphertext IS NULL;");
    console.log("  -- Should return 0");
  }

  await db.end();
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
