# Business Rules

This document captures all business logic encoded in the system. "Unclear or assumed" rules are flagged — see `questions-for-owner.md` for items that need owner confirmation.

---

## Appointment scheduling

- **Weekdays only**: no Saturday or Sunday slots are offered.
- **Hours**: 9 AM to 5 PM Central Time. Slots are 60 minutes apart.
- **Lead time**: Minimum 2 hours from the current moment. Clients cannot book same-day within 2 hours.
- **Days available**: Up to 14 calendar days ahead. The system always shows exactly 14 upcoming slots (not 14 days, 14 slots).
- **DST handling**: The code uses a fixed offset of UTC-5 (CDT). In winter (CST = UTC-6), displayed times will be 1 hour off. This is a known limitation.
- **Slot conflicts**: Each slot can have at most one confirmed appointment. A partial unique index enforces this at the DB level. A second request for the same slot returns HTTP 409.
- **Google Calendar**: Blocker calendars can mark Joe as busy. Slots overlapping Calendar busy periods are hidden from the public-facing list.
- **Rate limit**: 3 booking attempts per 10 minutes per IP:email pair.

---

## Pricing

- **Source**: Dillon Gage (Fiztrade API). Prices are pulled live on request; the API does not cache them.
- **What is shown vs. used**: The client invoice always shows WHC retail prices (what Joe enters in Deal Builder). The DG wholesale price is used internally for trade execution only. The invoice never references Dillon Gage.
- **Price lock window**: DG locks prices for 20 seconds. LockPrices → ExecuteTrade must complete within this window.
- **Spot timestamp**: Recorded in the deal at execution time. The invoice prints this to show the client when pricing was locked.

---

## Deal execution

- **Terms of Service**: Cannot execute without `termsProvided: true` and `termsVersion` and `confirmationMethod`. The only accepted confirmation method is `verbal_recorded_call`. These are enforced by server validation.
- **Terms version**: Currently `v1.0`. If terms change, the version must be incremented in `deals.ts` and the change logged.
- **Deal types**: `cash` and `ira`. IRA-specific logic (custodian, IRA account number, IRA type) is captured but the execution path has not been fully tested for IRA-specific edge cases.
- **Rate limit**: 10 deal submissions per 10 minutes per operator email. This protects the DG API.

### FedEx Hold label format
This is a 10-year proven format used by WHC. The Dillon Gage ship-to is formatted as:
- **firstName** field in DG request: `{FedEx location name} FBO {ClientFirstName} {ClientLastName}`
- **lastName** field in DG request: `{ClientFirstName} {ClientLastName}`
- **address2** field in DG request: same as firstName field (redundancy in case label is damaged)

This is intentional and must not be changed without coordinating with Dillon Gage.

### Home delivery
Ship-to fields are sent directly to DG with the client's name and address. No FBO format.

### DG product codes
Only three products are currently mapped:

| WHC product ID | DG code |
|---|---|
| `gold-american-eagle-1oz` | `1EAGLE` |
| `gold-american-buffalo-1oz` | `1B` |
| `silver-american-eagle-1oz` | `SE` |

Any product ID not in this map is silently excluded from the DG order. If a product is added to the UI but not to the map, it will be in the invoice but not ordered from DG.

---

## Wire / payment timeline

- **Payment deadline**: Next business day from price lock, by close of business. The deadline is computed by `nextBusinessDayFrom()` and printed in the deal recap email.
- **What "close of business" means**: The email says "close of business on the next business day." The exact cut-off time is not enforced by code — it is a manual expectation.
- **At Risk / Cancel Eligible**: The scheduler transitions the deal status after 1 and 2 business days respectively if no wire is received. These are Sheets status labels only — no automated action (e.g. cancellation) occurs.

---

## Email sequence

7 automated emails per deal (plus the admin notification which is internal):

| # | Trigger | Email |
|---|---|---|
| 0 | Booking confirmed | Booking confirmation (to client) |
| 0 | Booking confirmed | Booking notification (to Joe) |
| 1 | Deal executed | Deal recap + invoice PDF (to client) |
| 2 | Wire received | Wire confirmation (to client) — idempotent, fires once |
| 3 | 24h after tracking number received | Shipping notification (to client) |
| 4 | Delivered marked | Delivery confirmation (to client) — fires immediately |
| 5 | 7 days after delivery | 7-day follow-up (to client) |
| 6 | 30 days after delivery | 30-day follow-up (to client) |

**Idempotency**: Emails 2–6 are guarded by `sent_at` timestamps. Once stamped, the scheduler and endpoints skip them permanently.

**Delivery email exception**: Unlike other automated emails, the delivery confirmation (Email 4) fires immediately via the `/delivered` endpoint, not via the background scheduler.

---

## Shipping notification timing

The shipping notification email is deliberately delayed 24 hours after the tracking number is received. Reason: the FedEx package typically appears in FedEx tracking data 12–24 hours after the label is created. The delay prevents the client from checking FedEx and seeing "no information available" immediately after receiving the notification.

---

## Wire instructions (hardcoded in invoice PDF)

```
Bank:         Commerce Bank
Bank address: 1551 Waterfront, Wichita, KS 67206
Routing:      101000019
Account name: West Hills Capital
Account addr: 1314 N. Oliver Ave. #8348, Wichita, KS 67208
Account num:  690108249
```

These values are hardcoded in `invoice-pdf.ts`. To update them, edit the `WIRE` constant in that file.

---

## Invoices

- **Invoice ID format**: `WHC-{deal_id}-{YYYYMMDD}` where the date is the locked_at date.
- **Invoice is not a receipt**: It is a proforma invoice / wire instructions document. The deal recap email says "payment must be received" — the invoice shows what is owed, not what was paid.
- **Drive upload**: PDFs are uploaded to `GOOGLE_DRIVE_DEALS_FOLDER_ID`. The folder structure inside Drive is not defined by code — all files go into the root folder specified.

---

## Fulfillment status chain

Status transitions flow in one direction only. The scheduler computes status from the set of timestamps:

```
Awaiting Wire → At Risk → Cancel Eligible
            → Wire Received
                       → Order Paid
                                  → Label Created (tracking received)
                                                 → Shipped
                                                         → Delivered
```

"At Risk" triggers after 1 business day without payment. "Cancel Eligible" after 2 business days. These are display labels in Sheets; no code enforces an actual cancellation.

---

## Google Sheets — operator column safety

The app **never overwrites operator columns** once a row is inserted. This means:
- Notes you add in Sheets are permanent
- Status values you change in Sheets will not be overwritten by the next sync (with one exception: the `Status` column in the Deals tab is a system column and is synced on every scheduler tick)
- The Ops Status column in the Deals tab is system-managed and will be overwritten regularly
