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
      "| Product portal (API key) | `Authorization: Bearer sk_live_…` | `POST /api/v1/product/auth/api-keys` |",
      "| Internal (WHC staff) | `Authorization: Bearer <session_token>` | `POST /api/internal/auth/sign-in` |",
      "",
      "## API Key Authentication",
      "",
      "External integration partners can authenticate using a long-lived API key instead of a Clerk JWT. API keys:",
      "- Are prefixed with `sk_live_`",
      "- Are stored hashed (SHA-256) — the plaintext is returned only once on creation",
      "- Can be named, listed, and revoked via `/api/v1/product/auth/api-keys`",
      "- Are accepted wherever a Clerk JWT is accepted on product routes",
      "",
      "## Base URL",
      "All paths below are relative to `/api/v1`.",
    ].join("\n"),
    contact: { name: "DocuPak Engineering" },
  },
  servers: [{ url: "/api/v1", description: "Current server (v1)" }],
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
      apiKeyAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key (sk_live_…)",
        description:
          "Long-lived API key issued by `POST /api/v1/product/auth/api-keys`. For external integration partners. " +
          "Keys are prefixed with `sk_live_` and are stored hashed — the plaintext is shown only once on creation.",
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
      DocuFillPackage: {
        type: "object",
        description: "A Docuplete package — a reusable interview template that defines the documents, fields, and configuration for a document workflow.",
        required: ["id", "name", "active", "created_at", "updated_at"],
        properties: {
          id:               { type: "integer", example: 7 },
          account_id:       { type: "integer" },
          name:             { type: "string", example: "IRA Rollover Packet" },
          active:           { type: "boolean", description: "Only active packages can have sessions created against them." },
          description:      { type: "string", nullable: true },
          transaction_scope: { type: "string", nullable: true, example: "IRA" },
          custodian_id:     { type: "integer", nullable: true },
          custodian_name:   { type: "string", nullable: true },
          depository_id:    { type: "integer", nullable: true },
          depository_name:  { type: "string", nullable: true },
          webhook_url:      { type: "string", nullable: true, format: "uri" },
          recipient_email:  { type: "string", nullable: true, format: "email" },
          fields:           { type: "array", items: { type: "object" } },
          documents:        { type: "array", items: { type: "object" } },
          created_at:       { type: "string", format: "date-time" },
          updated_at:       { type: "string", format: "date-time" },
        },
      },
      DocuFillSessionListItem: {
        type: "object",
        description: "A lightweight session summary returned by the session list endpoint.",
        required: ["id", "token", "package_id", "package_name", "status", "created_at", "updated_at", "expires_at"],
        properties: {
          id:           { type: "integer" },
          token:        { type: "string", example: "df_abc123" },
          package_id:   { type: "integer" },
          package_name: { type: "string" },
          status:       { type: "string", enum: ["draft", "in_progress", "generated"] },
          created_at:   { type: "string", format: "date-time" },
          updated_at:   { type: "string", format: "date-time" },
          expires_at:   { type: "string", format: "date-time" },
        },
      },
      AccountInfo: {
        type: "object",
        description: "Account and user information returned by the `/product/auth/me` endpoint.",
        required: ["accountId", "accountName", "slug", "role"],
        properties: {
          accountId:   { type: "integer", description: "Numeric account ID." },
          accountName: { type: "string", example: "Acme Capital", description: "Display name of the account." },
          slug:        { type: "string", example: "acme-capital", description: "URL-safe account slug." },
          email:       { type: "string", format: "email", nullable: true, description: "Email of the authenticated user. `null` when authenticated via API key." },
          role:        { type: "string", enum: ["admin", "member"], description: "Role of the authenticated user within the account." },
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
      ApiKey: {
        type: "object",
        properties: {
          id:        { type: "integer", example: 1 },
          name:      { type: "string", example: "Production integration" },
          keyPrefix: { type: "string", example: "sk_live_a1b2c3", description: "First 16 characters of the key — shown for identification only." },
          createdAt: { type: "string", format: "date-time" },
          revokedAt: { type: "string", format: "date-time", nullable: true },
          active:    { type: "boolean" },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
      WebhookPayload: {
        type: "object",
        description:
          "The JSON body delivered to your webhook endpoint when a Docuplete form is submitted. " +
          "Every delivery is signed — verify the `X-Docuplete-Signature` header before processing.\n\n" +
          "**Signature verification**\n\n" +
          "Each request includes:\n```\nX-Docuplete-Signature: sha256=<hex>\n```\n" +
          "Verify by computing `HMAC-SHA256(webhookSecret, rawBody)` using your package's signing secret " +
          "(available in the Docuplete dashboard under Webhooks → Signing secret).\n\n" +
          "**Node.js example**\n```js\nconst crypto = require('crypto');\n" +
          "const sig = req.headers['x-docuplete-signature'];\n" +
          "const expected = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');\n" +
          "if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {\n" +
          "  return res.status(401).end('Invalid signature');\n}\n```",
        properties: {
          event: {
            type: "string",
            enum: ["interview.submitted", "interview.test"],
            description:
              "`interview.submitted` fires on every completed form submission. " +
              "`interview.test` is sent when you click **Send test** in the dashboard.",
          },
          package_id: {
            type: "integer",
            description: "Internal ID of the Docuplete package.",
          },
          package_name: {
            type: "string",
            description: "Human-readable name of the package.",
          },
          token: {
            type: "string",
            description:
              "Unique submission token. Use this as an idempotency key — " +
              "automatic retries deliver the same token.",
          },
          submitted_at: {
            type: "string",
            format: "date-time",
            description: "ISO-8601 timestamp of when the form was submitted.",
          },
          answers: {
            type: "object",
            additionalProperties: { type: "string" },
            description:
              "Key-value map of field IDs to their submitted values. " +
              "Fields marked sensitive in the package settings are replaced with `[redacted]`.",
          },
        },
        required: ["event", "package_id", "package_name", "token", "submitted_at", "answers"],
      },
      WebhookDelivery: {
        type: "object",
        description: "A single webhook delivery attempt recorded in the delivery log.",
        properties: {
          id: { type: "integer" },
          event_type: {
            type: "string",
            enum: ["interview.submitted", "interview.test"],
          },
          attempt_number: {
            type: "integer",
            description:
              "1 for the initial attempt; increments for each automatic retry " +
              "(max 4 attempts total: immediate, +5 s, +30 s, +5 min).",
          },
          http_status: {
            type: "integer",
            nullable: true,
            description: "HTTP status returned by the endpoint, or null if the request failed to connect.",
          },
          response_body: {
            type: "string",
            description: "First 1 KB of the response body, useful for debugging.",
          },
          duration_ms: {
            type: "integer",
            description: "Round-trip time in milliseconds.",
          },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["id", "event_type", "attempt_number", "http_status", "response_body", "duration_ms", "created_at"],
      },
    },
  },
  "x-webhooks": {
    "interview.submitted": {
      post: {
        tags: ["Webhooks"],
        summary: "Form submitted",
        description:
          "Sent when a Docuplete interview or customer-link form is completed. " +
          "Docuplete retries delivery up to 3 times (4 total attempts) with exponential back-off: " +
          "5 s → 30 s → 5 min.\n\n" +
          "Your endpoint must return any **2xx** status within 10 seconds to acknowledge receipt. " +
          "Non-2xx responses and connection errors trigger a retry.\n\n" +
          "See the `WebhookPayload` schema and its description for signature verification details.",
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WebhookPayload" },
            },
          },
        },
        responses: {
          "2XX": {
            description: "Return any 2xx to acknowledge receipt. The response body is ignored.",
          },
        },
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
    `${routesDir}/product-auth.ts`,
  ],
});

mkdirSync(resolve(__dirname, "../src/lib"), { recursive: true });
writeFileSync(outFile, JSON.stringify(spec, null, 2));
console.log(`[generate-openapi] Wrote ${outFile}`);
