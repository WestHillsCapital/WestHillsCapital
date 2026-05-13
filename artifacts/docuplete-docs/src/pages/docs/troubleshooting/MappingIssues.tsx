export default function MappingIssues() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Troubleshooting</div>
        <h1>Mapping Issues</h1>
        <p className="text-lg text-white/55 mt-2">Diagnose problems with fields not filling, misaligned text, and unexpected output in the completed PDF.</p>
      </div>

      <h2>Diagnosis checklist</h2>
      <p>Work through these in order before looking at specific scenarios below:</p>
      <ol>
        <li>Open the package in the Visual Mapper and confirm every field you expect to fill has a mapping box on the canvas.</li>
        <li>Generate a test session and complete the interview. Download the result and compare it to the expected output.</li>
        <li>Check the field's <strong>Format</strong> setting in the inspector — dates, currencies, and SSNs all have format options that affect output.</li>
        <li>Confirm the mapping box is fully within the page boundaries and not overlapping the page edge.</li>
        <li>Check the field's <strong>Active</strong> toggle — inactive fields are excluded from the interview and the PDF output.</li>
      </ol>

      <h2>Field fills in the wrong position</h2>
      <p>The PDF was re-uploaded or replaced after the mapping was created. When you replace a PDF, existing mapping coordinates are preserved but the new PDF may have different page dimensions or layout. You will need to manually reposition affected mapping boxes.</p>
      <p>To avoid this: when making minor edits to a PDF (text changes, watermarks, branding), use the same page size and do not shift the content area. Only replace the PDF when the layout changes significantly, and plan to re-verify all mappings afterward.</p>

      <h2>Field fills but text overflows the box</h2>
      <p>The font size in the mapping box is fixed to the box height by default. If the value is too long:</p>
      <ul>
        <li>Enable <strong>Multiline</strong> in the field inspector and increase the box height to accommodate wrapping text.</li>
        <li>Set a <strong>Max Length</strong> validation on the field to limit how many characters clients can enter.</li>
        <li>If the PDF has a fixed-size box that cannot change, set the font size explicitly in the mapping options to match the original PDF's font size so auto-sizing does not apply.</li>
      </ul>

      <h2>Checkboxes are not checked in the output</h2>
      <p>Checkbox mapping requires a <strong>Check Value</strong> to be set in the mapping inspector. This is the value that, when matched against the field's filled value, marks the box as checked. Common values are <code>Yes</code>, <code>true</code>, <code>X</code>, or the specific option text.</p>
      <p>If you have a checkbox group (multiple boxes for one field), each box needs its own mapping with a different check value matching its corresponding option.</p>

      <h2>Radio buttons only partially fill</h2>
      <p>Each radio option needs a separate mapping box on the PDF, each with a <strong>Check Value</strong> matching the option text exactly (case-sensitive). If an option is spelled differently in the field definition vs. the check value, it will not match.</p>

      <h2>Date appears as numbers instead of formatted text</h2>
      <p>The <strong>Date Format</strong> in the mapping options controls how the date is rendered. The default is <code>MM/DD/YYYY</code>. Change this to match whatever format the PDF expects. Available tokens:</p>
      <ul>
        <li><code>MM</code> — zero-padded month (01–12)</li>
        <li><code>M</code> — month without padding (1–12)</li>
        <li><code>DD</code> — zero-padded day</li>
        <li><code>D</code> — day without padding</li>
        <li><code>YYYY</code> — four-digit year</li>
        <li><code>YY</code> — two-digit year</li>
        <li><code>MMMM</code> — full month name (January, February, …)</li>
        <li><code>MMM</code> — abbreviated month name (Jan, Feb, …)</li>
      </ul>

      <h2>Signature does not appear in the output</h2>
      <p>E-sign fields require the client to complete identity verification before signing. If the client skipped or failed verification, the signature step is not unlocked and no signature is written to the PDF. Check the session audit log to see whether verification was completed.</p>

      <h2>Multi-page PDF: field only fills on one page</h2>
      <p>Mapping boxes are per-page. If the same field needs to fill on multiple pages (e.g., initials on every page), create a mapping box for the field on each page. You can use the same field — it just needs multiple mappings, one per page location.</p>

      <div className="callout callout-warning">
        <strong>After any mapping change:</strong> Always generate a fresh test session to verify the output PDF. The preview in the mapper shows positions but does not render the filled values.
      </div>
    </div>
  );
}
