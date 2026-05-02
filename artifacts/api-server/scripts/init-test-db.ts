/**
 * Initialises the test database schema.
 *
 * Called by the cross-tenant isolation CI workflow before running integration
 * tests so that the required tables (accounts, docufill_packages,
 * docufill_interview_sessions, …) exist in the fresh Postgres container.
 *
 * Usage:
 *   node --import tsx/esm scripts/init-test-db.ts
 */

import { initDb, getDb } from "../src/db.js";

process.env.NODE_ENV = "test";

try {
  await initDb();
  console.log("Test database initialised successfully.");
} catch (err) {
  console.error("Failed to initialise test database:", err);
  process.exit(1);
} finally {
  await getDb().end().catch(() => {});
}
