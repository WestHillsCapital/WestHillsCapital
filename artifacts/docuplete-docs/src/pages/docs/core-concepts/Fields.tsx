export default function Fields() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Core Concepts</div>
        <h1>Fields & Interview Logic</h1>
        <p className="text-lg text-white/55 mt-2">Fields define what information you collect and how the interview behaves for each client.</p>
      </div>

      <h2>Field types</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Type</th><th>Description</th><th>Maps to PDF as</th></tr>
          </thead>
          <tbody>
            <tr><td><code>text</code></td><td>Free-form single-line input</td><td>Text string</td></tr>
            <tr><td><code>textarea</code></td><td>Multi-line text input</td><td>Text block (word-wrapped)</td></tr>
            <tr><td><code>number</code></td><td>Numeric input with optional formatting</td><td>Formatted number</td></tr>
            <tr><td><code>date</code></td><td>Date picker</td><td>Formatted date string</td></tr>
            <tr><td><code>checkbox</code></td><td>Single boolean toggle</td><td>Checkmark or "Yes"/"No"</td></tr>
            <tr><td><code>radio</code></td><td>Pick one from a list</td><td>Selected option label</td></tr>
            <tr><td><code>select</code></td><td>Dropdown — pick one from a list</td><td>Selected option label</td></tr>
            <tr><td><code>multi-select</code></td><td>Pick multiple from a list</td><td>Comma-separated labels</td></tr>
            <tr><td><code>signature</code></td><td>E-sign field (all plans)</td><td>Signature image</td></tr>
            <tr><td><code>initials</code></td><td>Initials e-sign field</td><td>Initials image</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Interview modes</h2>
      <p>Each field has an interview mode that controls how it appears to the client:</p>
      <ul>
        <li><strong>Required</strong> — The client must provide an answer before proceeding. If left blank, submission is blocked.</li>
        <li><strong>Optional</strong> — The client may skip the field. The PDF mapping will be empty if no answer is given.</li>
        <li><strong>Read-only</strong> — The field is shown with a prefilled value the client cannot change. Useful for reference information or pre-confirmed data.</li>
        <li><strong>Hidden</strong> — The field is not shown in the interview at all. It can still be prefilled via the session API and mapped to the PDF.</li>
      </ul>

      <h2>Conditional logic</h2>
      <p>Fields can be shown or hidden based on the answers to other fields. This keeps the interview short and relevant — clients only see questions that apply to their situation.</p>
      <p>A condition rule follows this pattern:</p>
      <pre>{`Show this field IF:
  [Field]  [Operator]  [Value]

Examples:
  "Account Type"  equals  "Joint"     → show "Co-Applicant Name"
  "US Citizen"    equals  "No"        → show "Country of Citizenship"
  "Annual Income" greater than 250000 → show "Accredited Investor Disclosure"`}</pre>

      <p>Multiple conditions can be combined with AND / OR logic. Conditions are evaluated in real time as the client types — fields appear and disappear instantly without a page reload.</p>

      <h2>Field groups</h2>
      <p>Fields can be grouped into sections with a label. Groups appear as collapsible sections in the interview and help break long interviews into manageable parts (e.g., "Personal Information", "Investment Objectives", "Beneficiary Designations").</p>

      <h2>Validation rules</h2>
      <p>Beyond required/optional, fields support additional validation:</p>
      <ul>
        <li><strong>Min / max length</strong> for text fields</li>
        <li><strong>Min / max value</strong> for number fields</li>
        <li><strong>Date range constraints</strong> (e.g., must be 18+ years ago)</li>
        <li><strong>Regex pattern matching</strong> (e.g., SSN format)</li>
        <li><strong>Custom error messages</strong> shown inline when validation fails</li>
      </ul>
    </div>
  );
}
