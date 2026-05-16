export default function UnmappedRoutingFields() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Common Patterns</div>
        <h1>Unmapped Routing Fields</h1>
        <p className="text-lg text-white/55 mt-2">Collect answers that drive interview logic without writing anything to the PDF.</p>
      </div>

      <p>Not every field in your package needs to appear on the finished document. Some fields exist purely to guide the interview — to ask a question, capture the answer, and use that answer to decide what the advisor or client sees next. These are called <strong>routing fields</strong>.</p>

      <h2>How unmapped fields work</h2>
      <p>Mapping and interview behavior are independent. A field can be:</p>

      <table>
        <thead>
          <tr>
            <th>Required?</th>
            <th>Mapped?</th>
            <th>Effect</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Yes</td>
            <td>Yes</td>
            <td>Must be answered; value is written to the PDF</td>
          </tr>
          <tr>
            <td>Yes</td>
            <td>No</td>
            <td>Must be answered; value is <em>not</em> written to the PDF</td>
          </tr>
          <tr>
            <td>No</td>
            <td>Yes</td>
            <td>Optional; value is written if answered</td>
          </tr>
          <tr>
            <td>No</td>
            <td>No</td>
            <td>Optional routing field; no effect on the PDF at all</td>
          </tr>
        </tbody>
      </table>

      <p>The most useful combination for routing is <strong>required + unmapped</strong>. The advisor must answer the question before the document can be generated, but the answer stays in the interview — it never shows up on the printed form.</p>

      <h2>When to use a routing field</h2>
      <ul>
        <li><strong>Gating a conditional section</strong> — "Does the client have a beneficiary?" controls whether the beneficiary fields appear. The question itself doesn't belong on the PDF.</li>
        <li><strong>Disambiguation questions</strong> — "Is this a rollover or a new contribution?" drives which set of fields is shown, but that internal classification isn't printed.</li>
        <li><strong>Advisor-only notes</strong> — capturing context that informs the interview but isn't part of the client-facing document.</li>
        <li><strong>Computed routing</strong> — asking for a value that will be used via conditions on multiple downstream fields, even if the value itself doesn't appear in the output.</li>
      </ul>

      <h2>Setting up a routing field</h2>
      <ol>
        <li>Create the field with the appropriate type (Dropdown, Radio, or Text).</li>
        <li>Set Interview behavior to <strong>Required</strong> so it must be answered before generation.</li>
        <li>Reference it in the conditions of other fields using <code>equals</code>, <code>not_equals</code>, or <code>is_answered</code>.</li>
      </ol>

      <h2>Making a field required without a PDF placement</h2>
      <p>The field editor lets you set Interview behavior independently of whether a field is mapped. However, you may notice that a newly created field defaults to Optional. To mark it Required and leave it unmapped, the deliberate workflow is:</p>
      <ol>
        <li>In the field editor, set Interview behavior to <strong>Required</strong> and save.</li>
        <li>Open the <strong>Visual Mapper</strong>. Drag the field onto the PDF to give it a placement — this is what activates the Required enforcement.</li>
        <li>Right-click the placed field on the PDF and remove the mapping.</li>
        <li>The field now has no PDF placement but remains Required in the interview.</li>
      </ol>

      <div className="callout-tip">
        <strong>This workflow is intentional.</strong> Placing and then removing the mapping is a deliberate step — it ensures you've thought through where the field sits in the document before deciding to leave it unmapped. A field that drives conditions without a placement is a purposeful design choice, not an accident.
      </div>

      <div className="callout-info">
        <strong>The "No placement" badge is not an error.</strong> In the mapper's field list, unmapped fields show a grey "No placement" badge. For routing fields this is intentional — you can leave them there without issue.
      </div>

      <h2>Example: Transfer type routing</h2>

      <pre>{`[required, unmapped]  transferType
  → "Transfer type"
  → Type: Dropdown
  → Options: Full transfer, Partial transfer — by dollar amount,
             Partial transfer — by percentage

[required, mapped]    partialDollarAmount
  → "Dollar amount to transfer"
  → Validation: Currency
  → Condition: transferType equals "Partial transfer — by dollar amount"

[required, mapped]    partialPercentage
  → "Percentage to transfer"
  → Validation: Percent
  → Condition: transferType equals "Partial transfer — by percentage"`}</pre>

      <p>The "Transfer type" answer routes the advisor to exactly one of the two amount fields. Neither condition branch appears until the routing question is answered, and the routing question itself leaves no trace on the PDF.</p>

      <div className="callout-warning">
        <strong>Don't use Omit for routing fields.</strong> "Omit from interview" removes the field from the interview entirely — the advisor will never see it. Use <strong>Required</strong> (or Optional) without a mapping instead.
      </div>
    </div>
  );
}
