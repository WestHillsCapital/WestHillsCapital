export default function RepeatingFieldGroups() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Common Patterns</div>
        <h1>Repeating Field Groups</h1>
        <p className="text-lg text-white/55 mt-2">Use a count dropdown to show exactly as many item blocks as the client needs — no more, no less.</p>
      </div>

      <p>Some documents allow a variable number of the same type of entry: beneficiaries, co-trustees, referenced accounts, prior employers, or property descriptions. Instead of building a fixed number of blocks and hiding the extras, the <strong>count-driven repeating group</strong> pattern lets a single dropdown control exactly how many blocks appear in the interview.</p>

      <h2>Why a count dropdown — not a yes/no</h2>
      <p>A yes/no question ("Do you have beneficiaries?") adds a step without adding information. If someone answers "No," nothing appears. If they answer "Yes," you still have to ask how many. Skipping straight to the count question achieves the same gating with one fewer click and cleaner logic.</p>
      <p>Use a <strong>radio or dropdown</strong> for the count field — not a free-text number. Docuplete conditions use <code>equals</code> and <code>not_equals</code>, so you need fixed values like <code>1</code>, <code>2</code>, <code>3</code> to write clean per-block conditions.</p>

      <h2>The pattern</h2>
      <ol>
        <li><strong>Create a count gateway field</strong> — a required, unmapped dropdown or radio asking how many items the client wants to add. Options: <code>1</code>, <code>2</code>, <code>3</code>, etc.</li>
        <li><strong>Build a "block" for each possible item</strong> — each block is a group of fields (name, relationship, percentage, etc.) for that position.</li>
        <li><strong>Condition each block on the count</strong> — Block 1 is always shown when the gateway is answered. Block 2 shows when count is <code>2</code> or higher. Block 3 shows when count is <code>3</code> or higher, and so on.</li>
        <li><strong>Optionally gate the count gateway itself</strong> — if the count question only applies in certain situations (e.g., unmarried applicants), condition it on an upstream field first.</li>
      </ol>

      <div className="callout-tip">
        <strong>Block 1 does not need an OR condition.</strong> Since the count field is required, any count value (1, 2, 3…) means Block 1 applies. Set Block 1 fields to <code>count not_equals ""</code> — or simply leave them unconditioned if the count gateway itself only appears when relevant.
      </div>

      <h2>Beneficiary example — full field list</h2>
      <p>This example covers a common IRA or annuity beneficiary section where a married applicant always assigns their spouse as 100% primary beneficiary, and an unmarried applicant chooses how many beneficiaries to name.</p>

      <pre>{`── Marital status ──────────────────────────────────────────
[required, unmapped]  maritalStatus
  → "Marital Status"
  → Type: Radio — Options: Married, Not Married

── Spouse path (married only) ──────────────────────────────
[required, mapped]    spouseName
  → "Spouse / Primary Beneficiary — Full Name"
  → Condition: maritalStatus equals Married

── Count gateway (unmarried only) ──────────────────────────
[required, unmapped]  beneficiaryCount
  → "How many beneficiaries would you like to add?"
  → Type: Radio — Options: 1, 2, 3
  → Condition: maritalStatus equals Not Married

── Beneficiary 1 (always shown once count is answered) ─────
[required, mapped]    bene1Name
  → "Beneficiary 1 — Full Name"
  → Condition: beneficiaryCount not_equals ""

[required, mapped]    bene1Relationship
  → "Beneficiary 1 — Relationship"
  → Condition: beneficiaryCount not_equals ""

[required, mapped]    bene1Pct
  → "Beneficiary 1 — Allocation %"
  → Validation: Percent
  → Condition: beneficiaryCount not_equals ""

── Beneficiary 2 (only when count ≥ 2) ────────────────────
[required, mapped]    bene2Name
  → "Beneficiary 2 — Full Name"
  → Condition: beneficiaryCount equals 2
              OR beneficiaryCount equals 3

[required, mapped]    bene2Relationship
  → "Beneficiary 2 — Relationship"
  → Condition: beneficiaryCount equals 2
              OR beneficiaryCount equals 3

[required, mapped]    bene2Pct
  → "Beneficiary 2 — Allocation %"
  → Validation: Percent
  → Condition: beneficiaryCount equals 2
              OR beneficiaryCount equals 3

── Beneficiary 3 (only when count = 3) ─────────────────────
[required, mapped]    bene3Name
  → "Beneficiary 3 — Full Name"
  → Condition: beneficiaryCount equals 3

[required, mapped]    bene3Relationship
  → "Beneficiary 3 — Relationship"
  → Condition: beneficiaryCount equals 3

[required, mapped]    bene3Pct
  → "Beneficiary 3 — Allocation %"
  → Validation: Percent
  → Condition: beneficiaryCount equals 3`}</pre>

      <div className="callout-info">
        <strong>OR conditions in the field editor.</strong> When a block should appear for multiple count values (e.g., Block 2 when count is 2 <em>or</em> 3), use the AND/OR toggle in the field editor to combine two conditions with OR logic. Both conditions share the same field (<code>beneficiaryCount</code>) but check different values.
      </div>

      <h2>How the conditions chain</h2>
      <p>The logic reads cleanly from top to bottom:</p>
      <ul>
        <li><strong>maritalStatus = Married</strong> → show spouseName, skip the count gateway entirely</li>
        <li><strong>maritalStatus = Not Married</strong> → show beneficiaryCount</li>
        <li><strong>beneficiaryCount = 1</strong> → show Block 1 only</li>
        <li><strong>beneficiaryCount = 2</strong> → show Blocks 1 and 2</li>
        <li><strong>beneficiaryCount = 3</strong> → show all three blocks</li>
      </ul>
      <p>No block ever appears before its dependencies are answered, and no dead-end branches exist — every path through the form resolves cleanly.</p>

      <h2>Extending the pattern</h2>
      <p>The same structure applies any time you have a variable number of the same type of entry:</p>
      <ul>
        <li><strong>Co-trustees</strong> — "How many co-trustees?" drives Trustee 2, Trustee 3 blocks</li>
        <li><strong>Transfer accounts</strong> — "How many accounts are you consolidating?" drives Account 2, Account 3 blocks</li>
        <li><strong>Prior employers</strong> — "Number of prior employers in the past 2 years" drives Employer 2, Employer 3 blocks</li>
        <li><strong>References</strong> — "How many references?" drives Reference 2, Reference 3 blocks</li>
      </ul>
      <p>In every case, the pattern is the same: one count field, one block per possible count value, conditions that include each block at the right threshold.</p>

      <h2>Field library tip</h2>
      <p>If you use a beneficiary block across multiple packages, add the individual fields (name, relationship, percentage, type) to your <strong>shared field library</strong> under a "Beneficiaries" category. You can then add them to any package in seconds and set conditions after the fact — rather than recreating the fields from scratch each time.</p>
    </div>
  );
}
