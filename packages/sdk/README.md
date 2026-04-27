# @docuplete/sdk

Official Node.js / TypeScript SDK for the [Docuplete](https://docuplete.com) API.

## Installation

```bash
npm install @docuplete/sdk
# or
pnpm add @docuplete/sdk
```

**Requires Node.js 18 or later** (uses native `fetch`).

## Quick start

```ts
import { Docuplete } from "@docuplete/sdk";

const client = new Docuplete({ apiKey: "sk_live_your_key_here" });

// 1. Pick a package
const packages = await client.packages.list();
const pkg = packages[0];

// 2. Create an interview session
const { session, token, interviewUrl } = await client.sessions.create({
  packageId: pkg.id,
  prefill: {
    client_name: "Jane Smith",
    account_number: "ACC-12345",
  },
});

console.log("Send the customer to:", interviewUrl);
console.log("Session token:", token);

// 3. Poll for completion
async function waitForCompletion(token: string, intervalMs = 5000): Promise<void> {
  while (true) {
    const s = await client.sessions.get(token);
    if (s.status === "generated") {
      console.log("Done! Answers:", s.answers);
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

await waitForCompletion(token);
```

## Authentication

Create an API key in the Docuplete dashboard under **Settings → API Keys**, then pass it to the constructor:

```ts
const client = new Docuplete({ apiKey: "sk_live_..." });
```

API keys are long-lived and prefixed with `sk_live_`. Store them in environment variables — never hard-code them.

## Custom base URL

```ts
const client = new Docuplete({
  apiKey: process.env.DOCUPLETE_API_KEY!,
  baseUrl: "https://your-self-hosted-instance.example.com",
});
```

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
// Package
```

---

### `client.sessions`

#### `sessions.create(params)`

Creates a new interview session. Returns the session object, a bearer token, and a ready-to-use `interviewUrl` you can send to recipients.

```ts
const { session, token, interviewUrl } = await client.sessions.create({
  packageId: 42,             // required
  prefill: {                 // optional: pre-populate interview fields
    client_name: "Jane Smith",
  },
  recipientEmail: "jane@example.com", // optional
  transactionScope: "IRA rollover",   // optional
  source: "crm-integration",          // optional label
});
```

#### `sessions.get(token)`

Fetches the current state of a session by its token. Use this to poll for completion.

```ts
const session = await client.sessions.get("df_abc123");
// session.status: "draft" | "in_progress" | "generated"
```

#### `sessions.list(params?)`

Lists sessions for your account, with optional filters.

```ts
const sessions = await client.sessions.list({
  packageId: 42,           // optional: filter by package
  status: "generated",     // optional: "draft" | "in_progress" | "generated"
  limit: 25,               // optional: default 50
  offset: 0,               // optional: for pagination
});
```

---

### `client.account`

#### `account.get()`

Returns the account and user associated with the API key.

```ts
const account = await client.account.get();
// { account_id, account_name, slug, email, role }
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
    // err.status — HTTP status code (e.g. 404, 401, 400)
    // err.message — human-readable message from the API
  }
}
```

## TypeScript

The SDK ships with full type declarations. All types are re-exported from the main entry point:

```ts
import type { Package, Session, SessionStatus, Account, CreateSessionParams } from "@docuplete/sdk";
```

## License

MIT
