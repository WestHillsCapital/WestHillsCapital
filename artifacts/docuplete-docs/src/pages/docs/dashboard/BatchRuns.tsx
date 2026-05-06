import { DocScreenshot } from "@/components/DocScreenshot";

export default function BatchRuns() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Sessions Dashboard</div>
        <h1>Batch Runs Tab</h1>
        <p className="text-lg text-white/55 mt-2">Track and download results from all your batch CSV import runs.</p>
      </div>

      <p>The Batch Runs tab lists every CSV import run across all packages. Each row is one batch run with its overall status, progress, and a link to the detailed results.</p>

      <DocScreenshot
        src="/screenshots/batch-runs-dashboard.png"
        alt="The Batch Runs tab showing a table of import runs with status chips (Completed, Processing, Queued), progress bars, and success/error counts"
        caption="The Batch Runs tab — status chips and progress bars give you an at-a-glance view of every import run across all packages."
      />

      <h2>Batch run list columns</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Column</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>Name</td><td>The file name of the uploaded CSV</td></tr>
            <tr><td>Package</td><td>Which package template was used</td></tr>
            <tr><td>Status</td><td>queued, processing, completed, completed_with_errors, failed</td></tr>
            <tr><td>Progress</td><td>X of Y rows processed (shown as a progress bar during processing)</td></tr>
            <tr><td>Success / Error</td><td>Count of successful and failed rows after completion</td></tr>
            <tr><td>Started</td><td>When processing began</td></tr>
            <tr><td>Completed</td><td>When processing finished</td></tr>
            <tr><td>Created by</td><td>Team member who uploaded the file</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Batch run detail view</h2>
      <p>Click any batch run to open its detail view. You'll see a per-row breakdown:</p>
      <ul>
        <li>Each row's status (success or error)</li>
        <li>The client name for that row</li>
        <li>A download link for the generated PDF (success rows)</li>
        <li>The error message (error rows)</li>
      </ul>

      <h2>Downloading output</h2>
      <ul>
        <li><strong>Download all PDFs (ZIP)</strong> — All successfully generated PDFs in one archive. Available once the run has at least one successful row.</li>
        <li><strong>Download individual PDF</strong> — Click the download icon on any successful row.</li>
        <li><strong>Download error report (CSV)</strong> — A copy of the input CSV for failed rows only, with an <code>_error</code> column explaining each failure.</li>
      </ul>

      <h2>Batch run retention</h2>
      <p>Batch runs and their generated PDFs are retained for 90 days by default. After 90 days, the run history is still shown but the PDF downloads are removed. Download your files or enable Google Drive sync to ensure permanent storage.</p>

      <div className="callout callout-info">
        <strong>Enterprise:</strong> On Enterprise plans, retention can be extended to 1 year or indefinitely. Contact your account manager to configure extended retention.
      </div>
    </div>
  );
}
