/**
 * Initialises the test database schema.
 *
 * Called by the cross-tenant isolation CI workflow before running integration
 * tests so that the required tables (accounts, docuplete_packages,
 * docuplete_interview_sessions, scim_tokens, docuplete_audit_logs, …) exist in
 * the fresh Postgres container.
 *
 * Usage:
 *   node --import tsx/esm scripts/init-test-db.ts
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initDb, getDb } from "../src/db.js";

process.env.NODE_ENV = "test";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  await initDb();
  console.log("Core schema initialised.");

  // Apply enterprise migration so scim_tokens, docuplete_audit_logs, etc. exist
  const enterpriseSql = readFileSync(
    resolve(__dirname, "../src/lib/migrate-enterprise.sql"),
    "utf8",
  );
  await getDb().query(enterpriseSql);
  console.log("Enterprise schema applied.");

  console.log("Test database initialised successfully.");
} catch (err) {
  console.error("Failed to initialise test database:", err);
  process.exit(1);
} finally {
  await getDb().end().catch(() => {});
}
