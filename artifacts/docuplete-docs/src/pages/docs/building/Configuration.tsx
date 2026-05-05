import { Link } from "wouter";

export default function Configuration() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Building a Package</div>
        <h1>Package Configuration</h1>
        <p className="text-lg text-white/55 mt-2">Package-level settings that control branding, notifications, submission behavior, and more.</p>
      </div>

      <h2>General settings</h2>
      <ul>
        <li><strong>Package name</strong> — Internal name, not shown to clients.</li>
        <li><strong>Description</strong> — Internal notes for your team.</li>
        <li><strong>Status</strong> — Draft, Active, or Archived.</li>
        <li><strong>Tags</strong> — Freeform labels for organizing packages in the dashboard.</li>
      </ul>

      <h2>Branding</h2>
      <p>By default, sessions use your organization's branding configured in <strong>Settings → Branding</strong>. You can override branding per package:</p>
      <ul>
        <li><strong>Logo</strong> — Shown at the top of the client interview.</li>
        <li><strong>Brand color</strong> — Used for buttons and progress indicators in the interview.</li>
        <li><strong>Interview header text</strong> — A short title shown above the first field group (e.g., "New Account Application").</li>
        <li><strong>Footer text</strong> — Shown at the bottom of each interview step (e.g., "Questions? Call us at 800-555-1234").</li>
      </ul>

      <h2>Notifications</h2>
      <ul>
        <li><strong>Notification email(s)</strong> — One or more team email addresses to receive an email when a session is submitted. Multiple addresses separated by commas.</li>
        <li><strong>Client confirmation email</strong> — Whether to send the client an email with a download link to their completed PDF after submission.</li>
      </ul>

      <h2>Submission behavior</h2>
      <ul>
        <li><strong>Redirect URL</strong> — Where to send the client after they submit. Defaults to a Docuplete confirmation page. Set a custom URL to redirect to your website or a thank-you page.</li>
        <li><strong>Allow re-submission</strong> — Whether a client can reopen a completed session and re-submit. Disabled by default.</li>
      </ul>

      <h2>Session settings</h2>
      <ul>
        <li><strong>Expiration window</strong> — Number of days before an unsubmitted session expires. Default: 30 days. Set to 0 for no expiration.</li>
        <li><strong>Require e-sign</strong> — When enabled, all sessions require identity verification before signature fields can be completed.</li>
        <li><strong>Allow anonymous sessions</strong> — Whether sessions can be created without a client email address. When e-sign is required, email is always mandatory.</li>
      </ul>

      <h2>Integrations</h2>
      <p>Per-package integration overrides:</p>
      <ul>
        <li><strong>Google Drive folder</strong> — Override the default Drive destination folder for completed PDFs from this package.</li>
        <li><strong>HubSpot pipeline</strong> — Map submission to a specific HubSpot deal pipeline stage.</li>
        <li><strong>Webhook URL</strong> — Enterprise only. See <Link href="/webhooks/setup">Webhook Setup</Link>.</li>
      </ul>
    </div>
  );
}
