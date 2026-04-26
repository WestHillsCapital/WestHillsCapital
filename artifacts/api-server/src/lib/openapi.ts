/**
 * OpenAPI 3.1 specification for the DocuPak / DocuFill API.
 *
 * Served as JSON at  GET /api/docs/openapi.json
 * Rendered as Swagger UI at  GET /api/docs
 *
 * Route groups:
 *   • Public (no auth)           — storage assets, DocuFill customer session flow
 *   • Product auth (Clerk JWT)   — SaaS product portal settings & DocuFill mgmt
 *   • Internal auth (session)    — WHC internal tool settings & DocuFill mgmt
 */

const DOCUFILL_SESSION_SCHEMA = {
  type: "object",
  properties: {
    id:               { type: "integer" },
    token:            { type: "string", example: "df_abc123" },
    package_id:       { type: "integer" },
    package_name:     { type: "string" },
    status:           { type: "string", enum: ["pending", "in_progress", "generated"] },
    answers:          { type: "object", additionalProperties: true, description: "Map of fieldId → answer value" },
    prefill:          { type: "object", additionalProperties: true, description: "Read-only prefill data set when the session was created" },
    fields:           { type: "array", items: { type: "object" } },
    documents:        { type: "array", items: { type: "object" } },
    mappings:         { type: "array", items: { type: "object" } },
    custodian_name:   { type: "string", nullable: true },
    depository_name:  { type: "string", nullable: true },
    org_name:         { type: "string", nullable: true },
    org_logo_url:     { type: "string", nullable: true },
    org_brand_color:  { type: "string", nullable: true, example: "#C49A38" },
    transaction_scope:{ type: "string", nullable: true },
    expires_at:       { type: "string", format: "date-time" },
    created_at:       { type: "string", format: "date-time" },
    updated_at:       { type: "string", format: "date-time" },
  },
};

const ORG_SCHEMA = {
  type: "object",
  properties: {
    id:          { type: "integer" },
    name:        { type: "string", example: "Acme Capital" },
    slug:        { type: "string", example: "acme-capital" },
    logo_url:    { type: "string", nullable: true, example: "/api/storage/org-logo/42" },
    brand_color: { type: "string", example: "#C49A38", description: "Six-digit hex accent color" },
  },
};

const ERROR_SCHEMA = {
  type: "object",
  properties: { error: { type: "string" } },
  required: ["error"],
};

