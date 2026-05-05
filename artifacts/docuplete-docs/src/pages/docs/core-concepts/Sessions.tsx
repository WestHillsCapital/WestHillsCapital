import { Link } from "wouter";

export default function Sessions() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Core Concepts</div>
        <h1>Sessions</h1>
        <p className="text-lg text-white/55 mt-2">A session is a single client interaction created from a package — a unique link where one client completes and submits their forms.</p>
      </div>

      <p>When you're ready to send a package to a specific client, you create a session. Docuplete generates a unique, unguessable URL. The client opens that URL and completes the interview. When they submit, the session transitions to the <code>generated</code> state and the filled PDF is produced.</p>

      <h2>Session states</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>State</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            <tr><td><code>pending</code></td><td>Session created, not yet opened by the client.</td></tr>
            <tr><td><code>in_progress</code></td><td>Client has opened the link and started the interview (autosave data exists).</td></tr>
            <tr><td><code>generated</code></td><td>Client submitted successfully. Filled PDF is available.</td></tr>
            <tr><td><code>voided</code></td><td>Session was voided by an admin. The client link is no longer accessible.</td></tr>
            <tr><td><code>expired</code></td><td>Session passed its expiration window without being submitted.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Session link behavior</h2>
      <p>The client link is single-use in the sense that it is tied to one session. However, the same link can be opened multiple times (for example, if the client starts on mobile and wants to continue on desktop). Progress is autosaved as the client moves between interview steps.</p>
      <p>Once the session reaches <code>generated</code> or <code>voided</code>, the link becomes inaccessible — the client sees a confirmation or closure message.</p>

      <h2>Prefilling fields</h2>
      <p>When creating a session, you can supply prefill values for any field. Prefilled values appear pre-populated in the interview. Depending on the field's interview mode, the client can edit them or they may be locked as read-only.</p>
      <p>Prefill is useful when you already know some answers from your CRM — for instance, name, date of birth, or account number — and want to reduce the client's input burden.</p>

      <h2>Expiration</h2>
      <p>Sessions expire after a configurable number of days if not submitted. The default is 30 days; packages can override this in their configuration. An expiration warning email is sent to the client 3 days before expiration if an email address was provided.</p>

      <div className="callout callout-tip">
        <strong>Re-sending:</strong> If a session expires or you need to send a fresh link, simply create a new session from the same package. You can prefill any known data again.
      </div>

      <h2>E-sign sessions</h2>
      <p>If the package requires e-sign, the session includes an additional identity verification step before the client can apply a signature. See <Link href="/sending-to-clients/esign">E-Sign Identity Verification</Link> for details.</p>
    </div>
  );
}
