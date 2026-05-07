import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Mirror the SSL logic from artifacts/api-server/src/db.ts.
// In development SSL is disabled (local dev DB has no TLS).
// In production rejectUnauthorized: true ensures certificate chain verification.
// Set DB_SSL_CA (base64-encoded PEM) for private-CA environments.
const _sslConfig: false | { rejectUnauthorized: boolean; ca?: string } =
  process.env.NODE_ENV !== "production"
    ? false
    : process.env.DB_SSL_CA
      ? {
          rejectUnauthorized: true,
          ca: Buffer.from(process.env.DB_SSL_CA, "base64").toString("utf8"),
        }
      : { rejectUnauthorized: true };

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: _sslConfig,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