export const openApiSpec = {
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
  servers: [
    { url: "/api", description: "Current server" },
  ],
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
      DocuFillSession: DOCUFILL_SESSION_SCHEMA,
      OrgSettings: ORG_SCHEMA,
      Error: ERROR_SCHEMA,
    },
  },
  paths: {
    // ── Storage — public, no auth ────────────────────────────────────────────
    "/storage/public-objects/{filePath}": {
      get: {
        tags: ["Storage"],
        summary: "Serve a public asset file",
        description: "Streams a file from the public-objects search paths. Files must already exist in the configured GCS bucket paths. No authentication required.",
        parameters: [
          {
            name: "filePath",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Relative path of the file (e.g. `logos/sample.png`)",
          },
        ],
        responses: {
          200: { description: "File contents streamed with the original Content-Type" },
          404: { description: "File not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/storage/org-logo/{accountId}": {
      get: {
        tags: ["Storage"],
        summary: "Serve an org logo",
        description: [
          "Returns the logo image for the given account. No authentication required.",
          "",
          "The underlying GCS object is stored at a random UUID path so that guessing a",
          "valid `accountId` only returns the publicly-intended logo, never a private asset.",
        ].join("\n"),
        parameters: [
          {
            name: "accountId",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
            description: "Numeric account / organisation ID",
          },
        ],
        responses: {
          200: { description: "Image data (PNG, JPEG, or WebP)" },
          404: { description: "Account not found or no logo configured", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── DocuFill — public session flow (customer-facing, no auth) ────────────
    "/docufill/public/sessions/{token}": {
      get: {
        tags: ["DocuFill — Customer Session"],
        summary: "Load an interview session",
        description: [
          "Retrieves a DocuFill interview session by its token. Used by the customer-facing",
          "interview form to load form fields, prefill data, and org branding.",
          "",
          "Sessions expire — the response is `404` for both missing and expired tokens.",
        ].join("\n"),
        parameters: [
          { name: "token", in: "path", required: true, schema: { type: "string" }, description: "Session token (e.g. `df_…`)" },
        ],
        responses: {
          200: {
            description: "Session loaded",
            content: { "application/json": { schema: { type: "object", properties: { session: { $ref: "#/components/schemas/DocuFillSession" } } } } },
          },
          404: { description: "Session not found or expired", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["DocuFill — Customer Session"],
        summary: "Save interview answers",
        description: [
          "Persists the customer's answers (and optionally updates the session status).",
          "Call this as the user progresses through the form — safe to call multiple times.",
          "",
          "**`answers`** is a flat object mapping field IDs to answer values.",
        ].join("\n"),
        parameters: [
          { name: "token", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  answers: {
                    type: "object",
                    additionalProperties: { type: "string" },
                    description: "Map of fieldId → answer string",
                    example: { client_first_name: "Jane", client_last_name: "Doe", transfer_amount: "50000" },
                  },
                  status: {
                    type: "string",
                    enum: ["pending", "in_progress", "generated"],
                    description: "Optional status override",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Answers saved",
            content: { "application/json": { schema: { type: "object", properties: { session: { $ref: "#/components/schemas/DocuFillSession" } } } } },
          },
          404: { description: "Session not found or expired", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/docufill/public/sessions/{token}/generate": {
      post: {
        tags: ["DocuFill — Customer Session"],
        summary: "Generate the filled packet",
        description: [
          "Validates the current answers against the package's required fields, generates",
          "the filled PDF packet, and (if configured) saves it to Google Drive and fires",
          "the package's webhook.",
          "",
          "Returns a `downloadUrl` pointing to the rendered PDF.",
        ].join("\n"),
        parameters: [
          { name: "token", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Packet generated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    packet:      { type: "object", description: "Structured summary of the generated packet" },
                    downloadUrl: { type: "string", example: "/api/docufill/public/sessions/df_xxx/packet.pdf" },
                    drive:       {
                      type: "object", nullable: true,
                      properties: {
                        fileId: { type: "string" },
                        url:    { type: "string" },
                      },
                    },
                    warnings: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          400: { description: "Validation errors (missing required fields)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          404: { description: "Session not found or expired", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/docufill/public/sessions/{token}/packet.pdf": {
      get: {
        tags: ["DocuFill — Customer Session"],
        summary: "Download the generated packet PDF",
        description: "Streams the filled PDF for the session. The packet must have been generated first via `POST /sessions/{token}/generate`.",
        parameters: [
          { name: "token", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "PDF file",
            content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
          },
          404: { description: "Session not found or expired", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Product settings (Clerk JWT) ─────────────────────────────────────────
    "/product/settings/org": {
      get: {
        tags: ["Product Portal — Settings"],
        summary: "Get org settings",
        description: "Returns the authenticated organisation's name, logo URL, and brand color.",
        security: [{ productAuth: [] }],
        responses: {
          200: {
            description: "Org settings",
            content: { "application/json": { schema: { type: "object", properties: { org: { $ref: "#/components/schemas/OrgSettings" } } } } },
          },
          401: { description: "Missing or invalid Clerk JWT", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          404: { description: "Account not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Product Portal — Settings"],
        summary: "Update org settings",
        description: [
          "Partially updates the org's display name and/or accent color.",
          "All fields are optional — omitted fields keep their current values.",
          "Send `clearLogo: true` to remove the current logo.",
        ].join("\n"),
        security: [{ productAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name:        { type: "string", description: "Display name shown in form headers", example: "Acme Capital" },
                  brandColor:  { type: "string", description: "Six-digit hex accent color", example: "#3B6CB7" },
                  clearLogo:   { type: "boolean", description: "Pass `true` to remove the current logo" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated org settings",
            content: { "application/json": { schema: { type: "object", properties: { org: { $ref: "#/components/schemas/OrgSettings" } } } } },
          },
          401: { description: "Missing or invalid Clerk JWT", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/product/settings/org/logo": {
      post: {
        tags: ["Product Portal — Settings"],
        summary: "Upload org logo",
        description: [
          "Replaces the org's logo with a new image. The logo is stored in private object storage",
          "and served at `/api/storage/org-logo/{accountId}` without authentication.",
          "",
          "**Send the raw image bytes as the request body** (not multipart/form-data).",
          "Set `Content-Type` to the image MIME type.",
          "",
          "Maximum file size: **5 MB**. Accepted types: `image/png`, `image/jpeg`, `image/webp`.",
        ].join("\n"),
        security: [{ productAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "image/png":  { schema: { type: "string", format: "binary" } },
            "image/jpeg": { schema: { type: "string", format: "binary" } },
            "image/webp": { schema: { type: "string", format: "binary" } },
          },
        },
        responses: {
          200: {
            description: "Logo uploaded — returns updated org settings",
            content: { "application/json": { schema: { type: "object", properties: { org: { $ref: "#/components/schemas/OrgSettings" } } } } },
          },
          400: { description: "Unsupported file type, empty body, or file too large", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          401: { description: "Missing or invalid Clerk JWT", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/product/settings/extract-brand-colors": {
      post: {
        tags: ["Product Portal — Settings"],
        summary: "Extract brand colors from a website",
        description: [
          "Fetches the given public URL and attempts to extract brand colors from:",
          "1. `<meta name=\"theme-color\">` tag",
          "2. CSS custom properties (`--primary`, `--brand-*`, `--accent`, `--color-primary`)",
          "3. Dominant color in the page favicon (PNG only)",
          "",
          "Returns up to 5 hex color candidates. Returns an empty array if none are found.",
          "",
          "**SSRF protection**: only public HTTP/HTTPS URLs are accepted.",
          "Private IP ranges, `localhost`, and `file://` URLs are rejected.",
        ].join("\n"),
        security: [{ productAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: {
                  url: { type: "string", format: "uri", description: "Public HTTPS URL of the company website", example: "https://acmecapital.com" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Extracted colors (may be empty if none were found)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { colors: { type: "array", items: { type: "string" }, example: ["#3B6CB7", "#F5A623"] } },
                },
              },
            },
          },
          400: { description: "Missing or unsafe URL", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          401: { description: "Missing or invalid Clerk JWT", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          422: { description: "URL could not be reached", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Internal settings (WHC staff session token) ───────────────────────────
    "/internal/settings/org": {
      get: {
        tags: ["Internal — Settings"],
        summary: "Get org settings (internal)",
        description: "Same as the product portal endpoint but authenticated with an internal session token.",
        security: [{ internalAuth: [] }],
        responses: {
          200: {
            description: "Org settings",
            content: { "application/json": { schema: { type: "object", properties: { org: { $ref: "#/components/schemas/OrgSettings" } } } } },
          },
          401: { description: "Missing or invalid session token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Internal — Settings"],
        summary: "Update org settings (internal)",
        description: "Same as the product portal endpoint but authenticated with an internal session token.",
        security: [{ internalAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name:       { type: "string", example: "West Hills Capital" },
                  brandColor: { type: "string", example: "#C49A38" },
                  clearLogo:  { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated org settings",
            content: { "application/json": { schema: { type: "object", properties: { org: { $ref: "#/components/schemas/OrgSettings" } } } } },
          },
          401: { description: "Missing or invalid session token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/internal/settings/org/logo": {
      post: {
        tags: ["Internal — Settings"],
        summary: "Upload org logo (internal)",
        description: "Same as the product portal endpoint but authenticated with an internal session token.",
        security: [{ internalAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "image/png":  { schema: { type: "string", format: "binary" } },
            "image/jpeg": { schema: { type: "string", format: "binary" } },
            "image/webp": { schema: { type: "string", format: "binary" } },
          },
        },
        responses: {
          200: {
            description: "Logo uploaded",
            content: { "application/json": { schema: { type: "object", properties: { org: { $ref: "#/components/schemas/OrgSettings" } } } } },
          },
          400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/internal/settings/extract-brand-colors": {
      post: {
        tags: ["Internal — Settings"],
        summary: "Extract brand colors from a website (internal)",
        description: "Same as the product portal endpoint but authenticated with an internal session token.",
        security: [{ internalAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: { url: { type: "string", format: "uri" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Extracted colors", content: { "application/json": { schema: { type: "object", properties: { colors: { type: "array", items: { type: "string" } } } } } } },
          400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          422: { description: "URL unreachable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Internal DocuFill management (admin CRUD) ─────────────────────────────
    "/internal/docufill/packages": {
      get: {
        tags: ["DocuFill — Admin (Internal)"],
        summary: "List packages",
        description: "Returns all DocuFill packages for the authenticated account.",
        security: [{ internalAuth: [] }],
        responses: {
          200: { description: "Array of packages", content: { "application/json": { schema: { type: "object", properties: { packages: { type: "array", items: { type: "object" } } } } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        tags: ["DocuFill — Admin (Internal)"],
        summary: "Create a package",
        description: "Creates a new DocuFill package (form template).",
        security: [{ internalAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name:             { type: "string", example: "IRA Transfer Packet" },
                  transactionScope: { type: "string", example: "ira_transfer" },
                  description:      { type: "string" },
                  enableInterview:  { type: "boolean", default: false },
                  enableCsv:        { type: "boolean", default: false },
                  enableCustomerLink: { type: "boolean", default: false },
                  webhookEnabled:   { type: "boolean", default: false },
                  webhookUrl:       { type: "string", format: "uri", nullable: true },
                  tags:             { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Created package", content: { "application/json": { schema: { type: "object", properties: { package: { type: "object" } } } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/internal/docufill/packages/{id}": {
      get: {
        tags: ["DocuFill — Admin (Internal)"],
        summary: "Get a package",
        security: [{ internalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Package detail", content: { "application/json": { schema: { type: "object", properties: { package: { type: "object" } } } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          404: { description: "Package not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["DocuFill — Admin (Internal)"],
        summary: "Update a package",
        security: [{ internalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          200: { description: "Updated package", content: { "application/json": { schema: { type: "object", properties: { package: { type: "object" } } } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["DocuFill — Admin (Internal)"],
        summary: "Delete a package",
        security: [{ internalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Package deleted" },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/internal/docufill/packages/{id}/sessions": {
      post: {
        tags: ["DocuFill — Admin (Internal)"],
        summary: "Create an interview session",
        description: [
          "Creates a new customer-facing interview session for the given package.",
          "Returns a `token` that the customer uses to access the interview form.",
          "",
          "**`prefill`** is an optional key-value map of field values injected as read-only",
          "data (e.g. client name and address pulled from a CRM deal).",
        ].join("\n"),
        security: [{ internalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, description: "Package ID" }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  custodianId:      { type: "integer", nullable: true },
                  depositoryId:     { type: "integer", nullable: true },
                  transactionScope: { type: "string" },
                  dealId:           { type: "integer", nullable: true },
                  source:           { type: "string", enum: ["manual", "batch", "api"], default: "manual" },
                  prefill:          { type: "object", additionalProperties: true, description: "Pre-filled field values (read-only for the customer)" },
                  testMode:         { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Session created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    session: { $ref: "#/components/schemas/DocuFillSession" },
                    url:     { type: "string", description: "Full URL to the customer-facing interview form" },
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          404: { description: "Package not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/internal/docufill/packages/{id}/documents": {
      post: {
        tags: ["DocuFill — Admin (Internal)"],
        summary: "Upload a PDF to a package",
        description: "Uploads a PDF file to the package's document list. Send the raw PDF bytes as the request body with `Content-Type: application/pdf`. Maximum size: 100 MB.",
        security: [{ internalAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          { name: "X-File-Name", in: "header", required: false, schema: { type: "string" }, description: "Original filename (used as the document title)" },
          { name: "X-Document-Title", in: "header", required: false, schema: { type: "string" }, description: "Human-readable document title (overrides X-File-Name)" },
        ],
        requestBody: {
          required: true,
          content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
        },
        responses: {
          200: { description: "Document uploaded", content: { "application/json": { schema: { type: "object", properties: { document: { type: "object" } } } } } },
          400: { description: "Invalid PDF or too large", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Product DocuFill management (Clerk JWT) ───────────────────────────────
    "/product/docufill/packages": {
      get: {
        tags: ["DocuFill — Admin (Product Portal)"],
        summary: "List packages",
        description: "Returns DocuFill packages for the authenticated product-portal account.",
        security: [{ productAuth: [] }],
        responses: {
          200: { description: "Array of packages", content: { "application/json": { schema: { type: "object", properties: { packages: { type: "array", items: { type: "object" } } } } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/product/docufill/packages/{id}": {
      get: {
        tags: ["DocuFill — Admin (Product Portal)"],
        summary: "Get a package",
        security: [{ productAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Package detail", content: { "application/json": { schema: { type: "object", properties: { package: { type: "object" } } } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/product/docufill/packages/{id}/sessions": {
      post: {
        tags: ["DocuFill — Admin (Product Portal)"],
        summary: "Create an interview session",
        description: "Creates a customer-facing interview session. Same behaviour as the internal endpoint.",
        security: [{ productAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  custodianId:  { type: "integer", nullable: true },
                  depositoryId: { type: "integer", nullable: true },
                  transactionScope: { type: "string" },
                  prefill: { type: "object", additionalProperties: true },
                  testMode: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Session created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    session: { $ref: "#/components/schemas/DocuFillSession" },
                    url:     { type: "string" },
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Deal builder (internal staff only) ───────────────────────────────────
    "/deals": {
      post: {
        tags: ["Deal Builder (Internal)"],
        summary: "Create a deal",
        description: "Creates a new deal in the WHC deal builder pipeline. **Internal staff only.**",
        security: [{ internalAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                description: "Full deal input object — consult the deal builder UI for the complete field list",
              },
            },
          },
        },
        responses: {
          200: { description: "Deal created", content: { "application/json": { schema: { type: "object", properties: { deal: { type: "object" } } } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/deals/{id}": {
      get: {
        tags: ["Deal Builder (Internal)"],
        summary: "Get a deal",
        security: [{ internalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Deal detail", content: { "application/json": { schema: { type: "object", properties: { deal: { type: "object" } } } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/deals/{id}/payment": {
      patch: {
        tags: ["Deal Builder (Internal)"],
        summary: "Record payment",
        description: "Marks payment as received for a deal and triggers the payment confirmation email.",
        security: [{ internalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  payment_method: { type: "string", enum: ["wire", "check", "credit_card"] },
                  payment_amount: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Payment recorded", content: { "application/json": { schema: { type: "object" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/deals/{id}/tracking": {
      patch: {
        tags: ["Deal Builder (Internal)"],
        summary: "Set tracking number",
        description: "Records the FedEx/UPS tracking number and schedules the shipping notification email.",
        security: [{ internalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["tracking_number"],
                properties: {
                  tracking_number: { type: "string" },
                  carrier:         { type: "string", enum: ["fedex", "ups", "usps"] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Tracking updated", content: { "application/json": { schema: { type: "object" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
  },
};
