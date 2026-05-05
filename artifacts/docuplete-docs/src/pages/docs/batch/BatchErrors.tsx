export default function BatchErrors() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Batch CSV Import</div>
        <h1>Understanding Errors</h1>
        <p className="text-lg text-white/55 mt-2">How to read and resolve the two types of errors: structural and per-row.</p>
      </div>

      <h2>Structural errors (pre-processing)</h2>
      <p>These prevent the batch from starting. They are shown immediately after upload:</p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Error</th><th>Cause</th><th>Fix</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Unrecognized column</td>
              <td>A header column doesn't match any field key in the package</td>
              <td>Rename or remove the column; re-download the template to get the current keys</td>
            </tr>
            <tr>
              <td>Missing required column</td>
              <td>A field marked as required (and not pre-fillable) has no column in the CSV</td>
              <td>Add the missing column with the correct header</td>
            </tr>
            <tr>
              <td>File too large</td>
              <td>File exceeds 10 MB</td>
              <td>Split into multiple batch files (&lt;5,000 rows each)</td>
            </tr>
            <tr>
              <td>Invalid encoding</td>
              <td>File is not UTF-8</td>
              <td>Re-export from Excel using "Save as CSV UTF-8"</td>
            </tr>
            <tr>
              <td>Too many rows</td>
              <td>More than 5,000 data rows</td>
              <td>Split into multiple files</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Per-row errors (during processing)</h2>
      <p>These affect individual rows but don't stop the batch. Other rows continue processing.</p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Error</th><th>Cause</th><th>Fix</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Required field blank</td>
              <td>A required field has no value in this row</td>
              <td>Fill in the missing value in the source data and re-run</td>
            </tr>
            <tr>
              <td>Invalid date format</td>
              <td>Date value is not in YYYY-MM-DD format</td>
              <td>Reformat dates to ISO 8601</td>
            </tr>
            <tr>
              <td>Option not found</td>
              <td>Radio/select value doesn't match any configured option</td>
              <td>Check exact capitalization and spelling against the template example row</td>
            </tr>
            <tr>
              <td>Value too long</td>
              <td>Text value exceeds the field's max length</td>
              <td>Truncate or edit the value</td>
            </tr>
            <tr>
              <td>Number out of range</td>
              <td>Number exceeds the field's min/max constraint</td>
              <td>Correct the value</td>
            </tr>
            <tr>
              <td>PDF generation failed</td>
              <td>An error occurred stamping answers onto the PDF (rare)</td>
              <td>Contact support with the batch run ID and row number</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Error report</h2>
      <p>Download the error report CSV from the Batch Runs tab. It contains the original row data plus an extra <code>_error</code> column describing what went wrong. Filter on <code>_error</code> to see only failed rows, fix the data, and re-upload those rows as a new batch.</p>
    </div>
  );
}
