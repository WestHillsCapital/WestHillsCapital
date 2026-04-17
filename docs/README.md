# West Hills Capital — System Overview

West Hills Capital is a physical gold and silver allocation firm based in Wichita, KS.
Phone: (800) 867-6768

---

## What the system does

**Public site** (`/`): Attracts and converts prospects into scheduled allocation calls.
Displays live spot pricing, explains service offerings, and lets visitors book a consultation slot online without any human interaction on WHC's side.

**Internal portal** (`/internal`): Protected by Google OAuth. Joe (and any authorized team member) uses this to build deals, execute trades with Dillon Gage, generate invoices, and track each order through fulfillment milestones.

---

## Major workflows

### 1. Attract → Lead capture
Visitor submits a form on the public site (various form types: page intake, IRA interest, etc.).
The lead is saved to PostgreSQL and synced to the **Prospecting Pipeline** tab in Google Sheets.

### 2. Engage → Appointment booking
Visitor selects an available slot from the public scheduling page.
The system confirms the slot, creates a Google Calendar event, sends the prospect a branded confirmation email, and notifies Joe.

### 3. Deliver → Deal execution
During the consultation call, Joe opens Deal Builder in the internal portal.
He selects products, the system fetches live spot prices, he reviews the deal, and clicks Execute.
On execution (in sequence, all within seconds):
1. Deal saved to PostgreSQL
2. Trade placed with Dillon Gage (LockPrices → ExecuteTrade)
3. Invoice PDF generated (PDFkit)
4. PDF uploaded to Google Drive
5. Deal recap email with PDF attachment sent to client
6. Deal row written to Deals tab and Operations tab in Google Sheets
7. Admin notification email sent to Joe

### 4. Fulfill → Milestone tracking
After execution, Joe tracks five milestones in the Deal Builder:
- Wire Received (triggers wire confirmation email to client)
- Order Paid (Joe ACH-pays Dillon Gage via Fiztrade — currently manual, no API endpoint available)
- Shipped (auto-populated by background tracking sync from Dillon Gage; triggers shipping email ~24h after tracking received)
- Delivered (Joe marks manually; triggers delivery confirmation email immediately)
- Follow-up emails at 7 days and 30 days post-delivery (automated by background scheduler)

### 5. Delight → Post-delivery follow-ups
Background scheduler fires at 7 days and 30 days after delivery date, sending personalized follow-up emails and opening a referral conversation.

---

## Live features

- Public site: home, how it works, pricing page with live spot prices, scheduling page, contact
- Lead capture from multiple form placements
- Appointment scheduling with Google Calendar integration and slot conflict prevention
- Internal portal with Google OAuth protection
- Deal Builder: product selection, live spot pricing, FedEx Hold / home delivery, IRA / cash deal types
- DG trade execution (LockPrices + ExecuteTrade via Fiztrade API)
- Invoice PDF generation with wire instructions, shipping address, spot prices
- Google Drive PDF upload
- Google Sheets CRM sync: leads, appointments, deals, booking attempts, operations
- Full 7-email automation suite: booking confirmation, deal recap, wire received, shipping, delivery, 7d follow-up, 30d follow-up
- Background tracking auto-fetch from Dillon Gage every 15 minutes
- Fulfillment milestone panel in Deal Builder with email status indicators
- Wire email resend button (when initial send failed)
- Rate limiting on all public endpoints

## Incomplete / planned features

- IRA deal flow: fields exist in the DB and UI but execution path and custodian-specific requirements are not fully documented or tested
- ACH payment to Dillon Gage: no API endpoint available in Fiztrade; Order Paid milestone must be marked manually
- Home delivery shipping: `home_delivery` is a valid deal type and routes correctly to DG, but no specific UI workflow beyond address entry
- Public contact form: listed as planned; may not be wired to a backend route
- Client portal / account login: not built

---

## Services used

| Service | Purpose |
|---|---|
| PostgreSQL | Primary database (Replit-managed) |
| Resend | Transactional email delivery |
| Dillon Gage / Fiztrade | Wholesale metal trade execution and shipping status |
| Google Sheets API | CRM — leads, appointments, deals, operations |
| Google Calendar API | Appointment event creation; blocker calendar support |
| Google Drive API | Invoice PDF storage |
| Google OAuth | Internal portal authentication |
| PDFkit | Server-side invoice PDF generation |
