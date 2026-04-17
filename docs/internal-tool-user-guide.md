# Internal Tool User Guide

The internal portal is accessed at `/internal`. It requires a Google account that is on the allowed list (`INTERNAL_ALLOWED_EMAILS`).

---

## Logging in

1. Go to `/internal`
2. Click "Sign in with Google"
3. Select your authorized Google account
4. You are redirected to the internal dashboard

If you see "Access denied," your email is not in the allowed list. Contact whoever manages the `INTERNAL_ALLOWED_EMAILS` environment variable.

---

## Deal Builder

The Deal Builder is the primary operational tool. One Deal Builder session = one client transaction.

### Opening a deal

- From the dashboard, click "New Deal" or navigate to `/internal/deal-builder`
- To continue an existing deal: use the "Open Deal Builder" link in the Deals tab of Google Sheets

### Step-by-step deal flow

**1. Client info**
- Enter first name, last name, email, phone, and state
- If the client has a confirmation ID from a prior appointment, enter it to link the deal to that booking

**2. Deal type**
- `Cash`: standard direct purchase — client wires funds to WHC
- `IRA`: requires custodian name, IRA type (Traditional/Roth), and IRA account number

**3. Products**
- Select from the three available metals:
  - Gold American Eagle 1 oz
  - Gold American Buffalo 1 oz
  - Silver American Eagle 1 oz
- Set quantity for each. Products with qty = 0 are excluded.
- Prices are loaded live from Dillon Gage. Click "Refresh Prices" if the quote is stale.

**4. Shipping**
- **FedEx Hold**: Select the client's nearest staffed FedEx Office. The location search populates name, address, and hours automatically. The system formats the DG shipping label in WHC's 10-year proven FBO format.
- **Home Delivery**: Enter the client's home or vault address. The metal ships directly.

**5. Billing address**
- Shown on the invoice "Bill To" block
- Can differ from ship-to (e.g. if client has a PO Box for billing)

**6. Terms of Service**
- Confirm that the client provided verbal acceptance on the recorded call
- Select the confirmation method: "Verbal confirmation on recorded call"
- This is required before execution

**7. Preview invoice**
- Click "Preview Invoice" to review the PDF before executing
- This generates a live preview with no DB write or DG call

**8. Execute deal**
- Click "Execute Deal" — this is the point of no return
- What happens in sequence (all within seconds):
  1. Deal saved to database
  2. Trade placed with Dillon Gage (LockPrices → ExecuteTrade)
  3. Invoice PDF generated
  4. PDF uploaded to Google Drive
  5. Deal recap email + PDF sent to client
  6. Deal rows written to Deals tab and Operations tab in Sheets
  7. Admin notification email sent to you
- Any non-fatal failures (Drive, email, Sheets) appear as warnings in the response — the deal is still saved and the DG order is still placed

---

## Fulfillment panel

After execution, the Fulfillment Panel shows the deal's milestone timeline. Each step can only be completed in order.

### Step 1: Wire Received
- Click when the client's wire arrives in the Commerce Bank account
- Triggers: wire confirmation email to client (one-time, idempotent)
- If the email fails to send, a yellow warning banner appears with a "Resend" button
- Also writes Wire Received Date to the Operations tab

### Step 2: Order Paid
- Click when you submit payment to Dillon Gage via Fiztrade (ACH)
- **Important**: no API endpoint exists in Fiztrade for ACH payment — this milestone is manual. You must actually submit payment on the Fiztrade site; this button only records the date.

### Step 3: Label Created / Shipped
- Tracking number is auto-populated by the background sync (checks DG every 15 minutes with a 2-minute offset, so up to ~17 minutes after DG marks it shipped)
- Or enter the tracking number manually and click "Save Tracking #"
- Saving a tracking number automatically schedules the shipping notification email for 24 hours later

### Step 4: Delivered
- Click when the client confirms receipt at the FedEx location or at home
- Triggers: delivery confirmation email immediately
- Schedules 7-day and 30-day follow-up emails

### Email status indicators
Each milestone step shows the status of its associated email:
- Green chip: "Email sent [date]"
- Gray chip: "Email not sent yet"
- Yellow banner (wire only): email failed — use "Resend" button

---

## Common mistakes to avoid

**Do not click Execute twice.** If execution appears to hang or fail, check the database or Sheets before trying again — the trade may have been placed with Dillon Gage even if the UI did not confirm it.

**Do not re-execute a deal to fix a typo.** Once a DG order is placed, the confirmation ID is the record. Contact Dillon Gage directly for amendments.

**Do not mark Wire Received before the wire actually arrives.** The wire confirmation email fires immediately and cannot be unsent.

**Do not use home delivery unless the client specifically wants home delivery.** The default for WHC clients is FedEx Hold for security reasons.

**Do not enter the wrong FedEx location.** The ship-to on the DG order is baked in at execution and cannot be changed without contacting DG. Verify the location hours and address with the client before executing.

**Spot prices expire.** If you take more than a minute or two between fetching prices and executing, click "Refresh Prices" again. The DG lock window is 20 seconds — the server fetches a fresh lock at execution time, but your UI price display may be stale.

---

## Google Sheets operational workflow

The Operations tab in the Ops sheet is the day-to-day fulfillment view. It has one row per deal:

- **Metal Ordered Date**: Set automatically at deal execution
- **Wire Received Date / Wire Email Sent**: Set when you click Wire Received
- **Order Paid Date**: Set when you click Order Paid
- **Tracking Number / Shipped Date**: Auto-populated by background sync, or set manually
- **Delivered Date**: Set when you click Delivered
- **Status**: Updated by the system after each milestone
- **Days to Fund / Days to Ship / Days to Complete**: These columns are intentionally left blank — add a `=NETWORKDAYS()` formula using the date columns to calculate these automatically

The "Open Deal Builder" link in the row takes you directly to that deal in the internal portal.
