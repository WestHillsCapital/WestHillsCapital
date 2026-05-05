export default function FieldLibraryOverview() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Field Library</div>
        <h1>What is the Field Library?</h1>
        <p className="text-lg text-white/55 mt-2">A shared repository of pre-configured fields your whole organization can reuse across packages.</p>
      </div>

      <p>The Field Library stores field definitions at the organization level rather than inside a single package. Any package can pull fields from the library instead of defining them from scratch. This ensures consistency — the same "Social Security Number" field has the same label, validation, and format everywhere it's used.</p>

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
      <p>Navigate to <strong>Organization → Field Library</strong> in the main sidebar. You'll see all library fields with their type, validation, and which packages currently use them.</p>

      <div className="callout callout-info">
        <strong>Permissions:</strong> Only Admins can create, edit, or delete library fields. Members can import library fields into packages they have edit access to.
      </div>
    </div>
  );
}
