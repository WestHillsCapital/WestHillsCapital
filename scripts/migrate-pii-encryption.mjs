#!/usr/bin/env node
/**
 * One-time migration: encrypt all existing plaintext session answers.
 *
 * Run AFTER deploying the code changes that add answers_ciphertext column.
 * Requires DATABASE_URL and ENCRYPTION_MASTER_KEY environment variables.
 *
 * Usage:
 *   node scripts/migrate-pii-encryption.mjs
 *   node scripts/migrate-pii-encryption.mjs --dry-run   (count only, no writes)
 */

import { createCipheriv, randomBytes } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const DRY_RUN = process.argv.includes("--dry-run");

// ── Key material ───────────────────────────────────────────────────────────────

function getMasterKey() {
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) throw new Error("ENCRYPTION_MASTER_KEY env var is not set");
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) throw new Error("ENCRYPTION_MASTER_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

function aesEncrypt(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function encryptDek(dek, masterKey) {
  return aesEncrypt(dek, masterKey);
}

function encryptAnswers(answers, dek) {
  const json = JSON.stringify(answers);
  return aesEncrypt(Buffer.from(json, "utf8"), dek);
}

// ── Migration ─────────────────────────────────────────────────────────────────

const masterKey = getMasterKey();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log(`[migrate-pii-encryption] Starting${DRY_RUN ? " (DRY RUN)" : ""}…`);

  // 1. Count sessions that need migration
  const { rows: countRows } = await db.query(`
    SELECT COUNT(*) AS total
      FROM docufill_interview_sessions
     WHERE answers_ciphertext IS NULL
       AND answers != '{}'::jsonb
  `);
  const total = Number(countRows[0].total);
  console.log(`[migrate-pii-encryption] Sessions to migrate: ${total}`);

  if (total === 0) {
    console.log("[migrate-pii-encryption] Nothing to do — all sessions already encrypted or empty.");
    await db.end();
    return;
  }

  if (DRY_RUN) {
    console.log("[migrate-pii-encryption] Dry run complete — no writes performed.");
    await db.end();
    return;
  }

  // 2. Process accounts in batches (fetch/create DEK per account)
  const { rows: accounts } = await db.query(`
    SELECT DISTINCT s.account_id, a.encrypted_dek
      FROM docufill_interview_sessions s
      JOIN accounts a ON a.id = s.account_id
     WHERE s.answers_ciphertext IS NULL
       AND s.answers != '{}'::jsonb
  `);
  console.log(`[migrate-pii-encryption] Accounts to process: ${accounts.length}`);

  const dekByAccount = new Map();
  for (const acc of accounts) {
    let dek;
    if (acc.encrypted_dek) {
      // Re-derive from existing encrypted DEK using master key
      const { createDecipheriv } = await import("node:crypto");
      const parts = acc.encrypted_dek.split(":");
      const iv = Buffer.from(parts[0], "hex");
      const tag = Buffer.from(parts[1], "hex");
      const ct = Buffer.from(parts[2], "hex");
      const decipher = createDecipheriv("aes-256-gcm", masterKey, iv);
      decipher.setAuthTag(tag);
      dek = Buffer.concat([decipher.update(ct), decipher.final()]);
    } else {
      dek = randomBytes(32);
      const encryptedDek = encryptDek(dek, masterKey);
      await db.query(`UPDATE accounts SET encrypted_dek = $1 WHERE id = $2`, [encryptedDek, acc.account_id]);
      console.log(`[migrate-pii-encryption] Created DEK for account ${acc.account_id}`);
    }
    dekByAccount.set(acc.account_id, dek);
  }

  // 3. Migrate sessions in batches of 100
  const BATCH_SIZE = 100;
  let offset = 0;
  let migrated = 0;

  while (true) {
    const { rows: sessions } = await db.query(`
      SELECT id, account_id, answers
        FROM docufill_interview_sessions
       WHERE answers_ciphertext IS NULL
         AND answers != '{}'::jsonb
       ORDER BY id
       LIMIT $1 OFFSET $2
    `, [BATCH_SIZE, offset]);

    if (sessions.length === 0) break;

    for (const session of sessions) {
      const dek = dekByAccount.get(session.account_id);
      if (!dek) {
        console.warn(`[migrate-pii-encryption] No DEK for account ${session.account_id} — skipping session ${session.id}`);
        continue;
      }
      const answers = typeof session.answers === "object" && session.answers ? session.answers : {};
      const ciphertext = encryptAnswers(answers, dek);
      await db.query(`
        UPDATE docufill_interview_sessions
           SET answers_ciphertext = $1,
               answers = '{}'::jsonb,
               updated_at = NOW()
         WHERE id = $2
      `, [ciphertext, session.id]);
      migrated++;
    }

    console.log(`[migrate-pii-encryption] Progress: ${migrated}/${total}`);
    offset += BATCH_SIZE;
    if (sessions.length < BATCH_SIZE) break;
  }

  console.log(`[migrate-pii-encryption] Done — migrated ${migrated} sessions.`);
  await db.end();
}

main().catch((err) => {
  console.error("[migrate-pii-encryption] FATAL:", err);
  process.exit(1);
});
