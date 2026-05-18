export default function AutoFillFields() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Common Patterns</div>
        <h1>Auto-Fill Fields</h1>
        <p className="text-lg text-white/55 mt-2">Automatically copy an answer from one field into another when a trigger condition is met.</p>
      </div>

      <p>Many forms share data across sections — a spouse's address often matches the primary account holder's address, and a joint account holder may share the same mailing information. The auto-fill pattern eliminates redundant data entry by copying values automatically as soon as the triggering condition is satisfied.</p>

      <h2>How it works</h2>
      <p>Each field can be configured with a <strong>copyFrom</strong> rule consisting of three parts:</p>
      <ul>
        <li><strong>Source field</strong> — the field whose current value will be copied into this field.</li>
        <li><strong>Trigger field</strong> — the field whose answer determines whether the copy fires.</li>
        <li><strong>Trigger value</strong> — the specific answer the trigger field must equal to activate the copy.</li>
      </ul>
      <p>When the trigger field's answer changes to the trigger value during the interview, the source field's current value is immediately copied in. The auto-filled value is fully editable — the user can overwrite it if needed.</p>

      <h2>Configuring auto-fill in the field editor</h2>
      <ol>
        <li>Open a field for editing (double-click its card in the mapper, or use ⋯ → Edit in the field list).</li>
        <li>Scroll to the <strong>Auto-fill from another field when</strong> section and expand it.</li>
        <li>Select the <strong>source field</strong> from the dropdown — this is the field whose value will be copied.</li>
        <li>Select the <strong>trigger field</strong> — the field that controls when the copy fires.</li>
        <li>Enter the <strong>trigger value</strong> — the exact answer the trigger field must equal.</li>
        <li>Save the field. The rule is now active for all future interviews on this package.</li>
      </ol>

      <div className="callout-tip">
        <strong>The auto-fill is non-destructive.</strong> It fires once when the trigger condition is first met. If the user changes the trigger field away from the trigger value and back again, the copy fires again — but any manual edits made in between are overwritten. Design accordingly.
      </div>

      <h2>Beneficiary same-address example</h2>
      <p>The most common use case: when a beneficiary's relationship is "Spouse," their address is almost always the same as the account holder's. Here is the complete field setup:</p>

      <pre>{`[required]  beneRelationship
  → "Primary Beneficiary — Relationship"
  → Type: Dropdown — Options: Spouse, Child, Parent, Sibling, Other

[required]  beneAddress
  → "Primary Beneficiary — Street Address"
  → Auto-fill: copy from clientAddress
             when beneRelationship equals Spouse

[required]  beneCity
  → "Primary Beneficiary — City"
  → Auto-fill: copy from clientCity
             when beneRelationship equals Spouse

[required]  beneState
  → "Primary Beneficiary — State"
  → Auto-fill: copy from clientState
             when beneRelationship equals Spouse

[required]  beneZip
  → "Primary Beneficiary — ZIP"
  → Auto-fill: copy from clientZip
             when beneRelationship equals Spouse`}</pre>

      <p>When the advisor or client selects "Spouse" for the relationship, all four address fields populate instantly from the primary account holder's address. They can be edited if the mailing addresses differ.</p>

      <h2>Combining auto-fill with conditional display</h2>
      <p>Auto-fill and conditional display work independently and can be applied to the same field simultaneously. A common pattern is to show the beneficiary address block only when a beneficiary exists, and auto-fill it when the relationship is "Spouse":</p>

      <pre>{`[required]  beneRelationship
  → "Primary Beneficiary — Relationship"
  → Condition: hasBeneficiaries equals Yes

[required]  beneAddress
  → "Primary Beneficiary — Street Address"
  → Condition: hasBeneficiaries equals Yes
  → Auto-fill: copy from clientAddress
             when beneRelationship equals Spouse`}</pre>

      <h2>Other uses of this pattern</h2>
      <ul>
        <li><strong>Joint account holder address</strong> — "Same address as primary?" equals "Yes" triggers copying all primary address fields into joint holder address fields</li>
        <li><strong>Alternate mailing address</strong> — "Mail to same address?" equals "No" clears (or pre-fills from another source) the alternate address fields</li>
        <li><strong>Custodian contact info</strong> — when a specific custodian is selected, copy that custodian's standard address from a known field default</li>
        <li><strong>Co-trustee name</strong> — when trust type equals "Revocable Living Trust," copy the primary client's name into the trustee name field</li>
      </ul>

      <div className="callout-tip">
        <strong>Auto-fill does not replace prefill.</strong> Prefill injects known values at session-creation time (from a CRM or the Deal Builder). Auto-fill reacts to answers entered during the interview itself. Use both together — prefill the primary address fields so they're already populated when the session opens, then auto-fill copies them into the beneficiary fields when the relationship is set.
      </div>
    </div>
  );
}
