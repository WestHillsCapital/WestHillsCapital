export default function WebhookLogs() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Webhooks & API</div>
        <h1>Delivery Logs</h1>
        <p className="text-lg text-white/55 mt-2">Inspect the full history of webhook delivery attempts for any session.</p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> Webhooks are available exclusively on the Enterprise plan.
      </div>

      <h2>Viewing delivery logs</h2>
      <p>Delivery logs are accessible from two places:</p>
      <ul>
        <li><strong>Package → Configuration → Webhook → View Logs</strong> — All deliveries for that package's webhook.</li>
        <li><strong>Session detail → Webhook Deliveries</strong> — All delivery attempts for one specific session.</li>
      </ul>

      <h2>Log entry details</h2>
      <p>Each delivery attempt shows:</p>
      <ul>
        <li><strong>Event ID</strong> — The unique event identifier</li>
        <li><strong>Attempt</strong> — Which attempt this was (1st, 2nd, etc.)</li>
        <li><strong>Status</strong> — Success, failed, or pending (in-flight)</li>
        <li><strong>HTTP status code</strong> — The status code your server returned (e.g., 200, 500, 0 for timeout)</li>
        <li><strong>Response time</strong> — How long your server took to respond</li>
        <li><strong>Delivered at</strong> — Timestamp of this attempt</li>
        <li><strong>Next retry</strong> — When the next retry is scheduled (for failed events)</li>
      </ul>

      <h2>Inspecting request and response</h2>
      <p>Click any log entry to expand it. You'll see:</p>
      <ul>
        <li>The full request headers and body that Docuplete sent</li>
        <li>The full response headers and body your server returned</li>
      </ul>
      <p>This is invaluable for debugging integration issues — you can see exactly what Docuplete sent and what your server responded.</p>

      <h2>Manual retry</h2>
      <p>On any failed delivery, click <strong>Retry now</strong> to immediately queue a new delivery attempt. The retry uses the original payload — it doesn't re-fetch current session data.</p>

      <h2>Log retention</h2>
      <p>Delivery logs are retained for 30 days. After 30 days, old entries are deleted automatically.</p>
    </div>
  );
}
