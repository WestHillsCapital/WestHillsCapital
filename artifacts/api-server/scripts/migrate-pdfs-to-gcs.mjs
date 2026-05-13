/**
 * One-time migration: move pdf_data blobs from docuplete_package_documents
 * to GCS, writing back the pdf_gcs_key and optionally nulling pdf_data.
 *
 * Usage (from project root):
 *   node artifacts/api-server/scripts/migrate-pdfs-to-gcs.mjs [--dry-run] [--null-pdf-data]
 *
 * Options:
 *   --dry-run       Print what would be migrated without making any changes.
 *   --null-pdf-data After a successful GCS upload, set pdf_data = NULL to reclaim
 *                   Postgres storage. Only applies to rows that were successfully
 *                   uploaded. Omitting this flag leaves pdf_data intact as a fallback.
 *
 * Required env vars:
 *   DATABASE_URL        — Postgres connection string
 *   PRIVATE_OBJECT_DIR  — GCS bucket path prefix (e.g. gs://my-bucket/private)
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const { Pool } = require("pg");
const { Storage } = require("@google-cloud/storage");

const DRY_RUN = process.argv.includes("--dry-run");
const NULL_PDF_DATA = process.argv.includes("--null-pdf-data");

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

/**
 * Build a GCS Storage client using the same credential strategy as objectStorage.ts:
 *  1. Replit sidecar (REPL_ID or REPLIT_DOMAINS set)
 *  2. GOOGLE_SERVICE_ACCOUNT_KEY JSON string
 *  3. Bare ADC fallback (only valid if explicit GCP credentials are in the environment)
 */
function buildStorageClient() {
  if (process.env.REPL_ID || process.env.REPLIT_DOMAINS) {
    console.log("Auth: Replit managed sidecar");
    return new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: { type: "json", subject_token_field_name: "access_token" },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
  }
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    console.log("Auth: GOOGLE_SERVICE_ACCOUNT_KEY");
    const credentials = JSON.parse(serviceAccountKey);
    return new Storage({ credentials, projectId: credentials.project_id });
  }
  console.warn("WARN: Neither REPL_ID/REPLIT_DOMAINS nor GOOGLE_SERVICE_ACCOUNT_KEY is set — falling back to ADC");
  return new Storage();
}

/**
 * Parse PRIVATE_OBJECT_DIR using the same logic as the runtime's parseObjectPath:
 *   gs://bucket/prefix  →  { bucketName: "bucket", prefix: "prefix" }
 *   /bucket/prefix      →  { bucketName: "bucket", prefix: "prefix" }
 *   bucket/prefix       →  { bucketName: "bucket", prefix: "prefix" }
 *   bucket              →  { bucketName: "bucket", prefix: "" }
 */
function parsePrivateObjectDir(envVal) {
  if (!envVal) throw new Error("PRIVATE_OBJECT_DIR is not set");
  // Strip gs:// scheme if present, then ensure leading slash for uniform parsing.
  let normalized = envVal.replace(/^gs:\/\//, "");
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  const parts = normalized.split("/");
  // parts[0] is always "" (before the leading slash)
  const bucketName = parts[1] ?? "";
  const prefix = parts.slice(2).join("/");
  if (!bucketName) throw new Error(`PRIVATE_OBJECT_DIR "${envVal}" does not contain a valid bucket name`);
  return { bucketName, prefix };
}

async function uploadToGcs(storage, bucketName, prefix, objectId, buffer) {
  const fullPath = prefix ? `${prefix}/${objectId}` : objectId;
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fullPath);
  await file.save(buffer, { contentType: "application/pdf", resumable: false });
  return `/objects/${objectId}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { bucketName, prefix } = parsePrivateObjectDir(process.env.PRIVATE_OBJECT_DIR);
  const storage = buildStorageClient();

  console.log(`GCS bucket: ${bucketName}, prefix: ${prefix || "(none)"}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}${NULL_PDF_DATA ? " + null pdf_data after upload" : ""}`);
  console.log("");

  const { rows } = await pool.query(`
    SELECT d.id, d.package_id, d.document_id, d.byte_size,
           p.account_id
      FROM docuplete_package_documents d
      JOIN docuplete_packages p ON p.id = d.package_id
     WHERE d.pdf_data IS NOT NULL
       AND d.pdf_gcs_key IS NULL
     ORDER BY d.id
  `);

  console.log(`Found ${rows.length} document(s) to migrate.`);
  if (rows.length === 0) {
    await pool.end();
    return;
  }

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    const objectId = `pdfs/${row.account_id}/${row.package_id}/${row.document_id}.pdf`;
    process.stdout.write(`  doc ${row.id} (pkg=${row.package_id}, docId=${row.document_id}, ${row.byte_size} bytes) → /objects/${objectId} … `);

    if (DRY_RUN) {
      console.log("(dry run)");
      succeeded++;
      continue;
    }

    try {
      // Fetch the binary data
      const { rows: dataRows } = await pool.query(
        "SELECT pdf_data FROM docuplete_package_documents WHERE id=$1",
        [row.id],
      );
      const pdfBuffer = dataRows[0]?.pdf_data;
      if (!pdfBuffer) {
        console.log("SKIP — pdf_data is null (already migrated?)");
        continue;
      }

      // Upload to GCS
      const gcsKey = await uploadToGcs(storage, bucketName, prefix, objectId, pdfBuffer);

      // Write back key (and optionally null pdf_data)
      if (NULL_PDF_DATA) {
        await pool.query(
          "UPDATE docuplete_package_documents SET pdf_gcs_key=$1, pdf_data=NULL, updated_at=NOW() WHERE id=$2",
          [gcsKey, row.id],
        );
      } else {
        await pool.query(
          "UPDATE docuplete_package_documents SET pdf_gcs_key=$1, updated_at=NOW() WHERE id=$2",
          [gcsKey, row.id],
        );
      }

      console.log("OK");
      succeeded++;
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
      failed++;
    }
  }

  console.log("");
  console.log(`Done. ${succeeded} succeeded, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
