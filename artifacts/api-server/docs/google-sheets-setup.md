# Google Sheets Setup — Operator Runbook

This document tells Joe exactly what tabs and headers must exist in the master
Google Sheet before the first production deal execution. The system resolves
all column positions by header name, so column order within a tab does not
matter — only the names must match exactly.

---

## Required: Deals Tab

The `Deals` tab must exist in the master Google Sheet. The service account
has write access but **cannot create tabs** — if the tab is missing the
system throws:

> Required tab "Deals" does not exist in the Google Sheet. Please create it
> manually (with the correct header row) and re-run.

### Full header list (46 columns, A → AT)

Copy these headers into **row 1** of the Deals tab, one per cell:

| Column | Header |
|--------|--------|
| A | Deal ID |
| B | Lead ID |
| C | Confirmation ID |
| D | Client Name |
| E | Email |
| F | Phone |
| G | State |
| H | Deal Type |
| I | Execution Method |
| J | Execution Status |
| K | Gold Spot |
| L | Silver Spot |
| M | Spot Timestamp |
| N | Product Summary |
| O | Total Quantity |
| P | Deal Amount |
| Q | Cash Component |
| R | Actual Cash Transferred |
| S | Shipping Fee |
| T | Total Invoice Amount |
| U | Balance Due |
| V | Custodian |
| W | IRA Type |
| X | IRA Account Number |
| Y | Delivery Method |
| Z | Ship To |
| AA | FedEx Location |
| AB | Billing Line 1 |
| AC | Billing Line 2 |
| AD | Billing City |
| AE | Billing State |
| AF | Billing Zip |
| AG | External Trade ID |
| AH | Supplier Confirmation ID |
| AI | Execution Timestamp |
| AJ | Account Specialist |
| AK | Deal Closer |
| AL | Invoice ID |
| AM | Invoice Generated |
| AN | Recap Email Sent |
| AO | Created |
| AP | Updated |
| AQ | Notes |
| AR | Ops Status |
| AS | Payment Received At |
| AT | Tracking Number |

### If the Deals tab already has 38 columns (current state)

Your sheet currently has the first 38 columns (Deal ID → Notes) but is
missing these 8:

**Add to the existing Deals tab (in any order, after column AL):**
- `Billing Line 1`
- `Billing Line 2`
- `Billing City`
- `Billing State`
- `Billing Zip`
- `Ops Status`  ← used by "Mark Payment Received" to write "Paid"
- `Payment Received At`
- `Tracking Number`

> **Important:** `Ops Status` and `Payment Received At` are required for
> the "Mark Payment Received" button in the Deal Builder to update the sheet.
> Without those columns, the status sync is silently skipped.

---

## Operations Tab (current state: manually maintained)

The system does **not** auto-write to the Operations tab on deal execution.
It is filled in manually as each milestone (docs, wire, metal, shipping)
completes. The tab must have the following headers for compatibility if
auto-sync is added later:

| Column | Header |
|--------|--------|
| A | Deal ID |
| B | Client Name |
| C | Docs Received Date |
| D | Wire Sent Date |
| E | Wire Received Date |
| F | Metal Ordered Date |
| G | Shipped Date |
| H | Delivered Date |
| I | Days to Fund |
| J | Days to Ship |
| K | Days to Complete |
| L | Status |
| M | Notes |

> Ops Status tracking (`Pending Wire`, `Paid`, etc.) happens in the
> **Deals tab** via the `Ops Status` column, not in the Operations tab.
> The "Mark Payment Received" button in the Deal Builder updates the Deals
> tab, not this Operations tab.

---

## Google Drive setup (for invoice PDF storage)

The `GOOGLE_DRIVE_DEALS_FOLDER_ID` environment variable must point to a
folder **inside a Shared Drive** (Google Workspace Team Drive). Service
accounts have no personal Drive storage quota and cannot upload to regular
My Drive folders.

**One-time setup:**
1. Go to [drive.google.com](https://drive.google.com) → left sidebar →
   **Shared drives** → click **+** (New shared drive)
2. Name it `WHC Deals` (or similar)
3. Open the Shared Drive → gear icon → **Manage members**
4. Add the service account email (the `client_email` value from
   `GOOGLE_SERVICE_ACCOUNT_KEY`) as a **Contributor**
5. Inside the Shared Drive, create a folder named `WHC Deals`
6. Copy the folder ID from the URL
   (`https://drive.google.com/drive/folders/{FOLDER_ID}`)
7. In Railway → **Variables** → update `GOOGLE_DRIVE_DEALS_FOLDER_ID` to
   the new Shared Drive folder ID
8. Redeploy — Drive uploads will work automatically from that point

---

## What happens when a tab or column is missing

| Scenario | System behaviour |
|----------|-----------------|
| Deals tab does not exist | Deal execution fails with a clear error in the amber warning block: "Required tab 'Deals' does not exist…" |
| Deals tab exists but has fewer columns than expected | Row is written for all existing columns; amber block shows which columns could not be added and their names |
| Ops Status column missing | Mark Payment Received silently skips the sheet update (logs a warning) |
| Drive folder is regular My Drive | Amber warning block shows: "Service Accounts do not have storage quota" |
