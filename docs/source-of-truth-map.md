# Source of Truth Map

Where is each important piece of data authoritative?

---

## Data stored in PostgreSQL (authoritative)

PostgreSQL is the single authoritative source of truth for all transactional and operational data.

| Data | Table | Notes |
|---|---|---|
| Leads | `leads` | All form submissions and appointment prospects |
| Appointments | `appointments` | Confirmed booking records |
| Booking audit log | `booking_attempts` | Pruned after 90 days |
| Deals | `deals` | All executed deals and their full history |
| Spot price history | `spot_price_history` | Historical pricing snapshots |
| Fulfillment milestones | `deals` | All `_at` timestamp columns |
| Email send status | `deals` | All `_sent_at` columns |
| DG trade confirmation | `deals.supplier_confirmation_id` | Required for tracking sync |
| Invoice ID | `deals.invoice_id` | Format: `WHC-{id}-{YYYYMMDD}` |

---

## Data stored in Google Sheets (operational view — not authoritative)

Google Sheets is a **read and write operational dashboard** for Joe and the team. It mirrors PostgreSQL data but should not be treated as the system of record.

| Sheet / Tab | What it shows | Authoritative source |
|---|---|---|
| `leads` tab | Lead pipeline | PostgreSQL `leads` |
| `appointments` tab | Booked calls | PostgreSQL `appointments` |
| `Prospecting Pipeline` tab | Combined lead + appointment view | PostgreSQL `leads` + `appointments` |
| `Deals` tab | Deal details and milestone dates | PostgreSQL `deals` |
| `Operations` tab | Fulfillment workflow view | PostgreSQL `deals` |
| `booking_attempts` tab | Booking audit log | PostgreSQL `booking_attempts` |
| Operator columns (Notes, Priority, etc.) | **Authoritative only in Sheets** — app never overwrites these | Google Sheets only |

**Operator-managed fields in Sheets are the source of truth for those values.** If you set a priority, owner, call outcome, or notes in Sheets, that data exists only in Sheets. PostgreSQL does not mirror it back.

---

## Data stored in Google Drive (archive only)

| Data | Notes |
|---|---|
| Invoice PDFs | Uploaded at deal execution. Drive is an archive copy — the authoritative record is in PostgreSQL (`deals.invoice_url`). The PDF is also emailed to the client. |

---

## Data stored in Google Calendar (operational view)

| Data | Notes |
|---|---|
| Appointment events | Created at booking. The appointment record is authoritative in PostgreSQL. The Calendar event is a convenience view for Joe. |
| Blocker events | Joe manages these directly in Calendar. The system reads them to hide slots. |

---

## Pricing data

| Data | Source | Cached? |
|---|---|---|
| Live spot prices | Dillon Gage / Fiztrade API | Not cached — fetched live on each `/pricing/spot` request and each Deal Builder page load |
| Price at execution | Locked in `deals.gold_spot_ask` / `deals.silver_spot_ask` | Permanent — stored at execution, never changes |

---

## Configuration data

| Data | Source |
|---|---|
| Wire instructions | Hardcoded in `invoice-pdf.ts` (the `WIRE` constant) |
| Product catalog | Hardcoded in `fiztrade.ts` (DG_CODE) and Deal Builder UI |
| Terms version | Hardcoded in `deals.ts` (CURRENT_TERMS_VERSION = "v1.0") |
| Allowed internal users | `INTERNAL_ALLOWED_EMAILS` environment variable |
| From email address | `FROM_EMAIL` environment variable (default: `noreply@westhillscapital.com`) |

---

## Email delivery status

| Data | Source |
|---|---|
| Whether an email was sent | PostgreSQL `*_sent_at` columns — these are set only on confirmed send |
| Email content history | Resend dashboard |
| Bounce/delivery status | Resend dashboard |

---

## Summary: what to check first

| Question | Check |
|---|---|
| "Did the client's wire arrive?" | PostgreSQL `deals.wire_received_at` |
| "Was the wire email sent?" | PostgreSQL `deals.wire_confirmation_email_sent_at` |
| "What is the tracking number?" | PostgreSQL `deals.tracking_number` |
| "Was the shipping email sent?" | PostgreSQL `deals.shipping_email_sent_at` |
| "What did Joe note about this client?" | Google Sheets operator columns |
| "Where is the invoice PDF?" | Google Drive (link in `deals.invoice_url`) |
| "Was the DG order placed?" | PostgreSQL `deals.supplier_confirmation_id` + `deals.execution_status` |
