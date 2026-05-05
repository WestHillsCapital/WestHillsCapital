import { Link } from "wouter";
import { DocScreenshot } from "@/components/DocScreenshot";

export default function BatchOverview() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Batch CSV Import</div>
        <h1>When to Use Batch Import</h1>
        <p className="text-lg text-white/55 mt-2">Generate hundreds of filled PDFs in one operation by uploading a spreadsheet of client data.</p>
      </div>

      <div className="callout callout-info">
        <strong>Pro and Enterprise only.</strong> Batch CSV import is available on Pro ($249/mo) and Enterprise ($3,000/mo) plans.
      </div>

      <h2>What is batch import?</h2>
      <p>Batch import lets you upload a CSV file where each row represents one client. Docuplete generates a separate filled PDF for each row — using the same package template for all of them. The batch run appears in your Sessions Dashboard under the <Link href="/sessions-dashboard/batch-runs">Batch Runs tab</Link>.</p>

      <DocScreenshot
        src="/screenshots/batch-runs-list.svg"
        alt="The Batch Runs tab listing multiple CSV import runs with file names, package names, status chips, success and error counts, and download buttons"
        caption="The Batch Runs tab — every import run is listed with its status, row counts, and download links for completed PDFs."
      />

      <h2>When to use it</h2>
      <ul>
        <li><strong>Annual renewals</strong> — You have a list of existing clients who all need the same disclosure or agreement updated each year.</li>
        <li><strong>Onboarding groups</strong> — A new employer offers your services to their employees; you receive a roster and need to pre-populate each person's application.</li>
        <li><strong>Mass disclosures</strong> — Regulatory filings or disclosures that must be generated for every client in your book of business.</li>
        <li><strong>Bulk account changes</strong> — Beneficiary updates, address changes, or account modifications across many accounts at once.</li>
      </ul>

      <h2>When not to use it</h2>
      <ul>
        <li>When the client needs to review and confirm the data themselves — use individual sessions instead.</li>
        <li>When e-sign is required — batch sessions do not support interactive e-sign (the client is not filling out a form).</li>
        <li>For one-off requests — creating a regular session is faster than preparing a CSV for a single client.</li>
      </ul>

      <h2>Output</h2>
      <p>Each row in the CSV produces a completed PDF (assuming no errors). All PDFs in the batch are available for download individually or as a ZIP archive from the Batch Runs tab. If Google Drive is connected, each PDF is saved to the configured folder automatically.</p>
    </div>
  );
}
