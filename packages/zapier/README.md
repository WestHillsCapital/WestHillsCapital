# Docuplete Zapier Integration

Connects Docuplete interviews to 7,000+ apps via Zapier — no code required.

## Features

| Type | Key | Description |
|------|-----|-------------|
| Trigger | `session_submitted` | Fires when a client completes an interview and documents are generated |
| Action | `create_session` | Creates a new interview session and returns the interview URL |
| Search | `get_session` | Looks up a session by token, returning status, answers, and PDF link |

## Authentication

Users connect their Docuplete account by pasting an API key into Zapier.

- Keys start with `sk_live_` and are created in **Docuplete → Settings → API Keys**
- Keys are account-scoped (not user-scoped); all sessions for the account are accessible
- The auth test calls `GET /api/v1/product/auth/me` to validate the key

## Local Development

### Prerequisites

- Node.js ≥ 18
- A Zapier account (free)
- A Docuplete API key (`sk_live_...`)

### Setup

```bash
# Install dependencies
pnpm install

# Install the Zapier CLI globally (first time only)
npm install -g zapier-platform-cli

# Authenticate the CLI with your Zapier account
zapier login

# Register the app on the Zapier developer platform (first time only)
# This creates the app in your Zapier account and writes .zapierapprc
zapier register "Docuplete"
```

### Validate

```bash
cd packages/zapier
zapier validate
```

A valid integration will show `0 errors, 0 warnings`.

### Test Locally

```bash
# Set up test credentials
export ZAPIER_DEPLOY_KEY=your-key

# Run the Zapier test suite
zapier test
```

### Deploy to Zapier

```bash
# Push a new version to the Zapier platform
zapier push

# Promote to production (run after internal testing)
zapier promote 1.0.0
```

After `zapier push`, the integration is available in your Zapier account as an
invite-only beta. Share the invite link from the Zapier developer dashboard with
beta users.

## Zap Templates

### "Add new Docuplete submissions to a Google Sheet"

Suggested Zap structure:

1. **Trigger**: Docuplete — Interview Submitted
2. **Action**: Google Sheets — Create Spreadsheet Row
   - Map `package_name`, `status`, `session_url`, `pdf_url`, `created_at`, and any `answer__*` fields to columns

Publish this template from the Zapier developer dashboard under **Templates**
after registering the app.

## Trigger: Interview Submitted

Polls `GET /api/v1/product/docufill/sessions?status=generated` every 1–15 minutes.

**Output fields:**

| Field | Description |
|-------|-------------|
| `id` | Unique session ID (used by Zapier for deduplication) |
| `token` | Opaque session token (e.g. `df_abc123`) |
| `package_name` | Name of the interview package |
| `status` | Always `generated` for this trigger |
| `session_url` | Internal Docuplete dashboard link |
| `pdf_url` | Direct link to the generated PDF (if available) |
| `answer__*` | Flattened interview answers, one field per answer key |
| `prefill__*` | Flattened prefill values passed when the session was created |

**Optional input:** Filter by `packageId` to only trigger for a specific interview type.

## Action: Create Interview Session

Posts to `POST /api/v1/product/docufill/sessions`.

**Input fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `packageId` | Yes | Interview package to use |
| `source` | No | Free-text label (default: `zapier`) |
| `prefill` | No | Key-value pairs pre-populated in the interview form |

**Output fields:**

| Field | Description |
|-------|-------------|
| `token` | Session token for use in downstream steps |
| `interview_url` | Direct link to share with the client |
| `session_url` | Internal dashboard link |

## Search: Get Session

Calls `GET /api/v1/product/docufill/sessions/:token`.

Returns current `status`, all `answer__*` fields, and `pdf_url` once documents
are generated.

## Help Article

Suggested content for a Docuplete help article titled
**"Connect Docuplete to your CRM with Zapier"**:

> Docuplete's Zapier integration lets you automate document workflows without writing code.
>
> **Common use cases:**
> - Send a new Docuplete interview link to a contact automatically when a deal reaches a certain stage in your CRM
> - Add completed interview submissions as rows in a Google Sheet for reporting
> - Trigger a follow-up email campaign when a client finishes their documents
>
> **Getting started:**
> 1. Create an API key in Docuplete under Settings → API Keys
> 2. Search for "Docuplete" in Zapier and connect your account
> 3. Use the **Interview Submitted** trigger to start a Zap when a client finishes their paperwork
>
> Need help? Contact support@docuplete.com

## File Structure

```
packages/zapier/
  index.js                   Main app definition
  authentication.js          API key auth + connection label
  triggers/
    sessionSubmitted.js      Interview Submitted (polling)
    listPackages.js          Hidden trigger for dynamic package dropdown
  creates/
    createSession.js         Create Interview Session (action)
  searches/
    getSession.js            Get Session (search)
  package.json
  README.md
```
