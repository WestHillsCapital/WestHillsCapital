export default function CustomDomains() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Enterprise</div>
        <h1>Custom Domains</h1>
        <p className="text-lg text-white/55 mt-2">
          Serve client-facing interview links from your own subdomain — for example,{" "}
          <code>forms.yourcompany.com</code> — instead of the default Docuplete domain.
        </p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> Custom domains require an Enterprise plan.{" "}
        <a href="/getting-started/plans">Learn about plans →</a>
      </div>

      <h2>How it works</h2>
      <p>
        Docuplete serves interview sessions over HTTPS from a subdomain you own. You point that
        subdomain at Docuplete's infrastructure via a CNAME DNS record. Docuplete then provisions an
        SSL certificate and verifies the configuration. Once active, all newly created session links
        automatically use your domain — no changes to your existing packages or integrations required.
      </p>

      <h2>Setup (dashboard)</h2>
      <ol>
        <li>Go to <strong>Settings → Custom Domain</strong>.</li>
        <li>
          Enter your desired subdomain (e.g. <code>forms.yourcompany.com</code>) and click{" "}
          <strong>Save</strong>.
        </li>
        <li>
          In your DNS provider, add a <strong>CNAME record</strong>:
          <ul>
            <li><strong>Host / Name:</strong> <code>forms</code> (just the subdomain part, or the full subdomain if your provider requires it)</li>
            <li><strong>Value / Target:</strong> <code>docuplete.com</code></li>
            <li><strong>TTL:</strong> 3600 seconds (or your provider's recommended default)</li>
          </ul>
        </li>
        <li>
          Return to <strong>Settings → Custom Domain</strong> and click <strong>Verify</strong>.
          DNS propagation usually resolves within minutes but can take up to 48 hours depending on
          your provider.
        </li>
      </ol>

      <div className="callout callout-tip">
        Use a tool like{" "}
        <a href="https://dnschecker.org" target="_blank" rel="noopener noreferrer">dnschecker.org</a>{" "}
        to confirm your CNAME has propagated globally before clicking Verify. This avoids a failed
        verification attempt that would put the domain into <code>verification_failed</code> status.
      </div>

      <h2>Domain statuses</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Status</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>not_configured</code></td>
              <td>No custom domain is set. Session links use the default Docuplete domain.</td>
            </tr>
            <tr>
              <td><code>pending_verification</code></td>
              <td>Domain saved. Waiting for DNS to propagate and for you to click Verify.</td>
            </tr>
            <tr>
              <td><code>active</code></td>
              <td>Domain verified and SSL certificate provisioned. All new session links use your domain.</td>
            </tr>
            <tr>
              <td><code>verification_failed</code></td>
              <td>
                Docuplete checked for the CNAME but it was missing or pointed to the wrong target.
                Fix your DNS record and click Verify again.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>API reference</h2>
      <p>You can also manage custom domains programmatically via the REST API.</p>

      <h3>Get current domain status</h3>
      <pre>{`GET /api/v1/account/custom-domain
Authorization: Bearer dp_live_...

// 200 OK
{
  "domain":      "forms.yourcompany.com",
  "status":      "active",
  "cnameTarget": "docuplete.com",
  "verifiedAt":  "2026-03-14T09:00:00.000Z",
  "instructions": null
}`}</pre>

      <h3>Set a custom domain</h3>
      <pre>{`PUT /api/v1/account/custom-domain
Authorization: Bearer dp_live_...
Content-Type: application/json

{ "domain": "forms.yourcompany.com" }

// 200 OK — status will be "pending_verification"`}</pre>

      <h3>Trigger DNS verification</h3>
      <pre>{`POST /api/v1/account/custom-domain/verify
Authorization: Bearer dp_live_...

// 200 OK — status updated to "active" on success
// 422 Unprocessable Entity — CNAME not yet resolvable`}</pre>

      <h3>Remove the custom domain</h3>
      <pre>{`DELETE /api/v1/account/custom-domain
Authorization: Bearer dp_live_...

// 200 OK — session links revert to the default Docuplete domain immediately`}</pre>

      <h2>SDK type reference</h2>
      <pre>{`import type { CustomDomainStatus } from "@docuplete/sdk";

// Shape:
// {
//   domain:       string | null;   // null when not_configured
//   status:       string;          // "not_configured" | "pending_verification" | "active" | "verification_failed"
//   cnameTarget:  string;          // always "docuplete.com"
//   verifiedAt:   string | null;   // ISO 8601 timestamp, null until verified
//   instructions: string | null;   // setup guidance when pending, null when active
// }`}</pre>

      <h2>Frequently asked questions</h2>

      <h3>Does the custom domain apply to existing sessions?</h3>
      <p>
        No. Sessions created <em>before</em> the domain became active keep their original links.
        Only sessions created after the domain status reaches <code>active</code> use your custom
        domain. Re-create any links that need to be reissued on the new domain.
      </p>

      <h3>Can I use a root domain (e.g. yourcompany.com) instead of a subdomain?</h3>
      <p>
        No. CNAME records cannot be set on a root/apex domain in most DNS providers. Use a subdomain
        such as <code>forms.yourcompany.com</code> or <code>sign.yourcompany.com</code>.
      </p>

      <h3>What happens to the SSL certificate?</h3>
      <p>
        Docuplete provisions and automatically renews an SSL certificate for your subdomain via
        Let's Encrypt. You do not need to manage certificates yourself.
      </p>

      <h3>Can I have more than one custom domain?</h3>
      <p>
        Each Docuplete account supports one active custom domain. To switch, remove the current
        domain and configure the new one.
      </p>
    </div>
  );
}
