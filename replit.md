# Overview

**Docuplete** is a SaaS platform for custodial paperwork automation, evolved from the West Hills Capital internal tool. It lets organizations build reusable document packages, map interview fields to PDF overlays, and have clients complete forms via tokenized public links. The project also retains the original West Hills Capital public-facing website (live pricing, appointment scheduling, IRA allocation, Insights Hub, Deal Builder) as a separate product under the same monorepo.

# User Preferences

I prefer iterative development. I want to be asked before making major changes.

# System Architecture

pnpm monorepo (TypeScript) with two primary artifacts:
- `artifacts/api-server` — Express 5 backend
- `artifacts/west-hills-capital` — React + Vite + Tailwind + shadcn frontend

Shared packages: `packages/api-zod` (Zod schemas), `packages/db` (database client).

**Frontend (React + Vite + Tailwind + shadcn):**
- **Public pages:** Home, Live Pricing, Schedule Allocation Call, IRA Allocation, About, Disclosures, Terms, Insights Hub, individual Insight Articles.
- **Internal portal** (`/internal/*`): Google-auth-gated. Deal Builder, DocuFill manager, prospecting pipeline, scheduled calls.
- **Product portal** (`/app/*`): Clerk-auth-gated. Docuplete SaaS interface for tenant organizations. AppPortal → AppSettings (multi-section Settings page), DocuFill editor, etc.
- **Routing:** React Router with dynamic slug-based routing and token-scoped public interview pages.
- **Design:** Off-white, navy, and gold color scheme. Fixed header with live spot ticker.

**Backend (Express 5 + PostgreSQL):**
- **API:** RESTful, mounted at `/api`. Endpoints for pricing, scheduling, lead capture, internal settings, product (tenant) settings, DocuFill admin CRUD, DocuFill public session flow, storage assets, deal builder, security/audit.
- **Authentication:**
  - Internal portal: Google OAuth (session-based).
  - Product portal: Clerk (`@clerk/express`). `requireProductAuth` middleware gates all `/api/v1/product/*` routes and enforces TOTP 2FA.
