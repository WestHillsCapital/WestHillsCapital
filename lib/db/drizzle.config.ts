// CANONICAL Drizzle config for migration generation.
// Run from the workspace root: pnpm --filter @workspace/api-server db:generate
// (which delegates to `drizzle-kit generate --config ../../lib/db/drizzle.config.ts`)
// Schema source: lib/db/src/schema/index.ts (shared across packages)
// Migration output: artifacts/api-server/drizzle/ (consumed by api-server at runtime)
import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  out: path.join(__dirname, "../../artifacts/api-server/drizzle"),
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder/placeholder",
  },
});
