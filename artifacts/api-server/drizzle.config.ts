// LOCAL convenience config for running drizzle-kit commands directly from
// the api-server package directory (e.g. `pnpm db:generate`, `pnpm db:migrate`,
// `pnpm dlx drizzle-kit studio`).
// The canonical config for CI/scripted generation is lib/db/drizzle.config.ts
// — both configs point at the same schema source and migration output folder.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../../lib/db/src/schema/index.ts",
  dialect: "postgresql",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder/placeholder",
  },
});
