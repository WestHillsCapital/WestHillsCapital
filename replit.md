# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Project: West Hills Capital

West Hills Capital is a physical gold and silver allocation company. The website is a production-ready, 6-page site with live pricing, a 2-step appointment scheduling flow, and an IRA allocation section. Primary CTA is "Schedule Allocation Call" — phone 800-867-6768.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind + shadcn
- **Frontend packages**: react-hook-form, @hookform/resolvers, framer-motion, lucide-react, date-fns, tailwind-merge, clsx

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/             # Express API server (port 8080)
│   └── west-hills-capital/     # React + Vite frontend (preview path: /)
├── lib/
│   ├── api-spec/               # OpenAPI spec + Orval codegen config
│   ├── api-client-react/       # Generated React Query hooks
│   ├── api-zod/                # Generated Zod schemas from OpenAPI
│   └── db/                     # Drizzle ORM schema + DB connection
├── scripts/                    # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Pages

1. **Home** (`/`) — Hero, principles, CTAs
2. **Live Pricing** (`/pricing`) — Spot ticker, 3 product cards, buyback section
3. **Schedule Allocation Call** (`/schedule`) — 2-step flow: intake form → slot picker → confirmation
4. **IRA Allocation** (`/ira`) — IRA education + intake form
5. **About** (`/about`) — Company story and philosophy
6. **Disclosures** (`/disclosures`) — Legal disclosures and policies

## API Routes

All routes mounted at `/api`:

- `GET /api/pricing/spot` — Gold/silver spot prices (mock: gold $3,215, silver $32.45)
- `GET /api/pricing/products` — 3 featured products with spreads (gold +2%, silver +5%)
- `GET /api/pricing/buyback` — Buyback prices (gold -1%, silver -3%)
- `GET /api/scheduling/slots` — Available 45-min slots, Mon-Fri 9am-5pm CT over 14 days
- `POST /api/scheduling/book` — Book a slot, returns confirmation ID
- `POST /api/leads/intake` — Lead capture form submission

## Key Files

- `lib/api-spec/openapi.yaml` — Full API contract (source of truth)
- `artifacts/api-server/src/routes/pricing.ts` — Pricing routes (TODO: replace mock with Dillon Gage API)
- `artifacts/api-server/src/routes/scheduling.ts` — Scheduling routes (TODO: integrate Google Calendar)
- `artifacts/api-server/src/routes/leads.ts` — Lead capture route (TODO: integrate CRM/email)
- `artifacts/api-server/src/routes/index.ts` — Route mounting
- `artifacts/west-hills-capital/src/App.tsx` — Frontend entry point and routing
- `artifacts/west-hills-capital/src/index.css` — Design theme (off-white / navy / gold)

## Business Rules

- NO cart, checkout, or payment flows
- ALL trades require verbal confirmation and cleared funds
- Phone 800-867-6768 must appear in header, footer, and confirmation screens
- No fear marketing, countdown timers, or "limited supply" language

## TODO / Integration Roadmap

- Replace mock spot prices with Dillon Gage API (`DILLON_GAGE_API_KEY` env var)
- Replace mock scheduling slots with Google Calendar API (`GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY`)
- Add lead CRM integration (`SENDGRID_API_KEY` for confirmations)
- Add Google Sheets or HubSpot lead logging

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — actual JS bundling by esbuild/vite
- **Project references** — cross-package imports require references arrays

## Root Scripts

- `pnpm run build` — typecheck then recursive build
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`, validated with `@workspace/api-zod`.

### `artifacts/west-hills-capital` (`@workspace/west-hills-capital`)

React + Vite frontend. Images in `public/images/`. API calls via fetch to `/api/*`.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec (`openapi.yaml`) and Orval config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from OpenAPI spec. Used by api-server for validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks (not currently used — frontend uses raw fetch).

### `lib/db` (`@workspace/db`)

Drizzle ORM + PostgreSQL. Push schema: `pnpm --filter @workspace/db run push`

### `scripts` (`@workspace/scripts`)

Utility scripts. Run: `pnpm --filter @workspace/scripts run <script>`
