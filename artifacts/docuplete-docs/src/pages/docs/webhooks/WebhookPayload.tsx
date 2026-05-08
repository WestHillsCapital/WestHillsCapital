export default function WebhookPayload() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Webhooks & API</div>
        <h1>Event Payload</h1>
        <p className="text-lg text-white/55 mt-2">The JSON structure sent to your webhook endpoint on every session submission.</p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> Webhooks are available exclusively on the Enterprise plan.
      </div>

      <h2>Payload structure</h2>
      <pre>{`{
  "event":           "interview.submitted",
  "packageId":       42,
  "packageName":     "New Client Intake",
  "sessionToken":    "df_a1b2c3d4e5f6...",
  "submittedAt":     "2026-05-08T14:32:05.123Z",
  "prefill": {
    "firstName": "Jane",
    "email":     "jane@example.com"
  },
  "answers": {
    "firstName":           "Jane",
    "lastName":            "Smith",
    "dateOfBirth":         "1985-07-22",
    "accountType":         "Individual",
    "annualIncome":        "95000",
    "usCitizen":           "yes",
    "investmentObjective": "Growth"
  },
  "generatedPdfUrl": "https://api.docuplete.com/api/v1/sessions/df_a1b2c3.../packet.pdf"
}`}</pre>

      <h2>Top-level fields</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><code>event</code></td><td>string</td><td>Always <code>"interview.submitted"</code> for submission events.</td></tr>
            <tr><td><code>packageId</code></td><td>number</td><td>Numeric ID of the package this session was created from.</td></tr>
            <tr><td><code>packageName</code></td><td>string</td><td>Display name of the package at the time of submission.</td></tr>
            <tr><td><code>sessionToken</code></td><td>string</td><td>The unique session token (<code>df_…</code>). Use this to look up the session via the API.</td></tr>
            <tr><td><code>submittedAt</code></td><td>ISO 8601</td><td>Timestamp when the client submitted the interview.</td></tr>
            <tr><td><code>prefill</code></td><td>object</td><td>The prefill values supplied when the session was created. Key is the field source key.</td></tr>
            <tr><td><code>answers</code></td><td>object</td><td>Key-value map of all submitted field answers. Key is the field source key.</td></tr>
            <tr><td><code>generatedPdfUrl</code></td><td>string | null</td><td>URL to download the completed PDF. Valid for 24 hours. <code>null</code> if PDF generation is still in progress.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Answer value types</h2>
      <p>
        Values in the <code>answers</code> object are always strings, regardless of the field type
        (text, date, number, checkbox, radio, etc.). Parse them as needed in your handler.
      </p>

      <h2>Deduplication</h2>
      <p>
        Due to retries, your server may receive the same event more than once. Use the{" "}
        <code>sessionToken</code> field as a natural idempotency key — check whether you have
        already processed a submission for this token before taking action.
      </p>

      <h2>TypeScript type</h2>
      <p>
        The <a href="/developer/sdk">Node.js SDK</a> exports a fully-typed <code>WebhookPayload</code>{" "}
        interface, and <code>constructWebhookEvent()</code> returns it directly after verifying the
        signature:
      </p>
      <pre>{`import { constructWebhookEvent, type WebhookPayload } from "@docuplete/sdk";

const event: WebhookPayload = await constructWebhookEvent(rawBody, sig, secret);
console.log(event.sessionToken); // typed string
console.log(event.answers);      // typed Record<string, unknown>`}</pre>
    </div>
  );
}
