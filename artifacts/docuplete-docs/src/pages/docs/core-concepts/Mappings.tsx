import { Link } from "wouter";

export default function Mappings() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Core Concepts</div>
        <h1>Mappings & Formatting</h1>
        <p className="text-lg text-white/55 mt-2">Mappings tell Docuplete exactly where on the PDF to stamp each field's answer, and how to format it.</p>
      </div>

      <p>Once fields are defined, mappings connect them to specific locations on your PDF pages. Each mapping is a bounding box — defined by coordinates, dimensions, page number, and document index — plus formatting rules that control how the value is rendered.</p>

      <h2>One field, many positions</h2>
      <p>A single field can be mapped to multiple positions across multiple pages and documents. For example, a "Full Legal Name" field might appear on page 1, page 4, and page 7 of a multi-page form — you create one mapping per position, all linked to the same field. The client only enters the value once.</p>

      <h2>Formatting options</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Option</th><th>Effect</th></tr>
          </thead>
          <tbody>
            <tr><td>Font size</td><td>Override the default font size (8pt–24pt)</td></tr>
            <tr><td>Font weight</td><td>Normal or bold</td></tr>
            <tr><td>Alignment</td><td>Left, center, or right within the bounding box</td></tr>
            <tr><td>Text transform</td><td>Uppercase, lowercase, or title case</td></tr>
            <tr><td>Date format</td><td>MM/DD/YYYY, YYYY-MM-DD, "Month D, YYYY", etc.</td></tr>
            <tr><td>Number format</td><td>Currency ($1,234.56), percent (12.5%), plain integer</td></tr>
            <tr><td>Checkbox render</td><td>Checkmark (✓), "X", "Yes"/"No", or filled box</td></tr>
            <tr><td>Multiline wrap</td><td>Word-wrap text within a tall bounding box</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Calculated fields</h2>
      <p>Mappings can render a <strong>calculated expression</strong> rather than a raw field value. Calculations are defined with a simple formula syntax:</p>
      <pre>{`{{ field.annual_income * 0.1 }}         → 10% of annual income
{{ field.first_name + " " + field.last_name }}  → full name concatenation
{{ today() }}                             → current date at generation time
{{ field.dob | age }}                     → age derived from date of birth`}</pre>

      <h2>Conditional render</h2>
      <p>A mapping can be set to only render if a condition is met — for example, only stamp a co-applicant name if the account type is "Joint". This prevents empty boxes from appearing on the filled PDF for fields that weren't applicable.</p>

      <h2>Visual Mapper</h2>
      <p>The Visual Mapper is the drag-and-drop canvas for creating and positioning mappings. See <Link href="/building-a-package/mapper">Visual Mapper</Link> for a step-by-step guide on using it.</p>
    </div>
  );
}
