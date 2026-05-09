export default function QuickstartGuide() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Developer Quickstart Guide</h1>
        <p className="text-lg text-white/55 mt-2">
          A complete end-to-end walkthrough — from installing the SDK to receiving your first
          webhook — in a single guide.
        </p>
      </div>

      <div className="callout callout-info">
        <strong>No API key yet?</strong> Try the{" "}
        <a href="/developer/sandbox">Public Sandbox Demo</a> first — it creates a live session
        with no account or API key required.
      </div>

      <h2>What you'll build</h2>
      <p>
        By the end of this guide you will have a working Node.js server that:
      </p>
      <ol>
        <li>Creates a Docuplete interview session when a client record arrives in your system</li>
        <li>Sends the client a unique interview link</li>
        <li>Receives a webhook when the client submits the interview</li>
        <li>Verifies the webhook signature and logs the submitted answers</li>
        <li>Generates the filled PDF and retrieves the download URL</li>
      </ol>
      <p>Estimated time: <strong>15 minutes</strong>.</p>

      <h2>Prerequisites</h2>
      <ul>
        <li>Node.js 18 or newer</li>
        <li>A Docuplete <strong>Enterprise account</strong> with an active package — see <a href="/getting-started/quick-start">Quick Start</a> to build one</li>
        <li>A live <strong>API key</strong> (<code>dp_live_…</code>) — see <a href="/developer/authentication">Authentication</a></li>
        <li>A publicly reachable URL for webhooks (use <a href="https://ngrok.com" target="_blank" rel="noopener noreferrer">ngrok</a> during local development)</li>
      </ul>

      <h2>Step 1 — Install the SDK</h2>
      <pre>{`npm install @docuplete/sdk express
# or
pnpm add @docuplete/sdk express`}</pre>

      <h2>Step 2 — Configure environment variables</h2>
      <p>Store credentials in a <code>.env</code> file. Never commit this file.</p>
      <pre>{`# .env
DOCUPLETE_API_KEY=dp_live_your_key_here
DOCUPLETE_WEBHOOK_SECRET=wh_your_webhook_secret_here
DOCUPLETE_PACKAGE_ID=42`}</pre>

      <pre>{`# Load in your entry point
import "dotenv/config";`}</pre>

      <h2>Step 3 — Initialize the client</h2>
      <p>Create a single client instance and reuse it across the application.</p>
      <pre>{`// src/docuplete.ts
import { Docuplete } from "@docuplete/sdk";

export const docuplete = new Docuplete({
  apiKey: process.env.DOCUPLETE_API_KEY!,
});`}</pre>

      <h2>Step 4 — Create a session</h2>
      <p>
        When a new client is ready to fill out documents, call{" "}
        <code>sessions.create()</code>. Pass any fields you already know as{" "}
        <code>prefill</code> — the client will see them pre-populated and can confirm or correct
        them.
      </p>
      <pre>{`import { docuplete } from "./docuplete";

interface Client {
  firstName: string;
  lastName:  string;
  email:     string;
}

async function sendIntakeForm(client: Client): Promise<string> {
  const { sessionToken, interviewUrl, expiresAt } = await docuplete.sessions.create({
    packageId:      Number(process.env.DOCUPLETE_PACKAGE_ID),
    prefill: {
      firstName: client.firstName,
      lastName:  client.lastName,
      email:     client.email,
    },
    linkExpiryDays: 14,
    reminders: {
      enabled:     true,
      intervalDays: 3,   // remind every 3 days if not yet submitted
    },
  });

  console.log(\`Session created: \${sessionToken}\`);
  console.log(\`Interview link:  \${interviewUrl}\`);
  console.log(\`Expires:         \${expiresAt ?? "never"}\`);

  // Store sessionToken in your database for later lookup
  // await db.sessions.insert({ token: sessionToken, clientId: client.id });

  return interviewUrl;
}

// Usage
const link = await sendIntakeForm({
  firstName: "Jane",
  lastName:  "Smith",
  email:     "jane@example.com",
});

// Send link via your email provider, CRM, or SMS service
console.log("Sending to client:", link);`}</pre>

      <h2>Step 5 — Configure a webhook</h2>
      <p>
        In the Docuplete dashboard, open your package and go to <strong>Configuration →
        Webhooks</strong>. Enter your server's URL (e.g.{" "}
        <code>https://your-server.com/webhook/docuplete</code>) and click <strong>Save</strong>.
        Copy the <strong>Signing Secret</strong> (<code>wh_…</code>) into your{" "}
        <code>DOCUPLETE_WEBHOOK_SECRET</code> environment variable.
      </p>
      <div className="callout callout-tip">
        <strong>Local development:</strong> Run <code>ngrok http 3000</code> to get a public
        HTTPS URL for your local server. Paste the ngrok URL as the webhook endpoint.
      </div>

      <h2>Step 6 — Handle the webhook</h2>
      <p>
        Set up an Express route that reads the <strong>raw body</strong> (before JSON parsing),
        verifies the signature, and processes the event. Use{" "}
        <code>express.raw()</code> on this route — not <code>express.json()</code>.
      </p>
      <pre>{`// src/server.ts
import express from "express";
import { constructWebhookEvent } from "@docuplete/sdk";
import type { WebhookPayload } from "@docuplete/sdk";

const app = express();

// IMPORTANT: use raw body for this route — must come before express.json()
app.post(
  "/webhook/docuplete",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["x-docuplete-signature"] as string | undefined;

    let event: WebhookPayload;
    try {
      event = await constructWebhookEvent(
        req.body.toString(),
        sig,
        process.env.DOCUPLETE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(401).send("Invalid signature");
    }

    // Always respond 200 quickly — process asynchronously
    res.sendStatus(200);

    // Handle events
    switch (event.event) {
      case "interview.submitted":
        await handleSubmission(event.sessionToken, event.answers);
        break;
      case "pdf.generated":
        await handlePdfReady(event.sessionToken, event.downloadUrl);
        break;
      case "signer.completed":
        console.log(\`Signer \${event.signerEmail} completed step \${event.signerOrder}\`);
        break;
    }
  },
);

app.use(express.json()); // JSON parsing for all other routes

app.listen(3000, () => console.log("Server running on port 3000"));`}</pre>

      <h2>Step 7 — Process the submission</h2>
      <p>
        When the <code>interview.submitted</code> event arrives, the answers are available
        immediately. The PDF may take a few seconds to generate — wait for <code>pdf.generated</code>{" "}
        or poll <code>getGenerateStatus()</code>.
      </p>
      <pre>{`async function handleSubmission(
  sessionToken: string,
  answers: Record<string, string>,
): Promise<void> {
  console.log("Interview submitted for session:", sessionToken);
  console.log("Answers received:");
  for (const [key, value] of Object.entries(answers)) {
    console.log(\`  \${key}: \${value}\`);
  }

  // Save to your database
  // await db.submissions.insert({ token: sessionToken, answers });
}

async function handlePdfReady(
  sessionToken: string,
  downloadUrl:  string,
): Promise<void> {
  console.log(\`PDF ready for \${sessionToken}\`);
  console.log(\`Download: \${downloadUrl}\`);

  // Forward to Google Drive, email the advisor, update your CRM, etc.
}`}</pre>

      <h2>Step 8 — Retrieve session status (optional polling)</h2>
      <p>
        If you need session state without waiting for a webhook (e.g. for a dashboard display),
        poll <code>sessions.get()</code>:
      </p>
      <pre>{`import { docuplete } from "./docuplete";

const session = await docuplete.sessions.get("df_a1b2c3d4...");

console.log(session.status);   // "pending" | "in_progress" | "submitted" | "generated" | "voided"
console.log(session.answers);  // populated after status is "generated"
console.log(session.pdfUrl);   // download URL — populated after PDF generation`}</pre>

      <h2>Complete server example</h2>
      <p>Here's the full working server in one file:</p>
      <pre>{`import "dotenv/config";
import express from "express";
import { Docuplete, constructWebhookEvent } from "@docuplete/sdk";
import type { WebhookPayload } from "@docuplete/sdk";

const client = new Docuplete({ apiKey: process.env.DOCUPLETE_API_KEY! });
const app    = express();

// ─── Create session endpoint ──────────────────────────────────────────────────
app.use(express.json());

app.post("/intake", async (req, res) => {
  const { firstName, lastName, email } = req.body as Record<string, string>;

  try {
    const { sessionToken, interviewUrl } = await client.sessions.create({
      packageId: Number(process.env.DOCUPLETE_PACKAGE_ID),
      prefill: { firstName, lastName, email },
      linkExpiryDays: 14,
      reminders: { enabled: true, intervalDays: 3 },
    });

    // Store sessionToken in your DB here
    res.json({ sessionToken, interviewUrl });
  } catch (err) {
    console.error("Failed to create session:", err);
    res.status(500).json({ error: "Session creation failed" });
  }
});

// ─── Webhook handler ──────────────────────────────────────────────────────────
// IMPORTANT: raw body — must be registered BEFORE app.use(express.json())
app.post(
  "/webhook/docuplete",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event: WebhookPayload;
    try {
      event = await constructWebhookEvent(
        req.body.toString(),
        req.headers["x-docuplete-signature"] as string,
        process.env.DOCUPLETE_WEBHOOK_SECRET!,
      );
    } catch {
      return res.status(401).send("Invalid signature");
    }

    res.sendStatus(200); // always respond before processing

    if (event.event === "interview.submitted") {
      console.log("Submitted answers:", event.answers);
    }
    if (event.event === "pdf.generated") {
      console.log("PDF download URL:", event.downloadUrl);
    }
  },
);

app.listen(3000, () => console.log("Listening on http://localhost:3000"));`}</pre>

      <h2>Testing your integration</h2>
      <ol>
        <li>Start your server: <code>npx ts-node src/server.ts</code></li>
        <li>
          POST to <code>/intake</code> with a JSON body to create a session and get an interview
          link.
        </li>
        <li>Open the interview link in a browser and submit the form.</li>
        <li>
          Watch your terminal — you should see the <code>interview.submitted</code> webhook arrive
          within seconds.
        </li>
        <li>
          A few seconds later, <code>pdf.generated</code> arrives with the download URL.
        </li>
      </ol>

      <div className="callout callout-tip">
        <strong>Replay a webhook delivery:</strong> In the Docuplete dashboard, go to{" "}
        <strong>Packages → [your package] → Configuration → Webhooks → Delivery Logs</strong> and
        click <strong>Retry</strong> on any past delivery to replay it to your endpoint.
      </div>

      <h2>Common errors and fixes</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Error</th><th>Cause</th><th>Fix</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>401 Unauthorized</code></td>
              <td>Missing or invalid API key</td>
              <td>Check that <code>DOCUPLETE_API_KEY</code> is set and starts with <code>dp_live_</code>.</td>
            </tr>
            <tr>
              <td><code>404 package_not_found</code></td>
              <td>Package ID is wrong or package is archived</td>
              <td>Verify the package ID from the dashboard URL or <code>packages.list()</code>.</td>
            </tr>
            <tr>
              <td>Webhook signature invalid</td>
              <td>Parsed JSON body before verification, or wrong secret</td>
              <td>Use <code>express.raw()</code> on the webhook route. Confirm <code>DOCUPLETE_WEBHOOK_SECRET</code> matches the dashboard value.</td>
            </tr>
            <tr>
              <td>Webhook not arriving</td>
              <td>Endpoint not publicly reachable</td>
              <td>Use ngrok or a similar tunnel during local development. Check Delivery Logs in the dashboard for error details.</td>
            </tr>
            <tr>
              <td><code>DocupleteError</code> thrown</td>
              <td>API returned an error response</td>
              <td>Catch and inspect <code>err.status</code>, <code>err.code</code>, and <code>err.issues</code> for a machine-readable description.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>What to explore next</h2>
      <ul>
        <li>
          <a href="/developer/bulk-sessions">Bulk Session Creation</a> — create up to 100 sessions
          in one API call for mass intake or onboarding campaigns.
        </li>
        <li>
          <a href="/developer/signers">Multi-Party Signers</a> — chain sequential signers so
          documents require sign-off from multiple parties.
        </li>
        <li>
          <a href="/developer/audit-log">Session Audit Log</a> — retrieve the immutable audit
          trail of every action on a session for compliance purposes.
        </li>
        <li>
          <a href="/enterprise/scim">SCIM Provisioning</a> — automate user lifecycle from your
          Identity Provider.
        </li>
        <li>
          <a href="/enterprise/custom-domains">Custom Domains</a> — serve interview links from
          your own subdomain.
        </li>
      </ul>
    </div>
  );
}
