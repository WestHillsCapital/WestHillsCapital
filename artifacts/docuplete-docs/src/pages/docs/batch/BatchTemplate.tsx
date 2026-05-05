export default function BatchTemplate() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Batch CSV Import</div>
        <h1>Downloading the Template</h1>
        <p className="text-lg text-white/55 mt-2">Get a pre-built CSV template with the correct column headers for your package.</p>
      </div>

      <p>Every package has a unique CSV template generated from its fields. The column headers match the field keys exactly — so you don't have to guess the format or column names.</p>

      <h2>How to download the template</h2>
      <ol>
        <li>Open the package you want to use for the batch run.</li>
        <li>Click <strong>Batch Import → Download Template</strong>.</li>
        <li>Open the CSV in Excel, Google Sheets, or any spreadsheet editor.</li>
      </ol>

      <h2>Template structure</h2>
      <p>The template has one header row and one example data row. Each column corresponds to a field in the package:</p>
      <pre>{`first_name,last_name,date_of_birth,account_type,annual_income
John,Smith,1975-04-12,Individual,85000`}</pre>

      <p>Fields that are not included in the batch (e.g., hidden or read-only fields without prefill) are still listed as columns — you can leave them blank for those rows.</p>

      <h2>Special columns</h2>
      <ul>
        <li><strong><code>_client_name</code></strong> — The display name for this session in the dashboard (e.g., "John Smith — 2024 Renewal"). If blank, Docuplete auto-generates a name from available name fields.</li>
        <li><strong><code>_client_email</code></strong> — If provided, the client receives a confirmation email with their completed PDF after the batch run.</li>
        <li><strong><code>_expiration_days</code></strong> — Per-row override of the session expiration window. Rarely needed for batch runs since most batch PDFs are generated immediately.</li>
      </ul>

      <h2>Updating the template</h2>
      <p>If you add or remove fields from the package, download a fresh template — the old template's column headers may no longer match. Docuplete validates headers on upload and will report unrecognized column names as warnings.</p>
    </div>
  );
}
