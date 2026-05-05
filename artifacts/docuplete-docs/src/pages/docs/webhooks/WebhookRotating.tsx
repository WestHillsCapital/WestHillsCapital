export default function WebhookRotating() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Webhooks & API</div>
        <h1>Rotating the Secret</h1>
        <p className="text-lg text-white/55 mt-2">Rotate your webhook signing secret without downtime using a dual-secret transition window.</p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> Webhooks are available exclusively on the Enterprise plan.
      </div>

      <h2>When to rotate</h2>
      <p>Rotate your webhook secret if:</p>
      <ul>
        <li>The secret has been accidentally exposed (committed to source code, logged to an external system, etc.)</li>
        <li>A team member who had access to the secret leaves the organization</li>
        <li>As part of a scheduled security rotation policy</li>
      </ul>

      <h2>Zero-downtime rotation process</h2>
      <p>Rotating a secret immediately invalidates the old one, which would break delivery verification until you deploy the new secret to your server. To avoid dropped events during the transition:</p>
      <ol>
        <li>Go to <strong>Package → Configuration → Webhook → Rotate Secret</strong>.</li>
        <li>Docuplete generates a new secret and enters a <strong>dual-secret window</strong>. During this period (configurable: 1–24 hours), Docuplete accepts HMAC verification against <em>either</em> the old or the new secret.</li>
        <li>Update your server's environment variable with the new secret and deploy.</li>
        <li>Once deployed, return to the webhook configuration and click <strong>Complete Rotation</strong>. This immediately invalidates the old secret.</li>
      </ol>

      <div className="callout callout-warning">
        <strong>Complete the rotation:</strong> If you don't click "Complete Rotation", the dual-secret window closes automatically after 24 hours and only the new secret is valid from that point. Don't forget to update your server before this happens.
      </div>

      <h2>Viewing current secret</h2>
      <p>The full secret value is only shown once — immediately after initial setup or after a rotation. If you lose it, you must rotate to generate a new one. There is no way to retrieve the existing secret value after it has been dismissed from the UI.</p>
    </div>
  );
}
