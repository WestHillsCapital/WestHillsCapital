import { DocScreenshot } from "@/components/DocScreenshot";

export default function FieldLibraryOverview() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Field Library</div>
        <h1>What is the Field Library?</h1>
        <p className="text-lg text-white/55 mt-2">A shared repository of pre-configured fields your whole organization can reuse across packages.</p>
      </div>

      <p>The Field Library stores field definitions at the organization level rather than inside a single package. Any package can pull fields from the library instead of defining them from scratch. This ensures consistency — the same "Social Security Number" field has the same label, validation, and format everywhere it's used.</p>

      <DocScreenshot
        src="/screenshots/field-library-list.png"
        alt="The Field Library list view showing a table of shared fields with their labels, internal keys, types, categories (Personal, Financial, Address), and how many packages use each field"
        caption="The Field Library — every shared field shows which packages currently use it, so you can gauge the impact before making changes."
      />

      <h2>Why use the Field Library?</h2>
      <ul>
        <li><strong>Consistency</strong> — Client-facing labels, validation rules, and error messages are identical across all packages. No risk of different packages asking for the same information in different ways.</li>
        <li><strong>Speed</strong> — Building a new package is faster when common fields are already defined and ready to import.</li>
        <li><strong>Maintainability</strong> — If a label or validation rule needs to change, update it once in the library. The change applies to all packages that use that field (for new sessions — existing submitted sessions are unaffected).</li>
      </ul>

      <h2>What belongs in the library?</h2>
      <p>Good candidates for library fields are those that appear in more than one package:</p>
      <ul>
        <li>Personal identifiers: Full Name, Date of Birth, SSN, Email, Phone Number</li>
        <li>Address fields: Street Address, City, State, ZIP</li>
        <li>Financial data: Annual Income, Net Worth, Liquid Net Worth, Investment Objective</li>
        <li>Account identifiers: Account Number, Routing Number, Custodian</li>
        <li>Beneficiary fields: Beneficiary Name, Relationship, Percentage</li>
      </ul>

      <h2>Accessing the Field Library</h2>
      <p>Click the <strong>Library</strong> tab in the main navigation (alongside Packages, Sessions, and Batch). You'll see all library fields organized into Fields, Field Groups, Types, Groups, and Compliance tabs.</p>

      <div className="callout callout-info">
        <strong>Permissions:</strong> Only Admins can create, edit, or delete library fields. Members can import library fields into packages they have edit access to.
      </div>

      <h2>Compliance tagging</h2>
      <p>Each library field can carry one or more compliance tags that classify the sensitivity of the data it collects. Common tags include:</p>
      <ul>
        <li><code>pii</code> — Personally Identifiable Information (name, email, date of birth, SSN)</li>
        <li><code>financial</code> — Income, net worth, account numbers, routing numbers</li>
        <li><code>sensitive</code> — Data subject to heightened regulatory requirements (health information, political affiliation, etc.)</li>
      </ul>
      <p>Tags are set per field in the library and propagate automatically to every package that imports that field. To add or change tags, open a field, go to the <strong>Compliance</strong> tab, and select the applicable tags.</p>
      <p>Once fields are tagged, you can run a <strong>Compliance Audit</strong> from the Library's Compliance tab. The report shows every tagged field, which packages use it, how many sessions have collected that data, and when the field definition was last modified. This provides a structured view of your data collection footprint — useful for internal reviews, GDPR data mapping, and security questionnaires.</p>

      <div className="callout callout-info">
        <strong>Tags are metadata only:</strong> Compliance tags do not change how data is stored, encrypted, or transmitted. They are labels that help your team track which fields carry sensitive data — the controls that govern storage and encryption are configured at the account level (see <a href="/account/security">Security Settings</a>).
      </div>
    </div>
  );
}
