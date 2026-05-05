import { DocScreenshot } from "@/components/DocScreenshot";

export default function EsignFields() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Building a Package</div>
        <h1>E-Sign Fields</h1>
        <p className="text-lg text-white/55 mt-2">Capture legally binding electronic signatures and initials directly within the client interview.</p>
      </div>

      <h2>Available e-sign field types</h2>
      <ul>
        <li><strong>Signature</strong> — A full signature drawn by the client using a touch or mouse canvas, or typed in a signature font.</li>
        <li><strong>Initials</strong> — Same as signature but captures initials only, typically placed on every page that requires acknowledgment.</li>
        <li><strong>Date signed</strong> — A read-only date field automatically populated with the current date at the moment of signing. Cannot be edited by the client.</li>
      </ul>

      <h2>Adding e-sign fields</h2>
      <p>From the Fields tab, click <strong>Add Field</strong> and select <strong>Signature</strong> or <strong>Initials</strong>. E-sign fields behave like any other field — they appear in the interview at the position you place them in the field list, and they are mapped to the PDF in the Visual Mapper.</p>

      <DocScreenshot
        src="/screenshots/esign-field-placed.svg"
        alt="The Visual Mapper with a signature field selected, showing a blue bounding box placed over the signature line on a PDF document, with a captured signature preview inside"
        caption="Placing an e-sign field in the mapper — draw a bounding box over the signature line. The captured signature image scales to fit within the box."
      />

      <h2>How the client signs</h2>
      <p>When the client reaches a signature field in the interview:</p>
      <ol>
        <li>They are shown a signing panel with two options: <strong>Draw</strong> (freehand) or <strong>Type</strong> (renders their name in a signature font).</li>
        <li>If this is the first signature field in the session, Docuplete first verifies the client's identity via an OTP sent to their email. They must enter the code before signing.</li>
        <li>The signature image is captured and shown in the interview. The client can redo it before submitting.</li>
        <li>On submission, the signature image is embedded in the PDF at each mapped position.</li>
      </ol>

      <div className="callout callout-info">
        <strong>Audit trail:</strong> Each completed e-sign session includes a Certificate of Completion — a separate page appended to the PDF that records the signer's email, IP address, OTP verification timestamp, and signature timestamps.
      </div>

      <h2>Enabling e-sign on a package</h2>
      <p>E-sign is enabled per package. In the package's <strong>Configuration</strong> tab, toggle <strong>Require e-sign</strong>. When enabled:</p>
      <ul>
        <li>All sessions created from this package will enforce identity verification before signature.</li>
        <li>The session must include a client email address (used for OTP delivery).</li>
        <li>The completed PDF will include the Certificate of Completion.</li>
      </ul>

      <h2>Legal standing</h2>
      <p>Docuplete's e-sign implementation is compliant with the U.S. ESIGN Act (2000) and UETA. The OTP identity verification, IP capture, and audit trail provide the evidentiary record required to demonstrate intent to sign.</p>

      <div className="callout callout-warning">
        <strong>Not for wet-ink jurisdictions:</strong> Some documents (wills, certain real estate deeds, notarized instruments) may require wet-ink signatures in your jurisdiction. Consult your legal advisor before using e-sign for those document types.
      </div>
    </div>
  );
}
