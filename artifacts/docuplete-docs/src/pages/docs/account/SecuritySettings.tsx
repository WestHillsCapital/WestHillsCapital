export default function SecuritySettings() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Account & Settings</div>
        <h1>Security Settings</h1>
        <p className="text-lg text-white/55 mt-2">Manage two-factor authentication, active sessions, trusted devices, and access logs from <strong>Settings → Security</strong>.</p>
      </div>

      <h2>Two-factor authentication (2FA)</h2>
      <p>All Docuplete users can enable TOTP-based two-factor authentication using any RFC 6238-compatible authenticator app — Google Authenticator, Authy, 1Password, and others.</p>

      <h3>Enabling 2FA</h3>
      <ol>
        <li>Go to <strong>Settings → Security → Two-Factor Authentication</strong>.</li>
        <li>Click <strong>Enable 2FA</strong>. A QR code is displayed.</li>
        <li>Open your authenticator app and scan the QR code. Alternatively, tap <strong>Can't scan?</strong> to copy the setup key and enter it manually.</li>
        <li>Enter the current 6-digit code from your app to confirm the pairing.</li>
        <li>Copy your recovery codes and store them somewhere safe. Each code is single-use and lets you bypass 2FA if you lose access to your authenticator.</li>
      </ol>

      <div className="callout callout-warning">
        <strong>Save your recovery codes.</strong> If you lose your authenticator device and have no recovery codes, you will be locked out of your account. Docuplete support requires identity verification to assist with 2FA recovery.
      </div>

      <h3>Disabling 2FA</h3>
      <p>Go to <strong>Settings → Security → Two-Factor Authentication</strong> and click <strong>Disable 2FA</strong>. You must enter a valid TOTP code from your authenticator to confirm.</p>

      <h3>Organization-wide 2FA enforcement</h3>
      <p>Admins can require 2FA for every member of the organization. Go to <strong>Settings → Security → Require 2FA for all members</strong> and enable the toggle.</p>
      <p>Once enforced, any member who has not yet set up 2FA is prompted at their next login. They cannot access the dashboard until setup is complete. Members who already have 2FA enabled are unaffected.</p>

      <h2>Active sessions</h2>
      <p>Every time you sign in, Docuplete creates a session tied to your device, browser, and IP address. View and manage all active sessions at <strong>Settings → Security → Active Sessions</strong>.</p>
      <p>Each session entry shows:</p>
      <ul>
        <li>Browser and operating system</li>
        <li>IP address and approximate location (city and country)</li>
        <li>Last active timestamp</li>
        <li>Whether this is the session you are currently using</li>
      </ul>
      <p>Click <strong>Revoke</strong> next to any session to sign that device out immediately. The next request from that device will receive a 401 and be redirected to the login page. Use <strong>Revoke all other sessions</strong> to sign out of every device except your current one — useful if you suspect unauthorized access or have lost a device.</p>

      <h2>Trusted devices</h2>
      <p>After completing 2FA on a device, you can mark it as <strong>trusted</strong> to skip the 2FA prompt on future logins from that device for up to 30 days. Trusted devices are listed at <strong>Settings → Security → Trusted Devices</strong>.</p>
      <p>You can remove trust from any listed device at any time. On the next login from that device, 2FA will be required again.</p>

      <div className="callout callout-info">
        Revoking an active session (above) and removing a trusted device are separate actions. Revoking a session signs the device out now. Removing trust only means 2FA will be required on the next login — the current session, if any, is not revoked.
      </div>

      <h2>PDF access log</h2>
      <p>Docuplete records every PDF view and download event — who accessed it, when, from which IP address, and via which surface (dashboard, API response, or client download link). This log is available at <strong>Settings → Security → PDF Access Log</strong>.</p>
      <p>Each log entry includes:</p>
      <ul>
        <li>Actor: team member name or API key identifier</li>
        <li>Action: <code>view</code> or <code>download</code></li>
        <li>Session and package the PDF belongs to</li>
        <li>IP address</li>
        <li>Timestamp (UTC)</li>
      </ul>
      <p>Entries are immutable and retained for a minimum of 12 months. Use this log to demonstrate access controls to auditors or to investigate unusual download patterns after a potential breach.</p>
    </div>
  );
}
