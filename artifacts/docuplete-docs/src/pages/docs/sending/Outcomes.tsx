export default function Outcomes() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Sending to Clients</div>
        <h1>Post-Submission Outcomes</h1>
        <p className="text-lg text-white/55 mt-2">What happens immediately after a client submits a session.</p>
      </div>

      <h2>What triggers on submission</h2>
      <p>When a client clicks "Submit" and the session transitions to <code>generated</code>:</p>
      <ol>
        <li><strong>PDF generation</strong> — Docuplete stamps the client's answers onto the PDF template at every mapped position. The filled PDF is stored and available for download immediately.</li>
        <li><strong>Notification email(s)</strong> — Your configured notification recipients receive an email with a link to view the completed session.</li>
        <li><strong>Client confirmation email</strong> — If configured, the client receives a confirmation email with a link to download their completed PDF.</li>
        <li><strong>Google Drive sync</strong> — If the Google Drive integration is connected, the completed PDF is uploaded to the configured folder.</li>
        <li><strong>HubSpot sync</strong> — If the HubSpot integration is connected, the submission creates or updates the associated contact/deal.</li>
        <li><strong>Webhook delivery</strong> — If a webhook URL is configured on the package (Enterprise), Docuplete fires a signed POST with the session data.</li>
      </ol>

      <h2>Client redirect</h2>
      <p>After submission, the client is redirected to the configured <strong>Redirect URL</strong>. If none is set, they see a Docuplete confirmation page with a success message and a download link for their PDF.</p>

      <h2>Viewing the completed PDF</h2>
      <p>Go to the Sessions Dashboard and open the completed session. Click <strong>Download PDF</strong> to get the filled document. You can also view a preview in-browser.</p>

      <h2>Notification email contents</h2>
      <p>The notification email includes:</p>
      <ul>
        <li>Client name and email</li>
        <li>Package name</li>
        <li>Submission timestamp</li>
        <li>Direct link to the session in your Docuplete dashboard</li>
      </ul>

      <h2>Handling errors</h2>
      <p>If PDF generation fails (rare — usually due to a corrupt template or an extremely long answer overflowing all text boxes), the session is flagged with a <code>generation_error</code> state. You'll receive an error notification. Contact support with the session ID and we'll investigate within 1 business day.</p>
    </div>
  );
}
