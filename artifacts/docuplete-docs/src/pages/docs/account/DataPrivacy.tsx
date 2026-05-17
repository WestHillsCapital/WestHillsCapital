export default function DataPrivacy() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Account & Settings</div>
        <h1>Data & Privacy</h1>
        <p className="text-lg text-white/55 mt-2">Manage data retention, export your organization's data, and submit deletion requests from <strong>Settings → Data & Privacy</strong>.</p>
      </div>

      <h2>Data retention settings</h2>
      <p>By default, Docuplete retains session data, submitted answers, and generated PDFs for the duration of your subscription. You can configure a shorter retention window at <strong>Settings → Data & Privacy → Retention Policy</strong>.</p>
      <p>Available windows: 30 days, 90 days, 1 year, 3 years, or indefinite (default). Records that exceed the configured window are automatically purged during a nightly cleanup job.</p>

      <div className="callout callout-warning">
        <strong>Purges are permanent.</strong> Data deleted by the retention policy cannot be recovered. Make sure your configured window reflects your actual record-keeping needs and any applicable regulatory requirements before enabling a shorter window.
      </div>

      <h2>Exporting your data</h2>
      <p>You can request a full export of your organization's data at any time. Go to <strong>Settings → Data & Privacy → Export Data</strong> and click <strong>Request Export</strong>.</p>
      <p>The export archive includes:</p>
      <ul>
        <li>All sessions and their submitted field values (JSON)</li>
        <li>Generated PDFs</li>
        <li>Team member list and role assignments</li>
        <li>Package definitions and field configurations</li>
        <li>Session and management audit log entries</li>
      </ul>
      <p>Exports are prepared asynchronously. Docuplete sends an email to the requesting admin when the archive is ready. The download link is valid for 7 days; after that, request a fresh export.</p>

      <div className="callout callout-info">
        Data export is available on all plans. Only organization admins can initiate an export.
      </div>

      <h2>Account deletion (right to erasure)</h2>
      <p>To permanently delete your organization's account and all associated data, go to <strong>Settings → Data & Privacy → Request Account Deletion</strong>. This initiates a 30-day confirmation window before any data is removed.</p>

      <h3>During the confirmation window</h3>
      <ul>
        <li>Your account remains fully active and accessible.</li>
        <li>You will receive email reminders 7 days and 24 hours before the deletion executes.</li>
        <li>You can cancel the request at any time — see below.</li>
      </ul>

      <h3>What is deleted</h3>
      <p>After the 30-day window expires, the following is permanently and irreversibly deleted:</p>
      <ul>
        <li>All sessions, submitted answers, and generated PDFs</li>
        <li>All packages and field configurations</li>
        <li>All team members and their accounts</li>
        <li>Audit logs (session and management)</li>
        <li>Billing history and subscription data</li>
      </ul>
      <p>This satisfies GDPR Article 17 (right to erasure) and CCPA deletion requirements. Your subscription is canceled automatically when deletion executes; any unused prepaid balance is not refunded.</p>

      <div className="callout callout-warning">
        <strong>Export before deleting.</strong> Request a data export before submitting a deletion request if you need to retain records for compliance, auditing, or your own archives.
      </div>

      <h2>Canceling a deletion request</h2>
      <p>To cancel a pending deletion request, go to <strong>Settings → Data & Privacy → Cancel Deletion Request</strong> and confirm. The deletion countdown stops immediately and your account returns to normal operation with no changes made.</p>
    </div>
  );
}
