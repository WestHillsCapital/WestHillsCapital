# Overview

West Hills Capital is a physical gold and silver allocation company. This project is a production-ready website designed to facilitate their operations, featuring live precious metal pricing, a 2-step appointment scheduling system, an IRA allocation section, and an educational content hub. The primary goal is to drive "Schedule Allocation Call" actions, supported by robust backend services for pricing, scheduling, lead capture, and deal execution. The business vision is to provide a seamless and informative platform for clients interested in gold and silver allocation, with ambitions to streamline internal processes through automated deal execution and record-keeping.

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
- **Deal Builder Workflow:** A server-side pipeline for "Lock & Execute" functionality, involving:
    1.  Database save of deal details.
    2.  Dillon Gage `LockPrices` and `ExecuteTrade` calls.
    3.  PDF invoice generation with wire instructions.
    4.  Google Drive upload of the invoice.
    5.  Client recap email via Resend.
    6.  Admin notification and Sheets sync.

**Key Features:**
-   **Live Pricing:** Integration with Dillon Gage Fiztrade API for real-time gold and silver spot prices.
-   **Appointment Scheduling:** A 2-step form to schedule allocation calls, with available slots generated deterministically (Mon-Fri, 9 am-5 pm CT, 14 days ahead) and booked slots excluded.
-   **Booking confirmations:** Customer confirmation emails include warmer consultation copy, an explicit calendar-save prompt, and an attached `.ics` calendar event with a 15-minute reminder; the frontend confirmation screen also offers a calendar download based on the booked Central Time slot.
-   **Insights Hub:** A content management system for educational articles, with metadata and content managed in `insights.ts`.
-   **Deal Builder:** An internal tool to manage and execute client deals, automating pricing, trade execution, invoicing, and record-keeping.
-   **Internal workflow language:** Staff-facing navigation uses Prospecting Pipeline and Scheduled Calls to match the six-tab Google Sheets workbook. Backend tables and API routes still use the stable `leads` and `appointments` names.
-   **FedEx Location Search:** Integration to find nearest FedEx locations for shipping.
-   **DocuFill:** Internal custodial paperwork engine for reusable document packages. Admin users can manage custodians, depositories, packages, ordered documents, reusable interview fields, field sensitivity flags, visual field placements, and launch package interviews from IRA/custodial Deal Builder workflows. Package admins can delete obsolete packages, which removes their stored PDFs, mappings, and interview sessions through database cascades. Sensitive fields are masked in internal summaries/default-value inputs by default and redacted from generated packet summary fallbacks, while mapped packet overlays still deliberately use the real values to complete custodial PDFs. The focused validation script at `scripts/validate-docufill-redaction.mjs` proves SSN/account-style values stay hidden in packet summaries and internal prefill display while overlay values remain available; `.github/workflows/docufill-redaction.yml` runs it on relevant source changes. The West Hills package script `test:docufill-selection` covers reopened IRA deals resolving DocuFill custodian/depository selections by saved IDs first, while legacy name-only deals still fall back to names. DocuFill stores only reusable blank template PDFs in PostgreSQL in `docufill_package_documents` with page count and per-page size metadata, capped at 100 MB of stored PDFs per package, reconciled into package metadata on reads and package saves, previewed page-by-page in the mapper through protected internal PDF endpoints, shown as first-page thumbnails in the document ordering pane, and used as the base PDFs for generated packets with mapped answer text overlaid when coordinates exist. Filled customer-specific DocuFill packets should not be stored as templates; completed packets belong in the customer's Google Drive folder alongside the invoice. The visual mapper separates reusable field data rules from per-document presentation rules: fields carry required status plus validation type/message/pattern, while each PDF placement carries position, size, font size, text alignment, and render format such as uppercase, initials, first/last name, digits-only, last-four, currency, date, or checkbox mark. Staff can drag interview fields onto PDF pages, drag existing placements, resize them from the corner, select a placement for exact x/y/w/h controls, and packet generation blocks until required/typed interview answers pass validation.

