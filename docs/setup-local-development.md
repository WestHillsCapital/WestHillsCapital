# Local Development Setup

This project runs on Replit. The standard development environment is the Replit workspace — there is no requirement to run it locally. These instructions cover the Replit environment.

---

## Prerequisites

All of the following are pre-configured in the Replit workspace:
- Node.js (via Nix)
- pnpm (workspace package manager)
- PostgreSQL (Replit-managed, available via `DATABASE_URL`)

---

## Required secrets

Before running, set these in the Replit Secrets panel (or as environment variables):

**Minimum set to run the app at all:**
```
PORT=3001              # (set automatically by Replit workflows; usually not needed)
DATABASE_URL           # Provided automatically by Replit for the attached database
```

**To use live pricing and deal execution:**
```
DILLON_GAGE_API_KEY    # Get from your Dillon Gage account representative
FIZTRADE_BASE_URL      # Usually: https://connect.fiztrade.com/FizServices
FIZTRADE_DRY_RUN=true  # Set to true to simulate trades without placing real DG orders
```

**To use email:**
```
RESEND_API_KEY         # From your Resend account (resend.com)
FROM_EMAIL             # e.g. West Hills Capital <noreply@westhillscapital.com>
ADMIN_EMAIL            # Joe's email — receives deal notifications and booking alerts
```

**To use Google Sheets, Calendar, and Drive:**
```
GOOGLE_SERVICE_ACCOUNT_KEY        # Full JSON of service account credentials
GOOGLE_SHEETS_SPREADSHEET_ID      # Master CRM spreadsheet ID
GOOGLE_DEAL_BUILDER_SHEET_ID      # Deal Builder spreadsheet ID (or same as master)
GOOGLE_DEALS_OPS_SHEET_ID         # Operations spreadsheet ID (or same as master)
GOOGLE_BOOKING_CALENDAR_ID        # Google Calendar ID for appointment events
GOOGLE_BLOCKER_CALENDAR_IDS       # Comma-separated calendar IDs for busy-period blocking
GOOGLE_DRIVE_DEALS_FOLDER_ID      # Google Drive folder ID for invoice PDFs
```

**To use the internal portal:**
```
GOOGLE_CLIENT_ID              # Google OAuth client ID
INTERNAL_ALLOWED_EMAILS       # Comma-separated list of allowed login emails
FRONTEND_URL                  # e.g. https://your-repl.replit.app
```

---

## Starting the application

The workspace has three configured workflows. Start them from the Replit workflows panel or they start automatically:

| Workflow | Command | What it does |
|---|---|---|
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | Starts the Express API server with hot reload |
| `artifacts/west-hills-capital: web` | `pnpm --filter @workspace/west-hills-capital run dev` | Starts the public site + internal portal (Vite) |
| `artifacts/mockup-sandbox: Component Preview Server` | `pnpm --filter @workspace/mockup-sandbox run dev` | Component preview server (for design work only) |

The public site and internal portal are accessible via the Replit preview pane.

---

## Development tips

**Using dry-run mode for trades**: Set `FIZTRADE_DRY_RUN=true`. The full deal flow (DB save, PDF, email, Sheets) runs as normal but no real DG order is placed. Dry-run confirmation IDs are prefixed `DRY-CONF-` and are excluded from the tracking sync.

**Testing emails locally**: Either use a real Resend API key (emails will actually send) or comment out the `RESEND_API_KEY` variable — the server will throw on email sends but log clearly that email is disabled. Email HTML can be previewed by temporarily returning the HTML string from an API endpoint.

**Database migrations**: The DB schema is managed entirely by `initDb()` in `db.ts`. It uses `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` — running it multiple times is always safe. Restart the API server to apply schema changes.

**Resetting the database**: Use the Replit database console to run `DROP TABLE` statements, or truncate individual tables. Be careful — there is no migration rollback.

---

## Common setup issues

**"DATABASE_URL environment variable is not set"**  
Replit provides this automatically for attached databases. If you see this, check that the Replit database is attached to the project in the database panel.

**"DILLON_GAGE_API_KEY is not set" on deal execute**  
Set the API key in secrets, or set `FIZTRADE_DRY_RUN=true` for testing without a real key.

**"Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY"**  
The service account JSON must be the raw JSON string (not the file path, not base64). Paste the full `{...}` JSON content directly into the secret value.

**Internal portal shows "Access denied" after OAuth**  
Your Google account email is not in `INTERNAL_ALLOWED_EMAILS`. Add it and restart the API server.

**Vite dev server shows blank page or routing errors**  
The preview pane uses path-based proxying. Ensure `server.allowedHosts: true` is set in the Vite config. Restart the web workflow if the preview is stale.
