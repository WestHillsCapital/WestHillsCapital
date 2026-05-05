export default function Experience() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Sending to Clients</div>
        <h1>Client Interview Experience</h1>
        <p className="text-lg text-white/55 mt-2">What your client sees when they open the session link.</p>
      </div>

      <h2>What the client experiences</h2>
      <p>When a client opens their session link, they see a clean, branded interview — no PDF, no blank form, no confusing legal language. The interview presents one field group at a time and guides them through step by step.</p>

      <h3>Interview flow</h3>
      <ol>
        <li><strong>Welcome screen</strong> — Displays your logo, interview title, and an optional introductory message. The client clicks "Begin" to start.</li>
        <li><strong>Field groups</strong> — Each group of related fields is presented as a page. Fields appear sequentially within the group. The client fills each one and clicks "Continue".</li>
        <li><strong>Conditional branching</strong> — If the client's answers trigger conditional fields, those questions appear inline. Sections that don't apply are silently skipped.</li>
        <li><strong>E-sign steps</strong> — If the package requires signature, signature and initials fields appear in the interview at their configured positions. Identity verification happens before the first signature.</li>
        <li><strong>Review screen</strong> — The client sees a summary of all their answers before submitting. They can navigate back to edit any section.</li>
        <li><strong>Submission</strong> — The client clicks "Submit". A confirmation screen appears. If configured, they receive a copy of their completed PDF via email.</li>
      </ol>

      <h2>Mobile-friendly</h2>
      <p>The interview is fully responsive. Clients on phones or tablets have the same experience as desktop users — fields are appropriately sized, the keyboard appears for the right input types (numeric keyboard for number fields, date picker for date fields), and the layout adapts gracefully.</p>

      <h2>Autosave</h2>
      <p>Progress is saved after each field group. If the client closes the tab and reopens the link, they resume where they left off. Autosave data is stored server-side and tied to the session.</p>

      <h2>No account required</h2>
      <p>The client does not need to create a Docuplete account. The session link is self-contained. If e-sign is required, the client's identity is verified via an OTP sent to their email — no password or account needed.</p>

      <h2>Branding customization</h2>
      <p>The interview reflects your organization's branding: logo, brand color, and footer text. You can configure defaults in <strong>Settings → Branding</strong> or override per package in the package's <strong>Configuration</strong> tab.</p>
    </div>
  );
}
