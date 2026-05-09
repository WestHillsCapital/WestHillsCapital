export default function BulkSessions() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Bulk Session Creation</h1>
        <p className="text-lg text-white/55 mt-2">
          Create up to 100 interview sessions in a single API call — ideal for mass intake campaigns,
          batch onboarding, or migrating records from a CSV.
        </p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> Bulk session creation requires an Enterprise plan.{" "}
        <a href="/getting-started/plans">Learn about plans →</a>
      </div>

      <h2>Overview</h2>
      <p>
        <code>sessions.bulkCreate</code> sends a single <code>POST /v1/sessions/bulk</code> request
        containing an array of session definitions. The API processes each item independently — a
        failure on one item does not block the others. The response is always HTTP{" "}
        <code>207 Multi-Status</code>, with a per-item result for every session you submitted.
      </p>

      <h2>Basic example</h2>
      <pre>{`import { Docuplete } from "@docuplete/sdk";

const client = new Docuplete({ apiKey: process.env.DOCUPLETE_API_KEY! });

const result = await client.sessions.bulkCreate({
  sessions: [
    { packageId: 42, prefill: { firstName: "Jane",  lastName: "Smith", email: "jane@example.com"  } },
    { packageId: 42, prefill: { firstName: "Bob",   lastName: "Jones", email: "bob@example.com"   } },
    { packageId: 42, prefill: { firstName: "Alice", lastName: "Chen",  email: "alice@example.com" } },
  ],
});

console.log(\`Created \${result.succeeded} of \${result.total} sessions\`);

for (const item of result.results) {
  if (item.ok) {
    console.log(\`[\${item.index}] \${item.sessionToken} → \${item.interviewUrl}\`);
  } else {
    console.error(\`[\${item.index}] Failed: \${item.error} (code: \${item.code})\`);
  }
}`}</pre>

      <h2>Session item parameters</h2>
      <p>
        Each entry in the <code>sessions</code> array accepts the same parameters as a single{" "}
        <a href="/developer/sdk"><code>sessions.create</code></a> call:
      </p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>packageId</code></td><td>number</td><td>Yes</td>
              <td>ID of the package to use for this session.</td>
            </tr>
            <tr>
              <td><code>prefill</code></td><td>Record&lt;string, string&gt;</td><td>No</td>
              <td>Key-value pairs to pre-populate known field values.</td>
            </tr>
            <tr>
              <td><code>linkExpiryDays</code></td><td>number</td><td>No</td>
              <td>Override the package expiry (1–365 days).</td>
            </tr>
            <tr>
              <td><code>locale</code></td><td>string</td><td>No</td>
              <td>BCP 47 locale code, e.g. <code>"es"</code>, <code>"fr"</code>.</td>
            </tr>
            <tr>
              <td><code>signers</code></td><td>array</td><td>No</td>
              <td>Multi-party signer list. See <a href="/developer/signers">Multi-Party Signers →</a></td>
            </tr>
            <tr>
              <td><code>reminders</code></td><td>object</td><td>No</td>
              <td>Automated reminder email configuration. See <a href="/developer/sdk">sessions.create</a> for the full schema.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Response shape</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><code>total</code></td><td>number</td><td>Total number of items submitted.</td></tr>
            <tr><td><code>succeeded</code></td><td>number</td><td>Number of sessions created successfully.</td></tr>
            <tr><td><code>failed</code></td><td>number</td><td>Number of items that failed.</td></tr>
            <tr>
              <td><code>results</code></td><td>BulkCreateSessionResultItem[]</td>
              <td>Per-item outcome — one entry per submitted session, in the same order as the input array.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Per-item result fields</h3>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>index</code></td><td>number</td>
              <td>Zero-based position matching the input array.</td>
            </tr>
            <tr>
              <td><code>ok</code></td><td>boolean</td>
              <td><code>true</code> if the session was created successfully; <code>false</code> on failure.</td>
            </tr>
            <tr>
              <td><code>sessionToken</code></td><td>string | undefined</td>
              <td>The session token (<code>df_…</code>). Present only when <code>ok</code> is <code>true</code>.</td>
            </tr>
            <tr>
              <td><code>interviewUrl</code></td><td>string | undefined</td>
              <td>Ready-to-send interview link. Present only when <code>ok</code> is <code>true</code>.</td>
            </tr>
            <tr>
              <td><code>expiresAt</code></td><td>string | null</td>
              <td>ISO 8601 timestamp when the link expires, or <code>null</code> if the package has no expiry set.</td>
            </tr>
            <tr>
              <td><code>error</code></td><td>string | undefined</td>
              <td>Human-readable failure message. Present only when <code>ok</code> is <code>false</code>.</td>
            </tr>
            <tr>
              <td><code>code</code></td><td>string | undefined</td>
              <td>Machine-readable error code. Present only when <code>ok</code> is <code>false</code>.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Limits</h2>
      <ul>
        <li>Maximum <strong>100 sessions per request</strong>.</li>
        <li>
          The HTTP response is always <code>207 Multi-Status</code> — check each item's <code>ok</code>{" "}
          field individually rather than relying on the top-level status code.
        </li>
        <li>
          One bulk call counts as one request against your rate limit (1,000 req/min), regardless of
          how many sessions are inside it.
        </li>
      </ul>

      <h2>Handling partial failures</h2>
      <pre>{`const failed = result.results.filter(r => !r.ok);

if (failed.length > 0) {
  console.warn(\`\${failed.length} session(s) failed to create:\`);
  for (const f of failed) {
    console.warn(\`  [index \${f.index}] \${f.error} — code: \${f.code}\`);
  }
  // Log to your error tracker, alert your team, or queue for retry
}`}</pre>

      <h2>TypeScript types</h2>
      <pre>{`import type {
  BulkCreateSessionItem,
  BulkCreateSessionResult,
  BulkCreateSessionResultItem,
} from "@docuplete/sdk";`}</pre>
    </div>
  );
}
