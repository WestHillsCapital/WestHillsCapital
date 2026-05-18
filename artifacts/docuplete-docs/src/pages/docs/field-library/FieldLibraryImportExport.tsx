export default function FieldLibraryImportExport() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Field Library</div>
        <h1>Importing &amp; Exporting Fields</h1>
        <p className="text-lg text-white/55 mt-2">Back up your field library, migrate it to another environment, or bulk-update field definitions using CSV or JSON.</p>
      </div>

      <h2>Exporting the field library</h2>
      <p>From the <strong>Library</strong> tab, click the <strong>Export</strong> button and choose a format:</p>
      <ul>
        <li><strong>JSON</strong> — Complete export including field groups. Best for backups and migrating to a new Docuplete organization.</li>
        <li><strong>CSV</strong> — Spreadsheet-friendly format covering all field properties. Best for bulk editing in Excel or Google Sheets before re-importing.</li>
      </ul>
      <p>Both formats include every field your organization owns: label, category, type, source, sensitive, required, validationType, validationPattern, validationMessage, active, sortOrder, options, and complianceTags.</p>

      <div className="callout callout-info">
        <strong>Global and inherited fields are not exported.</strong> Only fields that belong to your organization are included in the export.
      </div>

      <h2>Importing fields</h2>
      <p>From the <strong>Library</strong> tab, click <strong>Import</strong> and select a JSON or CSV file. A preview appears before anything is saved, showing exactly what will happen:</p>
      <ul>
        <li><strong>New</strong> (green badge) — Fields in the file that do not exist in your library yet. They will be added.</li>
        <li><strong>Update</strong> (blue badge) — Fields that already exist in your library and have at least one property that differs from the imported file. Clicking Import will apply those changes.</li>
        <li><strong>No change</strong> (grey badge) — Fields that already exist and match the imported values exactly. They are skipped.</li>
      </ul>
      <p>Click <strong>Import</strong> to confirm. The result banner reports how many fields were added, updated, and skipped.</p>

      <div className="callout callout-warning">
        <strong>Only your own fields can be updated by import.</strong> Global fields (provided by Docuplete) and inherited fields (from a parent organization) are always skipped — even if the file contains a matching label.
      </div>

      <h2>Bulk editing via the CSV round-trip</h2>
      <p>The most efficient way to update many fields at once is the export → edit → reimport workflow:</p>
      <ol>
        <li>Click <strong>Export → CSV</strong> to download your current field library.</li>
        <li>Open the file in Excel, Google Sheets, or any spreadsheet app.</li>
        <li>Edit the values you want to change — required, sensitive, active, validation rules, options, category, sort order, etc.</li>
        <li>Save the file as CSV.</li>
        <li>Click <strong>Import</strong>, select the saved file, review the preview, and confirm.</li>
      </ol>
      <p>Only rows where at least one value differs from the current library definition are shown as "Update" — unchanged rows are automatically skipped, so there is no risk of overwriting good data with identical values.</p>

      <div className="callout callout-info">
        <strong>Boolean values are case-insensitive.</strong> Spreadsheet apps like Excel and Google Sheets typically capitalize boolean values to <code>TRUE</code> / <code>FALSE</code> when you save a CSV. Docuplete accepts any casing — <code>true</code>, <code>TRUE</code>, <code>True</code> are all equivalent for the <code>sensitive</code>, <code>required</code>, and <code>active</code> columns.
      </div>

      <h2>CSV column reference</h2>
      <p>The CSV format uses the following columns. All columns except <code>label</code> are optional — if a column is omitted or a cell is empty, that property is not changed during import.</p>
      <table>
        <thead>
          <tr>
            <th>Column</th>
            <th>Values</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>label</code></td><td>Any text</td><td>Required. Must match an existing field label exactly (case-insensitive) for an update; otherwise a new field is created.</td></tr>
          <tr><td><code>category</code></td><td>Any text</td><td>Defaults to <code>General</code> if blank on new fields.</td></tr>
          <tr><td><code>type</code></td><td><code>text</code>, <code>date</code>, <code>radio</code>, <code>dropdown</code>, <code>checkbox</code>, <code>number</code></td><td></td></tr>
          <tr><td><code>source</code></td><td>Source key (e.g. <code>interview</code>, <code>firstName</code>, <code>ssn</code>)</td><td>Controls auto-fill behavior during the interview.</td></tr>
          <tr><td><code>sensitive</code></td><td><code>true</code> / <code>false</code> (any case)</td><td>Masks the value in logs and exports.</td></tr>
          <tr><td><code>required</code></td><td><code>true</code> / <code>false</code> (any case)</td><td>Whether the field must be answered to submit the session.</td></tr>
          <tr><td><code>active</code></td><td><code>true</code> / <code>false</code> (any case)</td><td>Inactive fields are hidden from the interview and not included in new sessions.</td></tr>
          <tr><td><code>validationType</code></td><td><code>none</code>, <code>name</code>, <code>email</code>, <code>phone</code>, <code>ssn</code>, <code>date</code>, <code>percent</code>, <code>custom</code></td><td></td></tr>
          <tr><td><code>validationPattern</code></td><td>Regex string</td><td>Only used when <code>validationType</code> is <code>custom</code>.</td></tr>
          <tr><td><code>validationMessage</code></td><td>Any text</td><td>Error shown to clients when validation fails.</td></tr>
          <tr><td><code>sortOrder</code></td><td>Integer</td><td>Lower numbers appear first in the library list.</td></tr>
          <tr><td><code>options</code></td><td>Pipe-separated values: <code>Option A|Option B|Option C</code></td><td>Used for <code>radio</code>, <code>dropdown</code>, and <code>checkbox</code> fields.</td></tr>
          <tr><td><code>complianceTags</code></td><td>Pipe-separated tag names: <code>pii|financial</code></td><td></td></tr>
        </tbody>
      </table>

      <h2>Using JSON for full backups</h2>
      <p>The JSON export includes field group definitions in addition to all field properties. Use this format when:</p>
      <ul>
        <li>Migrating a field library from one Docuplete organization to another</li>
        <li>Creating a point-in-time backup before a large bulk edit</li>
        <li>Seeding a new environment with a known-good configuration</li>
      </ul>
      <p>Import a JSON backup the same way as a CSV — click Import, select the file, review the preview, and confirm.</p>
    </div>
  );
}
