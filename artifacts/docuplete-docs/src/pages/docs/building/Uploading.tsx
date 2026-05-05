import { DocScreenshot } from "@/components/DocScreenshot";

export default function Uploading() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Building a Package</div>
        <h1>Uploading a PDF</h1>
        <p className="text-lg text-white/55 mt-2">Docuplete works with any standard PDF. Here's how to upload and manage your document files.</p>
      </div>

      <h2>Supported PDF types</h2>
      <p>Docuplete accepts:</p>
      <ul>
        <li>Standard PDFs (PDF 1.4 through 2.0)</li>
        <li>PDFs with embedded form fields (AcroForms) — Docuplete reads these to suggest field names</li>
        <li>Password-protected PDFs — you must provide the password on upload</li>
        <li>Multi-page PDFs of any length</li>
        <li>PDFs up to 50 MB per file</li>
      </ul>

      <div className="callout callout-warning">
        <strong>Scanned documents:</strong> PDFs that are scanned images (not text-based) work fine for mapping — Docuplete places answer text on top of the scanned image. However, the visual quality of the rendered answer depends on the resolution of the underlying scan.
      </div>

      <h2>Uploading a file</h2>
      <ol>
        <li>Open the package and click the <strong>Documents</strong> tab.</li>
        <li>Click <strong>Upload PDF</strong> and select your file (or drag-and-drop it).</li>
        <li>The file processes in a few seconds. You'll see a thumbnail preview of each page.</li>
        <li>If the PDF is password-protected, a prompt asks for the password. Docuplete decrypts and re-saves a clean version — the password is not stored.</li>
      </ol>

      <DocScreenshot
        src="/screenshots/upload-dialog.svg"
        alt="The Upload PDF dialog showing a drag-and-drop zone and an optional password field"
        caption="The Upload PDF dialog — drag your file in or click Browse. Enter the password if the document is protected."
      />

      <h2>Multiple documents in one package</h2>
      <p>To add more documents, click <strong>Upload PDF</strong> again. Documents are displayed in order. The order matters — it determines page numbering in the combined PDF output and the order the pages appear in the Visual Mapper.</p>
      <p>To reorder documents, drag them in the Documents tab. To remove a document, click the trash icon — any mappings for that document's pages are also removed.</p>

      <h2>Replacing a document</h2>
      <p>If your PDF template changes (for example, a new version of the form is released), you can replace it without rebuilding the whole package. Click <strong>Replace</strong> next to the document. Docuplete attempts to match existing mappings to the new document's pages by page number. Review the mappings in the Visual Mapper afterward to confirm positions are still accurate.</p>

      <div className="callout callout-info">
        <strong>Page-count changes:</strong> If the replacement PDF has fewer pages than the original, any mappings on the removed pages are deleted. You'll be warned before confirming.
      </div>
    </div>
  );
}
