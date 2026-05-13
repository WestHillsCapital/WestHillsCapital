export default function CommonErrors() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Troubleshooting</div>
        <h1>Common Errors</h1>
        <p className="text-lg text-white/55 mt-2">Diagnose and fix the most frequently encountered issues in Docuplete.</p>
      </div>

      <h2>Session errors</h2>

      <h3>"Session not found" when opening a client link</h3>
      <p>This error means the session ID in the URL does not match any active session in Docuplete.</p>
      <ul>
        <li><strong>Most common cause:</strong> The session was voided. Once voided, the public link is permanently invalidated.</li>
        <li><strong>Also check:</strong> The link was copied with a trailing space or truncated by the email client. Confirm the full token is present in the URL.</li>
        <li><strong>If using the API:</strong> Verify the <code>sessionId</code> returned from the session-creation endpoint matches what you embedded in the link.</li>
      </ul>

      <h3>"Session already completed" when client tries to submit</h3>
      <p>Sessions are single-use. Once a client submits, the session is locked. If you need the client to fill it out again, generate a new session from the same package.</p>

      <h3>Client receives a blank or partially rendered form</h3>
      <p>This is almost always a PDF rendering issue:</p>
      <ul>
        <li>The PDF may use fonts that are not embedded. Re-export the source document with all fonts embedded and re-upload.</li>
        <li>Very large PDFs (over 50 MB) may time out during rendering. Compress the PDF before uploading.</li>
        <li>Encrypted or password-protected PDFs are not supported. Remove the password before uploading.</li>
      </ul>

      <h2>Field mapping issues</h2>

      <h3>A field appears in the interview but does not fill in the PDF</h3>
      <p>The field has no mapping on the PDF canvas, or the mapping box is positioned outside the page boundaries.</p>
      <ol>
        <li>Open the package in the Visual Mapper.</li>
        <li>Select the field in the field list on the left.</li>
        <li>Confirm a mapping box appears on the PDF. If not, drag one onto the correct location.</li>
        <li>Make sure the mapping box is fully within the page — boxes clipped by the page edge are ignored.</li>
      </ol>

      <h3>Text is cut off inside the PDF after filling</h3>
      <p>The mapping box is too small for the field value. In the Visual Mapper, select the mapping box and resize it. For long text fields, consider enabling <strong>Multiline</strong> in the field settings and making the box taller.</p>

      <h3>Date field fills in the wrong format</h3>
      <p>By default, dates fill as <code>MM/DD/YYYY</code>. If the PDF requires a different format (e.g., <code>YYYY-MM-DD</code> or <code>Month DD, YYYY</code>), set the <strong>Date Format</strong> in the field's mapping options in the inspector panel.</p>

      <h2>Field library errors</h2>

      <h3>"Cannot edit — field is inherited" message</h3>
      <p>You are viewing a library field from inside a package. Library fields are read-only at the package level by design — edits must be made in <strong>Organization → Field Library</strong>. Changes made there propagate to all packages using the field.</p>

      <h3>"This field is used in X packages" warning on delete</h3>
      <p>Docuplete prevents deletion of library fields that are still linked to packages. Remove the field from each package first (or unlink it in the package's field list), then delete it from the library.</p>

      <h2>PDF upload errors</h2>

      <h3>"Unsupported file type" on upload</h3>
      <p>Only PDF files are accepted. If your document is a Word file, Google Doc, or image, export it to PDF first.</p>

      <h3>"Failed to extract fields" on a fillable PDF</h3>
      <p>Some PDFs with AcroForm fields have malformed or non-standard field definitions that Docuplete cannot parse. Try flattening the PDF's existing form fields (in Acrobat or Preview) before uploading, then map all fields manually using the Visual Mapper.</p>

      <h2>Webhook delivery failures</h2>

      <h3>Events are not arriving at your endpoint</h3>
      <ol>
        <li>Check <strong>Webhooks → Delivery Logs</strong> — Docuplete shows the HTTP status code returned by your server for every delivery attempt.</li>
        <li>Confirm your endpoint returns a <code>2xx</code> status within 10 seconds. Timeouts are treated as failures and trigger the retry schedule.</li>
        <li>Verify the endpoint URL is publicly reachable. Localhost or private-network URLs will always fail in production.</li>
        <li>Check that you are verifying the <code>X-Docuplete-Signature</code> header correctly — an invalid signature check that returns <code>401</code> or <code>403</code> is the most common cause of silent delivery failures.</li>
      </ol>

      <h3>Duplicate events arriving</h3>
      <p>Docuplete retries events that do not receive a <code>2xx</code> response. If your server is processing the event but returning an error code, you may receive the same event multiple times. Make your event handler idempotent using the <code>eventId</code> field in the payload as a deduplication key.</p>

      <div className="callout callout-info">
        <strong>Still stuck?</strong> Contact support with the <strong>Session ID</strong> or <strong>Event ID</strong> — these identifiers let our team pull the full audit trail for your specific issue.
      </div>
    </div>
  );
}
