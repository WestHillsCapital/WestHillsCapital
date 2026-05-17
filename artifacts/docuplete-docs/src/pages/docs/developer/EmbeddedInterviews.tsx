export default function EmbeddedInterviews() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Embedded & Headless Mode</h1>
        <p className="text-lg text-white/55 mt-2">The Developer plan unlocks two additional ways to use Docuplete beyond the standard shareable client link: embedded iframes and fully headless API-only generation.</p>
      </div>

      <div className="callout callout-info">
        <strong>Developer plan and above.</strong> Embedded and headless modes are available on the Developer ($499/mo) and Enterprise plans.
      </div>

      <h2>Embedded interview (iframe)</h2>
      <p>You can embed the Docuplete client interview directly inside your own web application using a standard HTML <code>{`<iframe>`}</code>. The client fills the form without ever leaving your page.</p>

      <h3>Step 1 — Create a session with embed mode enabled</h3>
      <p>When creating a session via the API, pass <code>embed: true</code>. The response includes an <code>embedUrl</code> specifically designed for iframe rendering:</p>
      <pre>{`const session = await docuplete.sessions.create({
  packageId: "pkg_abc123",
  embed: true,
  prefill: {
    client_name: "Jane Smith",
    email: "jane@example.com",
  },
});

// Use session.embedUrl — not session.interviewUrl — for iframes
console.log(session.embedUrl);`}</pre>

      <h3>Step 2 — Render the iframe</h3>
      <pre>{`<iframe
  src={session.embedUrl}
  allow="camera; clipboard-write"
  style={{ width: "100%", height: "700px", border: "none" }}
/>`}</pre>

      <h3>Step 3 — Listen for completion via postMessage</h3>
      <p>The embedded interview communicates with the parent window via <code>window.postMessage</code>. Add a listener to react when the client submits or exits:</p>
      <pre>{`window.addEventListener("message", (event) => {
  // Always verify the origin before acting on the message
  if (event.origin !== "https://app.docuplete.com") return;

  switch (event.data.type) {
    case "docuplete:submitted":
      // Client completed and submitted the interview.
      // event.data.sessionId — retrieve the session to get submitted values + PDF URL
      console.log("Submitted:", event.data.sessionId);
      break;

    case "docuplete:voided":
      // Client clicked exit without submitting.
      console.log("Client exited without submitting");
      break;

    case "docuplete:error":
      // An error occurred inside the interview.
      console.error("Interview error:", event.data.message);
      break;
  }
});`}</pre>

      <p>After receiving <code>docuplete:submitted</code>, fetch the session from the API to retrieve submitted field values and the generated PDF download URL:</p>
      <pre>{`const completed = await docuplete.sessions.get(event.data.sessionId);
console.log(completed.pdfUrl);      // signed URL, valid 24 hours
console.log(completed.answers);     // submitted field values`}</pre>

      <h2>Headless mode (API-only generation)</h2>
      <p>In headless mode you skip the client interview entirely. You supply all field values via the API and Docuplete generates the filled PDF immediately — no session link is created, no email is sent to any client.</p>
      <p>This is the core Developer plan use case: your own system or form collects the data, and you use Docuplete purely as a PDF generation engine.</p>

      <h3>Generate a PDF directly</h3>
      <pre>{`const result = await docuplete.sessions.generate({
  packageId: "pkg_abc123",
  fields: {
    client_name: "Jane Smith",
    date_of_birth: "1985-04-12",
    loan_amount: 250000,
    agreed_to_terms: true,
  },
});

// result.pdfUrl  — signed download URL, valid for 24 hours
// result.generationId — reference ID for audit and billing
console.log(result.pdfUrl);`}</pre>

      <h2>Quota and billing</h2>
      <p>Both embedded interview submissions and headless generations count as <strong>generations</strong> against your Developer plan quota (500 included per month). The source does not matter — each filled PDF produced is one generation.</p>
      <p>If you routinely exceed 500 generations per month, consider purchasing a <a href="/account/billing">generation pack</a> to pre-purchase additional generations at a predictable rate rather than paying variable overage at the end of each period.</p>

      <h2>Differences from the standard interview link</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Feature</th>
              <th>Standard link</th>
              <th>Embedded iframe</th>
              <th>Headless</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Client fills interview</td><td>✓</td><td>✓</td><td>—</td></tr>
            <tr><td>Stays on your page</td><td>—</td><td>✓</td><td>✓</td></tr>
            <tr><td>Client email sent</td><td>✓</td><td>Configurable</td><td>—</td></tr>
            <tr><td>Session link created</td><td>✓</td><td>✓</td><td>—</td></tr>
            <tr><td>PDF generated on submit</td><td>✓</td><td>✓</td><td>✓ (immediate)</td></tr>
            <tr><td>Counts as a generation</td><td>✓</td><td>✓</td><td>✓</td></tr>
            <tr><td>Plan required</td><td>Any</td><td>Developer+</td><td>Developer+</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
