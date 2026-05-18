export default function FieldLibraryBestPractices() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Field Library</div>
        <h1>Field Library Best Practices</h1>
        <p className="text-lg text-white/55 mt-2">Conventions and patterns that keep your field library clean, consistent, and easy to maintain as your package count grows.</p>
      </div>

      <h2>Naming conventions</h2>
      <p>Consistent naming makes it easier to find the right field when building packages and reduces the chance of creating near-duplicate fields.</p>
      <ul>
        <li><strong>Use the client-facing label as the field name.</strong> Name the field "Social Security Number" — not "ssn_field" or "SSN_V2". The display name is what your team will search for.</li>
        <li><strong>Be specific for person-type fields.</strong> "First Name" is ambiguous when a form has both a primary applicant and a beneficiary. Use "Applicant First Name" and "Beneficiary First Name" as separate library fields.</li>
        <li><strong>Avoid version suffixes.</strong> If a field changes, update the existing field and use version history to track prior states. Fields named "Email (New)" or "Address V2" create confusion and orphaned mappings.</li>
        <li><strong>Use consistent capitalization.</strong> Title case for labels works well: "Date of Birth", "Annual Income", "Net Worth". Pick a convention and apply it to every field.</li>
      </ul>

      <h2>Internal keys</h2>
      <p>Every field has an internal key used in the API and CSV imports. These are separate from the display label and should follow a different convention:</p>
      <ul>
        <li>Use <code>snake_case</code> — all lowercase, underscores between words: <code>date_of_birth</code>, <code>annual_income</code>.</li>
        <li>Keep them stable. If you rename a field's display label, you do not need to change the internal key — and usually should not, because it may be referenced in webhooks, CSV templates, or your own code.</li>
        <li>Never use spaces, hyphens, or special characters in internal keys.</li>
      </ul>

      <h2>Shared vs. package-local fields</h2>
      <p>Not every field belongs in the library. Use this rule of thumb:</p>
      <ul>
        <li><strong>Put in the library</strong> if the field appears in two or more packages and must always have the same label, validation, and format.</li>
        <li><strong>Keep local to the package</strong> if the field is specific to one document type or one client workflow. A "Special Instructions" field used in one bespoke package does not need to be in the shared library.</li>
      </ul>
      <p>Over-populating the library with rarely reused fields makes it harder to find the fields you actually need. When in doubt, start local and promote to the library when a second package needs it.</p>

      <h2>Organizing with groups</h2>
      <p>Groups are the library's folder system. Keep them broad — most organizations work well with 5–8 groups:</p>
      <ul>
        <li><strong>Personal</strong> — name, DOB, SSN, address, contact info</li>
        <li><strong>Financial</strong> — income, net worth, liquid assets, investment objective</li>
        <li><strong>Account</strong> — account number, routing number, custodian, depository</li>
        <li><strong>Beneficiary</strong> — beneficiary name, relationship, percentage</li>
        <li><strong>Agreement</strong> — checkbox acknowledgments, consent fields, disclosures</li>
        <li><strong>Signature</strong> — e-sign fields, initials</li>
      </ul>
      <p>Avoid creating a group per package — that defeats the purpose of a shared library and makes the list harder to navigate.</p>

      <h2>When to edit a library field</h2>
      <p>Before editing any library field, check the <strong>Used in X packages</strong> count. A field used in 12 packages is a high-impact change — even a label update changes what clients see across all active sessions from those packages.</p>
      <p>For low-risk edits (correcting a typo, tightening a validation message), proceed directly. For changes that affect field type, options list, or validation rules, consider:</p>
      <ol>
        <li>Creating a new library field with the updated configuration.</li>
        <li>Swapping the old field for the new one in packages, one at a time.</li>
        <li>Deleting the old field once no packages reference it.</li>
      </ol>
      <p>This staged approach avoids disrupting in-flight sessions that are already collecting data using the old field definition.</p>

      <h2>Using version history</h2>
      <p>Every save to a library field creates a version entry. If an edit causes unexpected behavior in the client interview, you can roll back to a previous version from the field's <strong>History</strong> tab. The rollback is immediate and applies to all future sessions — existing submitted sessions are not affected.</p>

      <div className="callout callout-info">
        <strong>Compliance tip:</strong> If your organization is subject to regulatory requirements about what questions are asked and how they are phrased, treat the field library as your source of truth for approved question text. Use version history as your audit trail for any changes.
      </div>

      <h2>Bulk updates via CSV</h2>
      <p>For changes that affect many fields at once — reclassifying a batch of fields as required, toggling sensitive on a whole category, reordering sort positions — use the export → edit → reimport workflow instead of editing fields one by one:</p>
      <ol>
        <li><strong>Export → CSV</strong> from the Library tab.</li>
        <li>Edit the relevant columns in Excel or Google Sheets.</li>
        <li><strong>Import</strong> the saved CSV. Only fields with actual differences are updated — identical rows are automatically skipped.</li>
      </ol>
      <p>This is also the recommended approach before any large structural change: export first as a backup, make your edits, then import. If anything looks wrong after import, you can roll back individual fields from their version history.</p>
      <p>See <a href="/field-library/import-export">Importing &amp; Exporting Fields</a> for the full column reference and notes on JSON format.</p>
    </div>
  );
}
