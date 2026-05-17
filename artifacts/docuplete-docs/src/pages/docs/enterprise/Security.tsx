export default function Security() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Enterprise</div>
        <h1>Security & Compliance</h1>
        <p className="text-lg text-white/55 mt-2">
          A comprehensive overview of how Docuplete protects your data, your clients' information,
          and your organization's compliance posture.
        </p>
      </div>

      <div className="callout callout-info">
        Need a single-page summary for your procurement or legal team?{" "}
        <a href="/docuplete-docs/enterprise/compliance-sheet">Download the Enterprise Compliance Sheet →</a>
      </div>

      <h2>Encryption</h2>

      <h3>Data in transit</h3>
      <p>
        All communication between clients, the Docuplete dashboard, and the API is encrypted using{" "}
        <strong>TLS 1.2 or higher</strong>. HTTP connections are automatically redirected to HTTPS.
        Webhook payloads are delivered over HTTPS only — Docuplete will not deliver to plain HTTP
        endpoints.
      </p>

      <h3>Data at rest</h3>
      <p>
        Database records and file storage are encrypted at rest using <strong>AES-256</strong>.
        Interview answer sets on Starter Professional, Pro, and Enterprise plans use an additional
        layer of application-level encryption with a unique key per record, derived from a
        master key stored in a dedicated secrets manager. This means even a compromised database
        snapshot cannot be read without the application-level key.
      </p>

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Layer</th><th>Standard</th><th>Scope</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Transport</td><td>TLS 1.2+</td>
              <td>All API, dashboard, and interview traffic</td>
            </tr>
            <tr>
              <td>Storage</td><td>AES-256</td>
              <td>Database rows, PDF files, uploaded documents</td>
            </tr>
            <tr>
              <td>Application (answers)</td><td>AES-256-GCM</td>
              <td>Interview answers — Starter Professional, Pro, Developer, and Enterprise plans</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Document integrity</h2>

      <h3>SHA-256 tamper detection</h3>
      <p>
        Every generated PDF is hashed with <strong>SHA-256</strong> at the moment of creation. The
        hash is stored alongside the document and returned in webhook payloads and API responses.
        Any modification to the PDF after generation produces a different hash — making tampering
        detectable. Clients and counterparties can verify a document's hash at any time via the
        Docuplete verification endpoint.
      </p>

      <h3>RFC 3161 trusted timestamps</h3>
      <p>
        E-signed documents receive an <strong>RFC 3161</strong> cryptographic timestamp from a
        qualified Timestamping Authority (TSA) at the moment of signing. This timestamp is embedded
        in the PDF and proves that the document existed in its current form at that exact moment in
        time — independent of Docuplete's own servers. This satisfies requirements in many
        jurisdictions for legally admissible electronic signatures.
      </p>

      <h3>Signing certificate page</h3>
      <p>
        Every e-signed PDF includes an appended certificate page that records: the signer's name,
        email address, IP address, user agent, OTP verification timestamp, and the document's hash.
        This page is itself part of the signed document scope.
      </p>

      <h2>Authentication & access control</h2>

      <h3>API key authentication</h3>
      <p>
        API keys use the format <code>dp_live_</code> followed by 64 random hex characters. Only a
        SHA-256 hash of each key is stored server-side — Docuplete cannot retrieve a key after
        creation. Keys are scoped to a single organization and can be revoked instantly from the
        dashboard.
      </p>
      <p>
        Failed authentication attempts are rate-limited per IP: after 10 consecutive failures in 60
        seconds, the IP is temporarily blocked from further attempts.
      </p>

      <h3>Role-based access control (RBAC)</h3>
      <p>
        Every user within an organization is assigned one of two roles:
      </p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Role</th><th>Capabilities</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Admin</strong></td>
              <td>Full access: manage users, billing, security settings, API keys, packages, and sessions.</td>
            </tr>
            <tr>
              <td><strong>Member</strong></td>
              <td>Can create and manage sessions and packages. Cannot access security settings, billing, or API keys.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>SSO / SAML</h3>
      <p>
        Enterprise accounts can enforce <strong>SAML 2.0 single sign-on</strong> with any compatible
        IdP (Okta, Azure AD, OneLogin, Google Workspace, and others). When SSO is enforced, password
        login is disabled for all users in the organization.
      </p>

      <h3>SCIM 2.0 provisioning</h3>
      <p>
        Enterprise accounts can automate user lifecycle management via{" "}
        <a href="/enterprise/scim">SCIM 2.0</a>. Provisioning, deprovisioning, and display name
        updates flow automatically from your IdP — no manual seat management required.
      </p>

      <h3>IP allowlisting</h3>
      <p>
        Enterprise admins can restrict API access to a list of allowed CIDR ranges. Requests
        originating from IPs outside the allowlist receive <code>403 Forbidden</code> regardless
        of the API key used. Dashboard access is not affected by API IP allowlists.
      </p>

      <h3>Two-factor authentication (TOTP)</h3>
      <p>
        All users can enable TOTP-based two-factor authentication from <strong>Settings →
        Security</strong>. Admins can require 2FA for all members in the organization.
      </p>

      <h2>Webhook security</h2>
      <p>
        Every webhook delivery includes an <code>X-Docuplete-Signature</code> header — an
        HMAC-SHA256 signature of the raw request body computed with your package's signing secret.
        Verifying this signature before processing the payload protects against spoofed or
        replayed requests.
      </p>
      <pre>{`import { constructWebhookEvent } from "@docuplete/sdk";

// Throws if the signature is invalid
const event = await constructWebhookEvent(
  req.body.toString(),
  req.headers["x-docuplete-signature"],
  process.env.DOCUPLETE_WEBHOOK_SECRET!,
);`}</pre>
      <p>
        See <a href="/webhooks/signature">Webhook Signature Verification</a> for full details,
        including language-agnostic verification examples.
      </p>

      <h2>Audit logging</h2>

      <h3>Session audit trail</h3>
      <p>
        Every action on a session — creation, link delivery, interview start, submission, PDF
        generation, void — is recorded in an immutable per-session audit log. Each entry captures
        the event type, actor type and identity, IP address, and a UTC timestamp. The audit log is
        available via the API (<a href="/developer/audit-log">Session Audit Log</a>) and is never
        editable after the fact.
      </p>

      <h3>Management audit log</h3>
      <p>
        Account-level administrative actions (user invitations, role changes, branding updates, API
        key creation and revocation, security setting changes) are captured in a separate management
        audit log accessible at <strong>Settings → Audit Log</strong>. This log is retained for a
        minimum of 12 months.
      </p>

      <h3>Login history</h3>
      <p>
        Each successful and failed login is recorded with IP address, GeoIP location (city and
        country), and user agent. Admins can review login history for any user in the organization
        at <strong>Settings → Security → Login History</strong>.
      </p>

      <h2>Data privacy & retention</h2>

      <h3>Data residency</h3>
      <p>
        Docuplete is hosted in <strong>US-East</strong> (AWS us-east-1) by default. Enterprise
        accounts requiring EU or APAC residency should contact their account manager before
        provisioning.
      </p>

      <h3>Retention policy</h3>
      <p>
        Document answers and generated PDFs are retained for the duration of your subscription plus
        a 30-day post-cancellation grace period. You can configure custom retention windows in
        <strong> Settings → Data & Privacy</strong>. Records scheduled for deletion are purged
        automatically at the end of the configured period.
      </p>

      <h3>Right to erasure (GDPR Article 17)</h3>
      <p>
        Admins can submit a data deletion request from <strong>Settings → Data → Request
        Deletion</strong>. The request opens a 30-day confirmation window, after which all
        account data — including sessions, answers, PDFs, and audit logs — is permanently deleted.
        A full data export is available before deletion via <strong>Settings → Data → Export</strong>.
      </p>

      <h3>PII redaction</h3>
      <p>
        Enterprise accounts can configure automatic PII redaction in generated PDF previews and
        dashboard views, with full answers retained only in encrypted storage and accessible only
        to authorized API consumers.
      </p>

      <h2>E-sign identity verification</h2>
      <p>
        When a package requires e-sign, Docuplete verifies the signer's identity using
        <strong> email one-time password (OTP)</strong>. The signer receives a 6-digit code to the
        email address on record. They must enter the code before the signature fields are unlocked.
        The OTP event is recorded in the session audit log with the IP address and timestamp.
      </p>

      <h2>Infrastructure & availability</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Property</th><th>Detail</th></tr>
          </thead>
          <tbody>
            <tr><td>Cloud provider</td><td>Amazon Web Services (AWS)</td></tr>
            <tr><td>Primary region</td><td>us-east-1 (N. Virginia)</td></tr>
            <tr><td>Database</td><td>Managed PostgreSQL with automated daily backups (30-day retention)</td></tr>
            <tr><td>Backups</td><td>Point-in-time recovery, 30-day retention, stored in a separate AWS region</td></tr>
            <tr><td>Uptime SLA</td><td>99.9% monthly uptime — Enterprise plan only</td></tr>
            <tr><td>Status page</td><td><a href="https://status.docuplete.com" target="_blank" rel="noopener noreferrer">status.docuplete.com</a></td></tr>
          </tbody>
        </table>
      </div>

      <h2>Vulnerability disclosure</h2>
      <p>
        Docuplete operates a responsible disclosure program. If you discover a security
        vulnerability, please report it to <strong>security@docuplete.com</strong>. We commit to
        acknowledging reports within 48 hours and providing a resolution timeline within 7 business
        days. We ask that you do not publicly disclose findings until a fix is in place.
      </p>

      <h2>Compliance references</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Framework / Regulation</th><th>Relevance</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>GDPR</td>
              <td>Data subject rights (access, erasure, portability), data processing agreements available on request.</td>
            </tr>
            <tr>
              <td>CCPA</td>
              <td>Data deletion and opt-out workflows supported. DPA available on request.</td>
            </tr>
            <tr>
              <td>ESIGN Act / UETA</td>
              <td>E-signatures generated by Docuplete meet ESIGN Act and UETA requirements for electronic records and signatures.</td>
            </tr>
            <tr>
              <td>eIDAS (EU)</td>
              <td>RFC 3161 timestamps satisfy Advanced Electronic Signature (AdES) requirements. Qualified signatures require additional steps — contact your account manager.</td>
            </tr>
            <tr>
              <td>HIPAA</td>
              <td>BAAs are available for Enterprise customers. Docuplete is not itself a HIPAA-covered entity — consult your compliance team before transmitting PHI.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="callout callout-info">
        <strong>Need a Data Processing Agreement (DPA)?</strong> Enterprise customers can request a
        signed DPA by emailing <strong>legal@docuplete.com</strong>.
      </div>
    </div>
  );
}
