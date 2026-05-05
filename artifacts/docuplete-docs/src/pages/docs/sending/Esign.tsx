import { DocScreenshot } from "@/components/DocScreenshot";

export default function EsignSending() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Sending to Clients</div>
        <h1>E-Sign Identity Verification</h1>
        <p className="text-lg text-white/55 mt-2">How Docuplete verifies the signer's identity before accepting an electronic signature.</p>
      </div>

      <h2>Verification flow</h2>
      <p>When a client reaches the first signature or initials field in a session that requires e-sign, the following happens:</p>
      <ol>
        <li><strong>Email collection</strong> — If the session wasn't created with a client email, the client is asked to enter their email address.</li>
        <li><strong>OTP delivery</strong> — Docuplete sends a 6-digit one-time passcode to that email address.</li>
        <li><strong>Code entry</strong> — The client enters the code on the interview screen. They have 5 minutes and 3 attempts before the code expires. A new code can be requested after expiry.</li>
        <li><strong>Verification confirmed</strong> — Once the correct code is entered, the signature fields unlock. The verified email and timestamp are recorded in the session's audit trail.</li>
      </ol>

      <DocScreenshot
        src="/screenshots/esign-capture.svg"
        alt="The signature capture screen showing an identity-verified banner, the agreement text excerpt, Draw and Type tabs, a signature canvas with a drawn signature, and a Submit & Sign button"
        caption="The signature capture step — identity is verified once via OTP, then the client draws or types their signature before final submission."
      />

      <div className="callout callout-info">
        <strong>One verification per session:</strong> The OTP is requested once per session, not once per signature field. After a successful verification, all signature and initials fields in the session are unlocked.
      </div>

      <h2>Audit trail</h2>
      <p>Every completed e-sign session includes a Certificate of Completion appended to the generated PDF. It records:</p>
      <ul>
        <li>Signer's email address (as verified by OTP)</li>
        <li>Signer's IP address at time of signing</li>
        <li>OTP verification timestamp</li>
        <li>Signature applied timestamp (per signature/initials field)</li>
        <li>Session ID and package ID</li>
        <li>Docuplete's certification statement</li>
      </ul>

      <h2>Prefilling the client email</h2>
      <p>If you create the session with a client email already set, the OTP is sent to that email immediately when the client reaches the signature step — they don't need to type their email again. This is the recommended approach: supply the email when creating the session so verification is seamless.</p>

      <h2>Failed verification</h2>
      <p>After 3 failed OTP attempts, the code expires and the client must request a new one. If the client cannot receive the OTP (wrong email address, spam filter), void the session and create a new one with the corrected email address.</p>

      <h2>Legal compliance</h2>
      <p>Docuplete's e-sign implementation satisfies the requirements of:</p>
      <ul>
        <li><strong>U.S. ESIGN Act (2000)</strong> — Electronic signatures are legally equivalent to handwritten signatures for covered transactions.</li>
        <li><strong>UETA</strong> — Uniform Electronic Transactions Act, adopted in 47 states.</li>
      </ul>
      <p>The OTP verification establishes intent and authentication, and the audit trail provides the tamper-evident record required for enforceability.</p>
    </div>
  );
}
