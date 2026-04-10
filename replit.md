# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Project: West Hills Capital

West Hills Capital is a physical gold and silver allocation company. The website is a production-ready site with live Dillon Gage pricing, a 2-step appointment scheduling flow, an IRA allocation section, and a 12-article Insights educational hub. Primary CTA is "Schedule Allocation Call" — phone (800) 867-6768.

### Pages / Routes
- `/` — Home
- `/pricing` — Live Pricing (spot stats, 8-period chart, product cards, buyback table)
- `/schedule` — Schedule Allocation Call (2-step form)
- `/ira` — IRA Allocation
- `/about` — About
- `/disclosures` — Disclosures
- `/insights` — Insights hub (12 articles across 4 topic groups)
- `/insights/:slug` — Individual article pages

### Insights Section
- **Data file**: `artifacts/west-hills-capital/src/data/insights.ts` — all article metadata, body content, group assignments, and related-article wiring
- **Landing page**: `src/pages/Insights.tsx`
- **Article page**: `src/pages/InsightArticle.tsx` (dynamic, uses slug routing)
- 4 topic groups: Understanding Pricing | Making Smart Decisions | Ownership and Practical Reality | Choosing Who to Trust
- 12 articles with full body copy, section headings, excerpts, and related-article internal links
- Each article has a bottom CTA linking to `/schedule`

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL (Replit built-in, pg client)
- **Validation**: Zod (`zod/v4`)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind + shadcn
- **Frontend packages**: react-hook-form, @hookform/resolvers, lucide-react, date-fns, tailwind-merge, clsx

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/             # Express API server (port 8080)
│   └── west-hills-capital/     # React + Vite frontend (preview path: /)
├── lib/
│   ├── api-spec/               # OpenAPI spec + Orval codegen config
│   ├── api-zod/                # Generated Zod schemas from OpenAPI
│   └── ...
├── pnpm-workspace.yaml
└── tsconfig.json
```

## Pages

1. **Home** (`/`) — Hero, live product prices, principles, CTAs
2. **Live Pricing** (`/pricing`) — Spot ticker, 3 product cards with live pricing, buyback table
3. **Schedule Allocation Call** (`/schedule`) — 2-step flow: intake form → slot picker → confirmation
4. **IRA Allocation** (`/ira`) — IRA education + intake form
5. **About** (`/about`) — Company story and philosophy
6. **Disclosures** (`/disclosures`) — Legal disclosures and policies

## API Routes

All routes mounted at `/api`:

- `GET /api/pricing/spot` — Live gold/silver spot prices from Dillon Gage Fiztrade API
- `GET /api/pricing/products` — 3 featured products with spreads (gold +2%, silver +5%)
- `GET /api/pricing/buyback` — Buyback prices (gold -1%, silver -3%)
- `GET /api/scheduling/slots` — Available slots, Mon-Fri 9am-5pm CT, 14 days ahead, excludes booked slots
- `POST /api/scheduling/book` — Book a slot, persists to DB, returns confirmation ID
- `POST /api/leads/intake` — Lead capture, persists to DB

## Key Files

- `lib/api-spec/openapi.yaml` — Full API contract (source of truth)
- `artifacts/api-server/src/routes/pricing.ts` — Live pricing via Dillon Gage Fiztrade API
- `artifacts/api-server/src/routes/scheduling.ts` — Scheduling with DB persistence
- `artifacts/api-server/src/routes/leads.ts` — Lead capture with DB persistence
- `artifacts/api-server/src/db.ts` — PostgreSQL pool connection utility
- `artifacts/west-hills-capital/src/App.tsx` — Frontend entry point and routing
- `artifacts/west-hills-capital/src/components/layout/SpotTicker.tsx` — Live spot price bar (top of every page)
- `artifacts/west-hills-capital/src/index.css` — Design theme (off-white / navy / gold)

## Live Data Integration

### Dillon Gage Fiztrade API

- **Production token**: stored as `DILLON_GAGE_API_KEY` env var (`1119-...`)
- **Staging token**: `1466-...` — staged but not yet activated by Dillon Gage; staging environment is incomplete
- **Working endpoint**: `GET https://connect.fiztrade.com/FizServices/GetSpotPriceData/{token}` — returns live gold/silver/platinum/palladium prices with daily changes
- **Account**: WEST HILLS CAPITAL, LLC — Account #167542
- **Cache**: 5-second TTL in-memory cache on the backend
- **Blocked endpoints**: `GetProductCatalog` and `GetPricesForProducts` crash with 500 (NullReferenceException on Dillon Gage's server) because the 3 products have not been added as "favorites" in the Fiztrade portal (connect.fiztrade.com). Once configured, these endpoints will return product images, account-specific pricing, and availability.

### Dillon Gage Product Codes (confirmed from existing WordPress site)

These are the exact Fiztrade product codes for the 3 featured products. They are documented in `pricing.ts` and ready to use with `GetPricesForProducts` once portal setup is complete:

| Product | Fiztrade Code |
|---|---|
| 1 oz American Gold Eagle | `1EAGLE` |
| 1 oz American Gold Buffalo | `1B` |
| 1 oz American Silver Eagle (Random Year) | `SE` |

### Pricing configuration

- Gold spread: +2% over spot bid
- Silver spread: +5% over spot bid
- Gold buyback: -1% from spot
- Silver buyback: -3% from spot

## Database

- **Platform**: Replit built-in PostgreSQL (`DATABASE_URL` env var)
- **Tables**:
  - `leads` — All form submissions from Schedule and IRA pages
  - `appointments` — All booked calls with confirmation IDs, used to prevent double-booking

## Email Notifications (Pending)

- SendGrid integration was declined (user dismissed the Replit connector)
- To add email confirmations later:
  - Option A: Connect SendGrid via Replit integrations (ask agent to "add SendGrid email")
  - Option B: Provide a `SENDGRID_API_KEY` directly so it can be stored as a secret
- Hook points already exist in `leads.ts` and `scheduling.ts` (add send logic after DB inserts)

## Google Calendar (Pending)

- The scheduling system uses deterministic time slot generation (Mon-Fri 9am-5pm CT)
- Booked slots are excluded via DB query — no double-booking is possible
- To integrate real Google Calendar availability:
  - Connect Google Calendar via Replit integrations (ask agent to "add Google Calendar")
  - The agent will query freebusy and create calendar events on booking

## Git & Deployment Setup

### Source of Truth

**GitHub** is the single source of truth: `WestHillsCapital/WestHillsCapital`, branch `main`.

- Replit local branch: `main` (tracking `github/main`)
- `git status` reads: "Your branch is up to date with 'github/main'"
- Both local and GitHub are at the same commit: `15ba625`

### History

Previously, Replit local (`master`) and GitHub (`main`) had completely divergent histories — no common ancestor. Task agents pushed directly to GitHub from isolated environments without syncing back to Replit. This was resolved by:
1. Fetching all GitHub objects locally
2. Adding `README.md` (the one file GitHub had that local didn't)
3. Force-pushing Replit's local history to `github/main` to unify into one linear history
4. Renaming local branch `master` → `main`
5. Setting upstream: `git branch --set-upstream-to=github/main main`

### Auto-Deploy Wiring

| Service | Watches | Deploys |
|---|---|---|
| **Railway** | GitHub `WestHillsCapital/WestHillsCapital` `main` | API server (`artifacts/api-server`) |
| **Vercel** | GitHub `WestHillsCapital/WestHillsCapital` `main` | Frontend (`artifacts/west-hills-capital`) |

Railway URL: `https://workspaceapi-server-production-987b.up.railway.app`

### Vercel Configuration

Root `vercel.json` controls the Vercel build:
- **Install**: `pnpm install`
- **Build**: `pnpm --filter @workspace/west-hills-capital build`
- **Output**: `artifacts/west-hills-capital/dist/public`
- **API rewrite**: `/api/(.*)` → Railway URL (so the Vercel-hosted frontend reaches Railway)
- **SPA fallback**: `/(.*)` → `/index.html`

### Git Remotes (Replit)

- `github` → `https://github.com/WestHillsCapital/WestHillsCapital.git` (push/fetch)
- `gitsafe-backup` → internal Replit backup
- `subrepl-848h6cbd` → isolated task agent communication

## Business Rules

- NO cart, checkout, or payment flows
- ALL trades require verbal confirmation and cleared funds
- Phone 800-867-6768 must appear in header, footer, and confirmation screens
- No fear marketing, countdown timers, or "limited supply" language
- Products: 1oz Gold American Eagle, 1oz Gold American Buffalo, 1oz Silver American Eagle

## Bug Fixes Applied

- `h-13` non-standard Tailwind class in Home.tsx → corrected to `h-12`
- Dead `animationDelay` style and unused `idx` variable removed from LivePricing.tsx product card map
- API image URLs from `/api/pricing/products` return root-relative paths (e.g. `/images/gold-eagle.png`); `useProductPrices` hook now prepends `import.meta.env.BASE_URL` to correctly resolve them under the `/west-hills-capital/` base path
- `staleTime: 4000` added to all three pricing queries (spot, products, buyback) to prevent unnecessary refetch flicker
- State of Residence in Schedule.tsx converted from free-text Input to a native `<select>` with all 50 US states
- State field in IRA.tsx also converted from free-text Input to a native `<select>` with all 50 US states
- Privacy Policy and Terms of Service sections added to Disclosures.tsx with `id="privacy-policy"` and `id="terms-of-service"` anchors and `scroll-mt-24` for proper offset under the fixed header
- Footer links updated to `/disclosures#privacy-policy` and `/disclosures#terms-of-service`
- `ScrollToTop` in App.tsx updated to skip scrolling when `window.location.hash` is present so anchor links navigate correctly
