import { DocScreenshot } from "@/components/DocScreenshot";

export default function Channels() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Account & Settings</div>
        <h1>Channel Defaults</h1>
        <p className="text-lg text-white/55 mt-2">Configure default notification and communication channels for your organization.</p>
      </div>

      <h2>What are channels?</h2>
      <p>Channels control where Docuplete sends notifications — to your team when a session is submitted, and to clients when they receive or complete their interview. Channel defaults are set at the organization level and can be overridden per package.</p>

      <DocScreenshot
        src="/screenshots/channels-config.svg"
        alt="The Channel Defaults settings page showing three sections: Team Notifications with Email/Slack/Both radio options, Client Confirmation with a toggle, and Expiration Reminder with a toggle"
        caption="Channel defaults — configure team notifications, client confirmations, and expiration reminders all in one place. Each setting can be overridden per package."
      />

      <h2>Team notification channel</h2>
      <p>Where your team is notified when a client submits a session:</p>
      <ul>
        <li><strong>Email</strong> — Notification sent to configured recipient addresses. This is the default and always available.</li>
        <li><strong>Slack</strong> — Post a message to a configured Slack channel. Connect your Slack workspace in <strong>Settings → Integrations → Slack</strong>.</li>
        <li><strong>Both</strong> — Email and Slack simultaneously.</li>
      </ul>

      <h2>Default notification recipients</h2>
      <p>Set the default email addresses that receive submission notifications. These apply to all packages unless overridden. You can set:</p>
      <ul>
        <li>Specific team member emails</li>
        <li>A distribution list or shared inbox (e.g., <code>documents@yourfirm.com</code>)</li>
        <li>Up to 10 recipient addresses per package</li>
      </ul>

      <h2>Client confirmation channel</h2>
      <p>Whether and how to notify clients after they submit:</p>
      <ul>
        <li><strong>Email confirmation</strong> — Send the client a confirmation email with a download link for their completed PDF. Requires a client email address on the session.</li>
        <li><strong>No confirmation</strong> — Client sees the confirmation screen only. No email sent.</li>
      </ul>

      <h2>Expiration reminder</h2>
      <p>Configure whether Docuplete automatically sends a reminder email to the client 3 days before their session expires. This helps reduce the number of sessions that expire before submission.</p>
      <ul>
        <li><strong>Enabled</strong> (default) — Reminder sent 3 days before expiration if client email is available and session is still pending/in_progress.</li>
        <li><strong>Disabled</strong> — No automatic reminder sent.</li>
      </ul>

      <h2>Slack notifications</h2>
      <p>Slack notifications include:</p>
      <ul>
        <li>Client name and package name</li>
        <li>Submission timestamp</li>
        <li>A deep link directly to the session in Docuplete</li>
      </ul>
      <p>Configure which Slack channel receives notifications in <strong>Settings → Integrations → Slack → Channel</strong>. Per-package Slack channel overrides are available.</p>
    </div>
  );
}
