import { DocScreenshot } from "@/components/DocScreenshot";

export default function GoogleDrive() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Integrations</div>
        <h1>Google Drive</h1>
        <p className="text-lg text-white/55 mt-2">Automatically save completed PDFs to your Google Drive folder after every submission.</p>
      </div>

      <div className="callout callout-info">
        <strong>Pro and Enterprise only.</strong> Google Drive integration is available on Pro ($249/mo) and Enterprise ($3,000/mo) plans.
      </div>

      <h2>Connecting Google Drive</h2>
      <ol>
        <li>Go to <strong>Settings → Integrations → Google Drive</strong>.</li>
        <li>Click <strong>Connect Google Drive</strong>.</li>
        <li>Complete the Google OAuth flow — sign in to the Google account that owns the destination Drive.</li>
        <li>Grant Docuplete permission to create files in Drive.</li>
        <li>Choose the <strong>default destination folder</strong> — a picker shows your Drive folder tree. Select the folder where completed PDFs should be saved.</li>
        <li>Click <strong>Save</strong>.</li>
      </ol>

      <DocScreenshot
        src="/screenshots/google-drive-settings.png"
        alt="The Google Drive integration settings page showing the connected account, default destination folder selector, file naming template, and a list of recent uploads"
        caption="The Google Drive settings page — once connected, choose a default folder and optionally customize the file naming template using field values as placeholders."
      />

      <h2>Per-package folder override</h2>
      <p>By default, all packages save to the default destination folder. To route a specific package's PDFs to a different folder:</p>
      <ol>
        <li>Open the package and go to <strong>Configuration → Integrations</strong>.</li>
        <li>Under <strong>Google Drive folder</strong>, click <strong>Override</strong> and choose a folder.</li>
      </ol>

      <h2>File naming</h2>
      <p>Completed PDFs are saved with a file name derived from:</p>
      <pre>{`[Package Name] - [Client Name] - [Submission Date].pdf
Example: "New Client Intake - Jane Doe - 2024-03-15.pdf"`}</pre>
      <p>You can configure a custom file name template in the package's <strong>Configuration → Integrations</strong> panel using field values as placeholders:</p>
      <pre>{`{{package_name}} - {{last_name}}, {{first_name}} - {{today}}.pdf`}</pre>

      <h2>Batch runs and Drive</h2>
      <p>When a batch run completes, all generated PDFs are saved to Drive as the batch processes — you don't need to download the ZIP and upload manually. Each PDF is named using the same naming convention, with the client name from the CSV's <code>_client_name</code> column.</p>

      <h2>Disconnecting</h2>
      <p>To disconnect Google Drive, go to <strong>Settings → Integrations → Google Drive → Disconnect</strong>. Existing uploaded PDFs in Drive are not affected. Future sessions will no longer trigger uploads.</p>
    </div>
  );
}
