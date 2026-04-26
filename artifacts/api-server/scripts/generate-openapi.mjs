/**
 * generate-openapi.mjs
 *
 * Runs swagger-jsdoc over the TypeScript route files to collect
 * all @openapi JSDoc annotations, merges them with the top-level
 * definition, and writes the combined spec to src/lib/openapi-spec.json.
 *
 * Called automatically by build.mjs before esbuild bundling.
 */
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const swaggerJsdoc = require("swagger-jsdoc");

const __dirname = dirname(fileURLToPath(import.meta.url));
const routesDir = resolve(__dirname, "../src/routes");
const outFile = resolve(__dirname, "../src/lib/openapi-spec.json");

const definition = {
  openapi: "3.1.0",
  info: {
    title: "DocuPak / DocuFill API",
    version: "1.0.0",
    description: [
      "API for the **DocuPak** SaaS platform and its embedded **DocuFill** paperwork engine.",
      "",
      "## Authentication",
      "",
      "| Scope | Scheme | How to obtain |",
      "|-------|--------|---------------|",
      "| Public routes | None | N/A |",
      "| Product portal (SaaS) | `Authorization: Bearer <clerk_jwt>` | Clerk front-end SDK |",
      "| Internal (WHC staff) | `Authorization: Bearer <session_token>` | `POST /api/internal/auth/sign-in` |",
      "",
      "## Base URL",
      "All paths below are relative to `/api`.",
    ].join("\n"),
    contact: { name: "DocuPak Engineering" },
  },
  servers: [{ url: "/api", description: "Current server" }],
  components: {
    securitySchemes: {
      productAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Clerk JWT",
        description: "Short-lived Clerk JWT issued by the product portal front-end.",
      },
      internalAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Session token",
        description: "Opaque session token issued by `POST /api/internal/auth/sign-in`. WHC staff only.",
      },
    },
    schemas: {
      OrgSettings: {
        type: "object",
        properties: {
          id:          { type: "integer" },
          name:        { type: "string", example: "Acme Capital" },
          slug:        { type: "string", example: "acme-capital" },
          logo_url:    { type: "string", nullable: true, example: "/api/storage/org-logo/42" },
          brand_color: { type: "string", example: "#C49A38", description: "Six-digit hex accent color" },
        },
      },
      DocuFillSession: {
        type: "object",
        properties: {
          id:               { type: "integer" },
          token:            { type: "string", example: "df_abc123" },
          package_id:       { type: "integer" },
          package_name:     { type: "string" },
          status:           { type: "string", enum: ["draft", "in_progress", "generated"] },
          answers:          { type: "object", additionalProperties: true },
          prefill:          { type: "object", additionalProperties: true },
          fields:           { type: "array", items: { type: "object" } },
          documents:        { type: "array", items: { type: "object" } },
          mappings:         { type: "array", items: { type: "object" } },
          custodian_name:   { type: "string", nullable: true },
          depository_name:  { type: "string", nullable: true },
          org_name:         { type: "string", nullable: true },
          org_logo_url:     { type: "string", nullable: true },
          org_brand_color:  { type: "string", nullable: true, example: "#C49A38" },
          transaction_scope: { type: "string", nullable: true },
          expires_at:       { type: "string", format: "date-time" },
          created_at:       { type: "string", format: "date-time" },
          updated_at:       { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
    },
  },
};

const spec = swaggerJsdoc({
  definition,
  apis: [
    `${routesDir}/storage.ts`,
    `${routesDir}/settings.ts`,
    `${routesDir}/docufill.ts`,
    `${routesDir}/deals.ts`,
  ],
});

mkdirSync(resolve(__dirname, "../src/lib"), { recursive: true });
writeFileSync(outFile, JSON.stringify(spec, null, 2));
console.log(`[generate-openapi] Wrote ${outFile}`);
