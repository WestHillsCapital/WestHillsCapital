import { DocScreenshot } from "@/components/DocScreenshot";

export default function Branding() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Account & Settings</div>
        <h1>Organization Branding</h1>
        <p className="text-lg text-white/55 mt-2">Customize the client interview with your logo, colors, and messaging.</p>
      </div>

      <div className="callout callout-info">
        <strong>Pro and Enterprise only.</strong> Custom branding is available on Pro ($249/mo) and Enterprise plans. Starter accounts show Docuplete's default branding.
      </div>

      <h2>Configuring organization branding</h2>
      <p>Go to <strong>Settings → Branding</strong> to set your organization-wide defaults. These apply to all packages unless a package overrides them individually.</p>

      <DocScreenshot
        src="/screenshots/branding-settings.svg"
        alt="The Branding settings page split into two columns: logo, color, header text, footer text, and email sender name on the left; a live interview preview on the right"
        caption="The Branding settings page — configure logo, brand color, and messaging on the left and see a live preview of the client interview on the right."
      />

      <h3>Logo</h3>
      <ul>
        <li>Upload a PNG or SVG logo (recommended: SVG for sharp rendering at all sizes).</li>
        <li>Displayed at the top of every client interview screen.</li>
        <li>Max file size: 2 MB. Minimum width: 200px for crisp display on retina screens.</li>
        <li>On light backgrounds, use a version of your logo with dark or colored text. The interview background is white.</li>
      </ul>

      <h3>Brand color</h3>
      <p>Sets the primary color for buttons, progress indicators, and active states in the interview UI. Enter a hex color code (e.g., <code>#1B4FD8</code>). Docuplete automatically derives an accessible text color for contrast.</p>

      <h3>Interview header text</h3>
      <p>A short title shown at the top of the interview (below the logo). Keep it concise — 3–6 words. Examples: "New Account Application", "Client Intake Form", "Annual Disclosure".</p>

      <h3>Footer text</h3>
      <p>Shown at the bottom of every interview step. Use it for support contact info, disclaimers, or reassurance copy. HTML is not supported — plain text only.</p>

      <h3>Email sender name</h3>
      <p>The "From" name displayed in notification and confirmation emails. Defaults to your organization name. Examples: "Acme Advisors", "Smith Financial Group".</p>

      <h2>Per-package branding overrides</h2>
      <p>You can override any branding setting at the package level. Open the package, go to <strong>Configuration → Branding</strong>, and enable overrides. Useful when you manage multiple brands or product lines from one Docuplete account.</p>

      <h2>Preview</h2>
      <p>The Branding settings page includes a live preview showing exactly how the interview will look with your current settings applied.</p>
    </div>
  );
}
