import { DocScreenshot } from "@/components/DocScreenshot";

export default function TextBoxes() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Building a Package</div>
        <h1>Single-line vs. Multiline</h1>
        <p className="text-lg text-white/55 mt-2">Choose the right mapping mode for how text flows within a bounding box on the PDF.</p>
      </div>

      <h2>Single-line mode</h2>
      <p>In single-line mode (the default), the answer is rendered on one line within the bounding box. If the text is too long to fit:</p>
      <ul>
        <li>The font is <strong>auto-scaled down</strong> to fit (you can disable this)</li>
        <li>Or the text is <strong>truncated</strong> with an ellipsis (configurable)</li>
      </ul>
      <p>Single-line is appropriate for most fields: names, dates, account numbers, dollar amounts, phone numbers.</p>

      <h2>Multiline mode</h2>
      <p>In multiline mode, the text wraps within the bounding box. The box must be tall enough to accommodate the expected text. Use multiline for:</p>
      <ul>
        <li>Address fields that span two or three lines</li>
        <li>Explanation or narrative fields (e.g., "Describe your investment objectives")</li>
        <li>Any field where the client might type more than ~60 characters</li>
      </ul>

      <DocScreenshot
        src="/screenshots/textbox-config.png"
        alt="Side-by-side comparison of single-line and multiline text box configuration panels, each showing mode and a preview of how the answer renders in the PDF"
        caption="Single-line mode (left) auto-scales font to keep text on one line. Multiline mode (right) wraps text within the bounding box using the configured line height."
      />

      <h2>Line height</h2>
      <p>For multiline mappings, the line height (spacing between lines) defaults to 1.2× the font size — giving a clean, readable result for most content.</p>

      <h2>Choosing between the modes</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Field type</th><th>Recommended mode</th></tr>
          </thead>
          <tbody>
            <tr><td>Name, SSN, phone, email</td><td>Single-line</td></tr>
            <tr><td>Date, account number</td><td>Single-line</td></tr>
            <tr><td>Street address</td><td>Multiline (2–3 lines)</td></tr>
            <tr><td>Description / notes</td><td>Multiline</td></tr>
            <tr><td>Checkbox / radio</td><td>N/A (renders a mark, not text)</td></tr>
            <tr><td>Signature / initials</td><td>N/A (renders an image)</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
