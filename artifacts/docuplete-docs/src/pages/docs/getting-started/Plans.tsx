export default function Plans() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Getting Started</div>
        <h1>Plans & Pricing</h1>
        <p className="text-lg text-white/55 mt-2">Docuplete offers four plans. All start with a 14-day free trial — no credit card required.</p>
      </div>

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Feature</th>
              <th>Starter ($69/mo)</th>
              <th>Pro ($249/mo)</th>
              <th>Developer ($499/mo)</th>
              <th>Enterprise ($3,000/mo)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Seats & Sessions</td>
            </tr>
            <tr><td>Seats included</td><td>2</td><td>10</td><td>Org-wide (unlimited)</td><td>25</td></tr>
            <tr><td>Sessions / generations included</td><td>150 sessions/mo</td><td>400 sessions/mo</td><td>500 generations/mo</td><td>Unlimited</td></tr>
            <tr><td>Overage</td><td>$0.50 / additional session</td><td>$0.50 / additional session</td><td>$75 / 100 generations</td><td>$15 / extra seat</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Packages & Templates</td>
            </tr>
            <tr><td>PDF upload & visual mapping</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Packages</td><td>Up to 5</td><td>Unlimited</td><td>Unlimited</td><td>Unlimited</td></tr>
            <tr><td>Field library (shared fields)</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Package groups & transaction types</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Sessions & Interview Flow</td>
            </tr>
            <tr><td>Shareable client interview link</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Autosave as client fills</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Client email notifications</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Session expiration & reminders</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Prefill field values</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Void sessions</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Electronic Signature</td>
            </tr>
            <tr><td>E-sign fields (signature & initials)</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Email OTP identity verification</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Signing certificate page</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>RFC 3161 trusted timestamp</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">PDF Generation & Delivery</td>
            </tr>
            <tr><td>Filled PDF generation</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>PDF download & dashboard storage</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>SHA-256 tamper detection</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Signed document verification (by token or hash)</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Batch & Branding</td>
            </tr>
            <tr><td>Custom branding (logo, colors)</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Batch CSV import</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Batch send client links</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Integrations</td>
            </tr>
            <tr><td>Google Drive, Dropbox & OneDrive</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>HubSpot contact sync</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Webhooks & API</td>
            </tr>
            <tr><td>REST API + TypeScript & Python SDKs</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>
            <tr><td>Webhooks (HMAC-signed, with retries)</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>
            <tr><td>Webhook delivery logs & manual retry</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>
            <tr><td>Headless & embedded interview mode</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>
            <tr><td>Bulk session creation (up to 100)</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>
            <tr><td>OpenAPI docs + Sandbox (no key needed)</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Enterprise</td>
            </tr>
            <tr><td>SSO / SAML + SCIM provisioning</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
            <tr><td>IP allowlisting</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
            <tr><td>AES-256-GCM answer encryption</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Custom domain</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
            <tr><td>SLA guarantee</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
            <tr><td>Dedicated account manager</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Annual billing</h2>
      <p>All plans are available on annual billing at a 20% discount. Annual billing locks in your current introductory rate — prices will increase as Docuplete grows.</p>

      <h2>Sessions vs. generations</h2>
      <p>A <strong>session</strong> is a single client interaction — a unique interview link created from a package and sent to one client. The session exists from the moment it's created until it is submitted, voided, or expired.</p>
      <p>A <strong>generation</strong> is the act of producing a filled PDF. On most plans, generation happens automatically when a client submits a session. On Developer, you can also trigger generation directly via the API without any client interview — for example, to fill a PDF programmatically from your own data source. Because of this, Developer counts <em>generations</em> rather than sessions: it's a broader unit that covers both paths.</p>
      <p>In short: every submitted session produces a generation, but not every generation comes from a client session.</p>

      <h2>Quota counting and overage</h2>
      <p>On Starter and Pro, your quota counts <strong>submitted sessions</strong> — sessions a client successfully completes and submits. Draft, voided, and abandoned sessions do not count. Quota resets each billing period.</p>
      <p>On Developer, your quota counts <strong>generations</strong> — each filled PDF produced, regardless of origin. Quota resets each billing period.</p>
      <p>On Enterprise, sessions and generations are unlimited.</p>
      <p>If you go over your base quota, you have two options: let overage bill automatically at the end of the period, or proactively purchase usage packs from <strong>Settings → Billing</strong> to top up your balance in advance. Starter and Pro customers can buy <strong>session packs</strong>; Developer customers can buy <strong>generation packs</strong>. See the <a href="/account/billing">Seats &amp; Billing</a> page for pack sizes and pricing.</p>

      <h2>Developer overage pricing</h2>
      <p>Developer overage is priced at <strong>$75 per 100 additional generations</strong> ($0.75 per generation). This is intentionally lower than the effective per-generation cost of the base plan ($499 ÷ 500 = ~$1.00/generation) — high-volume API usage is rewarded with a lower marginal rate.</p>
      <p>Overage is billed in blocks of 100, not per individual generation. This keeps invoices predictable: if you produce 620 generations in a month, you pay for 500 (included) + 200 (two full blocks, whether or not you used all 200). There is no fractional block charge.</p>
      <p>If you routinely exceed 500 generations per month, contact us about Enterprise pricing — unlimited generations are included at the $3,000/mo flat rate.</p>

      <h2>Seats</h2>
      <p>A seat is a user account within your organization. Admins, members, and read-only users each consume a seat.</p>
      <p>On <strong>Starter</strong> and <strong>Pro</strong>, seats beyond the included count cannot be purchased separately — upgrade to a higher plan for more. On <strong>Developer</strong>, seats are org-wide, meaning every member of your organization can have a seat at no additional per-seat cost. On <strong>Enterprise</strong>, the base plan includes 25 seats and extra seats are $15/seat/month.</p>

      <h2>Free trial</h2>
      <p>Every new account starts with a 14-day free trial — no credit card required. During the trial, you have access to all Pro-tier features. After the trial, choose a plan to continue.</p>

      <div className="callout callout-info">
        <strong>Introductory pricing:</strong> Prices shown are early-adopter rates and will increase as Docuplete grows. Existing customers keep their locked-in rate.
      </div>

      <h2>Upgrading or downgrading</h2>
      <p>You can change your plan at any time from <strong>Settings → Billing</strong>. Upgrades take effect immediately. Downgrades take effect at the end of the current billing period.</p>
    </div>
  );
}
