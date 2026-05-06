import { Link } from "wouter";
import { DocScreenshot } from "@/components/DocScreenshot";

export default function SendingSessions() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Sending to Clients</div>
        <h1>Generating a Session</h1>
        <p className="text-lg text-white/55 mt-2">Create a unique client link from any active package in seconds.</p>
      </div>

      <h2>From the dashboard</h2>
      <ol>
        <li>Open the package you want to send.</li>
        <li>Click <strong>Create Session</strong>.</li>
        <li>Fill in the client details form:
          <ul>
            <li><strong>Client name</strong> — Used to identify the session in your dashboard.</li>
            <li><strong>Client email</strong> — Required if the package requires e-sign or if you want expiration reminder emails sent.</li>
            <li><strong>Prefill values</strong> — Any fields you want pre-populated (optional).</li>
            <li><strong>Expiration</strong> — Override the package default if needed.</li>
          </ul>
        </li>
        <li>Click <strong>Generate Link</strong>.</li>
        <li>Copy the link and send it to the client via email, text, your CRM, or any other channel.</li>
      </ol>

      <DocScreenshot
        src="/screenshots/create-session-dialog.png"
        alt="The Create Session dialog showing fields for client name, client email, expiration, and optional prefill values, with a Generate Link button"
        caption="The Create Session dialog — enter the client details, optionally pre-populate known fields, then generate and copy the unique link."
      />

      <div className="callout callout-tip">
        <strong>Directly from the Sessions tab:</strong> You can also click <strong>New Session</strong> in the Sessions Dashboard and search/select the package from there — useful when managing many sessions across multiple packages.
      </div>

      <h2>Prefilling field values</h2>
      <p>Prefill saves the client time by pre-populating fields you already know. When creating the session, expand <strong>Prefill Fields</strong> and enter values for any fields you have. Prefilled required fields still show up in the interview (unless they're set to "Read-only") — the client can confirm and change them if needed.</p>

      <h2>Sharing the link</h2>
      <p>The session link is a direct URL — no login or app download required on the client side. You can:</p>
      <ul>
        <li>Paste it into your email client</li>
        <li>Embed it as a hyperlink in a client portal</li>
        <li>Send it as a text message</li>
        <li>Include it in your CRM workflow automation</li>
      </ul>

      <h2>Tracking sessions</h2>
      <p>After generating the link, the session appears in your <Link href="/sessions-dashboard/interviews">Sessions Dashboard</Link> with status <code>pending</code>. It transitions to <code>in_progress</code> when the client opens the link and to <code>generated</code> when they submit.</p>

      <h2>One session per client per submission</h2>
      <p>Each session link is unique to one client interaction. If you need to send the same package to multiple clients, create a separate session for each client — do not share a single link across clients.</p>
    </div>
  );
}
