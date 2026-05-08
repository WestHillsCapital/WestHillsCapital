export default function DeveloperAuthentication() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Authentication</h1>
        <p className="text-lg text-white/55 mt-2">
          Authenticate server-to-server requests to the Docuplete API using live API keys.
        </p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> API access is available on the Enterprise plan. Contact your account manager to enable it.
      </div>

      <h2>API keys</h2>
      <p>
        The Docuplete REST API uses bearer token authentication. Every server-side request must include a live API
        key in the <code>Authorization</code> header:
      </p>
      <pre>{`Authorization: Bearer dp_live_a1b2c3d4e5f6...`}</pre>

      <div className="callout callout-warning">
        <strong>Keep keys secret.</strong> API keys grant full access to your organization's data. Never embed them
        in client-side JavaScript, mobile apps, or public repositories. Always load them from environment variables
        on your server.
      </div>

      <h2>Key format</h2>
      <p>
        Live API keys start with the prefix <code>dp_live_</code> followed by 64 random hex characters. Keys are
        never stored in plaintext — only a SHA-256 hash is kept server-side. <strong>Copy your key immediately
        after creation; it is shown only once.</strong>
      </p>

      <h2>Generating a key</h2>
      <ol>
        <li>Open the Docuplete dashboard and go to <strong>Settings → API Keys</strong>.</li>
        <li>Click <strong>Generate New Key</strong>.</li>
        <li>Give the key a descriptive name (e.g., <em>"CRM Integration"</em> or <em>"Automation Server"</em>).</li>
        <li>Click <strong>Create</strong> and copy the key immediately — it will not be shown again.</li>
      </ol>

      <h2>Revoking a key</h2>
      <p>
        Click <strong>Revoke</strong> next to any key in <strong>Settings → API Keys</strong>. Revocation is
        immediate — subsequent requests using that key receive <code>401 Unauthorized</code>. Generate a new key
        to replace it.
      </p>

      <h2>Error responses</h2>
      <p>Authentication failures return standard HTTP error codes:</p>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>401</code></td>
            <td>Missing, malformed, or revoked API key.</td>
          </tr>
          <tr>
            <td><code>403</code></td>
            <td>Your plan does not include API access, or your IP address is not on the allowlist.</td>
          </tr>
          <tr>
            <td><code>429</code></td>
            <td>Too many requests — you have been rate-limited. Retry after a short delay.</td>
          </tr>
        </tbody>
      </table>

      <h2>Rate limits</h2>
      <p>
        API requests are rate-limited to <strong>1,000 requests per minute</strong> per organization. Exceeding
        this returns HTTP 429. Contact your account manager if you need a higher quota.
      </p>

      <h2>Base URL</h2>
      <p>All API endpoints are served from:</p>
      <pre>{`https://api.docuplete.com`}</pre>
      <p>
        Interactive API reference:{" "}
        <a href="https://api.docuplete.com/docs" target="_blank" rel="noopener noreferrer">
          api.docuplete.com/docs
        </a>
      </p>
    </div>
  );
}