-   **DocuFill Phase 2:** Packages now use normalized transaction types (`ira_transfer`, `ira_contribution`, `ira_distribution`, `cash_purchase`, `storage_change`, `beneficiary_update`) for Deal Builder selection. Completed packets are validated against required/typed interview fields before generation, rendered from stored template PDFs, saved to the customer's Google Drive folder when Drive is configured, and exposed through token-scoped public interview endpoints for external client completion without internal portal access.
-   **DocuFill shared field library:** Global reusable field definitions live in `docufill_fields` and are exposed through internal DocuFill bootstrap/library endpoints. Package fields can reference `libraryFieldId`, keeping per-package document mappings, options, and presentation settings separate while hydrating shared label/type/source/sensitivity/required/validation rules into package editors, interviews, and packet generation. Common business concepts can stay as single reusable interview fields, such as `Name`, while individual PDF placements choose the printed variant (First, Middle, Last, First + Last, Initials, or whole answer) so one customer answer can fill many differently labeled boxes. Shared field definitions are retired by marking them inactive rather than hard-deleting them, preserving old package references. The internal DocuFill admin is organized around the Sally/Tom package-builder concept: start in Document View to add/order PDFs, use Data + Fields View to drag reusable fields onto document pages and set rules, review the generated questionnaire, then finalize/activate the package so staff or customers only answer the resulting interview. Package details such as name, custodian, depository, and transaction type support the workflow but are not the primary first step.

**Multi-Tenancy Foundation (Phase 1 — DB + Auth):**
-   `accounts` table holds tenants. `account_users` maps staff emails to accounts with roles. `internal_sessions` backs the session store in Postgres (replaced in-memory Map; survives restarts, multi-instance safe).
-   `account_id` column added to `docufill_packages`, `docufill_custodians`, `docufill_depositories`. All existing WHC rows backfilled to `account_id = 1`. `INTERNAL_ALLOWED_EMAILS` staff auto-provisioned as WHC admins in `account_users` on startup.
-   `requireInternalAuth` middleware now stamps `req.internalAccountId` (number) on every internal request. Dev-bypass defaults to account 1.
-   `internal-auth.ts` resolves the account on Google sign-in: looks up `account_users`, auto-provisions missing allowed emails into WHC account.
-   All DocuFill bootstrap/list/create/update/delete routes now scope queries with `WHERE account_id = $N`. The public customer-link routes are unaffected (they go through package → session which is implicitly scoped).
-   `transaction_types` and `docufill_fields` remain global shared tables for now; per-tenant customization is a future phase.
-   **Phase 2 complete:** Clerk auth provisioned. External product portal lives at `/app/*` — sign-up at `/app/sign-up`, sign-in at `/app/sign-in`, DocuFill workspace at `/app`. `ClerkProvider` wraps the entire React app; WHC internal portal at `/internal/*` remains Google-auth gated and untouched.
-   `DocuFillConfigProvider` context overrides `apiPath` and `getAuthHeaders` so the same `DocuFill.tsx` component is reused in both portals without any forking. Internal portal uses `/api/internal/docufill/` + internal session cookie; product portal uses `/api/product/docufill/` + Clerk JWT bearer token.
-   `requireProductAuth` middleware on the API server validates Clerk JWTs and maps `clerk_user_id` → `accountId` (stored in new `account_users.clerk_user_id` column). Dev bypass defaults to account 1 when `CLERK_SECRET_KEY` is absent.
-   Clerk app name currently reads "West Hills Capital" — update in the Auth pane once the product name is chosen.
-   Next phases: product branding/name swap, account invitation flow, per-tenant customization.

**DocuFill Output Channels (step 3 of Package Builder):**
-   Webhook and Embed cards added as locked "Coming soon" placeholders after Customer Link.
-   Staff Interview dropdown now filtered to packages with `enable_interview = true`.

**Deployment:**
-   The monorepo is deployed to Railway (API server) and Vercel (frontend), both configured to watch the GitHub `main` branch.
-   Vercel handles API rewrites to proxy requests to the Railway-hosted API.

# External Dependencies

-   **Dillon Gage Fiztrade API:** Used for live gold/silver spot prices and wholesale trade execution (`LockPrices`, `ExecuteTrade`).
-   **PostgreSQL:** Replit's built-in PostgreSQL for `leads` and `appointments` data.
-   **Resend:** For sending client recap emails with invoice attachments.
-   **Google Drive API:** For uploading generated PDF invoices to a structured folder hierarchy.
-   **FedEx API:** For searching and retrieving nearby FedEx shipping locations.
-   **pnpm workspaces:** Monorepo management.
-   **TypeScript:** Language.
-   **Express:** Backend API framework.
-   **React, Vite, Tailwind CSS, shadcn/ui:** Frontend stack.
-   **Zod:** Data validation.
-   **pdfkit / pdf-lib:** PDF generation, PDF parsing, stored PDF composition, and DocuFill overlay utilities.

