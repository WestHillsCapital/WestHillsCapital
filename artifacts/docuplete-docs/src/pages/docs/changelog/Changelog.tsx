export default function Changelog() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">What's New</div>
        <h1>Changelog</h1>
        <p className="text-lg text-white/55 mt-2">Recent releases, improvements, and fixes — newest first.</p>
      </div>

      <div className="space-y-10">

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Multi-document scroll view in the Visual Mapper</h2>
          <p>The Visual Mapper now supports a continuous scroll view when a package contains more than one PDF. Instead of switching between documents via a dropdown, all pages from all documents render in a single vertically scrollable canvas. Switch between <strong>Scroll</strong> and <strong>Single</strong> mode using the toggle in the toolbar. Single mode retains the previous paginated experience for focused editing.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/15 text-green-400">Fix</span>
          </div>
          <h2 className="mt-0">Field Library edits now save correctly for shared (system) fields</h2>
          <p>Editing a field in the Field Library was returning a <code>404</code> error for fields that belong to the organization's shared field set (fields not owned by a specific account). This has been fixed. All library fields — both account-specific and shared — now save and restore versions correctly.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">April 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Contextual placeholder text in the Options field</h2>
          <p>When editing a Radio, Checkbox, or Dropdown field in the Field Library or package field editor, the <strong>Options</strong> textarea now shows a concrete example that matches the field type. Radio fields show a Yes / No / Unsure example, Dropdown fields show account type options, and Checkbox fields show agreement text examples.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">April 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Sidebar scrolling in the Visual Mapper</h2>
          <p>The left panel (field list) and right panel (field inspector) in the Visual Mapper now scroll independently at full viewport height. Long field lists and deeply configured fields no longer require scrolling the entire page.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">March 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-400">New</span>
          </div>
          <h2 className="mt-0">Batch CSV import</h2>
          <p>Generate hundreds of sessions at once by uploading a CSV file. Download the template for your package, fill in one row per client, and upload. Docuplete validates each row, reports errors inline, and creates sessions for all valid rows. Useful for annual renewals, large client cohorts, or migrating from another document system.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">February 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-400">New</span>
          </div>
          <h2 className="mt-0">Webhook delivery logs and retry visibility</h2>
          <p>The Webhooks section now includes a full delivery log for every event — HTTP status code, response body (truncated), delivery timestamp, and retry count. Failed deliveries show the exact error returned by your endpoint and when the next retry is scheduled.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">January 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-400">New</span>
          </div>
          <h2 className="mt-0">E-sign identity verification</h2>
          <p>Signature fields can now require identity verification before the client can sign. Supported methods: email OTP, SMS OTP, and knowledge-based authentication (KBA). The verification method is set per-package in the package configuration. The session audit log records which method was used and when it was completed.</p>
        </div>

      </div>
    </div>
  );
}
