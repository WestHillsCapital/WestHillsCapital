# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Project: West Hills Capital

West Hills Capital is a physical gold and silver allocation company. The website is a production-ready, 6-page site with live Dillon Gage pricing, a 2-step appointment scheduling flow, and an IRA allocation section. Primary CTA is "Schedule Allocation Call" — phone 800-867-6768.

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

- **Token**: stored as `DILLON_GAGE_API_KEY` env var
- **Working endpoint**: `GET https://connect.fiztrade.com/FizServices/GetSpotPriceData/{token}` — returns live gold/silver/platinum/palladium prices with daily changes
- **Account**: WEST HILLS CAPITAL, LLC — Account #167542
- **Cache**: 5-second TTL in-memory cache on the backend
- **Not yet configured**: `GetProductCatalog` and `GetPricesForProducts` return empty — products need to be set up in the Fiztrade web portal (connect.fiztrade.com) before these endpoints can be used

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

## Business Rules

- NO cart, checkout, or payment flows
- ALL trades require verbal confirmation and cleared funds
- Phone 800-867-6768 must appear in header, footer, and confirmation screens
- No fear marketing, countdown timers, or "limited supply" language
- Products: 1oz Gold American Eagle, 1oz Gold American Buffalo, 1oz Silver American Eagle
