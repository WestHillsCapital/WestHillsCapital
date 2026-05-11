import { Link } from "wouter";
import { DocScreenshot } from "@/components/DocScreenshot";

export default function QuickStart() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Getting Started</div>
        <h1>Quick Start</h1>
        <p className="text-lg text-white/55 mt-2">From zero to your first filled PDF in under 10 minutes.</p>
      </div>

      <div className="callout callout-tip">
        <strong>Before you begin:</strong> You'll need a PDF template you already use — an intake form, application, or agreement. Any standard PDF works.
      </div>

      <h2>Step 1: Create a package</h2>
      <p>In the Docuplete dashboard, click <strong>New Package</strong>. Give it a name (e.g., "New Client Intake") and click <strong>Create</strong>.</p>
      <p>A package is your reusable template. You'll upload your PDF and configure how it works here.</p>

      <h2>Step 2: Upload your PDF</h2>
      <p>On the package page, click <strong>Upload PDF</strong> and select your document. Docuplete accepts any standard PDF. Once uploaded, you'll see a preview of the document pages.</p>

      <DocScreenshot
        src="/screenshots/quickstart-upload.png"
        alt="The Documents tab showing the PDF upload drop zone and an existing uploaded document"
        caption="Drag and drop your PDF or click Browse — Docuplete accepts any standard PDF up to 50 MB."
      />

      <div className="callout callout-info">
        <strong>Multiple documents:</strong> A single package can contain multiple PDFs. All documents in the package are filled together from one client interview.
      </div>

      <h2>Step 3: Add fields</h2>
      <p>Switch to the <strong>Fields</strong> tab. Click <strong>Add Field</strong> to define what information you want to collect from the client. For each field you'll set:</p>
      <ul>
        <li><strong>Label</strong> — What the client sees (e.g., "Full Legal Name")</li>
        <li><strong>Type</strong> — Text, checkbox, dropdown, radio group, date, etc.</li>
        <li><strong>Interview mode</strong> — Required, optional, read-only, or omitted</li>
      </ul>
      <p>You can add as many fields as you need. The client will be asked each field in sequence during the interview.</p>

      <h2>Step 4: Map fields to the PDF</h2>
      <p>Switch to the <strong>Mapper</strong> tab. This is the visual canvas where you place answer boxes on the PDF. For each field:</p>
      <ol>
        <li>Select the field from the list on the left</li>
        <li>Click or drag a box on the PDF where the answer should appear</li>
        <li>Optionally set the alignment and format (e.g., uppercase, currency)</li>
      </ol>
      <p>One field can be mapped to multiple positions across multiple documents — useful for names, dates, or any value that appears more than once.</p>

      <DocScreenshot
        src="/screenshots/quickstart-mapper.png"
        alt="The Visual Mapper showing a PDF with blue bounding boxes placed on form fields, with the field list on the left and formatting options on the right"
        caption="The Visual Mapper — drag boxes onto the PDF to tell Docuplete exactly where each answer should appear. Numbered callouts indicate fields mapped to multiple locations."
      />

      <h2>Step 5: Send a client link</h2>
      <p>When your package is ready, click <strong>Create Session</strong>. Docuplete generates a unique link for this client. Copy the link and send it however you prefer — email, text, your CRM.</p>
      <p>The client opens the link and is guided through the interview. No account or app required.</p>

      <DocScreenshot
        src="/screenshots/quickstart-interview.png"
        alt="The client-facing interview screen showing a clean form with labeled fields, a progress bar, and a Continue button"
        caption="What your client sees — a clean, branded step-by-step interview. No blank PDFs, no confusing legal forms."
      />

      <h2>Step 6: Get the completed PDF</h2>
      <p>When the client submits, Docuplete generates the filled PDF and notifies you by email. Open the session in your dashboard and click <strong>Download PDF</strong>.</p>
      <p>The filled document is also stored in your Sessions view, searchable and accessible any time.</p>

      <DocScreenshot
        src="/screenshots/quickstart-download.png"
        alt="The session detail page showing submitted answers and a Download PDF button"
        caption="The session detail view — review submitted answers and download the completed PDF with one click."
      />

      <div className="callout callout-tip">
        <strong>Next steps:</strong> Once you're comfortable with the basics, explore <Link href="/core-concepts/fields">fields and interview logic</Link>, <Link href="/building-a-package/esign-fields">e-sign fields</Link>, or <Link href="/batch-csv/overview">batch CSV import</Link> for high-volume workflows.
      </div>
    </div>
  );
}
