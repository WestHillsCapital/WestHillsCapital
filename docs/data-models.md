# Data Models

All data lives in PostgreSQL. Column names are snake_case in the DB and camelCase in API responses.

---

## leads

Captures all prospect data from public forms and appointment bookings.

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Auto-increment lead ID |
| `form_type` | TEXT | Source form: `page_intake`, `ira_interest`, `appointment_booked` |
| `first_name` | TEXT | Required |
| `last_name` | TEXT | Required |
| `email` | TEXT | Required |
| `phone` | TEXT | Optional |
| `state` | TEXT | US state abbreviation |
| `allocation_type` | TEXT | `physical_delivery` \| `ira_rollover` \| `not_sure` |
| `allocation_range` | TEXT | `under_50k` \| `50k_150k` \| `150k_500k` \| `500k_plus` |
| `timeline` | TEXT | `ready` \| `within_30_days` \| `researching` |
| `current_custodian` | TEXT | IRA custodian if applicable |
| `ip_address` | TEXT | Captured for fraud review |
| `status` | TEXT | Default `new`; operator-managed in Sheets |
| `notes` | TEXT | Internal notes |
| `follow_up_date` | DATE | Operator-set follow-up reminder |
| `owner` | TEXT | Assigned team member |
| `linked_confirmation_id` | TEXT | Appointment confirmation ID if booked |
| `created_at` | TIMESTAMPTZ | When lead was created |
| `updated_at` | TIMESTAMPTZ | Last update |

---

## appointments

One row per confirmed booking.

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Auto-increment |
| `confirmation_id` | TEXT UNIQUE | WHC-XXXXXXXX format |
| `slot_id` | TEXT | `slot-{epoch_ms}` — unique index on confirmed slots |
| `scheduled_time` | TIMESTAMPTZ | UTC time of the appointment |
| `day_label` | TEXT | e.g. "Monday, April 20" (displayed to client) |
| `time_label` | TEXT | e.g. "9:00 AM CT" (displayed to client) |
| `first_name` | TEXT | |
| `last_name` | TEXT | |
| `email` | TEXT | |
| `phone` | TEXT | |
| `state` | TEXT | |
| `allocation_type` | TEXT | |
| `allocation_range` | TEXT | |
| `timeline` | TEXT | |
| `status` | TEXT | `confirmed` or `cancelled` |
| `calendar_event_id` | TEXT | Google Calendar event ID (set async after booking) |
| `lead_id` | INTEGER | FK to leads.id (set async after booking) |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Uniqueness constraint**: only one `confirmed` row per `slot_id` (partial unique index).

---

## deals

One row per executed deal. The most important and most complex table.

### Identity fields
| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Auto-increment deal ID |
| `lead_id` | INTEGER | FK to leads.id (optional) |
| `confirmation_id` | TEXT | Appointment confirmation ID (optional) |
| `invoice_id` | TEXT | `WHC-{id}-{YYYYMMDD}` |

### Deal type
| Column | Type | Description |
|---|---|---|
| `deal_type` | TEXT | `cash` \| `ira` |
| `ira_type` | TEXT | IRA sub-type (e.g. `traditional`, `roth`) |
| `custodian` | TEXT | IRA custodian name |
| `ira_account_number` | TEXT | |

### Client info
| Column | Type | Description |
|---|---|---|
| `first_name` | TEXT | Required |
| `last_name` | TEXT | Required |
| `email` | TEXT | Required |
| `phone` | TEXT | |
| `state` | TEXT | |

### Pricing
| Column | Type | Description |
|---|---|---|
| `gold_spot_ask` | NUMERIC(12,4) | Gold ask price at execution |
| `silver_spot_ask` | NUMERIC(12,4) | Silver ask price at execution |
| `spot_timestamp` | TIMESTAMPTZ | When prices were fetched |
| `products` | JSONB | Array of `{productId, productName, metal, qty, unitPrice, lineTotal}` |
| `subtotal` | NUMERIC(12,2) | Products total before shipping |
| `shipping` | NUMERIC(12,2) | Flat shipping fee |
| `total` | NUMERIC(12,2) | Grand total = subtotal + shipping |
| `balance_due` | NUMERIC(12,2) | Usually same as total |

### Shipping
| Column | Type | Description |
|---|---|---|
| `shipping_method` | TEXT | `fedex_hold` \| `home_delivery` |
| `fedex_location` | TEXT | FedEx location name (FedEx Hold only) |
| `fedex_location_hours` | TEXT | Store hours (shown on invoice and recap email) |
| `ship_to_name` | TEXT | Full name on shipping label |
| `ship_to_line1` | TEXT | Street address |
| `ship_to_city` | TEXT | |
| `ship_to_state` | TEXT | |
| `ship_to_zip` | TEXT | |

