# Access and Ownership

Who owns which accounts and what access is needed to maintain the system.

---

## Hosting and infrastructure

| Service | Purpose | Access needed |
|---|---|---|
| Replit | Monorepo hosting, deployment, database, secrets | Owner account |
| Railway | Production deployment (if deployed there) | Owner account |

---

## Database

| Item | Details |
|---|---|
| Provider | Replit-managed PostgreSQL |
| Connection | `DATABASE_URL` environment secret |
| Who has direct access | Anyone with the `DATABASE_URL` value |
| Prod data access | Via the Replit database console or any Postgres client using `DATABASE_URL` |

---

## Google services

All Google integrations use a single service account.

### Google Service Account
- **Variable**: `GOOGLE_SERVICE_ACCOUNT_KEY`
- **What it does**: Authenticates all Google API calls (Sheets, Calendar, Drive)
- **Who owns it**: Whoever manages the Google Cloud project for WHC
- **Required permissions**:
  - Google Sheets API enabled
  - Google Calendar API enabled
  - Google Drive API enabled
  - Service account shared as Editor on all spreadsheets used
  - Service account shared as Writer on the Drive deals folder
  - Calendar event creation access (via calendar sharing or domain delegation)

### Google Sheets
- **Master CRM sheet**: ID in `GOOGLE_SHEETS_SPREADSHEET_ID`
- **Deal Builder sheet**: ID in `GOOGLE_DEAL_BUILDER_SHEET_ID`
- **Ops sheet**: ID in `GOOGLE_DEALS_OPS_SHEET_ID`
- **Who can edit**: The service account + anyone manually shared on the spreadsheet
- **Access for Joe**: Joe's Google account should have at minimum Editor access to all sheets used operationally

### Google Calendar
- **Booking calendar**: ID in `GOOGLE_BOOKING_CALENDAR_ID` — where WHC appointment events are created
- **Blocker calendar(s)**: IDs in `GOOGLE_BLOCKER_CALENDAR_IDS` — read-only; the system checks these for Joe's busy periods
- **Who manages blockers**: Joe — add calendar events directly to block scheduling slots

### Google Drive
- **Deals folder**: ID in `GOOGLE_DRIVE_DEALS_FOLDER_ID`
- **What is stored**: One PDF per executed deal, named `WHC-{id}-{FirstName}{LastName}-{type}-{date}.pdf`
- **Who has access**: Service account + anyone shared on the folder

### Google OAuth (internal portal)
- **Variable**: `GOOGLE_CLIENT_ID`
- **What it does**: Powers the "Sign in with Google" button on the internal portal
- **Authorized emails**: `INTERNAL_ALLOWED_EMAILS` — comma-separated list of allowed Google accounts
- **Who can log in**: Only accounts in `INTERNAL_ALLOWED_EMAILS`; adding new staff requires updating this variable and redeploying

---

## Email (Resend)

| Item | Details |
|---|---|
| Provider | Resend (resend.com) |
| API key | `RESEND_API_KEY` |
| From address | `FROM_EMAIL` (default: `noreply@westhillscapital.com`) |
| Domain verification | TXT record on `send.westhillscapital.com` |
| Who manages | Whoever controls the westhillscapital.com DNS and Resend account |
| Dashboard | resend.com — view all sent emails, bounces, and domain status |

---

## Dillon Gage / Fiztrade

| Item | Details |
|---|---|
| Provider | Dillon Gage (fiztrade.com) |
| API key | `DILLON_GAGE_API_KEY` |
| Base URL | `FIZTRADE_BASE_URL` (default: `https://connect.fiztrade.com/FizServices`) |
| Dry run | `FIZTRADE_DRY_RUN=true` for testing (no real orders placed) |
| Account contact | Joe's Dillon Gage account representative |
| What to do if API fails | Contact DG support; manually place orders through Fiztrade website |

---

## Domain and DNS

| Item | Details |
|---|---|
| Domain | westhillscapital.com |
| DNS records needed | TXT record for Resend on `send` subdomain |
| Who manages DNS | Whoever manages the domain registrar account for westhillscapital.com |

---

## Environment secrets (all locations)

All secrets are stored in Replit Secrets or Railway environment variables. Never commit them to source control. Full list is in `environment-variables.md`.

To update a secret:
- **Development**: Replit Secrets panel
- **Production**: Railway project → Environment tab
- After changing a secret: restart the API server workflow for it to take effect
