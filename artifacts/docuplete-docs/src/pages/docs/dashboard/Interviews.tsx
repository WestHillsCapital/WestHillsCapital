import { DocScreenshot } from "@/components/DocScreenshot";

export default function Interviews() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Sessions Dashboard</div>
        <h1>Interviews Tab</h1>
        <p className="text-lg text-white/55 mt-2">Monitor and manage all individual client sessions across your packages.</p>
      </div>

      <p>The Interviews tab shows every session that was created as an individual client link (as opposed to batch runs, which appear in the Batch Runs tab). You can search, filter, sort, and take action on sessions from here.</p>

      <DocScreenshot
        src="/screenshots/interviews-list.svg"
        alt="The Interviews tab showing a searchable table of client sessions with status chips (Generated, In Progress, Pending, Expired), package names, and dates"
        caption="The Interviews tab — status chips make it easy to identify which sessions are waiting on clients, in progress, or completed."
      />

      <h2>Columns</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Column</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>Client name</td><td>As set when creating the session</td></tr>
            <tr><td>Package</td><td>Which package this session was created from</td></tr>
            <tr><td>Status</td><td>pending, in_progress, generated, voided, expired</td></tr>
            <tr><td>Created</td><td>When the session was generated (by you)</td></tr>
            <tr><td>Last activity</td><td>When the client last interacted with the interview</td></tr>
            <tr><td>Submitted</td><td>When the client submitted (if generated)</td></tr>
            <tr><td>Expires</td><td>Expiration date for pending/in-progress sessions</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Filtering</h2>
      <p>Use the filter bar to narrow down sessions by:</p>
      <ul>
        <li><strong>Status</strong> — Show only pending, in_progress, generated, voided, or expired sessions</li>
        <li><strong>Package</strong> — Filter to one specific package</li>
        <li><strong>Date range</strong> — Created within or submitted within a date range</li>
        <li><strong>Created by</strong> — Filter by which team member created the session</li>
      </ul>

      <h2>Searching</h2>
      <p>The search box filters by client name or client email. The search is case-insensitive and matches partial strings.</p>

      <h2>Session detail view</h2>
      <p>Click any session to open its detail view. From there you can:</p>
      <ul>
        <li>View submitted answers</li>
        <li>Download the completed PDF</li>
        <li>Copy the session link</li>
        <li>View the audit trail (for e-sign sessions)</li>
        <li>Void the session</li>
        <li>Send a reminder email to the client (pending/in_progress sessions)</li>
      </ul>

      <h2>Sending reminders</h2>
      <p>For sessions that are <code>pending</code> or <code>in_progress</code>, click <strong>Send Reminder</strong> to email the client their session link again. You can add a custom message to the reminder email. Reminders are rate-limited to once every 24 hours per session.</p>

      <h2>Exporting</h2>
      <p>Click <strong>Export CSV</strong> to download the current filtered view as a spreadsheet. The export includes all columns shown in the table plus the client email and prefill values provided at session creation.</p>
    </div>
  );
}
