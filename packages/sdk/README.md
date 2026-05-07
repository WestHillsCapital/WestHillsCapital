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
const pkg = packages.find(p => p.active)!;

// 2. Create a session — returns a ready-to-use interview URL
const { sessionToken, interviewUrl, expiresAt } = await client.sessions.create({
  packageId: pkg.id,
  prefill: {
    firstName: "Jane",
    lastName:  "Smith",
    email:     "jane@example.com",
  },
  linkExpiryDays: 7,
});

// Send the client to their interview
console.log("Interview URL:", interviewUrl);
console.log("Expires at:", expiresAt);

// 3. Poll or use webhooks to detect completion
const session = await client.sessions.get(sessionToken);
if (session.status === "generated") {
  console.log("Answers:", session.answers);
}
```

---

## Authentication

Generate an API key in the Docuplete dashboard under **Settings → Developer**, then
pass it to the constructor:

```ts
const client = new Docuplete({ apiKey: "dp_live_..." });
```

API keys are prefixed with `dp_live_`. Store them in environment variables — never
hard-code them in source files or client-side JavaScript.

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

Returns all active packages for your account.

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

Creates a new interview session via the headless API. Returns a `sessionToken` and
a ready-to-use `interviewUrl`. Prefill values use **field source keys** as keys.

```ts
const { sessionToken, interviewUrl, expiresAt } = await client.sessions.create({
  packageId: 42,                     // required
  prefill: {                         // optional — source key → value
    firstName:     "Jane",
    lastName:      "Smith",
    email:         "jane@example.com",
    accountNumber: "ACC-12345",
  },
  linkExpiryDays: 7,                 // optional — null for no expiry
  locale:         "en",             // optional — defaults to org setting
});
```

#### `sessions.get(sessionToken)`

Fetches the current state of a session by its token.

```ts
const session = await client.sessions.get("df_abc123");
// session.status:  "draft" | "in_progress" | "generated"
// session.answers: Record<string, unknown>  — filled once submitted
```

#### `sessions.list(params?)`

Lists sessions with optional filters.

```ts
const { sessions, total } = await client.sessions.list({
  packageId: 42,           // optional
  status:    "generated",  // optional: "draft" | "in_progress" | "generated"
  limit:     25,           // optional (default 50)
  offset:    0,            // optional (pagination)
});
```

#### `sessions.void(sessionToken)`

Immediately invalidates the interview link. Cannot be undone.

```ts
await client.sessions.void("df_abc123");
```

#### `sessions.sendLink(sessionToken, params)`

Sends (or re-sends) the interview link email from your org's address.

```ts
await client.sessions.sendLink("df_abc123", {
  recipientEmail: "jane@example.com",           // required
  recipientName:  "Jane Smith",                 // optional
  customMessage:  "Please complete at your earliest convenience.", // optional
});
```

#### `sessions.updateAnswers(sessionToken, answers)`

Saves interview answers programmatically — use this when filling the form on behalf
of the client instead of sending them the interview URL.

```ts
const session = await client.sessions.updateAnswers("df_abc123", {
  firstName:  "Jane",
  lastName:   "Smith",
  iraAmount:  "50000",
});
```

#### `sessions.generate(sessionToken)`

Triggers final PDF generation and fires integrations (Google Drive, HubSpot, webhooks).
Call this after `updateAnswers` when submitting programmatically.

```ts
const result = await client.sessions.generate("df_abc123");
// result.downloadUrl — URL to download the PDF packet
// result.drive       — { fileId, url } if Google Drive is enabled, else null
// result.warnings    — non-fatal integration warnings
```

---

### `client.account`

#### `account.get()`

Returns the account associated with the API key.

```ts
const account = await client.account.get();
// { accountId, accountName, slug, email, role }
```

---

## Webhooks

Docuplete sends a signed `interview.submitted` event to your webhook URL when a
session is completed. **Always verify the signature before processing.**

### Verifying signatures

Use `verifyWebhookSignature` (returns a boolean) or `constructWebhookEvent`
(throws on invalid signature):

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

Find the signing secret for a package in **Settings → Webhooks**, or via the API:

```bash
curl -H "Authorization: Bearer dp_live_..." \
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

All methods throw `DocupleteError` on non-2xx responses.

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
  CreateSessionResult,
  GenerateSessionResult,
  WebhookPayload,
  SupportedLocale,
} from "@docuplete/sdk";
```

---

## Programmatic flow (server-side only, no interview URL)

Use this pattern when you want to fill and generate a packet entirely server-side
without the client completing a form:

```ts
const client = new Docuplete({ apiKey: process.env.DOCUPLETE_API_KEY! });

// Create session
const { sessionToken } = await client.sessions.create({ packageId: 42 });

// Fill answers programmatically
await client.sessions.updateAnswers(sessionToken, {
  firstName:     "Jane",
  lastName:      "Smith",
  accountNumber: "ACC-12345",
  iraAmount:     "50000",
});

// Generate the PDF and fire integrations
const { downloadUrl, warnings } = await client.sessions.generate(sessionToken);
console.log("PDF ready at:", downloadUrl);
if (warnings.length) console.warn("Warnings:", warnings);
```

---

## License

MIT
