# Environment Variables

All variables are set in Railway (production) or Replit Secrets (development).
Never commit secret values to source control.

---

## Required — server will not start without these

| Variable | Description | Used in |
|---|---|---|
| `PORT` | TCP port for the Express server. Railway injects this automatically. | `index.ts` |
| `DATABASE_URL` | PostgreSQL connection string. Replit provides this automatically for the attached database. | `db.ts` |

If either is missing, the process exits immediately with a clear error message.

---

## Optional — missing values degrade specific features

| Variable | Default | Feature affected if missing | Used in |
|---|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | — | All Google Sheets and Calendar sync disabled | `google-sheets.ts`, `google-calendar.ts`, `google-drive.ts` |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | — | Master CRM sheet sync disabled (leads, appointments, booking attempts, pipeline) | `google-sheets.ts` |
| `GOOGLE_DEAL_BUILDER_SHEET_ID` | Falls back to master sheet | Deal Builder sheet writes go to master sheet | `google-sheets.ts` |
| `GOOGLE_DEALS_OPS_SHEET_ID` | Falls back to master sheet | Operations tab writes go to master sheet | `google-sheets.ts` |
| `DILLON_GAGE_API_KEY` | — | Live spot pricing returns 404; deal execution fails at DG step | `fiztrade.ts`, `pricing.ts` |
| `FIZTRADE_BASE_URL` | `https://connect.fiztrade.com/FizServices` | Wrong base URL would cause all DG calls to fail | `fiztrade.ts` |
| `FIZTRADE_DRY_RUN` | `false` | When set to `"true"`, DG trade calls are simulated; no real orders placed | `fiztrade.ts` |
| `GOOGLE_BOOKING_CALENDAR_ID` | — | Appointment calendar events not created | `google-calendar.ts` |
| `GOOGLE_BLOCKER_CALENDAR_IDS` | — | Blocker calendar busy periods not checked; may allow double-booking | `google-calendar.ts` |
| `RESEND_API_KEY` | — | All transactional email disabled; functions throw | `email.ts` |
| `FROM_EMAIL` | `West Hills Capital <noreply@westhillscapital.com>` | Custom sender address (must be verified in Resend) | `email.ts` |
| `GOOGLE_CLIENT_ID` | — | Internal portal Google OAuth disabled; nobody can log in | `internal-auth.ts` |
| `INTERNAL_ALLOWED_EMAILS` | — | All OAuth sign-ins blocked (no whitelist = no access) | `requireInternalAuth.ts` |
| `FRONTEND_URL` | — | "Open Deal Builder" hyperlinks in Sheets will be broken | `google-sheets.ts` |
| `ADMIN_EMAIL` | — | Admin deal notification emails and booking notifications not sent | `email.ts`, `scheduling.ts` |
| `CORS_ALLOWED_ORIGINS` | Open to all origins | CORS unrestricted in production | `app.ts` |
| `GOOGLE_DRIVE_DEALS_FOLDER_ID` | — | Invoice PDFs not saved to Drive (still emailed) | `google-drive.ts` |

---

## Notes

**`GOOGLE_SERVICE_ACCOUNT_KEY`** must be the full JSON content of a Google service account credentials file, base64-encoded or as a raw JSON string. The service account must have:
- Editor access to all Sheets spreadsheets used
- Writer access to the Google Drive folder
- Calendar event creation rights (via domain delegation or direct share)

**`INTERNAL_ALLOWED_EMAILS`** is a comma-separated list of email addresses allowed to access the internal portal. Example: `joe@westhillscapital.com,admin@westhillscapital.com`. If missing, no one can log in.

**`FIZTRADE_DRY_RUN`** is safe for development and testing. In dry-run mode:
- LockPrices and ExecuteTrade return fake IDs prefixed `DRY-`
- GetShippingStatus returns an empty array (so fake confirmation IDs are never polled)
- All downstream steps (PDF, email, Sheets) run normally

**`FIZTRADE_BASE_URL`** has an auto-heal: if the value was copy-pasted without the `https://` prefix, the code restores it automatically and logs a warning.

**`FROM_EMAIL`** must use a domain verified in Resend. The `send.westhillscapital.com` subdomain TXT record has been added for Resend DNS verification.
