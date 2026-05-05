export default function BatchFilling() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Batch CSV Import</div>
        <h1>Filling Out the CSV</h1>
        <p className="text-lg text-white/55 mt-2">Data format rules and best practices for preparing your batch import file.</p>
      </div>

      <h2>General rules</h2>
      <ul>
        <li>UTF-8 encoding required (default for Excel "Save as CSV UTF-8" and Google Sheets exports).</li>
        <li>First row must be the header row (field keys). Do not add extra header rows or blank rows at the top.</li>
        <li>Each subsequent row is one client / one PDF output.</li>
        <li>Maximum 5,000 rows per batch file.</li>
        <li>Maximum file size: 10 MB.</li>
      </ul>

      <h2>Value formats by field type</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Field type</th><th>Expected format</th><th>Example</th></tr>
          </thead>
          <tbody>
            <tr><td>text / textarea</td><td>Any string</td><td><code>John Smith</code></td></tr>
            <tr><td>number</td><td>Numeric value (no commas or currency symbols)</td><td><code>85000</code></td></tr>
            <tr><td>date</td><td>ISO 8601: YYYY-MM-DD</td><td><code>1975-04-12</code></td></tr>
            <tr><td>checkbox</td><td><code>true</code> or <code>false</code> (case-insensitive)</td><td><code>true</code></td></tr>
            <tr><td>radio / select</td><td>Exact option value (as configured in the field)</td><td><code>Individual</code></td></tr>
            <tr><td>multi-select</td><td>Comma-separated option values in quotes</td><td><code>"Stocks,Bonds,ETFs"</code></td></tr>
            <tr><td>signature / initials</td><td>Not supported in batch — leave blank</td><td></td></tr>
          </tbody>
        </table>
      </div>

      <h2>Blank values</h2>
      <p>Leave a cell empty to omit that field's value. For required fields, a blank value will cause that row to fail with an error — the other rows still process. For optional fields, a blank cell is fine — the mapping on the PDF will be empty.</p>

      <h2>Special characters</h2>
      <p>If a value contains a comma or a newline, wrap the entire value in double quotes:</p>
      <pre>{`address,"123 Main St, Suite 400"`}</pre>
      <p>If a value contains a double quote, escape it with another double quote:</p>
      <pre>{`notes,"Client said ""call me anytime"""`}</pre>

      <h2>Radio and dropdown exact matching</h2>
      <p>Radio and dropdown option values must match <em>exactly</em> — case-sensitive, same spacing — what you configured in the package's field options. If your option is "Individual Account" (with capital I), entering "individual account" will fail validation.</p>

      <div className="callout callout-tip">
        <strong>Tip:</strong> Open the example row in the downloaded template — it shows the correct option values for every radio/dropdown field in your package.
      </div>
    </div>
  );
}
