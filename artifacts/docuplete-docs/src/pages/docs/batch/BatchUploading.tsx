import { Link } from "wouter";
import { DocScreenshot } from "@/components/DocScreenshot";

export default function BatchUploading() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Batch CSV Import</div>
        <h1>Uploading & Reviewing Results</h1>
        <p className="text-lg text-white/55 mt-2">Submit your batch file and monitor progress in real time.</p>
      </div>

      <h2>Uploading the CSV</h2>
      <ol>
        <li>Open the package and click <strong>Batch Import → Upload CSV</strong>.</li>
        <li>Select or drag-and-drop your CSV file.</li>
        <li>Docuplete validates the file structure (headers, row count, file size) immediately. Fix any structural errors before proceeding.</li>
        <li>You'll see a preview of the first 5 rows. Review the column mapping to confirm data looks correct.</li>
        <li>Click <strong>Start Batch Run</strong>.</li>
      </ol>

      <DocScreenshot
        src="/screenshots/batch-upload-step.png"
        alt="The batch upload screen showing a drag-and-drop zone at the top and a preview table of the first five CSV rows below, with a Start Batch Run button"
        caption="Before starting, review the first five rows to confirm column mapping looks correct — catch data issues before they become errors."
      />

      <h2>Monitoring progress</h2>
      <p>After starting, the batch run appears in the <Link href="/sessions-dashboard/batch-runs">Batch Runs tab</Link> with a real-time progress indicator:</p>
      <ul>
        <li><strong>Queued</strong> — Waiting to start (usually seconds).</li>
        <li><strong>Processing</strong> — PDFs are being generated. You can see X of Y completed in real time.</li>
        <li><strong>Completed</strong> — All rows processed. Summary shows successes and failures.</li>
        <li><strong>Completed with errors</strong> — Some rows failed. A per-row error report is available for download.</li>
      </ul>

      <h2>Downloading results</h2>
      <p>Once the run completes:</p>
      <ul>
        <li><strong>Download all (ZIP)</strong> — All successfully generated PDFs in a single archive.</li>
        <li><strong>Download individual</strong> — Click any row in the batch run detail to download that client's PDF.</li>
        <li><strong>Error report (CSV)</strong> — Download a CSV listing every failed row with the error reason.</li>
      </ul>

      <h2>Google Drive sync</h2>
      <p>If Google Drive is connected, all successfully generated PDFs are automatically uploaded to the configured folder as the batch processes — you don't need to download and upload manually.</p>

      <h2>Re-running failed rows</h2>
      <p>From the error report, fix the data issues in the affected rows, and create a new CSV with only those rows. Upload it as a new batch run against the same package.</p>
    </div>
  );
}
