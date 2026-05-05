export default function Validation() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Building a Package</div>
        <h1>Validation & Conditional Logic</h1>
        <p className="text-lg text-white/55 mt-2">Ensure clients provide accurate answers and only see relevant questions.</p>
      </div>

      <h2>Validation rules</h2>
      <p>Validation rules run client-side in real time and are re-checked on submission. Invalid fields are highlighted with an inline error message.</p>

      <h3>Text fields</h3>
      <ul>
        <li><strong>Min length</strong> — Minimum number of characters</li>
        <li><strong>Max length</strong> — Maximum number of characters</li>
        <li><strong>Pattern</strong> — A regex the value must match (e.g., <code>^\d{3}-\d{2}-\d{4}$</code> for SSN)</li>
        <li><strong>Custom error message</strong> — Shown when the pattern fails (e.g., "Enter your SSN in XXX-XX-XXXX format")</li>
      </ul>

      <h3>Number fields</h3>
      <ul>
        <li><strong>Min value</strong> / <strong>Max value</strong> — Numeric bounds</li>
        <li><strong>Decimal places</strong> — How many decimal digits to accept</li>
      </ul>

      <h3>Date fields</h3>
      <ul>
        <li><strong>Min date</strong> / <strong>Max date</strong> — Absolute bounds (e.g., "not in the future")</li>
        <li><strong>Age constraint</strong> — E.g., "client must be at least 18 years old" (computed from today)</li>
      </ul>

      <h2>Conditional logic</h2>
      <p>Conditions control which fields are shown based on previously entered answers. Conditions are evaluated in real time — fields appear and disappear immediately as the client types or selects.</p>

      <h3>Condition structure</h3>
      <p>Each condition has three parts:</p>
      <ol>
        <li><strong>Source field</strong> — The field whose value is evaluated</li>
        <li><strong>Operator</strong> — equals, not equals, contains, starts with, greater than, less than, is empty, is not empty</li>
        <li><strong>Value</strong> — The value to compare against</li>
      </ol>

      <h3>Combining conditions</h3>
      <p>Multiple conditions can be added to one field:</p>
      <ul>
        <li><strong>ALL of these must be true (AND)</strong> — The field is shown only when every condition passes.</li>
        <li><strong>ANY of these must be true (OR)</strong> — The field is shown when at least one condition passes.</li>
      </ul>

      <h3>Example</h3>
      <pre>{`Show "Co-Applicant Name" if:
  "Account Type"  equals  "Joint"

Show "Source of Funds Explanation" if:
  "Source of Funds" equals "Other"

Show "Green Card Number" if:
  "US Citizen" equals "No"
  AND "Permanent Resident" equals "Yes"`}</pre>

      <h2>Required fields with conditions</h2>
      <p>A field can be both required and conditional. If the condition is not met, the field is hidden and its required constraint is ignored — the client is not blocked. If the condition is met, the field appears and becomes required.</p>
    </div>
  );
}
