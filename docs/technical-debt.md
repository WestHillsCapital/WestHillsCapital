# Technical Debt

Known shortcuts, temporary solutions, and risk areas that should be addressed before the system scales.

---

## Critical risks

### DST / time zone handling is broken in winter
**File**: `scheduling.ts` line 52  
**Issue**: `CT_OFFSET_HOURS = -5` is hardcoded (CDT). During Central Standard Time (November–March), the correct offset is -6. All displayed appointment times will be 1 hour off during this period.  
**Fix needed**: Use a proper time zone library (e.g. `date-fns-tz`) to compute the UTC offset from `America/Chicago` at the time of each slot, rather than a fixed offset.

### Wire instructions are hardcoded in source
**File**: `invoice-pdf.ts` (the `WIRE` constant)  
**Issue**: Bank name, address, routing number, and account number are hardcoded. Any banking change requires a code deployment to take effect.  
**Fix needed**: Move wire instructions to environment variables or a config table so they can be updated without a deployment.

### Product catalog is hardcoded in two places
**Files**: `fiztrade.ts` (DG_CODE map), Deal Builder UI product list  
**Issue**: Adding a new metal product requires updating both the DG product code map and the frontend, and redeploying.  
**Fix needed**: Move the product catalog to a DB table or config file.

---

## Functional gaps

### ACH payment to Dillon Gage has no API endpoint
**Issue**: The "Order Paid" milestone exists in the UI and DB but there is no Fiztrade API endpoint for ACH payment. Joe must submit payment manually on the Fiztrade website and then click the milestone button to record the date.  
**Risk**: The "Order Paid" milestone date is a manual entry — it is advisory only, not tied to actual payment confirmation from DG.

### IRA deal flow is partially unimplemented
**Issue**: The deal form collects IRA-specific fields (custodian, IRA type, account number) and the DB stores them, but the execution path has not been validated for actual IRA transfers. IRA deals involve custodian direction of investment letters, different payment timing, and compliance requirements that are not modeled in the code.  
**Risk**: Executing an IRA deal via the Deal Builder may create an incorrect DG order or fail compliance requirements.

### No retry mechanism for failed Sheets writes
**Issue**: Sheets writes are fire-and-forget. If a write fails (rate limit, auth error, transient network), the data is simply not written. There is no queue or retry.  
**Risk**: Occasional data gaps in Sheets; manual re-sync required.

### Delivery email sent timestamp is not visible in the UI
**Issue**: `delivery_email_sent_at` is stored in the DB but not exposed in the Fulfillment Panel UI. The Delivered milestone shows no email status indicator.  
**Risk**: Joe cannot tell if the delivery confirmation email was sent without checking the DB directly.

### No client-facing portal
**Issue**: Clients receive emails but have no way to check the status of their order or view their documents. All communication is push (email-only).  
**Risk**: Inbound client status inquiries must be handled manually.

---

## Code quality

### Two overlapping payment columns
**Issue**: `payment_received_at` (legacy) and `wire_received_at` (new) both track the customer wire arrival. When `/wire-received` is called, it sets both (`wire_received_at` directly and `payment_received_at` via COALESCE). The legacy `/payment` endpoint only sets `payment_received_at`. The two columns can diverge.  
**Fix needed**: Deprecate `/payment` endpoint. Remove `payment_received_at` from all status computation and replace with `wire_received_at`.

### Scheduling uses `console.log` instead of structured logger
**File**: `scheduling.ts`, `leads.ts`  
**Issue**: Some files use `console.log/error` while others use the pino-based `logger`. The logger produces structured JSON that Railway can parse and filter; console.log does not.

### Google Sheets upsert reads master spreadsheet ID unconditionally
**File**: `google-sheets.ts` in `upsertByHeaderName()` around line 440  
**Issue**: The key column scan uses `SPREADSHEET_ID` (master) even when called for the deal builder or ops sheet. This is likely a latent bug — if the master sheet and deal builder sheet are different files, the lookup will scan the wrong spreadsheet.  
**Fix needed**: Pass the spreadsheet ID override through to the upsert scan, the same way it is passed to `ensureTabHeaders`.

---

## Operational / manual processes

### Tracking numbers (usually automated, but fallback is manual)
The background sync polls DG automatically, but if DG never marks the order as "shipped," Joe must enter the tracking number manually in the Fulfillment Panel.

### Drive folder is flat (no sub-folder organization)
All invoice PDFs are uploaded to the root of `GOOGLE_DRIVE_DEALS_FOLDER_ID` with no sub-folder structure by month, year, or client. This will become hard to navigate as deal volume grows.

### No automated testing
There are no unit tests, integration tests, or E2E tests. All validation is manual.

### Booking_attempts pruned after 90 days
This is intentional but means audit trail for old booking attempts is lost after 3 months.
