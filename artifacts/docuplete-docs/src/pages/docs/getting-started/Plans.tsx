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
              <th>Starter ($49/mo)</th>
              <th>Starter Professional ($69/mo)</th>
              <th>Pro ($249/mo)</th>
              <th>Enterprise ($3,000/mo)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Seats & Submissions</td>
            </tr>
            <tr><td>Seats included</td><td>2</td><td>2</td><td>10</td><td>25</td></tr>
            <tr><td>Extra seats</td><td>$15/seat</td><td>$15/seat</td><td>$15/seat</td><td>$15/seat</td></tr>
            <tr><td>Submissions/seat/mo</td><td>50</td><td>50</td><td>50</td><td>Unlimited</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Packages & Templates</td>
            </tr>
            <tr><td>PDF upload & visual mapping</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Unlimited packages</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
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
            <tr><td>Answer encryption at rest</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">PDF Generation & Delivery</td>
            </tr>
            <tr><td>Filled PDF generation</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>PDF download & dashboard storage</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>SHA-256 tamper detection</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Signed document verification (by token or hash)</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Electronic Signature</td>
            </tr>
            <tr><td>E-sign fields (signature & initials)</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Email OTP identity verification</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Signing certificate page</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>RFC 3161 trusted timestamp</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Batch & Branding</td>
            </tr>
            <tr><td>Custom branding (logo, colors)</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>
            <tr><td>Batch CSV import</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>
            <tr><td>Batch send client links</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Integrations</td>
            </tr>
            <tr><td>Google Drive auto-save</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>
            <tr><td>HubSpot contact sync</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Webhooks & API</td>
            </tr>
            <tr><td>Webhooks (HMAC-signed, with retries)</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
            <tr><td>Webhook delivery logs & manual retry</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
            <tr><td>API key access</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
            <tr><td>OpenAPI docs (Swagger UI)</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>

            <tr>
              <td colSpan={5} className="text-xs font-semibold uppercase tracking-widest text-white/30 pt-4 pb-1">Enterprise</td>
            </tr>
            <tr><td>SSO / SAML</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
            <tr><td>SLA guarantee</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
            <tr><td>Dedicated account manager</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Annual billing</h2>
      <p>All plans are available on annual billing at a 20% discount. Annual billing locks in your current introductory rate — prices will increase as Docuplete grows.</p>

      <h2>Submission counting</h2>
      <p>A submission is counted each time a client successfully completes and submits an interview. Draft sessions, voided sessions, and abandoned sessions do not count. Your quota resets each billing period. On Enterprise, submissions are unlimited.</p>

      <h2>Seats</h2>
      <p>A seat is a user account within your organization. Admins, members, and read-only users each consume a seat. Extra seats beyond the plan's included count are billed at $15/seat/month.</p>

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
