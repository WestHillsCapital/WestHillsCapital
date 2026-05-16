export default function ConditionalSections() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Common Patterns</div>
        <h1>Conditional Sections</h1>
        <p className="text-lg text-white/55 mt-2">Show or hide groups of fields based on a single gateway question.</p>
      </div>

      <p>Many documents include sections that only apply in certain situations — beneficiary designations, joint account holders, spousal consent, or "other" explanations. The conditional section pattern handles all of these cleanly.</p>

      <h2>The pattern</h2>
      <ol>
        <li><strong>Create a gateway field</strong> — a required question that determines whether the section applies (e.g., "Do you want to name beneficiaries?"). This field is <em>unmapped</em> — it never writes to the PDF. Its only job is to drive the interview.</li>
        <li><strong>Create the detail fields</strong> — each field in the conditional section gets a condition pointing to the gateway: <code>equals Yes</code>. These fields are mapped to their PDF positions normally.</li>
        <li><strong>Optionally handle the "No" case</strong> — if the PDF has a checkbox for "No beneficiaries designated," create a field with the <code>checkbox-option:No</code> format, conditioned on the gateway equaling "No."</li>
      </ol>

      <div className="callout-tip">
        <strong>Gateway fields don't need a PDF placement.</strong> A field can be required and control conditions without being mapped to any position in the document. It will still block generation until answered, but its value is never written to the PDF.
      </div>

      <h2>Beneficiary example</h2>
      <p>Here is a complete field setup for a primary beneficiary section on an IRA application:</p>

      <pre>{`[required, unmapped]  hasBeneficiaries
  → "Do you want to name a primary beneficiary?"
  → Type: Dropdown — Options: Yes, No

[required, mapped]    bene1Name
  → "Primary Beneficiary — Full Name"
  → Condition: hasBeneficiaries equals Yes

[required, mapped]    bene1Relationship
  → "Primary Beneficiary — Relationship"
  → Condition: hasBeneficiaries equals Yes

[required, mapped]    bene1Dob
  → "Primary Beneficiary — Date of Birth"
  → Validation: Date
  → Condition: hasBeneficiaries equals Yes

[required, mapped]    bene1Pct
  → "Primary Beneficiary — Allocation %"
  → Validation: Percent
  → Condition: hasBeneficiaries equals Yes

[optional, mapped]    noBeneficiaryCheckbox
  → "No beneficiary designated" checkbox
  → Format: checkbox-option:No
  → Condition: hasBeneficiaries equals No`}</pre>

      <p>When an advisor selects "Yes," all four detail fields appear and must be completed. When they select "No," the detail fields are hidden and skipped, and the PDF checkbox is marked instead.</p>

      <h2>Adding a second beneficiary</h2>
      <p>To make the second beneficiary optional rather than always shown, add a second gateway:</p>

      <pre>{`[optional, unmapped]  hasContingentBeneficiary
  → "Do you also want to name a contingent beneficiary?"
  → Type: Dropdown — Options: Yes, No
  → Condition: hasBeneficiaries equals Yes

[required, mapped]    bene2Name
  → "Contingent Beneficiary — Full Name"
  → Condition: hasContingentBeneficiary equals Yes

[required, mapped]    bene2Pct
  → "Contingent Beneficiary — Allocation %"
  → Condition: hasContingentBeneficiary equals Yes`}</pre>

      <p>The second gateway is itself conditional on the first — it only appears after the advisor confirms a primary beneficiary exists.</p>

      <h2>Other uses of this pattern</h2>
      <ul>
        <li><strong>Joint accounts</strong> — "Is this a joint account?" gates all co-applicant fields</li>
        <li><strong>Spousal consent</strong> — "Is the client married?" gates the spouse name and consent signature fields</li>
        <li><strong>Source of funds</strong> — "Source of funds" equals "Other" gates a free-text explanation field</li>
        <li><strong>Permanent residency</strong> — "US Citizen" equals "No" gates green card number and country of citizenship</li>
        <li><strong>Transfer instructions</strong> — "Transfer type" equals "Partial" gates a dollar amount or percentage field</li>
      </ul>

      <div className="callout-info">
        <strong>Conditions are enforced on the backend too.</strong> A field hidden by an unmet condition is skipped during PDF generation and ignored in validation — even if someone submits the form directly via the API.
      </div>
    </div>
  );
}
