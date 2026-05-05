export default function Voiding() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Sending to Clients</div>
        <h1>Voiding a Session</h1>
        <p className="text-lg text-white/55 mt-2">Cancel a pending or in-progress session so the client link no longer works.</p>
      </div>

      <h2>When to void a session</h2>
      <ul>
        <li>You sent the link to the wrong person or with the wrong prefill data</li>
        <li>The client no longer needs to complete the forms</li>
        <li>You need to send an updated version (create a new session after voiding)</li>
        <li>The client's email address was wrong and e-sign verification is failing</li>
      </ul>

      <h2>How to void</h2>
      <ol>
        <li>Open the session in the Sessions Dashboard.</li>
        <li>Click <strong>⋯ → Void Session</strong>.</li>
        <li>Optionally enter a reason (internal note, not shown to the client).</li>
        <li>Confirm the void.</li>
      </ol>
      <p>The session immediately transitions to <code>voided</code>. If the client tries to open the link, they see a message: "This link is no longer active. Please contact [your organization name] for assistance."</p>

      <h2>Voiding a completed session</h2>
      <p>You can void a session that has already reached <code>generated</code> status. This does not delete the completed PDF — it remains accessible to you in the dashboard — but the session is marked voided and no further changes can be made. This is useful for compliance recordkeeping when a transaction is subsequently cancelled.</p>

      <div className="callout callout-warning">
        <strong>Irreversible:</strong> Voided sessions cannot be un-voided. If the client needs to complete the form, create a new session from the same package.
      </div>

      <h2>Mass voiding (bulk action)</h2>
      <p>In the Sessions Dashboard, you can select multiple sessions and use the <strong>Bulk Actions → Void</strong> option to void them all at once. Useful for cleaning up expired demo sessions or cancelling a batch of sessions that were created in error.</p>
    </div>
  );
}
