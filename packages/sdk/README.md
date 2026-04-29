# @docuplete/sdk

Official Node.js / TypeScript SDK for the [Docuplete](https://docuplete.com) API.

## Installation

```bash
npm install @docuplete/sdk
# or
pnpm add @docuplete/sdk
```

**Requires Node.js 18 or later** (uses native `fetch` and `crypto`).

---

## Quick start

```ts
import { Docuplete } from "@docuplete/sdk";

const client = new Docuplete({ apiKey: process.env.DOCUPLETE_API_KEY! });

// 1. Pick a package
const packages = await client.packages.list();
const pkg = packages[0];

// 2. Create an interview session and send the link to your client
const { token, interviewUrl } = await client.sessions.create({
  packageId: pkg.id,
  prefill: { firstName: "Jane", lastName: "Smith" },
});

// Option A — send them to the hosted interview URL
console.log("Send client to:", interviewUrl);

// Option B — send the link via your own email system
await client.sessions.sendLink(token, {
  recipientEmail: "jane@example.com",
  recipientName:  "Jane Smith",
});

// 3. Wait for submission (poll or use webhooks)
const session = await client.sessions.get(token);
if (session.status === "generated") {
  console.log("Answers:", session.answers);
}
```

---

## Authentication

Create an API key in the Docuplete dashboard under **Settings → API Keys**, then pass it to the constructor:

```ts
const client = new Docuplete({ apiKey: "sk_live_..." });
```

API keys are prefixed with `sk_live_`. Store them in environment variables — never hard-code them.

### Custom base URL

```ts
const client = new Docuplete({
  apiKey:  process.env.DOCUPLETE_API_KEY!,
  baseUrl: "https://your-self-hosted-instance.example.com",
});
```

---

## Resources

### `client.packages`

#### `packages.list()`

Returns all packages configured for your account.

```ts
const packages = await client.packages.list();
// Package[]
```

#### `packages.get(id)`

Returns a single package by its numeric ID.

```ts
const pkg = await client.packages.get(42);
```

---

### `client.sessions`

#### `sessions.create(params)`

Creates a new interview session. Returns the session, a bearer token, and a ready-to-use `interviewUrl`.

```ts
const { session, token, interviewUrl } = await client.sessions.create({
  packageId:        42,                        // required
  prefill: {                                   // optional: pre-populate fields
    firstName:      "Jane",
    lastName:       "Smith",
    accountNumber:  "ACC-12345",
  },
  recipientEmail:   "jane@example.com",        // optional
  transactionScope: "IRA rollover",            // optional
  source:           "crm-integration",         // optional label for your records
});
```

#### `sessions.get(token)`

Fetches the current state of a session by its token.

```ts
const session = await client.sessions.get("df_abc123");
// session.status: "draft" | "in_progress" | "generated"
// session.answers: Record<string, unknown>   (filled once submitted)
```

#### `sessions.list(params?)`

Lists sessions with optional filters.

```ts
const { sessions, total } = await client.sessions.list({
  packageId: 42,            // optional
  status:    "generated",   // optional: "draft" | "in_progress" | "generated"
  limit:     25,            // optional (default 50)
  offset:    0,             // optional (for pagination)
});
```

#### `sessions.sendLink(token, params)`

Sends (or re-sends) the interview link email to a recipient from your organisation's address.

```ts
await client.sessions.sendLink(token, {
  recipientEmail: "jane@example.com",           // required
  recipientName:  "Jane Smith",                 // optional
  customMessage:  "Please complete at your earliest convenience.", // optional
});
```

#### `sessions.updateAnswers(token, answers)`

Saves interview answers programmatically — useful when you are filling the form on behalf of the client rather than sending them the URL.

```ts
const session = await client.sessions.updateAnswers(token, {
  first_name:     "Jane",
  last_name:      "Smith",
  ira_amount:     "50000",
});
```

#### `sessions.generate(token)`

Triggers final PDF packet generation and fires any enabled integrations (Google Drive, HubSpot, webhooks). Call this after `updateAnswers` if you are filling the session programmatically.

```ts
const result = await client.sessions.generate(token);
// result.downloadUrl   — URL to download the PDF
// result.drive         — { fileId, url } if Google Drive is enabled, else null
// result.warnings      — any non-fatal integration warnings
```

---

### `client.account`

#### `account.get()`

Returns the account and user associated with the API key.

```ts
const account = await client.account.get();
// { accountId, accountName, slug, email, role }
```

---

## Webhooks

Docuplete sends a signed `interview.submitted` event to your webhook URL whenever a session is completed. Always verify the signature before processing.

### Verifying signatures

Use `verifyWebhookSignature` (returns a boolean) or `constructWebhookEvent` (throws on failure).

```ts
import express from "express";
import { constructWebhookEvent } from "@docuplete/sdk";

app.post(
  "/webhook",
  express.raw({ type: "application/json" }), // must be raw bytes, not parsed JSON
  async (req, res) => {
    const sig    = req.headers["x-docuplete-signature"] as string;
    const secret = process.env.DOCUPLETE_WEBHOOK_SECRET!;

    let event;
    try {
      event = await constructWebhookEvent(req.body.toString(), sig, secret);
    } catch {
      return res.status(401).send("Invalid signature");
    }

    if (event.event === "interview.submitted") {
      console.log("Submitted by token:", event.sessionToken);
      console.log("Answers:", event.answers);
    }

    res.sendStatus(200);
  },
);
```

### Getting your webhook secret

Retrieve the signing secret for a package from the Docuplete dashboard under **DocuFill → [Package] → Webhook**, or via the API:

```bash
curl -H "Authorization: Bearer sk_live_..." \
     https://app.docuplete.com/api/v1/packages/42/webhook-secret
```

### `WebhookPayload` shape

```ts
interface WebhookPayload {
  event:           "interview.submitted";
  packageId:       number;
  packageName:     string;
  sessionToken:    string;
  submittedAt:     string;            // ISO 8601
  prefill:         Record<string, unknown>;
  answers:         Record<string, unknown>;
  generatedPdfUrl: string | null;
}
```

---

## Error handling

All methods throw a `DocupleteError` on non-2xx responses.

```ts
import { Docuplete, DocupleteError } from "@docuplete/sdk";

try {
  const pkg = await client.packages.get(999);
} catch (err) {
  if (err instanceof DocupleteError) {
    console.error(`API error ${err.status}: ${err.message}`);
    // err.status  — HTTP status code (404, 401, 400, …)
    // err.message — human-readable message from the API
  }
}
```

---

## TypeScript

All types are exported from the main entry point:

```ts
import type {
  Package,
  Session,
  SessionStatus,
  Account,
  CreateSessionParams,
  GenerateSessionResult,
  WebhookPayload,
} from "@docuplete/sdk";
```

---

## Programmatic session flow (no interview URL)

Use this pattern when you want to fill and generate a packet entirely server-side without the client completing a form:

```ts
const client = new Docuplete({ apiKey: process.env.DOCUPLETE_API_KEY! });

// Create session
const { token } = await client.sessions.create({ packageId: 42 });

// Fill answers
await client.sessions.updateAnswers(token, {
  client_name:    "Jane Smith",
  account_number: "ACC-12345",
  ira_amount:     "50000",
});

// Generate the PDF
const { downloadUrl, warnings } = await client.sessions.generate(token);
console.log("PDF ready at:", downloadUrl);
if (warnings.length) console.warn("Warnings:", warnings);
```

---

## License

MIT
