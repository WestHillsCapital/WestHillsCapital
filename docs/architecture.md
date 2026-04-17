# Architecture

## System topology

```
Browser
  │
  ├── Public site (React + Vite)         /
  │     Pricing, scheduling, lead forms
  │
  └── Internal portal (React + Vite)    /internal
        Deal Builder, fulfillment panel
        Protected by Google OAuth
           │
           └──► API Server (Express + TypeScript)    /api-server
                  │
                  ├── PostgreSQL (DATABASE_URL)
                  ├── Resend (email)
                  ├── Google Sheets API
                  ├── Google Calendar API
                  ├── Google Drive API
                  └── Dillon Gage / Fiztrade API
```

Both the public site and internal portal are served from the same Vite artifact (`artifacts/west-hills-capital`).
The API server is a separate artifact (`artifacts/api-server`).
Both run as separate pnpm workspace packages within the monorepo.

---

## Frontend

**Framework**: React 18 + Vite + TypeScript + Tailwind CSS  
**Location**: `artifacts/west-hills-capital/src/`

Key page structure:
```
src/pages/
  Home.tsx                      Public landing page
  Pricing.tsx                   Live spot prices
  HowItWorks.tsx                Product education
  Schedule.tsx                  Appointment booking form
  internal/
    Login.tsx                   Google OAuth sign-in
    Dashboard.tsx               Internal home
    DealBuilder.tsx             Main deal workflow page
    deal-builder/
      hooks/
        useDealState.ts         All deal form state
        useOpsActions.ts        Milestone action handlers
        useLivePricing.ts       Polling spot prices
      sections/
        ProductSection.tsx      Product + pricing inputs
        ClientSection.tsx       Customer info
        ShippingSection.tsx     Delivery method selection
        FulfillmentSection.tsx  Milestone timeline + email status
```

---

## Backend

**Framework**: Express 5 + TypeScript, compiled to ESM  
**Location**: `artifacts/api-server/src/`

### Startup sequence
1. `validateConfig()` — exits if PORT or DATABASE_URL missing, warns on optional vars
2. HTTP server starts immediately (so Railway healthcheck succeeds)
3. `initDb()` — creates tables idempotently via `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS`
4. Background schedulers start after DB is ready

### Route structure
```
/api/
  health            GET  Server and DB readiness
  leads/intake      POST Lead capture
  scheduling/slots  GET  Available appointment slots
  scheduling/book   POST Book an appointment
  pricing/spot      GET  Live spot prices (proxied from DG)
  deals/            POST Execute deal (full orchestration)
  deals/preview-invoice POST Generate preview PDF (no DB write)
  deals/:id         GET  Fetch deal by ID
  deals/:id/wire-received    PATCH Mark wire received + send email
  deals/:id/order-paid       PATCH Mark DG payment sent
  deals/:id/tracking         PATCH Save tracking number
  deals/:id/delivered        PATCH Mark delivered + send email
  deals/:id/resend-wire-email PATCH Retry wire confirmation email
  internal/auth     Google OAuth callback
  fedex/            FedEx staffed location lookup
```

---

## Data flow

### Lead capture
```
Public form submit
  → POST /api/leads/intake
  → Zod validation
  → INSERT leads (PostgreSQL)
  → syncProspectToPipeline() (Google Sheets, non-blocking)
  → 200 OK
```

### Appointment booking
```
Visitor picks slot
  → POST /api/scheduling/book
  → Rate limit check (3 per 10 min per IP:email)
  → Slot availability check (DB + Google Calendar)
  → INSERT appointments (PostgreSQL)
  → [async, non-blocking]:
      Lead upsert + linkage
      mergeAppointmentIntoPipeline() (Google Sheets)
      createBookingEvent() (Google Calendar)
      sendBookingNotification() (admin email)
      sendBookingConfirmation() (client email)
  → 200 OK (immediately after DB insert)
```

### Deal execution
```
Joe clicks Execute in Deal Builder
  → POST /api/deals
  → Validation (firstName, lastName, email, products, total, termsProvided)
  → Rate limit check (10 per 10 min per operator email)
  → INSERT deals (PostgreSQL)
  → lockAndExecuteTrade() (DG: LockPrices → ExecuteTrade, must complete in <20s)
  → generateInvoicePdf() (PDFkit)
  → saveDealPdfToDrive() (Google Drive)
  → sendDealRecapEmail() (Resend, PDF attached)
  → appendDealToOpsSheet() + appendDealToOperationsTab() (Google Sheets)
  → sendDealLockNotification() (admin email, fire-and-forget)
  → 201 Created
```

### Post-execution milestone flow
```
Wire arrives in WHC bank account
  → Joe clicks "Wire Received" in Deal Builder
  → PATCH /api/deals/:id/wire-received
  → Sets wire_received_at, payment_received_at (COALESCE)
  → sendWireConfirmationEmail() (idempotent — only fires once)
  → updateOperationsMilestone() (Google Sheets)

DG ships the metal
  → runTrackingSync() (background, every 15 min, 2 min offset)
  → getShippingStatus([supplier_confirmation_ids]) (DG batch poll)
  → Sets tracking_number, shipping_notification_scheduled_at = NOW() + 24h

24h after tracking received
  → runScheduler() (background, every 15 min)
  → Detects shipping_notification_scheduled_at passed
  → sendShippingNotificationEmail()
  → Sets shipped_at, shipping_email_sent_at

Joe clicks "Delivered" in Deal Builder
  → PATCH /api/deals/:id/delivered
  → Sets delivered_at, follow_up_7d_scheduled_at = NOW()+7d, follow_up_30d_scheduled_at = NOW()+30d
  → sendDeliveryConfirmationEmail() (immediately)

7 days after delivery
  → runScheduler() detects follow_up_7d_scheduled_at passed
  → sendFollowUp7DayEmail()

30 days after delivery
  → runScheduler() detects follow_up_30d_scheduled_at passed
  → sendFollowUp30DayEmail()
```

---

## Background schedulers

Two independent schedulers run in `index.ts` after DB is ready:

| Scheduler | Interval | Offset | Responsibility |
|---|---|---|---|
| `runScheduler` | 15 min | none | Shipping emails, 7d/30d emails, Deals tab status sync |
| `runTrackingSync` | 15 min | +2 min | Poll DG for tracking numbers; schedule shipping notification |

Both are non-fatal — errors are logged but never crash the server.

---

## Key dependencies between services

- **Fiztrade API key required** for live spot pricing and trade execution. Without it, `/pricing/spot` returns 404 and deal execution fails at step 2.
- **Resend API key required** for any email. Without it, all email functions throw (non-fatal at deal execute time, but wire/shipping/delivery emails will silently not send).
- **Google service account required** for all Sheets and Calendar operations. Missing key degrades CRM sync but does not block deal execution.
- **GOOGLE_DRIVE_DEALS_FOLDER_ID required** for PDF Drive upload. Without it, the PDF is still generated and emailed but not saved to Drive.
