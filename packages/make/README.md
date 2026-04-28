# Docuplete Make.com Connector

Connects Docuplete interviews to 1,000+ apps via Make.com — no code required.

## Modules

| Type    | Name                     | Description                                                             |
|---------|--------------------------|-------------------------------------------------------------------------|
| Trigger | Interview Submitted      | Fires when a client completes an interview and documents are generated  |
| Action  | Create Interview Session  | Creates a new interview session and returns the interview URL           |
| Search  | Get Session              | Looks up a session by ID or token, returning status, answers, and PDF   |

## Authentication

Users connect their Docuplete account by entering an API key into Make.com.

- Keys start with `sk_live_` and are created in **Docuplete → Settings → API Keys**
- Keys are account-scoped (not user-scoped); all sessions for the account are accessible
- The connection test calls `GET /api/v1/product/auth/me` to validate the key

## File Structure

```
packages/make/
├── app.json            # App metadata (name, label, version, theme colour)
├── base.json           # Base HTTP configuration — auth headers, shared error handling
├── connection.json     # Connection parameters and validation call
├── modules/
│   ├── interview_submitted.json   # Polling trigger
│   ├── create_session.json        # Action module
│   └── get_session.json           # Search module
├── rpcs/
│   └── list_packages.json         # Dynamic dropdown — populates Package selectors
└── scripts/
    └── validate.js                # Structural validation script
```

## Publishing to Make.com

Make.com custom apps are managed through the [Make App Developer Platform](https://www.make.com/en/integrations).

### Steps to publish

1. Log in to Make.com and go to **Profile → Build an app**.
2. Click **Create a new app** and enter the metadata from `app.json`.
3. Set up the **Connection** using the fields and communication block in `connection.json`.
4. Add a **Remote Procedure Call (RPC)** using `rpcs/list_packages.json`.
5. Add each module from the `modules/` directory in order:
   - `interview_submitted.json` → Trigger
   - `create_session.json` → Action
   - `get_session.json` → Search
6. Paste the `base.json` content into the app's **Base** settings.
7. Use the **Test** button in the Make UI to verify each module with a live connection.

### Validate locally

```bash
cd packages/make
node scripts/validate.js
```

A valid connector outputs `0 error(s), 0 warning(s)`.

## Module Details

### Interview Submitted (Trigger)

Polls `GET /api/v1/product/docufill/sessions?status=generated` and fires once per newly generated session.

**Input fields**

| Field   | Required | Description                                              |
|---------|----------|----------------------------------------------------------|
| Package | No       | Filter triggers to a specific interview package          |

**Output fields**

`id`, `token`, `package_id`, `package_name`, `status`, `transaction_scope`, `session_url`, `pdf_url`, `created_at`, `updated_at`, `expires_at`, `answers` (collection), `prefill` (collection)

---

### Create Interview Session (Action)

`POST /api/v1/product/docufill/sessions`

**Input fields**

| Field        | Required | Description                                                            |
|--------------|----------|------------------------------------------------------------------------|
| Package      | Yes      | Interview package to use                                               |
| Source       | No       | Label tracking how the session was created (defaults to "make")        |
| Prefill Data | No       | Key-value pairs to pre-populate interview fields                       |

**Output fields**

`id`, `token`, `interview_url`, `package_id`, `package_name`, `status`, `created_at`, `expires_at`, `session_url`

---

### Get Session (Search)

`GET /api/v1/product/docufill/sessions/:sessionId`

Accepts either a numeric session ID or an opaque token (e.g. `df_abc123`).

**Input fields**

| Field              | Required | Description                              |
|--------------------|----------|------------------------------------------|
| Session ID or Token | Yes     | The ID from the trigger or token from the action |

**Output fields**

`id`, `token`, `package_id`, `package_name`, `status`, `transaction_scope`, `custodian_name`, `depository_name`, `session_url`, `pdf_url`, `created_at`, `updated_at`, `expires_at`, `answers` (collection)

## Differences from the Zapier Connector

| Aspect          | Zapier                                | Make.com                                 |
|-----------------|---------------------------------------|------------------------------------------|
| Trigger type    | Polling with `z.cursor` (composite cursor) | Polling with `epoch` (date watermark) + stable `offset` pagination |
| Prefill input   | `dict` (flat key-value input)         | `collection` with key/value item pairs   |
| Source default  | `"zapier"`                            | `"make"`                                 |
| Auth label      | Dynamic via `connectionLabel` fn      | `{{connection.accountName}}` from test   |
| Error handling  | `afterResponse` middleware            | `response.error.filter` in `base.json`   |
