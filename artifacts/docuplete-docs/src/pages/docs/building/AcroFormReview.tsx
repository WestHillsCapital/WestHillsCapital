export default function AcroFormReview() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Building a Package</div>
        <h1>Fillable PDF Import &amp; Field Review</h1>
        <p className="text-lg text-white/55 mt-2">
          When you upload a PDF with existing form fields, Docuplete detects every field automatically and positions it on the page. The Field Review step lets you confirm each field's identity before anything is saved.
        </p>
      </div>

      <h2>How AcroForm detection works</h2>
      <p>
        Standard fillable PDFs store form field metadata in a structure called an <strong>AcroForm</strong> — a list of fields with their names, types (text, checkbox, signature, date, etc.), and exact page coordinates. When Docuplete processes your upload, it reads this metadata and overlays each detected field on the Visual Mapper automatically.
      </p>
      <p>
        This means you start with field positions already placed. The review step is not about re-placing fields — it's about telling Docuplete which field in your <strong>global field library</strong> each detected AcroForm field corresponds to.
      </p>

      <div className="callout callout-info">
        <strong>No AcroForm data?</strong> If your PDF is a flat or scanned document (no embedded fields), detection doesn't apply. You'll place fields manually using the Visual Mapper. The review step only appears when at least one AcroForm field is detected.
      </div>

      <h2>The review step — walkthrough</h2>
      <p>After uploading a fillable PDF, the review panel opens automatically. It shows every detected field alongside the relevant section of the document. For each field:</p>

      <ol>
        <li>
          <strong>See the detected field name.</strong> This is the name the PDF author assigned — it might be clean (<code>FirstName</code>) or opaque (<code>field_12</code>, <code>Text23</code>).
        </li>
        <li>
          <strong>See a suggested match from your field library.</strong> Docuplete compares the detected field name to your existing global fields and surfaces the closest match. Common names like <code>Email</code>, <code>DateOfBirth</code>, or <code>SSN</code> will usually match confidently. Ambiguous names like <code>PrintedName</code>, <code>AccountHolder</code>, or <code>Signer</code> will show lower-confidence suggestions or no suggestion at all.
        </li>
        <li>
          <strong>Confirm, reassign, or skip.</strong> Click <strong>Confirm</strong> to accept the suggestion, select a different field from your library, create a new library field, or mark the field as unused if it shouldn't appear in the interview.
        </li>
        <li>
          <strong>Proceed to the next field.</strong> The panel steps through each detected field in reading order (top-to-bottom, page-by-page).
        </li>
      </ol>

      <p>
        Once all fields are reviewed, click <strong>Save mappings</strong>. Docuplete creates the field set for this document with every mapping explicitly confirmed. No field goes live without your sign-off.
      </p>

      <div className="callout callout-warning">
        <strong>Why no auto-mapping?</strong> Field names in AcroForms are set by the PDF author and are context-dependent. <code>PrintedName</code> could mean the client's name, a cosigner's name, or an authorized representative — depending on the document. Docuplete suggests but never silently maps, because a wrong field in the wrong place on a legal or financial document is a compliance issue, not a UI bug.
      </div>

      <h2>Handling ambiguous field names</h2>
      <p>Some field names are genuinely ambiguous. Here's how to handle the most common cases:</p>

      <table>
        <thead>
          <tr>
            <th>AcroForm field name</th>
            <th>What to check before confirming</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>PrintedName</code> / <code>Printed_Name</code></td>
            <td>Is this the client's full name as it should appear printed (not signed)? Which party does it belong to — the client, a witness, or a cosigner?</td>
          </tr>
          <tr>
            <td><code>Signer</code> / <code>SignerName</code></td>
            <td>Is this the primary signer or a specific named party? For multi-party documents, confirm which signing order position this field belongs to.</td>
          </tr>
          <tr>
            <td><code>AccountHolder</code> / <code>Account_Holder</code></td>
            <td>Is this the person filling out the form, or a referenced account owner (who might be different from the signer)?</td>
          </tr>
          <tr>
            <td><code>Date</code> / <code>Date1</code> / <code>SignatureDate</code></td>
            <td>Is this the date of signing (auto-filled at submission time) or a date the client should provide (like a date of birth or effective date)?</td>
          </tr>
          <tr>
            <td><code>field_1</code> / <code>Text23</code></td>
            <td>These are placeholder names with no semantic meaning. Look at the field's position on the document and its label text to determine the correct library field.</td>
          </tr>
        </tbody>
      </table>

      <h2>After confirmation</h2>
      <p>Once the review is complete:</p>
      <ul>
        <li>All confirmed fields appear in the Visual Mapper at their detected positions — no manual placement required.</li>
        <li>Each field is linked to its global library entry, so any future edits to that library field (label changes, validation rules, conditional logic) apply automatically to this document.</li>
        <li>Fields you marked as unused are visible in the mapper but excluded from the interview and from PDF output.</li>
        <li>The package is ready to configure — interview logic, reminders, e-sign setup, and sending behavior are all available immediately.</li>
      </ul>

      <h2>Re-running detection on a replaced document</h2>
      <p>
        If you replace the PDF for an existing document (for example, when a new version of a form is released), Docuplete re-detects all AcroForm fields and opens the review panel again. Fields whose names match previously confirmed mappings are pre-confirmed — you only need to review new or changed fields.
      </p>

      <div className="callout callout-info">
        <strong>Tip — building a template library:</strong> If your firm uses the same 20 PDF templates repeatedly, run each through the review step once. After that, re-uploading any of those templates (or a new version) is mostly a confirmation pass — most fields will be pre-matched from prior review history.
      </div>

      <h2>What carries over from the original AcroForm</h2>
      <p>Docuplete reads the following from embedded AcroForm data:</p>
      <ul>
        <li><strong>Field name</strong> — used to suggest global library matches</li>
        <li><strong>Field type</strong> — text, checkbox, radio button, date, signature</li>
        <li><strong>Field position &amp; size</strong> — used to pre-place the field on the page</li>
        <li><strong>Multi-line flag</strong> — text fields marked as multi-line in the AcroForm are imported as multiline Docuplete fields</li>
        <li><strong>Read-only flag</strong> — fields the PDF author marked read-only are flagged during review so you can decide whether to expose them in the interview</li>
      </ul>
      <p>Docuplete does <em>not</em> carry over AcroForm validation rules, calculation scripts, or JavaScript — those are replaced by Docuplete's own validation and conditional logic system.</p>
    </div>
  );
}
