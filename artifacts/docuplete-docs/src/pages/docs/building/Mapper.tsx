export default function Mapper() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Building a Package</div>
        <h1>Visual Mapper</h1>
        <p className="text-lg text-white/55 mt-2">Place and size answer boxes directly on your PDF preview with a drag-and-drop canvas.</p>
      </div>

      <h2>Opening the Mapper</h2>
      <p>From the package page, click the <strong>Mapper</strong> tab. You'll see the PDF pages rendered at full width. The left panel lists all your fields. The right panel shows formatting options for the selected mapping.</p>

      <h2>Adding a mapping</h2>
      <ol>
        <li>Select a field in the left panel.</li>
        <li>Click <strong>Add mapping</strong> (or simply click on the PDF where you want the box to appear).</li>
        <li>A bounding box appears. Drag it to position it precisely and drag the corners to resize it.</li>
        <li>Adjust formatting in the right panel — font size, alignment, text transform, date/number format.</li>
        <li>Click <strong>Save mapping</strong>.</li>
      </ol>

      <p>To map the same field to another location, click <strong>Add another mapping</strong> — the same field can have unlimited mappings across any page or document.</p>

      <h2>Precision positioning</h2>
      <p>For pixel-perfect placement, you can enter exact coordinates in the right panel instead of dragging. Coordinates are measured in points (pts) from the bottom-left corner of the page (standard PDF coordinate system).</p>

      <h2>Navigating pages</h2>
      <p>Use the page thumbnails in the bottom strip to jump to any page. For multi-document packages, use the document tab above the thumbnails to switch between documents.</p>

      <h2>Zoom and pan</h2>
      <ul>
        <li><strong>Zoom in/out</strong> — Use the +/- buttons or scroll with Ctrl/⌘ + scroll wheel.</li>
        <li><strong>Pan</strong> — Hold Space and drag, or use the scrollbars.</li>
        <li><strong>Fit to page</strong> — Press F or click the fit icon to reset the view.</li>
      </ul>

      <h2>Checkbox and radio group mappings</h2>
      <p>For checkbox and radio group fields, each mapping is tied to a specific option value. When you add a mapping for a radio field, you select which option this box represents. If that option is selected by the client, a checkmark (or "X") is rendered in that box. This lets you map each radio option to a different checkbox on the PDF form.</p>

      <h2>Signature mappings</h2>
      <p>Signature and initials fields are mapped the same way as text fields — draw a bounding box at the signature line. The signature image is scaled to fit within the box while preserving its aspect ratio.</p>

      <div className="callout callout-tip">
        <strong>Testing your mappings:</strong> After setting up mappings, create a test session from the package and fill it with dummy data. Download the generated PDF to confirm every field lands exactly where you expect.
      </div>
    </div>
  );
}
