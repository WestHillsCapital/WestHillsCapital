export default function Sdk() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Node.js SDK</h1>
        <p className="text-lg text-white/55 mt-2">
          The official TypeScript/Node.js client for the Docuplete API — fully typed, zero external
          dependencies, compatible with Node 18+, Deno, and edge runtimes.
        </p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> API access requires an Enterprise plan.{" "}
        <a href="/getting-started/plans">Learn about plans →</a>
      </div>

      <h2>Installation</h2>
      <pre>{`npm install @docuplete/sdk
# or
pnpm add @docuplete/sdk
# or
yarn add @docuplete/sdk`}</pre>

      <h2>Initialization</h2>
      <p>
        Create a single client instance and reuse it across your application. Pass your API key from
        an environment variable — never hard-code it.
      </p>
      <pre>{`import { Docuplete } from "@docuplete/sdk";

const client = new Docuplete({
  apiKey: process.env.DOCUPLETE_API_KEY!,
});`}</pre>

      <h3>Options</h3>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Option</th><th>Type</th><th>Default</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>apiKey</code></td>
              <td>string</td>
              <td>—</td>
              <td>Required. Your live API key (<code>dp_live_…</code>).</td>
            </tr>
            <tr>
              <td><code>timeout</code></td>
              <td>number</td>
              <td>30000</td>
              <td>Request timeout in milliseconds.</td>
            </tr>
            <tr>
              <td><code>baseUrl</code></td>
              <td>string</td>
              <td><code>https://api.docuplete.com</code></td>
              <td>Override the base URL (useful in tests).</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Sessions</h2>

      <h3>Create a session</h3>
      <p>
        Returns a <code>sessionToken</code> and a ready-to-use <code>interviewUrl</code>. Send or
        redirect your client to the URL — no Docuplete account required on their end.
      </p>
      <pre>{`const { sessionToken, interviewUrl, expiresAt } = await client.sessions.create({
  packageId: 42,
  prefill: {
    firstName: "Jane",
    lastName:  "Smith",
    email:     "jane@example.com",
  },
  linkExpiryDays: 7,
  locale: "en",
});

// Send interviewUrl to your client via email, SMS, or redirect
console.log("Interview link:", interviewUrl);`}</pre>

      <h3>Get a session</h3>
      <p>
        Fetch the current state of a session. Use this to poll for completion or to retrieve
        submitted answers after the client submits.
      </p>
      <pre>{`const session = await client.sessions.get("df_a1b2c3d4...");

console.log(session.status);  // "pending" | "in_progress" | "generated" | "voided" | "expired"
console.log(session.answers); // key→value map of submitted answers (populated after "generated")`}</pre>

      <h3>List sessions</h3>
      <pre>{`const { sessions, total } = await client.sessions.list({
  packageId: 42,          // filter by package
  status:    "generated", // filter by status
  limit:     50,
  offset:    0,
});`}</pre>

      <h3>Send (or resend) the interview link by email</h3>
      <pre>{`const { ok, sentTo } = await client.sessions.sendLink("df_a1b2c3d4...", {
  recipientEmail: "jane@example.com",
  recipientName:  "Jane Smith",
  customMessage:  "Please complete your intake forms at your earliest convenience.",
});`}</pre>

      <h3>Void a session</h3>
      <p>
        Immediately invalidates the interview link. The client sees a closure message if they
        attempt to open it. Voiding cannot be undone.
      </p>
      <pre>{`const { ok, voidedAt } = await client.sessions.void("df_a1b2c3d4...", {
  reason:       "Sent to wrong client",
  notifySigner: true, // sends the client an email notifying them
});`}</pre>

      <h3>Generate a PDF (server-side)</h3>
      <p>
        After filling a session's answers programmatically with <code>updateAnswers</code>, call
        this to trigger PDF generation and fire any enabled integrations (webhooks, Google Drive,
        HubSpot).
      </p>
      <pre>{`// Fill answers programmatically
await client.sessions.updateAnswers("df_a1b2c3d4...", {
  firstName:   "Jane",
  lastName:    "Smith",
  dateOfBirth: "1985-07-22",
});

// Trigger PDF generation
const result = await client.sessions.generate("df_a1b2c3d4...");

if (result.status === "generated") {
  // Synchronous (rare fallback) — ready immediately
  console.log("Download:", result.downloadUrl);
} else {
  // Asynchronous (normal) — poll until ready
  let done = false;
  while (!done) {
    await new Promise(r => setTimeout(r, 2000)); // wait 2 s between polls
    const s = await client.sessions.getGenerateStatus("df_a1b2c3d4...", result.jobId);
    if (s.status === "ready")  { console.log("Download:", s.downloadUrl); done = true; }
    if (s.status === "failed") throw new Error(s.error ?? "Generation failed");
  }
}`}</pre>

      <h2>Packages</h2>

      <h3>List packages</h3>
      <pre>{`const packages = await client.packages.list();

for (const pkg of packages) {
  console.log(pkg.id, pkg.name); // 42, "New Client Intake"
}`}</pre>

      <h3>Get a package</h3>
      <pre>{`const pkg = await client.packages.get(42);`}</pre>

      <h3>Webhook delivery log</h3>
      <p>Retrieve the delivery history for a package's webhook — useful for debugging failed deliveries.</p>
      <pre>{`const { deliveries, total } = await client.packages.webhookDeliveries(42, {
  limit:  50,
  offset: 0,
});

for (const d of deliveries) {
  console.log(d.attempt_number, d.http_status, d.duration_ms);
}`}</pre>

      <h2>Sandbox</h2>
      <p>
        The sandbox endpoint is publicly accessible — no API key required. It creates a live demo
        session against a fixed 8-field sample package.
      </p>
      <pre>{`// No API key needed — pass an empty string or any placeholder
const client = new Docuplete({ apiKey: "" });

const { interviewUrl } = await client.sandbox.start({
  firstName: "Jane",
  lastName:  "Smith",
  email:     "jane@example.com",
});

// Open interviewUrl in a browser to walk through the sandbox interview
console.log("Demo link:", interviewUrl);`}</pre>

      <div className="callout callout-info">
        <strong>Sandbox sessions</strong> are prefixed <code>df_sbx_</code>, expire after 7 days,
        and do not trigger webhooks or count against your submission quota. See the{" "}
        <a href="/developer/sandbox">Sandbox Demo page</a> for full details.
      </div>

      <h2>Webhook verification</h2>
      <p>
        The SDK ships with built-in helpers for verifying the <code>X-Docuplete-Signature</code>{" "}
        header and parsing the payload. They use the Web Crypto API and work in Node.js, Deno, and
        Cloudflare Workers without any additional dependencies.
      </p>

      <h3>Verify and parse in one step</h3>
      <pre>{`import express from "express";
import { constructWebhookEvent } from "@docuplete/sdk";

app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["x-docuplete-signature"] as string;

  let event;
  try {
    // Throws if the signature is invalid
    event = await constructWebhookEvent(
      req.body.toString(),               // raw body — do NOT parse as JSON first
      sig,
      process.env.DOCUPLETE_WEBHOOK_SECRET!,
    );
  } catch {
    return res.status(401).send("Invalid signature");
  }

  if (event.event === "interview.submitted") {
    console.log("Session token:", event.sessionToken);
    console.log("Package ID:",    event.packageId);
    console.log("Answers:",       event.answers);
    console.log("PDF URL:",       event.generatedPdfUrl);
  }

  res.sendStatus(200);
});`}</pre>

      <h3>Verify only</h3>
      <pre>{`import { verifyWebhookSignature } from "@docuplete/sdk";

const valid = await verifyWebhookSignature(
  req.body.toString(),                    // raw body string
  req.headers["x-docuplete-signature"],   // X-Docuplete-Signature header value
  process.env.DOCUPLETE_WEBHOOK_SECRET!,  // your package's signing secret
);

if (!valid) return res.status(401).send("Invalid signature");`}</pre>

      <h2>Error handling</h2>
      <p>
        All SDK methods throw a <code>DocupleteError</code> on API or network errors. Catch it to
        access structured error details.
      </p>
      <pre>{`import { Docuplete, DocupleteError } from "@docuplete/sdk";

try {
  const session = await client.sessions.get("df_invalid");
} catch (err) {
  if (err instanceof DocupleteError) {
    console.error(err.message); // Human-readable description
    console.error(err.status);  // HTTP status code — 0 for network errors
    console.error(err.code);    // Machine-readable code, e.g. "not_found"
    console.error(err.issues);  // Validation errors array (only on 400 responses)
  }
}`}</pre>

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Property</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><code>message</code></td><td>string</td><td>Human-readable error description.</td></tr>
            <tr><td><code>status</code></td><td>number</td><td>HTTP status code. <code>0</code> for network/timeout errors.</td></tr>
            <tr><td><code>code</code></td><td>string</td><td>Machine-readable error code (e.g. <code>"not_found"</code>, <code>"unauthorized"</code>).</td></tr>
            <tr><td><code>issues</code></td><td>string[] | undefined</td><td>Field-level validation errors returned on <code>400</code> responses.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>TypeScript types</h2>
      <p>All types are exported from the package root:</p>
      <pre>{`import type {
  Session,              // Full session object returned by sessions.get()
  SessionListItem,      // Abbreviated session returned in sessions.list()
  SessionStatus,        // "pending" | "in_progress" | "generated" | "voided" | "expired"
  Package,              // Package object
  CreateSessionParams,  // Input type for sessions.create()
  CreateSessionResult,  // Return type of sessions.create()
  GenerateSessionResult,// Discriminated union: { status: "pending", jobId } | { status: "generated", downloadUrl }
  GenerateStatusResult, // Return type of sessions.getGenerateStatus()
  SandboxStartParams,   // Input type for sandbox.start()
  SandboxStartResult,   // Return type of sandbox.start()
  WebhookPayload,       // Typed webhook event body
} from "@docuplete/sdk";`}</pre>
    </div>
  );
}
