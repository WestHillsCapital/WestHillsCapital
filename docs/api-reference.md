# API Reference

Base path: `/api`  
All routes require `Content-Type: application/json` for POST/PATCH requests.  
Internal routes additionally require a valid session cookie set by Google OAuth.

---

## Public routes

### GET /api/health
Returns server and database readiness.

**Response 200**
```json
{ "status": "ok", "db": "ready" }
```
```json
{ "status": "degraded", "db": "not ready", "dbError": "..." }
```

---

### POST /api/leads/intake
Saves a lead and mirrors it to the Prospecting Pipeline in Google Sheets.

**Request body** (Zod-validated)
```json
{
  "formType": "page_intake",
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "phone": "316-555-0000",
  "state": "KS",
  "allocationType": "physical_delivery",
  "allocationRange": "under_50k",
  "timeline": "ready",
  "currentCustodian": "Fidelity"
}
```

`formType` values: `page_intake`, `ira_interest`, `appointment_booked`, others as defined in Zod schema.  
`allocationType`: `physical_delivery` | `ira_rollover` | `not_sure`  
`allocationRange`: `under_50k` | `50k_150k` | `150k_500k` | `500k_plus`  
`timeline`: `ready` | `within_30_days` | `researching`

**Response 200** — always succeeds (even if DB/Sheets write fails, the lead is returned)
```json
{ "success": true, "message": "Your information has been received..." }
```

**Errors**
- `400` — Zod validation failure

---

### GET /api/scheduling/slots
Returns the next 14 available appointment slots.

**Rate limit**: 30 requests per minute per IP.

**Query params**: none

**Response 200**
```json
{
  "slots": [
    {
      "id": "slot-1713459600000",
      "dateTime": "2026-04-20T14:00:00.000Z",
      "dayLabel": "Monday, April 20",
      "timeLabel": "9:00 AM CT",
      "available": true
    }
  ],
  "timezone": "America/Chicago"
}
```

Slots are weekdays only, 9 AM – 5 PM CT, 60-minute intervals, at least 2 hours in the future, up to 14 days ahead. Already-booked DB slots and Google Calendar busy periods are excluded.

---

### POST /api/scheduling/book
Books an appointment slot.

**Rate limit**: 3 bookings per 10 minutes per IP:email.

**Request body** (Zod-validated)
```json
{
  "slotId": "slot-1713459600000",
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "phone": "316-555-0000",
  "state": "KS",
  "allocationType": "physical_delivery",
  "allocationRange": "under_50k",
  "timeline": "ready"
}
```

**Response 200**
```json
{
  "confirmationId": "WHC-MO38YWMI",
  "scheduledTime": "2026-04-20T14:00:00.000Z",
  "dayLabel": "Monday, April 20",
  "timeLabel": "9:00 AM CT",
  "message": "Your allocation discussion is confirmed."
}
```

**Errors**
- `400` — validation error or slot unavailable
- `409` — slot just taken (race condition)
- `429` — rate limited
- `503` — DB unavailable

---

### GET /api/pricing/spot
Returns current gold and silver spot prices from Dillon Gage.

**Response 200**
```json
{
  "gold": { "bid": 3200.50, "ask": 3210.00 },
  "silver": { "bid": 31.20, "ask": 31.50 },
  "timestamp": "2026-04-17T14:00:00.000Z"
}
```

**Errors**
- `404` — `DILLON_GAGE_API_KEY` not set

---

## Internal routes (require Google OAuth session)

### POST /api/deals
Full deal execution orchestration. Rate-limited to 10 deals per 10 minutes per operator email.