- **Database:** PostgreSQL — all tables created/migrated via `initializeDatabase()` in `db.ts` (no separate migration framework; `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pattern).
- **Pricing Logic:** Dillon Gage Fiztrade API. Spreads: gold +2%, silver +5%, buyback gold -1%, silver -3%.
- **Deal Builder:** Lock & Execute pipeline — DB save, Dillon Gage API call, pdfkit invoice, Google Drive upload, Resend email, Google Sheets sync.

**API Documentation:**
- OpenAPI 3.1 spec at `GET /api/docs/openapi.json`
- Swagger UI at `GET /api/docs`

# Key Features

## Docuplete (Document Automation)
Custodial paperwork engine. Staff configure reusable document packages; clients complete interviews via tokenized public links; filled PDFs are generated server-side.

- **Groups:** Unified concept (replaced legacy Custodians/Depositories). Full CRUD + delete. Each package belongs to a Group.
- **Transaction Types:** Normalized, full CRUD + delete.
- **Shared Field Library:** Reusable field definitions (label, type, validation, options) shared across packages. Full CRUD + delete.
- **Packages:** Collections of documents + field mappings. POST /packages enforces plan limits via `requireWithinPlanLimits`.
- **Field Types (editor):** Text box, Radio, Checkbox, Dropdown. **Date is not a field type** — it is a Validation Rule applied to a Text box field.
- **Sessions (public interview):** Token-scoped. Monthly submission count enforced + `usage_events` recorded.
- **PDF Overlay:** `pdf-lib` for parsing and overlay; `pdfkit` for generation.
- **DocuFill mapper UI:** 3-column grid `[190px_1fr_260px]` in the document editor.

## Settings Page (Product Portal)
Multi-section settings page at `/app/settings`. Desktop: left sidebar navigation (sticky, `top-[72px]`). Mobile: horizontal pill nav.

Sections (defined in `ALL_SETTINGS_NAV` array in `AppSettings.tsx`):
- Account, Profile, Password, Security (2FA + Trusted Devices), Sessions, Login History, Audit Log, Team, Billing, Custom Domain.

## Two-Factor Authentication (2FA)
- TOTP-based 2FA enforced by `requireProductAuth` middleware for all product API routes and the `TwoFAGate` component on the frontend.
- **Trusted Devices ("Remember this device for 30 days"):**
  - `POST /verify-2fa` accepts `trustDevice: boolean`. When true, generates a 32-byte random token, stores its SHA-256 hash in `trusted_devices` table, sets a 30-day signed HttpOnly cookie (`td_token`).
  - `requireProductAuth` checks `td_token` signed cookie before returning `TOTP_REQUIRED`. Hashes it, looks up `trusted_devices` by user + expiry. If valid, updates `last_used_at`, stamps the Clerk session `totp_verified`, grants access — no TOTP prompt.
  - Frontend `TwoFAGate.tsx`: "Remember this device for 30 days" checkbox.
  - `useProductAuth.tsx`: `verify2FA(code, trustDevice?)` sends `trustDevice` in body; all `/me` and `/verify-2fa` fetches use `credentials: "include"` for cross-origin cookie flow.
  - **Security Settings** in AppSettings shows the trusted devices list (label, IP, trust date, expiry) with a Revoke button per device.
  - API routes: `GET /api/v1/product/settings/security/trusted-devices`, `DELETE /api/v1/product/settings/security/trusted-devices/:id`.
  - Revoking a device records `security.trusted_device_revoked` in the audit log.
  - **Production requirement:** `COOKIE_SECRET` env var must be set in Railway. The server throws at startup if it is absent in production.
- **2FA Rate Limiting:** Combined IP+user key with strict threshold response to limit TOTP guessing.

## Audit Log
- Displayed in Settings → Audit Log section.
- Each entry shows: action, resource, metadata, timestamp, **IP address**, and **geographic location** (City, Country · x.x.x.x with a map-pin icon).
- Location resolved via `geoip-lite` in `settings.ts` (`lookupIpLocation` function).
- **LRU cache:** In-process `Map` capped at 1000 entries (delete+set on hit for true recency refresh). Avoids repeated geoip lookups for the same IP within a session.
- `AuditLogMetadataMap` in `auditLog.ts` provides typed metadata for every audit action.

## Custom Domain (Pro/Enterprise)
Organizations on Pro or Enterprise plans can configure a custom subdomain (e.g. `forms.acme.com`) for customer-facing interview links.
- DNS CNAME instructions, Verify button (real DNS lookup via Node `dns.promises.resolveCname`), status badges (Unverified / Verifying / Active / Error).
- Stored in `accounts.custom_domain` + `custom_domain_status` + `custom_domain_verified_at`.
- API: `GET/PUT /api/v1/product/settings/custom-domain`, `POST /api/v1/product/settings/custom-domain/verify`.
- Active custom domain is used as origin for new interview links and send-link emails.

## Billing (Stripe)
- Plan tiers: Free (3 packages, 50 submissions/mo, 1 seat), Pro ($99/mo — unlimited packages, 500 submissions/mo, 5 seats), Enterprise ($299/mo — unlimited).
- WHC account (id=1) is permanently on Enterprise.
- Stripe products seeded via `scripts/seed-stripe-products.ts`.
- Checkout/portal flow in `/api/internal/settings/billing` routes.
- `BillingSection` in `AppSettings.tsx` shows current plan, usage, and upgrade/manage links.

## Multi-Tenancy
`accounts` and `account_users` tables provide tenant isolation. `account_id` scopes all relevant data. Internal portal uses Google auth; product portal uses Clerk, reusing Docuplete components under different API paths.

## West Hills Capital Public Site
- Live Pricing (Dillon Gage integration), 2-step Appointment Scheduling, IRA Allocation, Insights Hub (CMS), Deal Builder (Lock & Execute pipeline), FedEx Location Search.

# Database Tables (Key)
All tables are auto-created on startup via `initializeDatabase()` in `db.ts`.

| Table | Purpose |
|---|---|
| `accounts` | Tenant organizations |
| `account_users` | Users scoped to tenants |
| `trusted_devices` | 2FA trusted device tokens (SHA-256 hash, expiry, IP, label) |
| `user_login_history` | Login events with IP + geoip location |
| `audit_log` | Typed audit events with `ip_address` field |
| `docufill_packages` | Document packages per account |
| `docufill_groups` | Custodian/depository groups |
| `docufill_shared_fields` | Reusable field definitions |
| `docufill_sessions` | Public interview sessions |
| `usage_events` | Submission usage tracking for plan limits |
| `stripe_subscriptions` | Billing subscription records |
| `leads`, `appointments` | WHC scheduling/sales data |

**Pending Railway DB migration (if not yet applied):**
```sql
CREATE TABLE IF NOT EXISTS docufill_groups (
  id serial PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  phone text, email text, notes text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS group_id integer REFERENCES docufill_groups(id) ON DELETE SET NULL;
```

## Encryption at Rest (PII)

**Status:** Implemented. Requires `ENCRYPTION_MASTER_KEY` set in Railway.

**Architecture:** Envelope encryption (AES-256-GCM).
- `ENCRYPTION_MASTER_KEY` (32-byte hex env var) → wraps per-account DEKs stored in `accounts.encrypted_dek TEXT`
- Each DEK encrypts the session `answers` JSONB → stored as `answers_ciphertext TEXT` in `docufill_interview_sessions`
- Format: `hex(iv):hex(authTag):hex(ciphertext)` (12-byte IV, 16-byte GCM auth tag)
- Dual-mode reads: decrypt `answers_ciphertext` if present, fall back to plaintext `answers` (migration period)
- In-process DEK cache (cleared on server restart) to avoid per-request DB roundtrips
- PII fields protected: `client_ssn`, `client_dob`, `ira_account_number`, all other session answers

**Files:**
- `artifacts/api-server/src/lib/encryption.ts` — crypto primitives + DEK cache
- `scripts/migrate-pii-encryption.mjs` — one-time migration for existing rows

**Production setup:**
1. Set `ENCRYPTION_MASTER_KEY=<64 hex chars>` in Railway environment
2. Deploy (DB migration runs automatically via `initDb()`)
3. Run `node scripts/migrate-pii-encryption.mjs` once to encrypt existing rows (use `--dry-run` first)

# External Dependencies

| Dependency | Purpose |
|---|---|
| Dillon Gage Fiztrade API | Live spot prices + trade execution |
| PostgreSQL | Primary database |
| Clerk (`@clerk/express`) | Product portal authentication |
| Google OAuth | Internal portal authentication |
| Stripe + `stripe-replit-sync` | Subscription billing |
| Resend | Client recap emails |
| Google Drive API | PDF invoice + packet uploads (per-account OAuth, DocuFill channel) |
| HubSpot CRM API | Per-account OAuth, contact create/update on DocuFill submission |
| Google Sheets API | Admin notifications / deal records |
| FedEx API | Shipping location search |
| `geoip-lite` | IP → City/Country resolution (in-process, LRU-cached) |
| `pdfkit` / `pdf-lib` | PDF generation and overlay |
| `otplib` | TOTP 2FA secret generation + verification |
| `cookie-parser` | Signed HttpOnly cookies for trusted device tokens |
| pnpm workspaces | Monorepo management |
| TypeScript, React, Vite, Tailwind, shadcn/ui | Frontend stack |
| Express 5, Zod | Backend framework + validation |

# Deployment

- **CI/CD:** Railway (API server) and Vercel (frontend) auto-deploy from `WestHillsCapital/WestHillsCapital` GitHub `main` branch.
- **Sync script:** `node scripts/sync-to-github.mjs --dry-run` shows stale files. `node scripts/push-to-github.mjs "message" file1 file2 ...` pushes specific files.
- **Important:** After task agent merges, always run `--dry-run` and explicitly push ALL stale/missing files. The sync script may not catch every file; use `push-to-github.mjs` directly for any file shown as MISSING.
- **Required Railway env vars:** `DATABASE_URL`, `COOKIE_SECRET` (throws at startup if absent), `CORS_ALLOWED_ORIGINS` (fails closed in production if unset), `SENTRY_DSN` (optional), `ENCRYPTION_MASTER_KEY` (warns at startup if absent — PII stored in plaintext without it; must be 64 hex chars = 32 bytes).
- Vercel handles API rewrites to proxy requests to the Railway-hosted API.
