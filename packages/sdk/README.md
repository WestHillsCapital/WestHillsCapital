# @docuplete/sdk

Official TypeScript/JavaScript SDK for the [Docuplete](https://docuplete.com) API.

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

// 1. Pick an active package
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
console.log("Expires at:", expiresAt ?? "never");

// 3. Poll or use webhooks to detect completion
const session = await client.sessions.get(sessionToken);
if (session.status === "generated") {
  console.log("Answers:", session.answers);
}
```

---

## Authentication

Docuplete uses two API key formats depending on the route:

| Key prefix | Used for |
|------------|----------|
| `dp_live_…` | Headless session creation (`sessions.create`) and webhook delivery logs (`packages.webhookDeliveries`) |
| `sk_live_…` | All other product routes — `sessions.get/list/void/generate`, `packages.list/get`, `account.get` |

Generate your keys in the Docuplete dashboard under **Settings → Developer**.

```ts
const client = new Docuplete({ apiKey: process.env.DOCUPLETE_API_KEY! });
```

Store keys in environment variables — **never** hard-code them or expose them client-side.

### Options

```ts
const client = new Docuplete({
  apiKey:  process.env.DOCUPLETE_API_KEY!,
  baseUrl: "https://your-self-hosted-instance.example.com", // optional
  timeout: 15_000,  // optional — ms, default 30 000
});
```

---

## Try it without an API key

Use the sandbox to explore the interview flow without any credentials:

```ts
const { interviewUrl } = await client.sandbox.start({
  firstName: "Jane",
  email:     "jane@example.com",
});
// Open interviewUrl in a browser — no sign-up required
```

The sandbox endpoint is publicly accessible and requires no authentication.

---

## Resources

### `client.sessions`

#### `sessions.create(params)` — `dp_live_…` key

Creates a new interview session and returns a ready-to-use interview URL.
Prefill values use **field source keys** as keys (found in the field editor).

```ts
const { sessionToken, interviewUrl, expiresAt } = await client.sessions.create({
  packageId: 42,
  prefill: {
    firstName:     "Jane",
    lastName:      "Smith",
    email:         "jane@example.com",
    accountNumber: "ACC-12345",
  },
  linkExpiryDays: 7,    // optional — null for no expiry
  locale:         "en", // optional — defaults to org setting
});
```

#### `sessions.get(token)`

Fetches the current state of a session including answers and status.

```ts
const session = await client.sessions.get("df_abc123");
// session.status:  "draft" | "in_progress" | "generated" | "voided"
// session.answers: Record<string, unknown>  — filled once submitted
```

#### `sessions.list(params?)`

Lists sessions with optional filters, most-recently updated first.

```ts
const { sessions, total } = await client.sessions.list({
  packageId:    42,
  status:       "generated",
  limit:        25,
  offset:       0,
  updatedAfter: "2026-01-01T00:00:00Z", // incremental sync
});
```

#### `sessions.void(token, params?)`

Immediately invalidates the interview link. Only `generated` sessions can be voided. Cannot be undone.

```ts
const result = await client.sessions.void("df_abc123", {
  reason:       "Client withdrew",  // optional — stored in audit log
  notifySigner: true,               // optional — email the signer
});
// result.ok, result.token, result.voidedAt
```

#### `sessions.sendLink(token, params)`

Sends (or re-sends) the interview link email from your org's address.

```ts
await client.sessions.sendLink("df_abc123", {
  recipientEmail: "jane@example.com",
  recipientName:  "Jane Smith",
  customMessage:  "Please complete at your earliest convenience.",
});
```

#### `sessions.updateAnswers(token, answers)`

Saves answers programmatically — use this when filling the form server-side
instead of sending the client to the interview URL.

```ts
const session = await client.sessions.updateAnswers("df_abc123", {
  firstName:  "Jane",
  lastName:   "Smith",
  iraAmount:  "50000",
});
```

#### `sessions.generate(token)`

Triggers final PDF generation and fires integrations (Google Drive, HubSpot, webhooks).

```ts
const result = await client.sessions.generate("df_abc123");

if (result.status === "generated") {
  // Synchronous path (Redis unavailable) — download immediately
  console.log("PDF ready:", result.downloadUrl);
} else {
  // Async path — poll until ready
  const { jobId } = result;
  let done = false;
  while (!done) {
    await new Promise(r => setTimeout(r, 2000));
    const s = await client.sessions.getGenerateStatus("df_abc123", jobId);
    if (s.status === "ready")  { console.log(s.downloadUrl); done = true; }
    if (s.status === "failed") throw new Error(s.error ?? "Generation failed");
  }
}
```

#### `sessions.getGenerateStatus(token, jobId?)`

Polls the status of a background generation job.

```ts
const status = await client.sessions.getGenerateStatus(token, jobId);
// status.status:      "pending" | "processing" | "ready" | "failed"
// status.downloadUrl: string | undefined  — present when "ready"
// status.error:       string | undefined  — present when "failed"
```

---

### `client.packages`

#### `packages.list()`

Returns all packages for your account.

```ts
const packages = await client.packages.list();
const active = packages.filter(p => p.active);
```

#### `packages.get(id)`

Returns a single package by its numeric ID.

```ts
const pkg = await client.packages.get(42);
```

#### `packages.webhookDeliveries(id, params?)` — `dp_live_…` key

Returns the webhook delivery log for a package (most recent first).

```ts
const { deliveries, total } = await client.packages.webhookDeliveries(42, {
  limit:  50,
  offset: 0,
});
```

---

### `client.account`

#### `account.get()`

Returns the account and role associated with the API key.

```ts
const account = await client.account.get();
// { accountId, accountName, slug, email, role }
```

---

### `client.sandbox`

#### `sandbox.start(params?)` — no API key required

Starts a public demo interview session backed by a seeded demo package.
Sandbox tokens are prefixed `df_sbx_` and expire after 7 days.

```ts
const { sessionToken, interviewUrl, prefill, expiresAt } = await client.sandbox.start({
  firstName: "Jane",
  lastName:  "Smith",
  email:     "jane@example.com",
  // dateOfBirth, addressLine1, city, state, zip
});
```

---

## Webhooks

Docuplete sends a signed `interview.submitted` event to your webhook URL when a session completes. **Always verify the signature before processing the payload.**

### Verifying signatures

Use `verifyWebhookSignature` (returns `boolean`) or `constructWebhookEvent` (throws on failure):

```ts
import express from "express";
import { constructWebhookEvent } from "@docuplete/sdk";

app.post(
  "/webhook",
  express.raw({ type: "application/json" }), // must receive raw bytes
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
      console.log("Session token:", event.sessionToken);
      console.log("Answers:", event.answers);
    }

    res.sendStatus(200);
  },
);
```

The signature header contains `sha256=<hex-encoded-hmac>`. Retrieve your webhook secret from **Settings → Webhooks** or via:

```bash
curl -H "Authorization: Bearer dp_live_..." \
     https://api.docuplete.com/api/v1/packages/42/webhook-secret
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

## Programmatic flow (fully server-side)

Use this pattern when you want to fill and generate a packet without the client completing a form:

```ts
const client = new Docuplete({ apiKey: process.env.DOCUPLETE_API_KEY! });

// Create session
const { sessionToken } = await client.sessions.create({ packageId: 42 });

// Fill answers using field source keys
await client.sessions.updateAnswers(sessionToken, {
  firstName:     "Jane",
  lastName:      "Smith",
  accountNumber: "ACC-12345",
  iraAmount:     "50000",
});

// Generate the PDF
const result = await client.sessions.generate(sessionToken);
if (result.status === "generated") {
  console.log("PDF ready:", result.downloadUrl);
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
    // err.code    — machine-readable code (e.g. "api_error", "network_error")
    // err.issues  — validation issue strings, present on 400 responses
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
  SessionListItem,
  SessionStatus,
  Account,
  CreateSessionParams,
  CreateSessionResult,
  GenerateSessionResult,
  GenerateStatusResult,
  SandboxStartParams,
  SandboxStartResult,
  WebhookDelivery,
  WebhookPayload,
  SupportedLocale,
} from "@docuplete/sdk";
```

---

## License

MIT
