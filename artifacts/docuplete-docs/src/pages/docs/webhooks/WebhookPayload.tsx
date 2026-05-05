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
  "event": "interview.submitted",
  "event_id": "evt_01J2K3L4M5N6P7Q8R9S0T1",
  "timestamp": "2024-03-15T14:32:07.841Z",
  "package_id": "pkg_abc123",
  "package_name": "New Client Intake",
  "session_id": "ses_xyz789",
  "client_name": "Jane Doe",
  "client_email": "jane.doe@example.com",
  "submitted_at": "2024-03-15T14:32:05.123Z",
  "generated_pdf_url": "https://api.docuplete.com/sessions/ses_xyz789/pdf",
  "fields": {
    "first_name": "Jane",
    "last_name": "Doe",
    "date_of_birth": "1985-07-22",
    "account_type": "Individual",
    "annual_income": 95000,
    "us_citizen": true,
    "investment_objective": "Growth"
  },
  "esign": {
    "verified": true,
    "verified_email": "jane.doe@example.com",
    "verified_at": "2024-03-15T14:30:55.000Z",
    "signer_ip": "203.0.113.42"
  }
}`}</pre>

      <h2>Top-level fields</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><code>event</code></td><td>string</td><td>Always <code>interview.submitted</code> for submission events</td></tr>
            <tr><td><code>event_id</code></td><td>string</td><td>Unique ID for this delivery. Use for deduplication.</td></tr>
            <tr><td><code>timestamp</code></td><td>ISO 8601</td><td>When the event was generated</td></tr>
            <tr><td><code>package_id</code></td><td>string</td><td>The package this session was created from</td></tr>
            <tr><td><code>session_id</code></td><td>string</td><td>The unique session ID</td></tr>
            <tr><td><code>client_name</code></td><td>string | null</td><td>Client name set at session creation</td></tr>
            <tr><td><code>client_email</code></td><td>string | null</td><td>Client email set at session creation</td></tr>
            <tr><td><code>submitted_at</code></td><td>ISO 8601</td><td>When the client submitted</td></tr>
            <tr><td><code>generated_pdf_url</code></td><td>string</td><td>Authenticated URL to download the completed PDF (valid 24 hours)</td></tr>
            <tr><td><code>fields</code></td><td>object</td><td>Key-value map of all submitted field answers</td></tr>
            <tr><td><code>esign</code></td><td>object | null</td><td>E-sign verification data (null if package doesn't require e-sign)</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Field value types in payload</h2>
      <p>Field values in the <code>fields</code> object are typed according to the field definition:</p>
      <ul>
        <li>Text → <code>string</code></li>
        <li>Number → <code>number</code></li>
        <li>Date → <code>string</code> (ISO 8601: <code>YYYY-MM-DD</code>)</li>
        <li>Checkbox → <code>boolean</code></li>
        <li>Radio / Select → <code>string</code> (the selected option value)</li>
        <li>Multi-select → <code>string[]</code></li>
        <li>Signature / Initials → <code>string</code> (URL to the signature image)</li>
      </ul>

      <h2>Deduplication</h2>
      <p>Use the <code>event_id</code> field to deduplicate webhook deliveries. If your server is unavailable, Docuplete retries the delivery — the same event may be delivered more than once with the same <code>event_id</code>. Store processed event IDs and skip duplicates.</p>
    </div>
  );
}
