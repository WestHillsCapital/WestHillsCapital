import { Link } from "wouter";

export default function WebhookRetries() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Webhooks & API</div>
        <h1>Retry Behavior</h1>
        <p className="text-lg text-white/55 mt-2">How Docuplete handles failed webhook deliveries and when to expect retries.</p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> Webhooks are available exclusively on the Enterprise plan.
      </div>

      <h2>What triggers a retry</h2>
      <p>A webhook delivery is considered failed if your server:</p>
      <ul>
        <li>Returns a non-2xx HTTP status code</li>
        <li>Doesn't respond within <strong>10 seconds</strong> (timeout)</li>
        <li>Returns a connection error (refused connection, DNS failure, TLS error)</li>
      </ul>
      <p>A successful delivery requires HTTP 2xx within 10 seconds. The response body is ignored.</p>

      <h2>Retry schedule</h2>
      <p>Docuplete retries failed deliveries with exponential backoff:</p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Attempt</th><th>Delay after previous failure</th></tr>
          </thead>
          <tbody>
            <tr><td>1st retry</td><td>1 second</td></tr>
            <tr><td>2nd retry</td><td>4 seconds</td></tr>
            <tr><td>3rd retry</td><td>16 seconds</td></tr>
          </tbody>
        </table>
      </div>
      <p>After 3 retries (total of 4 delivery attempts), the event is marked as <strong>failed</strong> and no further retries are attempted.</p>

      <h2>Idempotency</h2>
      <p>Because retries re-send the same event, your server may receive the same <code>event_id</code> more than once. Use the <code>event_id</code> field for idempotency — check if you've already processed this ID before taking action.</p>

      <h2>Manual retry</h2>
      <p>From the <Link href="/webhooks/logs">Delivery Logs</Link>, you can manually trigger a retry of any failed event. This is useful after fixing a server error that caused deliveries to fail.</p>

      <h2>Webhook health alerts</h2>
      <p>If your webhook URL fails 3 consecutive deliveries, Docuplete sends an alert email to your organization's admin. If failures continue, the webhook is automatically paused after 24 hours of consecutive failures. You'll need to re-enable it from the package configuration after fixing the issue.</p>
    </div>
  );
}