### Billing address (on invoice)
| Column | Type | Description |
|---|---|---|
| `billing_line1` | TEXT | |
| `billing_line2` | TEXT | |
| `billing_city` | TEXT | |
| `billing_state` | TEXT | |
| `billing_zip` | TEXT | |

### DG trade execution
| Column | Type | Description |
|---|---|---|
| `external_trade_id` | TEXT | DG LockPrices transaction ID |
| `supplier_confirmation_id` | TEXT | DG ExecuteTrade confirmation ID; used for tracking poll |
| `execution_status` | TEXT | `pending` → `executed` \| `execution_failed` |
| `execution_timestamp` | TIMESTAMPTZ | When DG execution completed |
| `execution_warnings` | JSONB | Non-fatal warnings array from execution |

### Invoice and Terms
| Column | Type | Description |
|---|---|---|
| `invoice_url` | TEXT | Google Drive web view link |
| `invoice_generated_at` | TIMESTAMPTZ | |
| `recap_email_sent_at` | TIMESTAMPTZ | When the order recap email was sent |
| `terms_provided` | BOOLEAN | Must be `true` to execute |
| `terms_provided_at` | TIMESTAMPTZ | |
| `terms_version` | TEXT | Current: `v1.0` |
| `confirmation_method` | TEXT | `verbal_recorded_call` |

### Fulfillment milestones
| Column | Type | Description |
|---|---|---|
| `wire_received_at` | TIMESTAMPTZ | Customer wire arrived in WHC account |
| `order_paid_at` | TIMESTAMPTZ | Joe paid DG (manual) |
| `tracking_number` | TEXT | FedEx tracking number |
| `shipped_at` | TIMESTAMPTZ | Product left DG warehouse |
| `delivered_at` | TIMESTAMPTZ | Client confirmed receipt |

### Email automation timestamps
| Column | Type | Description |
|---|---|---|
| `wire_confirmation_email_sent_at` | TIMESTAMPTZ | Email 1 — wire received confirmation |
| `shipping_notification_scheduled_at` | TIMESTAMPTZ | When shipping email should fire (= tracking received + 24h) |
| `shipping_email_sent_at` | TIMESTAMPTZ | Email 2 — shipping notification |
| `delivery_email_sent_at` | TIMESTAMPTZ | Email 3 — delivery confirmation |
| `follow_up_7d_scheduled_at` | TIMESTAMPTZ | = delivered_at + 7 days |
| `follow_up_7d_sent_at` | TIMESTAMPTZ | Email 4 — 7-day follow-up |
| `follow_up_30d_scheduled_at` | TIMESTAMPTZ | = delivered_at + 30 days |
| `follow_up_30d_sent_at` | TIMESTAMPTZ | Email 5 — 30-day follow-up |

### Legacy / operational
| Column | Type | Description |
|---|---|---|
| `payment_received_at` | TIMESTAMPTZ | Legacy — wire_received_at sets this too (COALESCE) |
| `order_placed_at` | TIMESTAMPTZ | Legacy — may be unused in current flow |
| `status` | TEXT | `locked` \| `executed` |
| `notes` | TEXT | Internal notes from Deal Builder |
| `locked_at` | TIMESTAMPTZ | When deal was submitted (= price lock time) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

## booking_attempts

Audit log for every booking attempt (success and failure). Pruned after 90 days.

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | |
| `attempted_at` | TIMESTAMPTZ | |
| `email` | TEXT | |
| `slot_id` | TEXT | |
| `ip_address` | TEXT | |
| `success` | BOOLEAN | |
| `confirmation_id` | TEXT | Set on success |
| `error_code` | TEXT | `validation_error` \| `rate_limited` \| `slot_unavailable` \| `slot_conflict_db` \| `database_unavailable` \| `db_insert_failed` |
| `error_detail` | TEXT | Full error message |

---

## spot_price_history

Historical spot price snapshots. Approximately one row per pricing fetch.

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | |
| `gold_bid` | NUMERIC(12,4) | |
| `gold_ask` | NUMERIC(12,4) | |
| `silver_bid` | NUMERIC(12,4) | |
| `silver_ask` | NUMERIC(12,4) | |
| `source` | TEXT | `dillon_gage` or similar |
| `recorded_at` | TIMESTAMPTZ | |

---

## Products (not a DB table)

Products are stored as JSONB in `deals.products`. The three currently supported products:

| productId | productName | metal | DG Code |
|---|---|---|---|
| `gold-american-eagle-1oz` | Gold American Eagle 1 oz | gold | `1EAGLE` |
| `gold-american-buffalo-1oz` | Gold American Buffalo 1 oz | gold | `1B` |
| `silver-american-eagle-1oz` | Silver American Eagle 1 oz | silver | `SE` |

Any product ID not in this map is silently dropped when building the DG trade request.
