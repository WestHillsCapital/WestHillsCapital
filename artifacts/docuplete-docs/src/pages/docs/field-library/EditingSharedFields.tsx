export default function EditingSharedFields() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Field Library</div>
        <h1>Editing Shared Fields</h1>
        <p className="text-lg text-white/55 mt-2">Changes to library fields propagate to all packages that use them — understand the impact before editing.</p>
      </div>

      <h2>Editing a library field</h2>
      <ol>
        <li>Click the <strong>Library</strong> tab in the main navigation.</li>
        <li>Click the field you want to edit.</li>
        <li>Make your changes.</li>
        <li>Review the <strong>Impact</strong> panel — it shows how many packages and active sessions use this field.</li>
        <li>Click <strong>Save Changes</strong>.</li>
      </ol>

      <div className="callout callout-warning">
        <strong>Impact on in-progress sessions:</strong> If a client is currently filling out a session from a package that uses this library field, they will see the updated label or options on their next page load. Take care when changing option values on radio/dropdown fields — if a client has already selected an option that is renamed or removed, their selection is preserved as a raw value that may no longer match any listed option.
      </div>

      <h2>Changing a field's type</h2>
      <p>You cannot change the type of a library field (e.g., from text to date) after it has been imported into any package. The type is locked once the field has mappings. To change the type, create a new library field with the correct type and remove the old one from affected packages.</p>

      <h2>Deleting a library field</h2>
      <p>To delete a library field:</p>
      <ol>
        <li>First remove it from all packages that use it (or detach them).</li>
        <li>Then open the field in the library and click <strong>Delete</strong>.</li>
      </ol>
      <p>Docuplete will not let you delete a library field that is still linked to any package.</p>

      <h2>Viewing usage</h2>
      <p>Each library field shows a list of packages that currently import it. Click <strong>Used in X packages</strong> to see the full list. This is useful before making any changes to understand downstream impact.</p>

      <h2>Bulk editing via CSV import</h2>
      <p>When you need to update many fields at once — for example, marking a set of fields as required, toggling sensitive, or reorganizing sort order — the CSV round-trip is faster than editing each field individually:</p>
      <ol>
        <li>In the Library tab, click <strong>Export → CSV</strong> to download your current field library.</li>
        <li>Open the file in Excel or Google Sheets. Each row is one field. Edit the columns you want to change (<code>required</code>, <code>sensitive</code>, <code>active</code>, <code>category</code>, <code>sortOrder</code>, <code>validationType</code>, etc.).</li>
        <li>Save the file as CSV.</li>
        <li>Click <strong>Import</strong> and select the saved file. A preview shows each row as <strong>Update</strong> (blue — something changed), <strong>No change</strong> (grey — identical to the current definition), or <strong>New</strong> (green — not yet in your library).</li>
        <li>Review the list and click <strong>Import</strong> to apply. Only rows marked Update are written — unchanged rows are skipped automatically.</li>
      </ol>

      <div className="callout callout-info">
        <strong>Booleans are case-insensitive.</strong> Spreadsheet apps like Excel and Google Sheets capitalize boolean values to <code>TRUE</code> / <code>FALSE</code> when saving a CSV. Docuplete accepts any capitalization for the <code>sensitive</code>, <code>required</code>, and <code>active</code> columns — <code>TRUE</code>, <code>true</code>, and <code>True</code> are all treated the same.
      </div>

      <p>For the full column reference and JSON import details, see <a href="/field-library/import-export">Importing &amp; Exporting Fields</a>.</p>

      <h2>Version history and rollback</h2>
      <p>Every save to a library field creates a version entry automatically. To view the history for a field, open it and click the <strong>History</strong> tab. Each entry shows:</p>
      <ul>
        <li>What changed (label, validation rules, options list, etc.)</li>
        <li>Who made the change</li>
        <li>The timestamp of the save</li>
      </ul>
      <p>To roll back, select any prior version and click <strong>Restore this version</strong>. The rollback is immediate and applies to all future sessions from every package that uses the field. Submitted sessions are not affected — their captured values are frozen at submission time.</p>

      <div className="callout callout-warning">
        <strong>Rolling back option values:</strong> If clients have already selected options that were renamed or removed between the current version and the version you're restoring to, their saved selections are preserved as raw values. You may see data in the session that no longer matches any listed option on the restored field definition.
      </div>
    </div>
  );
}
