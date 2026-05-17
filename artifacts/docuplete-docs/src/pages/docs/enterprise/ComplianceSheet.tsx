export default function ComplianceSheet() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Enterprise</div>
        <h1>Enterprise Compliance Sheet</h1>
        <p className="text-lg text-white/55 mt-2">
          A single-page summary of Docuplete's security controls, compliance posture, and data
          handling practices — suitable for procurement review, vendor assessments, and legal teams.
        </p>
      </div>

      <div className="callout callout-info">
        For the full security documentation, see the{" "}
        <a href="/docuplete-docs/enterprise/security">Security & Compliance packet →</a>
        {"  "}To request a signed DPA, BAA, or custom contract, email{" "}
        <strong>legal@docuplete.com</strong>.
      </div>

      {/* ── Company overview ── */}
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th colSpan={2}>Company Overview</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><strong>Product</strong></td><td>Docuplete — document automation &amp; e-signature platform</td></tr>
            <tr><td><strong>Primary use case</strong></td><td>Collecting filled, signed PDFs from clients via guided online interviews</td></tr>
            <tr><td><strong>Cloud provider</strong></td><td>Amazon Web Services (AWS), us-east-1 (primary)</td></tr>
            <tr><td><strong>Support</strong></td><td>Enterprise: dedicated account manager + priority SLA</td></tr>
            <tr><td><strong>Status page</strong></td><td><a href="https://status.docuplete.com" target="_blank" rel="noopener noreferrer">status.docuplete.com</a></td></tr>
          </tbody>
        </table>
      </div>

      {/* ── Encryption ── */}
      <div className="overflow-x-auto mt-6">
        <table>
          <thead>
            <tr>
              <th colSpan={3}>Encryption</th>
            </tr>
            <tr>
              <th>Layer</th><th>Standard</th><th>Scope</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>In transit</td><td>TLS 1.2+</td>
              <td>All API, dashboard, and client interview traffic; HTTPS enforced</td>
            </tr>
            <tr>
              <td>At rest</td><td>AES-256</td>
              <td>Database, PDFs, uploaded source documents</td>
            </tr>
            <tr>
              <td>Application (answers)</td><td>AES-256-GCM</td>
              <td>Interview answers — unique key per record; Starter Pro+ plans</td>
            </tr>
            <tr>
              <td>API key storage</td><td>SHA-256 hash only</td>
              <td>Raw keys are never stored; shown only once at creation</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Document integrity ── */}
      <div className="overflow-x-auto mt-6">
        <table>
          <thead>
            <tr><th colSpan={2}>Document Integrity &amp; E-Signature</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Tamper detection</strong></td>
              <td>SHA-256 hash computed at PDF generation; hash stored and returned in API/webhook responses</td>
            </tr>
            <tr>
              <td><strong>Trusted timestamps</strong></td>
              <td>RFC 3161 timestamps from a qualified TSA embedded in every e-signed PDF</td>
            </tr>
            <tr>
              <td><strong>Signing certificate</strong></td>
              <td>Certificate page appended to each signed PDF; records signer name, email, IP, user agent, OTP timestamp, and document hash</td>
            </tr>
            <tr>
              <td><strong>E-sign identity verification</strong></td>
              <td>Email OTP required before signature fields unlock; event logged in immutable session audit trail</td>
            </tr>
            <tr>
              <td><strong>Webhook authenticity</strong></td>
              <td>HMAC-SHA256 signature on every delivery via <code>X-Docuplete-Signature</code> header</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Access control ── */}
      <div className="overflow-x-auto mt-6">
        <table>
          <thead>
            <tr><th colSpan={2}>Access Control</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Authentication</strong></td>
              <td>API key (Bearer token, <code>dp_live_</code> prefix, 64-char hex); dashboard login via email + password or SSO</td>
            </tr>
            <tr>
              <td><strong>RBAC</strong></td>
              <td>Admin and Member roles; Admins control security, billing, and API keys</td>
            </tr>
            <tr>
              <td><strong>SSO / SAML 2.0</strong></td>
              <td>Supported (Enterprise); compatible with Okta, Azure AD, OneLogin, Google Workspace</td>
            </tr>
            <tr>
              <td><strong>SCIM 2.0</strong></td>
              <td>Automated provisioning/deprovisioning from any SCIM-compatible IdP (Enterprise)</td>
            </tr>
            <tr>
              <td><strong>MFA / 2FA</strong></td>
              <td>TOTP-based 2FA available for all users; Admins can enforce for the entire org</td>
            </tr>
            <tr>
              <td><strong>IP allowlisting</strong></td>
              <td>CIDR-based API access restriction (Enterprise); requests outside allowlist → <code>403</code></td>
            </tr>
            <tr>
              <td><strong>Rate limiting</strong></td>
              <td>Failed API auth attempts: 10 per IP per 60 s; API requests: 1,000/min per org</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Audit & Logging ── */}
      <div className="overflow-x-auto mt-6">
        <table>
          <thead>
            <tr><th colSpan={2}>Audit &amp; Logging</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Session audit log</strong></td>
              <td>Immutable per-session event trail (creation, link delivery, open, submission, void, PDF generation); available via API</td>
            </tr>
            <tr>
              <td><strong>Management audit log</strong></td>
              <td>Account-level admin actions retained 12+ months; accessible in dashboard</td>
            </tr>
            <tr>
              <td><strong>Login history</strong></td>
              <td>IP address, GeoIP location, and user agent logged for every login attempt</td>
            </tr>
            <tr>
              <td><strong>Webhook delivery logs</strong></td>
              <td>Full history of webhook attempts including status code, latency, and request/response bodies</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Data handling ── */}
      <div className="overflow-x-auto mt-6">
        <table>
          <thead>
            <tr><th colSpan={2}>Data Handling &amp; Privacy</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Data residency</strong></td>
              <td>US-East (AWS us-east-1) by default; EU and APAC residency available on Enterprise (contact sales)</td>
            </tr>
            <tr>
              <td><strong>Backups</strong></td>
              <td>Automated daily database backups; point-in-time recovery; 30-day retention; stored in separate AWS region</td>
            </tr>
            <tr>
              <td><strong>Retention</strong></td>
              <td>Configurable retention windows; data purged automatically at end of period</td>
            </tr>
            <tr>
              <td><strong>Data export</strong></td>
              <td>Full account export available on demand from Settings → Data → Export</td>
            </tr>
            <tr>
              <td><strong>Right to erasure</strong></td>
              <td>Admin-initiated deletion request; 30-day confirmation window; permanent purge of all records</td>
            </tr>
            <tr>
              <td><strong>PII redaction</strong></td>
              <td>Configurable field-level redaction in dashboard views (Enterprise)</td>
            </tr>
            <tr>
              <td><strong>Sub-processors</strong></td>
              <td>List available on request at <strong>legal@docuplete.com</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Developer Experience ── */}
      <div className="overflow-x-auto mt-6">
        <table>
          <thead>
            <tr><th colSpan={2}>Developer Experience (DX)</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>TypeScript SDK</strong></td>
              <td>Fully typed, clean-build SDK — <code>npm install @docuplete/sdk</code>. Zero generated code, strict TypeScript throughout.</td>
            </tr>
            <tr>
              <td><strong>Shared field library</strong></td>
              <td>Centralized field management across unlimited packages — define a field once, reuse it across every template in your organization</td>
            </tr>
            <tr>
              <td><strong>REST API + OpenAPI spec</strong></td>
              <td>Full OpenAPI specification with embedded Swagger UI; language-agnostic — cURL, Python, Ruby, Go, and more all supported</td>
            </tr>
            <tr>
              <td><strong>API Sandbox</strong></td>
              <td>Zero-config public sandbox — create a live interview session in a browser with no API key, account, or setup required</td>
            </tr>
            <tr>
              <td><strong>Headless / embedded mode</strong></td>
              <td>Interview URL can be opened in an <code>iframe</code>, modal, redirect, or SMS link — no Docuplete branding required on Enterprise</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Compliance frameworks ── */}
      <div className="overflow-x-auto mt-6">
        <table>
          <thead>
            <tr><th colSpan={3}>Compliance &amp; Legal</th></tr>
            <tr><th>Framework</th><th>Status</th><th>Notes</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>GDPR</td><td>Supported</td>
              <td>Data subject rights (access, erasure, portability); DPA available on request</td>
            </tr>
            <tr>
              <td>CCPA</td><td>Supported</td>
              <td>Data deletion and opt-out workflows; DPA available on request</td>
            </tr>
            <tr>
              <td>ESIGN Act / UETA</td><td>Compliant</td>
              <td>E-signatures meet ESIGN Act and UETA requirements</td>
            </tr>
            <tr>
              <td>eIDAS (EU)</td><td>AdES compliant</td>
              <td>RFC 3161 timestamps satisfy Advanced Electronic Signature requirements</td>
            </tr>
            <tr>
              <td>HIPAA</td><td>BAA available</td>
              <td>Enterprise customers only; consult your compliance team before transmitting PHI</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── SLA & uptime ── */}
      <div className="overflow-x-auto mt-6">
        <table>
          <thead>
            <tr><th colSpan={2}>Availability &amp; Support</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Uptime SLA</strong></td><td>99.9% monthly (Enterprise plan)</td></tr>
            <tr><td><strong>Incident response</strong></td><td>Security reports acknowledged within 48 hours; resolution timeline within 7 business days</td></tr>
            <tr><td><strong>Vulnerability disclosure</strong></td><td>security@docuplete.com</td></tr>
            <tr><td><strong>Enterprise support</strong></td><td>Dedicated account manager; priority ticket queue; onboarding assistance</td></tr>
            <tr><td><strong>Legal / DPA requests</strong></td><td>legal@docuplete.com</td></tr>
          </tbody>
        </table>
      </div>

      <div className="callout callout-tip" style={{ marginTop: "2rem" }}>
        <strong>Last updated:</strong> May 2026 · Docuplete, Inc. · This sheet is for informational
        purposes. The information above reflects current practices and is subject to change. For
        contractual commitments, a signed Order Form or DPA is required.
      </div>
    </div>
  );
}
