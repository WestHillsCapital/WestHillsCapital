# Overview

Docuplete is a SaaS platform designed for custodial paperwork automation, enabling organizations to create reusable document packages, map interview fields to PDF overlays, and facilitate client form completion via tokenized public links. This project also incorporates the public-facing website for West Hills Capital, offering live pricing, appointment scheduling, IRA allocation, an Insights Hub, and a Deal Builder, all within the same monorepo.

# User Preferences

I prefer iterative development. I want to be asked before making major changes.

# System Architecture

The project is structured as a pnpm monorepo using TypeScript, comprising several artifacts: `artifacts/api-server` (Express 5 backend), `artifacts/west-hills-capital` (React + Vite + Tailwind + shadcn frontend), `artifacts/docuplete` (Docuplete marketing site), and `artifacts/docuplete-docs` (Docuplete user documentation site at `/docuplete-docs/`). Shared packages include `packages/api-zod` for Zod schemas and `packages/db` for the database client.

**Docuplete Docs (`artifacts/docuplete-docs`):**
- React + Vite + Tailwind documentation site at preview path `/docuplete-docs/`
- Dark navy/indigo brand palette (`#0B1220` bg, `#1B4FD8` primary)
- Left sidebar with 10 sections and ~40 sub-pages, collapsible with active state tracking
- Client-side search across all pages via `allPages()` helper in `src/lib/nav.ts`
- Navigation structure defined in `src/lib/nav.ts` (typed `NavItem` tree)
- All pages in `src/pages/docs/` organized by section subdirectories
- Webhooks & API section marked with Enterprise-only callout boxes
- "Docs" link added to marketing site nav (`artifacts/docuplete/src/pages/Home.tsx`)

**Frontend (React + Vite + Tailwind + shadcn):**
- **User Interfaces:** Includes public pages (Home, Live Pricing, etc.), an internal Google-authenticated portal (`/internal/*`) for tools like Deal Builder and DocuFill manager, and a Clerk-authenticated product portal (`/app/*`) for Docuplete SaaS features such as the AppPortal and DocuFill editor.
- **Routing:** Implemented using React Router, supporting dynamic slug-based routing and token-scoped public interview pages.
- **Design System:** Utilizes an off-white, navy, and gold color scheme with a fixed header displaying a live spot ticker.

