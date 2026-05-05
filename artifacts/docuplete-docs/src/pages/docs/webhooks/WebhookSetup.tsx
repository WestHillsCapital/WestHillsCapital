import { Link } from "wouter";
import { DocScreenshot } from "@/components/DocScreenshot";

export default function WebhookSetup() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Webhooks & API</div>
        <h1>Webhook Setup</h1>
        <p className="text-lg text-white/55 mt-2">Configure a webhook endpoint to receive real-time notifications when a client submits a session.</p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> Webhooks are available exclusively on the Enterprise plan ($3,000/mo). <Link href="/getting-started/plans">Learn about plans →</Link>
      </div>

      <h2>How webhooks work</h2>
      <p>When a client submits a session (<code>interview.submitted</code> event), Docuplete makes an HTTP POST request to your configured webhook URL. The request body contains the session data — package ID, session ID, client information, and all submitted field values — as a JSON payload.</p>
      <p>Your server receives this in real time and can use it to create CRM records, trigger downstream workflows, update a database, or anything else your integration requires.</p>

      <h2>Configuring a webhook URL</h2>
      <ol>
        <li>Open the package you want to add a webhook to.</li>
        <li>Go to <strong>Configuration → Integrations</strong>.</li>
        <li>Enter your <strong>Webhook URL</strong> — must be <code>https://</code> (TLS required).</li>
        <li>Click <strong>Save</strong>. Docuplete sends a test ping to the URL immediately to verify it's reachable.</li>
        <li>Copy the <strong>Webhook Secret</strong> displayed after saving. Store it securely — you'll use it to verify signature headers.</li>
      </ol>

      <DocScreenshot
        src="/screenshots/webhook-setup.svg"
        alt="The Webhook Setup page showing a URL input field with a Save &amp; test button, a green success banner confirming the test ping succeeded, and the webhook secret field with a Copy button"
        caption="After saving the URL, Docuplete immediately sends a test ping. A green confirmation tells you the endpoint is reachable. Copy the secret — it's shown only once."
      />

      <h2>Webhook secret</h2>
      <p>Each package has its own webhook secret — a randomly generated 32-byte hex string. The secret is used to compute an HMAC-SHA256 signature of the request body. Your server should verify this signature on every webhook delivery to confirm the request came from Docuplete. See <Link href="/webhooks/signature">Signature Verification</Link> for implementation details.</p>

      <h2>Test ping</h2>
      <p>After saving the webhook URL, Docuplete sends a test event (<code>webhook.test</code>) to confirm connectivity. Your server should respond with HTTP 200 to any webhook delivery. If the test ping fails (non-2xx or timeout), the URL is marked as unreachable and you'll see an error in the configuration panel.</p>

      <h2>Organization-level webhook</h2>
      <p>In addition to per-package webhooks, Enterprise accounts can configure a single webhook URL at the organization level in <strong>Settings → API & Webhooks</strong>. This URL receives events from all packages — useful for a centralized integration hub.</p>
    </div>
  );
}
