# Google Sheets Integration

The app writes to up to three distinct Google Spreadsheets:

| Env var | Purpose |
|---|---|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Master CRM sheet — leads, appointments, booking attempts, pipeline |
| `GOOGLE_DEAL_BUILDER_SHEET_ID` | Deal Builder sheet — Deals tab. Falls back to master sheet if unset. |
| `GOOGLE_DEALS_OPS_SHEET_ID` | Operations sheet — Operations tab. Falls back to master sheet if unset. |

Authentication uses the `GOOGLE_SERVICE_ACCOUNT_KEY` JSON credentials. The service account must have Editor access to all three spreadsheets.

---

## Column safety guarantee

The app **never moves, renames, or deletes existing columns** in any sheet. When new columns are required, it reads the actual header row, identifies missing headers, and appends them at the right edge. Column order in the sheet is irrelevant — positions are derived from the live header row at sync time.

**What breaks if you rename a column**: The app will no longer find it by name and will append a duplicate column the next time it tries to write to that header. Do not rename system-managed headers.

**What is safe**: Reordering columns (the app resolves positions by name), adding your own formula or note columns anywhere, editing operator columns freely.

---

## Tabs

### `leads` (master sheet)

One row per lead. System columns are written on insert and update. Operator columns are written blank on insert and never touched again.

**System columns** (app writes on every sync):
`Lead ID`, `First Name`, `Last Name`, `Email`, `Phone`, `State`, `Structure`, `Allocation`, `Timeline`, `Source`, `Status`, `Current Custodian`, `Form Type`, `Linked Appointment`, `Created`, `Updated`

**Operator columns** (blank on insert, app never touches):
`Priority`, `Deal Size Estimate`, `Last Contact Date`, `Next Action`, `Next Action Due`, `Loss Reason`, `Won Date`, `Notes`, `Owner`

**Formula column**:
`Open Deal Builder` — written as a hyperlink formula when a deal is linked. Format: `=HYPERLINK("url","Open Deal Builder")`

---

### `appointments` (master sheet)

One row per confirmed appointment.

**System columns**:
`Confirmation ID`, `Slot ID`, `Scheduled Time`, `Day`, `Time`, `First Name`, `Last Name`, `Email`, `Phone`, `State`, `Structure`, `Allocation`, `Timeline`, `Status`, `Lead ID`, `Calendar Event ID`, `Created`, `Updated`

**Operator columns** (written blank, never updated by app):
`Priority`, `Call Outcome`, `Next Action`, `Next Action Due`, `Invoice Sent`, `Funds Received`, `Order Placed`, `Shipped`, `Delivered`, `Referral Requested`, `Notes`

**Formula column**:
`Open Deal Builder` — hyperlink to Deal Builder for the linked deal.

---

### `booking_attempts` (master sheet)

Append-only audit log. Never updated.

**Columns**:
`Attempt ID`, `Email`, `Slot ID`, `IP Address`, `Result`, `Error Code`, `Error Detail`, `Confirmation ID`, `Attempted At`

---

### `Prospecting Pipeline` (master sheet)

One row per prospect, combining lead and appointment data. The app upserts by Lead ID.

**System columns** (written on insert + scheduling update):
`Record Key`, `Origin Type`, `Is Scheduled`, `Lead ID`, `Confirmation ID`, `Deal ID`, `First Name`, `Last Name`, `Email`, `Phone`, `State`, `Structure`, `Allocation`, `Timeline`, `Form Type`, `Current Custodian`, `Source`, `Scheduled Time`, `Day`, `Time`, `Calendar Event ID`, `Created`, `Updated`

**Status column**: Written once on insert with `New`. Never overwritten — operator manages it.

**Operator columns** (blank on insert, never updated):
`Priority`, `Owner`, `Deal Size Estimate`, `Last Contact Date`, `Call Outcome`, `Next Action`, `Next Action Due`, `Notes`, `Won Date`, `Loss Reason`

**Formula column**:
`Open Deal Builder`

**Scheduling fields** (updated only when an appointment is booked):
`Is Scheduled`, `Confirmation ID`, `Scheduled Time`, `Day`, `Time`, `Calendar Event ID`, `Updated`

---

### `Deals` tab (deal builder sheet or master sheet)

One row per deal. Written on execution and updated on milestone changes.

**System columns** (all 50 columns — always overwritten):
`Deal ID`, `Lead ID`, `Confirmation ID`, `Client Name`, `Email`, `Phone`, `State`, `Deal Type`, `Execution Method`, `Execution Status`, `Gold Spot`, `Silver Spot`, `Spot Timestamp`, `Product Summary`, `Total Quantity`, `Deal Amount`, `Cash Component`, `Actual Cash Transferred`, `Shipping Fee`, `Total Invoice Amount`, `Balance Due`, `Custodian`, `IRA Type`, `IRA Account Number`, `Delivery Method`, `Ship To`, `FedEx Location`, `Billing Line 1`, `Billing Line 2`, `Billing City`, `Billing State`, `Billing Zip`, `External Trade ID`, `Supplier Confirmation ID`, `Execution Timestamp`, `Account Specialist`, `Deal Closer`, `Invoice ID`, `Invoice Generated`, `Recap Email Sent`, `Created`, `Updated`, `Notes`, `Ops Status`, `Payment Received At`, `Tracking Number`, `Wire Received At`, `Order Paid At`, `Shipped At`, `Delivered At`

**Ops Status values** (computed by `computeOpsStatus()`):
| Status | Condition |
|---|---|
| `Delivered` | `deliveredAt` set |
| `Shipped` | `shippedAt` or `shippingEmailSentAt` set |
| `Label Created` | `trackingNumber` set |
| `Wire Received` | `wireReceivedAt` set |
| `Order Paid` | `orderPaidAt` set |
| `Wire Received` | `paymentReceivedAt` or `orderPlacedAt` set (legacy fallback) |
| `Cancel Eligible` | > 2 business days since lock, no payment |
| `At Risk` | > 1 business day since lock, no payment |
| `Awaiting Wire` | default (deal executed, no payment yet) |

---

### `Operations` tab (ops sheet or master sheet)

Auto-created when a deal executes. One row per deal for operational tracking.

**System columns** (written at creation, updated on each milestone action):
`Deal ID`, `Client Name`, `Email`, `Phone`, `Deal Type`, `Total`, `Metal Ordered Date`, `Wire Received Date`, `Wire Email Sent`, `Order Paid Date`, `Tracking Number`, `Shipped Date`, `Delivered Date`, `Status`

**Operator columns** (written blank at creation, app never updates):
`Days to Fund`, `Days to Ship`, `Days to Complete`, `Notes`

**Formula column**:
`Open Deal Builder` — written once at row creation.

**Intended operator use**: Set `Days to Fund`, `Days to Ship`, `Days to Complete` as `=NETWORKDAYS()` formulas using the date columns. The app writes dates; the operator writes the day-counting formulas.

---

## What breaks if columns change

| Action | Impact |
|---|---|
| Rename a system column | App appends a new duplicate column; old column becomes orphaned |
| Delete a system column | App creates a new column at the right edge; data in old column is lost |
| Rename a tab | App cannot find the tab; it will create a new empty tab with the original name |
| Delete a tab | App auto-creates a new empty tab; historical data is gone |
| Add columns past column ZZ | Google Sheets API may return an error when extending headers |
| Reorder columns | Safe — app resolves positions from the header row |
| Edit operator columns | Always safe — app never touches them |
