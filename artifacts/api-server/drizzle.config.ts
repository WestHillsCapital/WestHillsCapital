import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../../lib/db/src/schema/index.ts",
  dialect: "postgresql",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder/placeholder",
  },
});