**Request body**
```json
{
  "firstName": "Joe",
  "lastName": "Test",
  "email": "joe@example.com",
  "phone": "316-555-0001",
  "state": "KS",
  "dealType": "cash",
  "shippingMethod": "fedex_hold",
  "fedexLocation": "FedEx Office Print & Ship Center",
  "fedexLocationHours": "Mon–Fri 8AM–7PM\nSat 9AM–6PM",
  "shipToLine1": "7701 E Kellogg Dr",
  "shipToCity": "Wichita",
  "shipToState": "KS",
  "shipToZip": "67207",
  "products": [
    {
      "productId": "silver-american-eagle-1oz",
      "productName": "1 oz Silver Eagle",
      "metal": "silver",
      "qty": 10,
      "unitPrice": 37.50,
      "lineTotal": 375.00
    }
  ],
  "subtotal": 375.00,
  "shipping": 25.00,
  "total": 400.00,
  "balanceDue": 400.00,
  "goldSpotAsk": 3210.00,
  "silverSpotAsk": 31.50,
  "spotTimestamp": "2026-04-17T14:00:00.000Z",
  "termsProvided": true,
  "termsVersion": "v1.0",
  "confirmationMethod": "verbal_recorded_call",
  "leadId": 42,
  "confirmationId": "WHC-MO38YWMI"
}
```

`dealType`: `cash` | `ira`  
`shippingMethod`: `fedex_hold` | `home_delivery`  
`confirmationMethod`: `verbal_recorded_call` (required)  
`termsVersion`: `v1.0` (current)

**Validation requirements**
- `firstName`, `lastName` non-empty
- `email` contains `@`
- `dealType` in `['cash', 'ira']`
- `shippingMethod` in `['fedex_hold', 'home_delivery']`
- `products` non-empty; each must have `productId`, `metal`, `qty > 0`, `unitPrice > 0`
- `total > 0`
- `termsProvided === true`
- `termsVersion` non-empty
- `confirmationMethod` non-empty

**Response 201**
```json
{
  "dealId": 17,
  "status": "executed",
  "invoiceId": "WHC-17-20260417",
  "invoiceUrl": "https://drive.google.com/...",
  "emailSentTo": "joe@example.com",
  "lockedAt": "2026-04-17T14:00:00.000Z",
  "warnings": ["Google Drive upload failed: ..."]
}
```

`warnings` is omitted if empty. Non-fatal failures (PDF, Drive, email, Sheets) are surfaced here without failing the overall request.

**Errors**
- `400` — validation failure
- `429` — rate limited
- `502` — DG trade execution failed (deal is saved in DB, no DG order placed)
- `500` — DB save failed

---

### POST /api/deals/preview-invoice
Generates a PDF for the current form state without saving anything. Returns the PDF as a binary stream.

**Response 200** — `application/pdf` binary

---

### GET /api/deals/:id
Fetch all fields of a deal by numeric ID.

**Response 200** — full deal row as camelCase JSON.

---

### PATCH /api/deals/:id/wire-received
Records the date the client's wire arrived. Idempotent — wire confirmation email fires only once.

**Response 200**
```json
{
  "success": true,
  "wireReceivedAt": "2026-04-18T14:00:00.000Z",
  "wireConfirmationEmailSentAt": "2026-04-18T14:00:01.000Z"
}
```

---

### PATCH /api/deals/:id/resend-wire-email
Retries the wire confirmation email when the original failed.

**Response 200**
```json
{ "success": true, "wireConfirmationEmailSentAt": "2026-04-18T15:00:00.000Z" }
```

---

### PATCH /api/deals/:id/order-paid
Records the date Joe paid Dillon Gage (manually entered).

**Response 200**
```json
{ "success": true, "orderPaidAt": "2026-04-19T10:00:00.000Z" }
```

---

### PATCH /api/deals/:id/tracking
Saves a tracking number manually. Also sets `shipping_notification_scheduled_at = NOW() + 24 hours`.

**Request body**
```json
{ "trackingNumber": "449044304137821" }
```

**Response 200**
```json
{ "success": true, "trackingNumber": "449044304137821" }
```

---

### PATCH /api/deals/:id/delivered
Marks the order as delivered. Sends delivery confirmation email immediately. Sets 7d and 30d follow-up schedules.

**Response 200**
```json
{ "success": true, "deliveredAt": "2026-04-24T16:00:00.000Z" }
```

---

## Error conventions

All errors return JSON:
```json
{ "error": "Human-readable message" }
```

Validation errors from `POST /api/deals` return a semicolon-separated string of all failures.
