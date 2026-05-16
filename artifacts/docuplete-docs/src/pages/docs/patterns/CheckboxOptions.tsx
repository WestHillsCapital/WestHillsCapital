export default function CheckboxOptions() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Common Patterns</div>
        <h1>Multi-Format Checkbox Fields</h1>
        <p className="text-lg text-white/55 mt-2">Map a single interview answer to multiple checkboxes on a PDF.</p>
      </div>

      <p>Many financial forms use a row of checkboxes where exactly one should be marked — account type, distribution method, marital status, and so on. Docuplete handles this with the <code>checkbox-option</code> format, which lets a single field value drive multiple mapped positions.</p>

      <h2>How it works</h2>
      <p>You create <strong>one interview field</strong> (usually a Dropdown or Radio) with all the options. Then you place it on the PDF <strong>multiple times</strong> — once for each checkbox — each with a different <code>checkbox-option</code> format.</p>

      <p>At generation time, each mapped instance checks whether the field's answer matches its configured option. If it matches, an <strong>X</strong> is written. If it doesn't match, the space is left blank.</p>

      <h2>Step-by-step setup</h2>
      <ol>
        <li>Create a Dropdown or Radio field with all your options (e.g., "Check," "Wire," "ACH").</li>
        <li>In the Visual Mapper, drag the field onto the first checkbox position on the PDF.</li>
        <li>In the field card on the right, open the <strong>Format</strong> dropdown and select <code>checkbox-option</code>, then type the matching option label exactly.</li>
        <li>Drag the same field onto the second checkbox position and repeat with the next option label.</li>
        <li>Continue for each option.</li>
      </ol>

      <div className="callout-tip">
        <strong>Option matching is case-sensitive and exact.</strong> "Check" and "check" are treated differently. Make sure the option label in the Format field matches the option in the field definition character-for-character.
      </div>

      <h2>Example: Distribution method</h2>
      <p>A form has three checkboxes: Check, Wire, and ACH. The interview field is a dropdown with those three options.</p>

      <pre>{`Interview field: distributionMethod
  → Type: Dropdown
  → Options: Check, Wire, ACH
  → Required

PDF mappings (same field, placed three times):
  → Position A  Format: checkbox-option:Check
  → Position B  Format: checkbox-option:Wire
  → Position C  Format: checkbox-option:ACH`}</pre>

      <p>If the advisor selects "Wire," position B gets an X and positions A and C are left blank.</p>

      <h2>Multi-select checkboxes</h2>
      <p>If the form allows multiple selections (e.g., "Check all that apply"), use a <strong>Checkbox</strong> field type instead of Dropdown. The advisor can pick several options, and each mapped position with a matching <code>checkbox-option</code> format will be marked.</p>

      <pre>{`Interview field: accountFeatures
  → Type: Checkbox
  → Options: Online access, Paper statements, Overdraft protection

PDF mappings:
  → Position A  Format: checkbox-option:Online access
  → Position B  Format: checkbox-option:Paper statements
  → Position C  Format: checkbox-option:Overdraft protection`}</pre>

      <p>Selecting "Online access" and "Paper statements" marks A and B; C stays blank.</p>

      <h2>Yes/No checkboxes</h2>
      <p>For a single yes/no checkbox — where a checkmark means "yes" — use the <code>checkbox-yes</code> format instead. This marks the box whenever the field has any truthy value, without requiring a specific option label.</p>

      <pre>{`Interview field: isTrustAccount
  → Type: Dropdown — Options: Yes, No

PDF mappings:
  → "Trust account" checkbox  Format: checkbox-yes
    → Marked when isTrustAccount equals "Yes"
  → "Individual account" checkbox  Format: checkbox-option:No
    → Marked when isTrustAccount equals "No"`}</pre>

      <div className="callout-info">
        <strong>Tip:</strong> You can combine <code>checkbox-yes</code> and <code>checkbox-option</code> mappings from the same field. Use <code>checkbox-yes</code> for the affirmative box and <code>checkbox-option:No</code> (or whatever the negative label is) for the other.
      </div>

      <h2>Common uses</h2>
      <ul>
        <li>Account type (Individual / Joint / Trust / Custodial)</li>
        <li>Distribution method (Check / Wire / ACH / Reinvest)</li>
        <li>Contribution type (Regular / Rollover / Transfer / Conversion)</li>
        <li>Marital status (Single / Married / Divorced / Widowed)</li>
        <li>Beneficiary type (Primary / Contingent / Per Stirpes)</li>
        <li>Investment objective (Growth / Income / Balanced / Preservation)</li>
      </ul>
    </div>
  );
}
