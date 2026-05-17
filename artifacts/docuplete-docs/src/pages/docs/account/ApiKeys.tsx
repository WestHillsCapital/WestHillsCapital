import { DocScreenshot } from "@/components/DocScreenshot";

export default function ApiKeys() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Account & Settings</div>
        <h1>API Keys</h1>
        <p className="text-lg text-white/55 mt-2">Generate and manage API keys for programmatic access to Docuplete.</p>
      </div>

      <div className="callout callout-info">
        <strong>Developer plan and above.</strong> API access is available on the Developer ($499/mo) and Enterprise plans. <a href="/getting-started/plans">See all plans →</a>
      </div>

      <h2>What you can do with the API</h2>
      <p>The Docuplete REST API allows you to:</p>
      <ul>
        <li>Create sessions programmatically (no dashboard required)</li>
        <li>Prefill field values at session creation</li>
        <li>Retrieve session status and submitted answers</li>
        <li>Download completed PDFs</li>
        <li>List sessions and batch runs</li>
        <li>Void sessions</li>
      </ul>
      <p>API documentation is available at <a href="https://api.docuplete.com/docs" target="_blank" rel="noopener noreferrer">api.docuplete.com/docs</a>.</p>

      <DocScreenshot
        src="/screenshots/api-keys-panel.png"
        alt="The API Keys settings panel listing live and test keys with names, key prefixes, created dates, last-used dates, and Revoke buttons"
        caption="The API Keys panel — create named keys for each integration, distinguish live from test keys, and revoke instantly if a key is compromised."
      />

      <h2>Creating an API key</h2>
      <ol>
        <li>Go to <strong>Settings → API Keys</strong>.</li>
        <li>Click <strong>Generate New Key</strong>.</li>
        <li>Give the key a name (e.g., "CRM Integration", "Automation Server") so you can identify it later.</li>
        <li>Optionally restrict the key to specific packages.</li>
        <li>Click <strong>Create</strong>.</li>
        <li>Copy the key immediately — it's shown only once. If you lose it, generate a new one.</li>
      </ol>

      <div className="callout callout-warning">
        <strong>Keep keys secret.</strong> Treat API keys like passwords. Never commit them to source code or expose them in client-side JavaScript. Use environment variables on your server.
      </div>

      <h2>Using an API key</h2>
      <p>Include the key in the <code>Authorization</code> header of every API request:</p>
      <pre>{`Authorization: Bearer dp_live_a1b2c3d4e5f6...`}</pre>

      <h2>Key types</h2>
      <ul>
        <li><strong>Live keys</strong> (<code>dp_live_...</code>) — Access your real organization data. Use in production.</li>
        <li><strong>Test keys</strong> (<code>dp_test_...</code>) — Access an isolated test environment. Sessions created with test keys don't send emails or trigger integrations.</li>
      </ul>

      <h2>Revoking a key</h2>
      <p>To revoke an API key, click <strong>Revoke</strong> next to it in <strong>Settings → API Keys</strong>. Revocation is immediate — any request using that key will immediately receive a 401 Unauthorized error. This cannot be undone; generate a new key if needed.</p>

      <h2>Rate limits</h2>
      <p>API requests are rate-limited to <strong>1,000 requests per minute</strong> per organization. If you hit the rate limit, you'll receive an HTTP 429 response with a <code>Retry-After</code> header. Contact your account manager if you need a higher limit.</p>
    </div>
  );
}
