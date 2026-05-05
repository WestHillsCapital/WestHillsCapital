export default function HubSpot() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Integrations</div>
        <h1>HubSpot</h1>
        <p className="text-lg text-white/55 mt-2">Sync submission data to HubSpot contacts and deals automatically.</p>
      </div>

      <div className="callout callout-info">
        <strong>Pro and Enterprise only.</strong> HubSpot integration is available on Pro ($249/mo) and Enterprise ($3,000/mo) plans.
      </div>

      <h2>Connecting HubSpot</h2>
      <ol>
        <li>Go to <strong>Settings → Integrations → HubSpot</strong>.</li>
        <li>Click <strong>Connect HubSpot</strong>.</li>
        <li>Authorize Docuplete in the HubSpot OAuth flow — you'll need to be a HubSpot admin.</li>
        <li>Choose which HubSpot portal (account) to connect to if you have multiple.</li>
      </ol>

      <h2>What syncs on submission</h2>
      <p>When a session reaches <code>generated</code> status, Docuplete:</p>
      <ol>
        <li><strong>Finds or creates a contact</strong> — Looks up the contact by client email. If found, updates it. If not found, creates a new contact.</li>
        <li><strong>Maps field values to contact properties</strong> — You configure which Docuplete fields map to which HubSpot contact properties in the field mapping UI.</li>
        <li><strong>Attaches the PDF</strong> — Uploads the completed PDF as a HubSpot engagement attached to the contact.</li>
        <li><strong>Creates or updates a deal</strong> — Optionally creates a deal in a configured pipeline with the contact attached.</li>
      </ol>

      <h2>Field mapping</h2>
      <p>Configure the mapping in <strong>Settings → Integrations → HubSpot → Field Mapping</strong>:</p>
      <ol>
        <li>Click <strong>Add mapping</strong>.</li>
        <li>Select a Docuplete field (e.g., <code>first_name</code>).</li>
        <li>Select the corresponding HubSpot contact property (e.g., <code>First name</code>).</li>
        <li>Repeat for all fields you want to sync.</li>
      </ol>
      <p>Per-package overrides are available in the package's Configuration panel if different packages have different field structures.</p>

      <h2>Deal creation</h2>
      <p>Enable deal creation in <strong>Settings → Integrations → HubSpot → Deal Settings</strong>:</p>
      <ul>
        <li><strong>Pipeline</strong> — Which HubSpot pipeline to create deals in</li>
        <li><strong>Stage</strong> — Which pipeline stage newly created deals start at</li>
        <li><strong>Deal name template</strong> — E.g., <code>{"{{package_name}} — {{last_name}}, {{first_name}}"}</code></li>
      </ul>

      <h2>Disconnecting</h2>
      <p>Go to <strong>Settings → Integrations → HubSpot → Disconnect</strong>. Future submissions will no longer sync to HubSpot. Existing contacts and deals in HubSpot are unaffected.</p>
    </div>
  );
}
