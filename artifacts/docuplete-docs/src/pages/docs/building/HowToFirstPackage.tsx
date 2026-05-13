export default function HowToFirstPackage() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Building a Package</div>
        <h1>How To: Build Your First Package</h1>
        <p className="text-lg text-white/55 mt-2">A step-by-step walkthrough — from a blank PDF to a client-ready session link — in under 30 minutes.</p>
      </div>

      <div className="callout callout-info">
        <strong>Before you start:</strong> Have the PDF you want to use ready on your computer. If it's a fillable PDF (AcroForm), Docuplete will detect the existing fields and give you a head start. If it's a flat (non-fillable) PDF, you'll place all fields manually.
      </div>

      <h2>Step 1 — Create a package</h2>
      <ol>
        <li>Go to <strong>DocuFill → Packages</strong> in the main sidebar.</li>
        <li>Click <strong>New Package</strong>.</li>
        <li>Give it a name that describes the document set — "IRA Application", "Client Onboarding", "Account Transfer". This name is internal only and never shown to clients.</li>
        <li>Click <strong>Create</strong>.</li>
      </ol>

      <h2>Step 2 — Upload your PDF</h2>
      <ol>
        <li>Inside your new package, click <strong>Add Document</strong>.</li>
        <li>Select your PDF. Upload completes in a few seconds for most files.</li>
        <li>If Docuplete detects AcroForm fields, it will ask whether to import them automatically. Accept this — it saves significant time on step 4.</li>
      </ol>
      <p>You can add multiple PDFs to a package if your workflow involves several forms that always go together (e.g., the application plus the beneficiary form plus the agreement). All documents in a package are filled in a single client session.</p>

      <h2>Step 3 — Review imported fields (fillable PDFs only)</h2>
      <p>If your PDF had AcroForm fields, Docuplete extracted them into your package's field list. Review each one:</p>
      <ul>
        <li>Check that the <strong>label</strong> makes sense as a client-facing question. AcroForm field names are often technical ("SSN_1", "Addr_Line2") — rename them to plain language.</li>
        <li>Set the correct <strong>field type</strong> (text, radio, checkbox, dropdown) for each field.</li>
        <li>Add <strong>validation</strong> where appropriate — set SSN fields to SSN validation, email fields to email validation, etc.</li>
        <li>Mark sensitive fields (SSN, date of birth) as <strong>Sensitive</strong> so they are masked in the sessions dashboard.</li>
      </ul>

      <h2>Step 4 — Add fields for flat PDFs</h2>
      <p>If your PDF is flat (no AcroForm), you'll define every field manually before mapping it:</p>
      <ol>
        <li>Click <strong>Add Field</strong> in the fields panel.</li>
        <li>Set the label, type, and validation.</li>
        <li>Repeat for every piece of information you need to collect.</li>
      </ol>
      <p><strong>Tip:</strong> If any of these fields are standard identifiers (name, SSN, address), check whether they already exist in your <strong>Field Library</strong> first. Importing from the library is faster than creating from scratch, and you get the benefit of consistent validation and formatting across all packages.</p>

      <h2>Step 5 — Map fields to the PDF</h2>
      <ol>
        <li>Click <strong>Open Mapper</strong> to enter the Visual Mapper.</li>
        <li>Your fields appear in the left panel. The PDF renders in the center.</li>
        <li>Drag each field from the left panel onto the correct location on the PDF. A mapping box appears where you drop it.</li>
        <li>Resize the box to match the available space in the PDF.</li>
        <li>For checkboxes and radio buttons: place a box on each selectable area, then set the <strong>Check Value</strong> in the right panel to the option text that should mark it.</li>
        <li>When all fields are placed, click <strong>Save</strong>.</li>
      </ol>

      <div className="callout callout-warning">
        <strong>Verify every field:</strong> After mapping, generate a test session (step 7) and fill it out yourself before sending it to any real client. Mapping errors are easiest to catch when you're the one answering the questions.
      </div>

      <h2>Step 6 — Configure the package</h2>
      <p>Open <strong>Package Settings</strong> and review:</p>
      <ul>
        <li><strong>Session expiry</strong> — how many days a client has to complete the form before the link expires.</li>
        <li><strong>Authentication</strong> — whether clients need to verify their identity before accessing the form (none, email, or PIN).</li>
        <li><strong>E-sign settings</strong> — if your package includes signature fields, choose the identity verification method required before signing.</li>
        <li><strong>Completion redirect</strong> — optionally send the client to a specific URL after they submit.</li>
      </ul>

      <h2>Step 7 — Test with a real session</h2>
      <ol>
        <li>Go to <strong>Sessions → New Session</strong>.</li>
        <li>Select your package.</li>
        <li>Enter your own name and email as the client.</li>
        <li>Copy the session link and open it in a private browser window (so you see exactly what a client sees).</li>
        <li>Complete the interview, sign if applicable, and submit.</li>
        <li>Return to the sessions dashboard and download the completed PDF. Verify every field filled correctly and is positioned properly.</li>
      </ol>
      <p>Fix any mapping issues in the Visual Mapper, save, and repeat the test until the output is exactly right. Each test takes only a few minutes and is the only reliable way to catch positioning or formatting problems before a real client encounters them.</p>

      <h2>Step 8 — Send to a real client</h2>
      <p>Once your test session looks correct:</p>
      <ol>
        <li>Generate a new session for your actual client.</li>
        <li>Send them the link — by email, SMS, or however you communicate with clients.</li>
        <li>Monitor completion status in the <strong>Sessions</strong> dashboard.</li>
        <li>When the client submits, you'll receive a webhook event (if configured) and the completed PDF will be available for download.</li>
      </ol>

      <div className="callout callout-info">
        <strong>Next step:</strong> If you'll be sending the same package to many clients at once, see <a href="/batch-csv/overview">Batch CSV Import</a> to generate hundreds of sessions in one upload.
      </div>
    </div>
  );
}
