export default function SumGroups() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Common Patterns</div>
        <h1>Sum Groups — Allocation Fields That Must Total 100%</h1>
        <p className="text-lg text-white/55 mt-2">
          Ensure that a set of percentage fields — like beneficiary shares or asset allocations — always adds up to exactly 100% before the client can submit.
        </p>
      </div>

      <h2>What is a Sum Group?</h2>
      <p>
        A <strong>Sum Group</strong> is a label you assign to two or more percent or number fields in a package. Fields that share the same Sum Group label are tracked together in the client interview. The form displays a live progress bar showing the running total, and blocks submission until the group's values sum to exactly 100%.
      </p>
      <p>
        This is designed for patterns like:
      </p>
      <ul>
        <li>Beneficiary allocation percentages (primary beneficiaries must total 100%)</li>
        <li>Asset allocation splits across investment options</li>
        <li>Portfolio distribution percentages across asset classes</li>
        <li>Cost-sharing splits between multiple parties</li>
      </ul>

      <h2>Setting up a Sum Group</h2>
      <ol>
        <li>Open a package in the builder and go to the <strong>Map Fields</strong> step.</li>
        <li>Double-click a percent or number field to open its editor.</li>
        <li>In the <strong>Validation</strong> section, set the validation type to <strong>Percent</strong> (or Number).</li>
        <li>A <strong>Sum Group</strong> input appears below the validation settings. Enter a short label — for example, <code>primary_beneficiaries</code>.</li>
        <li>Repeat for every field that belongs in the same group, using the exact same label.</li>
        <li>Save each field. The fields are now linked by their shared Sum Group label.</li>
      </ol>

      <div className="bg-[#1B4FD8]/10 border border-[#1B4FD8]/25 rounded-xl px-5 py-4 my-4">
        <p className="text-[#5B8DEF] font-semibold text-sm mb-1">Naming convention</p>
        <p className="text-white/65 text-sm">
          Sum Group labels are case-sensitive and used as-is. Use lowercase with underscores (e.g. <code>primary_beneficiaries</code>, <code>contingent_beneficiaries</code>). The label is automatically humanized in the client UI — <code>primary_beneficiaries</code> displays as "Primary Beneficiaries — Allocation."
        </p>
      </div>

      <h2>What the client sees</h2>
      <p>
        While filling in the interview, the client sees a live allocation banner below the field group. The banner shows:
      </p>
      <ul>
        <li>A color-coded progress bar — amber while under-allocated, red when over 100%, green when exactly 100%</li>
        <li>The running total in the format <strong>45% / 100%</strong></li>
        <li>Plain-English guidance: how much is still unallocated, or a warning if the total exceeds 100%</li>
      </ul>
      <p>
        If the client attempts to submit with a sum group that doesn't reach exactly 100%, the form blocks with a descriptive error message and highlights the banner in red.
      </p>

      <h2>Example: Beneficiary allocation</h2>
      <pre>{`Fields in the package:
  "Primary Beneficiary 1 Share"   — Percent, Sum Group: primary_beneficiaries
  "Primary Beneficiary 2 Share"   — Percent, Sum Group: primary_beneficiaries
  "Primary Beneficiary 3 Share"   — Percent, Sum Group: primary_beneficiaries

Client fills in:
  50 / 30 / 20  → total 100% ✓ — form allows submission
  50 / 30 / 25  → total 105% ✗ — banner shows red, form blocks
  50 / 30 / —   → total 80%  ✗ — banner shows 20% still unallocated`}</pre>

      <h2>Multiple groups in one package</h2>
      <p>
        A single package can have multiple independent Sum Groups — for example, <code>primary_beneficiaries</code> and <code>contingent_beneficiaries</code> can coexist. Each group has its own progress banner and is validated independently. A client must satisfy all groups before submitting.
      </p>

      <h2>Fields omitted from the interview</h2>
      <p>
        Sum Group validation only applies to fields that are <strong>visible</strong> in the interview (not Omitted or hidden by a condition that evaluates to false). If a field is omitted or its condition is not met, it is excluded from the group total entirely. This lets you conditionally include extra beneficiary slots that only appear when the client indicates they have more beneficiaries.
      </p>

      <h2>Partial answers</h2>
      <p>
        The progress bar and validation only activate once at least one field in the group has been filled in. If no fields in a group have any value entered, the group is considered untouched and does not block submission (unless the individual fields are also marked Required, in which case the required check will block first).
      </p>

      <h2>Tips</h2>
      <ul>
        <li>Set each field's validation type to <strong>Percent</strong> to also enforce that individual values are between 0 and 100.</li>
        <li>For forms that always require exactly N beneficiaries, mark each share field as <strong>Required</strong> in addition to assigning the Sum Group — this ensures the client fills in every row, not just some.</li>
        <li>Use a consistent naming convention across your library (e.g. always <code>primary_beneficiaries</code>, never mixing with <code>primaryBeneficiaries</code>).</li>
        <li>Add a Read-only instructional field above the allocation fields (e.g. "Enter each beneficiary's share as a whole number. Shares must total exactly 100%.") to orient clients before they reach the fields.</li>
      </ul>
    </div>
  );
}