**Backend (Express 5 + PostgreSQL):**
- **API:** A RESTful API mounted at `/api`, providing endpoints for various functionalities including pricing, scheduling, lead capture, settings management, DocuFill operations, storage, deal building, and security.
- **Authentication:** Internal portal uses Google OAuth (session-based), while the product portal uses Clerk with `requireProductAuth` middleware enforcing TOTP 2FA for `/api/v1/product/*` routes.
- **Database:** PostgreSQL is used. Tables are managed via two complementary mechanisms: (1) **Drizzle Kit tracked migrations** in `artifacts/api-server/drizzle/` for fresh deployments and future incremental changes — schema defined in `lib/db/src/schema/` (37 Drizzle `pgTable` definitions), with `pnpm db:generate` / `pnpm db:migrate` scripts in api-server; (2) **`initDb()` idempotent DDL** (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE IF NOT EXISTS ADD COLUMN IF NOT EXISTS`) for backward-compat on existing prod DBs. On startup `runDrizzleMigrations()` runs first: it auto-baselines existing DBs and runs all migrations on fresh ones, then `initDb()` handles any remaining column additions.
- **Pricing Logic:** Integrates with the Dillon Gage Fiztrade API, applying defined spreads for gold and silver.
- **Deal Builder:** Features a Lock & Execute pipeline that handles database saves, API calls, PDF invoice generation (pdfkit), Google Drive uploads, email sending (Resend), and Google Sheets synchronization.
- **API Documentation:** OpenAPI 3.1 spec available at `GET /api/docs/openapi.json` and Swagger UI at `GET /api/docs`.

**Key Features:**

*   **Docuplete (Document Automation):**
    *   **Core Functionality:** Enables staff to configure reusable document packages, clients to complete interviews via tokenized public links, and server-side generation of filled PDFs.
    *   **Components:** Manages Groups, Transaction Types, a Shared Field Library for reusable field definitions, and Packages that enforce plan limits.
    *   **Interview Sessions:** Token-scoped public interviews with monthly submission limits and usage tracking.
    *   **PDF Processing:** Uses `pdf-lib` for parsing and overlay, and `pdfkit` for generation. The DocuFill mapper UI is a 3-column grid.
    *   **E-sign v1:** Incorporates email OTP verification, SHA-256 PDF hashing, signing certificate appending, and an append-only audit trail.
    *   **RFC 3161 Trusted Timestamp (TSA):** Integrates with public TSAs (DigiCert, Sectigo, FreeTSA) for timestamping signed PDFs, storing raw DER `TimeStampResp` and the responding endpoint.

*   **Settings Page (Product Portal):** A multi-section settings page at `/app/settings` with navigation for Account, Profile, Security (2FA + Trusted Devices), Billing, and Custom Domain management.

*   **Two-Factor Authentication (2FA):** TOTP-based 2FA enforced by middleware. Includes a "Trusted Devices" feature using signed HttpOnly cookies to bypass TOTP for recognized devices, with management capabilities in security settings. Rate limiting is applied to TOTP attempts.

*   **Audit Log:** Displays actions, resources, metadata, timestamps, IP addresses, and geographic locations (resolved via `geoip-lite` with an LRU cache) for audit events in Settings.

*   **Custom Domain:** Allows Pro/Enterprise accounts to configure custom subdomains for customer-facing links, with DNS CNAME verification and status tracking.

*   **Billing (Stripe):** Manages plan tiers (Starter, Pro, Enterprise) and submission-based quotas. Integrates with Stripe for product seeding, checkout, and portal flows, displaying current plan and usage.

*   **Affiliate Program:** Full affiliate system with 20% commission for 12 months. Public apply page at `/become-an-affiliate`. DB tables: `affiliates`, `affiliate_referrals`, `affiliate_commissions`. API routes: public `POST /api/affiliates/apply`; admin `GET|POST /api/internal/affiliates`, `PATCH /:id`, `POST /:id/connect` (Stripe Connect Express onboarding), `POST /:id/commissions/:id/pay` (Stripe Transfer). `?ref=CODE` captured in `localStorage.docuplete_referral_code`, passed through Stripe checkout as `subscription_data.metadata.referral_code`. Webhook: `customer.subscription.created` creates referral + schedules annual commissions; `invoice.paid` creates monthly commissions; `charge.dispute.created` logs for admin review. Super Admin "Affiliates" tab manages the full lifecycle.

*   **Submission Bank:** Enables accounts to purchase extra submission packs (one-off, monthly, annual). Bank credits roll over for 12 months. Enforces usage limits by drawing from the plan pool then the submission bank. Stripe webhooks handle deposits for purchases.

*   **Merlin (AI Assistant):** A Claude-powered assistant. Internal Merlin (staff) provides a floating chat widget with tool access for session/package management and billing. Customer Merlin (Phase 2) offers conversational interview guidance, extracting field values to auto-fill forms.

*   **Multi-Tenancy:** Achieved through `accounts` and `account_users` tables, ensuring data isolation via `account_id` scoping.

*   **West Hills Capital Public Site:** Features Live Pricing, a 2-step Appointment Scheduling process, IRA Allocation, an Insights Hub (CMS), Deal Builder, and FedEx Location Search.

*   **Encryption at Rest (PII):** Implemented using envelope encryption (AES-256-GCM). `ENCRYPTION_MASTER_KEY` (environment variable) wraps per-account Data Encryption Keys (DEKs), which then encrypt sensitive session answers (JSONB) in `docufill_interview_sessions`. This uses a `hex(iv):hex(authTag):hex(ciphertext)` format and includes an in-process DEK cache.

# External Dependencies

*   **Dillon Gage Fiztrade API:** For live spot prices and trade execution.
*   **PostgreSQL:** The primary database.
*   **Clerk (`@clerk/express`):** For product portal authentication.
*   **Google OAuth:** For internal portal authentication.
*   **Stripe + `stripe-replit-sync`:** For subscription billing.
*   **Resend:** For sending client recap emails.
*   **Google Drive API:** For PDF invoice and packet uploads (service-account deal invoices; per-account OAuth via `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`).
*   **Microsoft OneDrive API:** Optional per-account cloud storage provider for DocuFill packets (requires `ONEDRIVE_CLIENT_ID` / `ONEDRIVE_CLIENT_SECRET` env vars and a registered Azure app with redirect URI pointing to the Settings page).
*   **Dropbox API v2:** Optional per-account cloud storage provider for DocuFill packets (requires `DROPBOX_CLIENT_ID` / `DROPBOX_CLIENT_SECRET` env vars and a registered Dropbox app).
*   **HubSpot CRM API:** For contact creation/updates on DocuFill submissions.
*   **Google Sheets API:** For admin notifications and deal records.
*   **FedEx API:** For shipping location search.
*   **`geoip-lite`:** For IP address to city/country resolution.
*   **DigiCert TSA, Sectigo TSA, FreeTSA:** RFC 3161 trusted timestamp authorities.
*   **`pdfkit` / `pdf-lib`:** For PDF generation and overlay.
*   **`otplib`:** For TOTP 2FA secret generation and verification.
*   **`cookie-parser`:** For signed HttpOnly cookies for trusted device tokens.
*   **pnpm workspaces:** For monorepo management.
*   **TypeScript, React, Vite, Tailwind, shadcn/ui:** Frontend development stack.
*   **Express 5, Zod:** Backend framework and validation.