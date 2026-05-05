export default function Packages() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Core Concepts</div>
        <h1>Packages</h1>
        <p className="text-lg text-white/55 mt-2">A package is a reusable template that combines one or more PDFs with a configured interview and field mappings.</p>
      </div>

      <p>Think of a package as the "master" document setup. You build it once and reuse it for every client who needs that set of forms. The package defines <em>what</em> you collect, <em>how</em> it maps onto the PDF, and <em>how</em> the session behaves — but it contains no client-specific data.</p>

      <h2>What a package contains</h2>
      <ul>
        <li><strong>PDF templates</strong> — One or more PDF files that will be filled with client answers.</li>
        <li><strong>Fields</strong> — The questions asked during the client interview. Fields have types, labels, validation rules, and display conditions.</li>
        <li><strong>Mappings</strong> — The precise positions on each PDF page where each field's answer gets stamped, along with formatting instructions (font size, alignment, date format, etc.).</li>
        <li><strong>Configuration</strong> — Package-level settings: branding, notification recipients, redirect URL after submission, e-sign requirements, expiration window, and more.</li>
      </ul>

      <h2>Package lifecycle</h2>
      <p>A package moves through a simple lifecycle:</p>
      <ol>
        <li><strong>Draft</strong> — Under construction. Sessions cannot be created from a draft package.</li>
        <li><strong>Active</strong> — Published and ready. New sessions can be created.</li>
        <li><strong>Archived</strong> — No longer accepting new sessions. Existing completed sessions remain accessible.</li>
      </ol>

      <h2>Versioning</h2>
      <p>Packages are not versioned in the traditional sense. When you update a package (add a field, remap a position), the change applies to new sessions created after the update. Existing completed sessions are always generated from the snapshot of the package at the time of submission — they are not retroactively affected by later edits.</p>

      <div className="callout callout-warning">
        <strong>In-progress sessions:</strong> If a client is currently filling out a session and you edit the package, the client will see the updated fields only if they reload the interview. Sessions already submitted are frozen.
      </div>

      <h2>Multi-document packages</h2>
      <p>A single package can include multiple PDF files. All documents are filled from the same interview — there is one unified list of fields, and any field can be mapped to positions across any of the documents. This is useful for form sets that always travel together (e.g., an application + a disclosure + a signature page).</p>

      <h2>Organizing packages</h2>
      <p>Packages can be grouped by tags or by folder in the dashboard. Use descriptive names and tags from the start to keep things manageable as your library grows (e.g., "New Account — IRA", "New Account — Joint Brokerage", "Transfer of Assets").</p>
    </div>
  );
}
