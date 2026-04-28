# Overview

West Hills Capital is a physical gold and silver allocation company. This project delivers a production-ready website designed to facilitate their operations. Key features include live precious metal pricing, a 2-step appointment scheduling system, an IRA allocation section, and an educational content hub. The primary goal is to drive "Schedule Allocation Call" actions, supported by robust backend services for pricing, scheduling, lead capture, and deal execution. The business vision is to provide a seamless and informative platform for clients, with ambitions to streamline internal processes through automated deal execution and record-keeping.

# User Preferences

I prefer iterative development. I want to be asked before making major changes.

# System Architecture

The project is structured as a pnpm monorepo using TypeScript, with separate `api-server` (Express) and `west-hills-capital` (React + Vite + Tailwind + shadcn) packages. Data validation is handled by Zod. The UI/UX emphasizes a professional aesthetic with an off-white, navy, and gold color scheme, featuring a fixed header with a live spot ticker.

**Frontend (React + Vite + Tailwind + shadcn):**
- **Pages:** Home, Live Pricing, Schedule Allocation Call, IRA Allocation, About, Disclosures, Terms, Insights Hub, and individual Insight Article pages.
- **Components:** Reusable UI components from shadcn-ui, `react-hook-form` for forms.
- **Routing:** Handled by React Router, with dynamic slug-based routing for articles.
- **Design:** Consistent theming across the site, using Tailwind CSS for utility-first styling.

**Backend (Express 5 + PostgreSQL):**
- **API:** RESTful API mounted at `/api` providing endpoints for pricing (spot, products, buyback), scheduling (slots, booking), and lead capture.
- **Database:** PostgreSQL used for storing leads and appointments.
- **Pricing Logic:** Spreads for gold (+2%), silver (+5%), and buyback prices (gold -1%, silver -3%) are applied server-side.
- **Deal Builder Workflow:** A server-side pipeline for "Lock & Execute" functionality, involving database saving, Dillon Gage API calls, PDF invoice generation, Google Drive upload, client recap email via Resend, and admin notification/Sheets sync.

**API Documentation:**
- OpenAPI 3.1 spec served as JSON at `GET /api/docs/openapi.json`
- Interactive Swagger UI (CDN-loaded, no build-time dependencies) at `GET /api/docs`
- Covers: public DocuFill session flow, product/internal settings, storage assets, DocuFill admin CRUD, deal builder

**Key Features:**
- **Live Pricing:** Integration with Dillon Gage Fiztrade API for real-time gold and silver spot prices.
- **Appointment Scheduling:** A 2-step form for scheduling allocation calls, with deterministically generated and booked slots management. Booking confirmations include calendar events and instructions.
- **Insights Hub:** A content management system for educational articles, with metadata and content managed internally.
- **Deal Builder:** An internal tool to manage and execute client deals, automating pricing, trade execution, invoicing, and record-keeping.
- **Internal Workflow Language:** Staff-facing navigation uses "Prospecting Pipeline" and "Scheduled Calls" to align with internal Google Sheets.
- **FedEx Location Search:** Integration to find nearest FedEx locations for shipping.
- **DocuFill / Docuplete:** An internal custodial paperwork engine for reusable document packages. It supports managing Groups (unified concept replacing legacy Custodians/Depositories), packages, and generating filled packets based on mapped interview fields. Phase 2 enhancements include normalized transaction types, validation, and token-scoped public interview endpoints for external client completion. A shared field library enables reusable field definitions across packages. Plan limit enforcement via `requireWithinPlanLimits` middleware on POST /packages (package count) and POST /sessions (monthly submission count + `usage_events` recording). `BillingSection` component in AppSettings.tsx shows current plan, usage, and upgrade/manage links. Full CRUD+delete is available for Groups, Transaction Types, and Shared Fields. **NOTE: Production (Railway) DB needs migration — run these two statements on the Railway Postgres instance:** `CREATE TABLE IF NOT EXISTS docufill_groups (id serial PRIMARY KEY, name text NOT NULL DEFAULT '', phone text, email text, notes text, active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 100, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());` and `ALTER TABLE docufill_packages ADD COLUMN IF NOT EXISTS group_id integer REFERENCES docufill_groups(id) ON DELETE SET NULL;`
- **Multi-Tenancy Foundation:** Implemented with `accounts` and `account_users` tables for tenant isolation. `account_id` scopes relevant data. Internal portal uses Google auth, while an external product portal at `/app/*` uses Clerk for authentication, reusing Docuplete components with different API paths and authentication headers.

**Deployment:**
- The monorepo is deployed to Railway (API server) and Vercel (frontend), both configured for continuous deployment from the GitHub `main` branch.
- Vercel handles API rewrites to proxy requests to the Railway-hosted API.

# External Dependencies

- **Dillon Gage Fiztrade API:** For live gold/silver spot prices and wholesale trade execution (`LockPrices`, `ExecuteTrade`).
- **PostgreSQL:** For `leads` and `appointments` data, and Docuplete configuration/data.
- **Resend:** For sending client recap emails.
- **Google Drive API:** For uploading generated PDF invoices and Docuplete packets.
- **FedEx API:** For searching shipping locations.
- **pnpm workspaces:** Monorepo management.
- **TypeScript:** Language.
- **Express:** Backend API framework.
- **React, Vite, Tailwind CSS, shadcn/ui:** Frontend stack.
- **Zod:** Data validation.
- **pdfkit / pdf-lib:** PDF generation, parsing, and Docuplete overlay utilities.
- **Clerk:** For authentication in the external product portal (`/app/*` routes).
- **Stripe:** Subscription billing via `stripe` + `stripe-replit-sync` packages. Plan tiers: Free (3 packages, 50 submissions/mo, 1 seat), Pro ($99/mo — unlimited packages, 500 submissions/mo, 5 seats), Enterprise ($299/mo — unlimited). WHC account (id=1) permanently on enterprise. Products seeded with `scripts/seed-stripe-products.ts`. Checkout/portal flow in `/api/internal/settings/billing` routes.