---

# How-To Guides

## Changing Wire Transfer Instructions on Invoices

Every customer invoice PDF includes the bank wiring details (bank name, routing number, account number, etc.). These are controlled by environment variables on Railway so you can update them any time without touching code or waiting for a redeploy.

**Steps:**
1. Go to [Railway](https://railway.app) → your project → the **API Server** service → click **Variables** in the left menu.
2. Find or add the following variables (create them if they don't exist yet):

| Variable name | What it controls | Example value |
|---|---|---|
| `WIRE_BANK` | Bank name that appears on invoice | `Commerce Bank` |
| `WIRE_BANK_ADDRESS` | Bank's mailing address | `1551 Waterfront, Wichita, KS 67206` |
| `WIRE_ROUTING` | ABA routing number | `101000019` |
| `WIRE_ACCOUNT_NAME` | Account holder name | `West Hills Capital` |
| `WIRE_ACCOUNT_ADDR` | Account holder mailing address | `1314 N. Oliver Ave. #8348, Wichita, KS 67208` |
| `WIRE_ACCOUNT_NUM` | Account number | `690108249` |

3. After saving, Railway automatically redeploys the API server. New invoices will use the updated values within a minute or two. **Old invoices already sent are not affected.**

> If a variable is missing, the invoice falls back to the current hardcoded Commerce Bank values — nothing will break.

---

## Adding a New Product to the Deal Builder

Adding a new coin or bar (e.g., a 10 oz Gold Bar) requires two small code changes, both in the API server. Once done, the Deal Builder picks up the new product automatically — no frontend changes needed.

**Step 1 — Get the Dillon Gage product code**
Log into the Fiztrade portal (connect.fiztrade.com) and find the product code for the item. It will be a short string like `10GBAR`.

**Step 2 — Edit `artifacts/api-server/src/routes/pricing.ts`**
Near the top, find the line that says:
```
const DG_PRODUCTS = ["1EAGLE", "1B", "SE"] as const;
```
Add the new product code to that list:
```
const DG_PRODUCTS = ["1EAGLE", "1B", "SE", "10GBAR"] as const;
```
Then scroll down to the `products = [...]` array and add a new entry following the same pattern as the existing ones — copy one of the gold products, paste it, and update the `id`, `name`, `metal`, `weight`, `description`, and `spreadPercent` fields.

**Step 3 — Edit `artifacts/api-server/src/lib/fiztrade.ts`**
Find the `DG_CODE` object near the top:
```
const DG_CODE: Record<string, string> = {
  "gold-american-eagle-1oz":   "1EAGLE",
  "gold-american-buffalo-1oz": "1B",
  "silver-american-eagle-1oz": "SE",
};
```
Add a line for the new product (the key must match the `id` you used in step 2):
```
  "gold-bar-10oz": "10GBAR",
```

**Step 4 — Push to GitHub**
Commit and push the changes to the `main` branch on GitHub. Railway and Vercel will deploy automatically within a few minutes. The new product will appear in the Deal Builder's product table immediately after the next "Get Spot Price" click.

---

## Verifying Production Is Fully Configured (Railway Health Check)

After a fresh deployment — or whenever something seems off — you can check which features are active on Railway without SSH access.

**How to access it:**
Open your browser and go to:
```
https://workspaceapi-server-production-987b.up.railway.app/api/healthz/config
```
(If your Railway URL is different, add `/api/healthz/config` to the end of it.)

**What you'll see:**
A JSON response that lists every feature and whether it's turned on (`"configured": true`) or off (`"configured": false`). Example:
```json
{
  "status": "ok",
  "configuredCount": 18,
  "totalCount": 22,
  "features": {
    "dillonGageApi":      { "configured": true,  "impact": "Live spot pricing and product prices" },
    "googleCalendar":     { "configured": true,  "impact": "Appointment booking creates Google Calendar events" },
    "resendEmail":        { "configured": false, "impact": "Transactional email disabled" },
    "wireBank":           { "configured": true,  "impact": "Bank name on invoice wire instructions" },
    ...
  }
}
```

**What to look for:**
- Anything showing `"configured": false` with an `"impact"` that says a critical feature is "disabled" needs its Railway variable set.
- It's normal for `fiztradeDryRun` to show `false` in production (that means real trades are being placed, which is correct).
- `googleOAuth` should be `true` in production — if it's `false`, the internal portal is running in dev-bypass mode and anyone can access it.
