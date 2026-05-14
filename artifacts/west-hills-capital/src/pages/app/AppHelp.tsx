interface GuideSection {
  id: string;
  icon: string;
  title: string;
  summary: string;
  items: { label: string; detail: string }[];
}

const GUIDE: GuideSection[] = [
  {
    id: "packages",
    icon: "📦",
    title: "Package Builder",
    summary: "A Package bundles one or more PDF forms into a single guided interview. Clients fill everything out in one session.",
    items: [
      { label: "Create a package", detail: "Click '+ New Package', give it a recognizable name (e.g. 'IRA Transfer'), then upload your PDF documents." },
      { label: "Document order", detail: "Drag documents up or down in the Documents tab to set the order they appear in the final PDF packet." },
      { label: "Map Fields (step 2)", detail: "Place data-entry fields directly on each PDF page — client name, date, signature, and more." },
      { label: "Finalize (step 3)", detail: "Review the interview question order and required/optional settings, then set the package to Active." },
      { label: "Draft vs. Active", detail: "Only Active packages can be used in sessions. Keep packages in Draft while you're building or making changes." },
      { label: "Save", detail: "Changes save automatically when navigating between steps. You can also click 'Save' manually at any time." },
    ],
  },
  {
    id: "fields",
    icon: "🗂",
    title: "Fields & Mapping",
    summary: "Fields define what information you collect. Mapping places those fields onto the PDF so answers fill in automatically.",
    items: [
      { label: "Adding a field", detail: "In the Map Fields view, drag a field from the right-hand rail and drop it onto the PDF where the answer should appear." },
      { label: "Resizing & moving", detail: "Click a placed field to select it, drag edges to resize, or drag the field body to reposition." },
      { label: "Field types", detail: "Text, Date, Dropdown, Checkbox, Radio, Initials, and Signature — choose the type that matches what you're collecting." },
      { label: "Required vs. Optional", detail: "Required fields block submission until answered. Optional fields can be skipped by the client." },
      { label: "Sensitive fields", detail: "Mark SSN, date-of-birth, and similar values as Sensitive — they're masked on screen and redacted from logs." },
      { label: "Conditional fields", detail: "Show a field only when another field has a specific answer using 'Show if…' conditions." },
      { label: "Field Library", detail: "Save fields you reuse often (e.g. 'Client Name', 'SSN') to the Library — then drop them into any package instantly." },
    ],
  },
  {
    id: "sessions",
    icon: "🔗",
    title: "Sessions",
    summary: "A Session is one interview instance for a specific client. Each session gets a unique secure link.",
    items: [
      { label: "Create a session", detail: "Go to the Sessions tab, select a package, enter the client's name and any known values, then click 'Create Session'." },
      { label: "Send to client", detail: "Copy the session link or use 'Email link' to send it directly. The client clicks the link and completes the interview." },
      { label: "Pre-fill values", detail: "Enter known data (name, email, account number) when creating the session — it appears pre-populated for the client." },
      { label: "Session statuses", detail: "Draft = not started. In Progress = client opened it. Generated = submitted and PDF ready. Voided = cancelled." },
      { label: "Download the packet", detail: "Once Generated, click 'Download PDF' on the session row to get the completed, signed PDF packet." },
      { label: "Void a session", detail: "Use 'Void' to cancel a session. The client's link stops working immediately." },
    ],
  },
  {
    id: "batch",
    icon: "📊",
    title: "Batch CSV",
    summary: "Create many sessions at once by uploading a CSV file — one row per client.",
    items: [
      { label: "Download template", detail: "Click 'Download template CSV' to get a file with the correct column headers for your selected package." },
      { label: "Fill in the CSV", detail: "Each row is one client. Add any pre-fill values you have — name, email, account number, etc." },
      { label: "Upload & import", detail: "Upload the CSV. The system validates each row and flags mismatched columns before importing." },
      { label: "Email links", detail: "After importing, email all clients their unique session links in one click from the Batch Runs view." },
      { label: "Track results", detail: "The Batch Runs view shows Generated, In Progress, and Pending counts for each batch import." },
    ],
  },
  {
    id: "library",
    icon: "📚",
    title: "Field Library",
    summary: "The Library stores shared field definitions you can reuse across all packages — saving time and keeping things consistent.",
    items: [
      { label: "Fields", detail: "Save reusable questions (e.g. 'Client Full Name', 'SSN') here, then drag them into any package." },
      { label: "Field Groups", detail: "Bundle related library fields (e.g. all address fields) into a Group to add them all to a package at once." },
      { label: "Version history", detail: "Every edit to a library field saves the previous version. Restore older versions if needed." },
      { label: "Analytics", detail: "See how many times each library field has been used across sessions." },
      { label: "Compliance tags", detail: "Tag fields with compliance labels (e.g. 'KYC', 'AML'). The Compliance report shows which packages are missing required fields." },
    ],
  },
  {
    id: "esign",
    icon: "✍️",
    title: "E-Signatures",
    summary: "Docuplete supports legally binding e-signatures collected directly in the interview.",
    items: [
      { label: "Adding signature fields", detail: "In Map Fields, add 'Signature', 'Initials', and 'Signer Date' system fields. Drag them onto the PDF where the client signs." },
      { label: "Email OTP", detail: "Enable Email OTP to verify the client's identity with a one-time code before they can submit." },
      { label: "Preview before signing", detail: "Enable 'Require preview' so clients must view the completed PDF before submitting — recommended for compliance." },
      { label: "Scroll confirmation", detail: "Enable 'Require scroll confirmation' to ensure the client has read the full document before signing." },
      { label: "Timestamping", detail: "Enterprise plans include RFC 3161 timestamp certificates providing cryptographic proof of signing time." },
    ],
  },
  {
    id: "settings",
    icon: "⚙️",
    title: "Settings & API",
    summary: "Configure branding, API access, webhooks, and your team from the Settings page.",
    items: [
      { label: "Branding", detail: "Upload your logo and set a brand color in Settings → Branding. These appear on client interview pages." },
      { label: "API keys", detail: "Generate API keys in Settings → API Keys to create and manage sessions programmatically." },
      { label: "Webhooks", detail: "Set a webhook URL to receive real-time JSON notifications when sessions are generated or status changes." },
      { label: "Team members", detail: "Invite colleagues in Settings → Team. Admins manage packages and settings; Members create and view sessions." },
      { label: "Two-factor auth", detail: "Require 2FA for all team members under Settings → Security." },
      { label: "Custom domain", detail: "Enterprise plans can use your own domain for client interview links." },
    ],
  },
];

function GuideCard({ section }: { section: GuideSection }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <span className="text-2xl">{section.icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{section.summary}</p>
        </div>
      </div>
      <div className="px-6 py-4 space-y-3">
        {section.items.map((item) => (
          <div key={item.label} className="flex gap-2.5 text-sm">
            <span className="mt-[6px] shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300" />
            <span className="text-gray-600"><span className="font-medium text-gray-800">{item.label}:</span> {item.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AppHelp() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">User Guide</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Everything you need to build packages, collect client paperwork, and manage your workflow in Docuplete.
        </p>
      </div>

      {/* Quick-jump nav */}
      <div className="flex flex-wrap gap-2 mb-8">
        {GUIDE.map((s) => (
          <a
            key={s.id}
            href={`#help-${s.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition-colors"
          >
            <span>{s.icon}</span>
            {s.title}
          </a>
        ))}
      </div>

      <div className="space-y-6">
        {GUIDE.map((s) => (
          <div key={s.id} id={`help-${s.id}`}>
            <GuideCard section={s} />
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-xl bg-gray-50 border border-gray-200 px-6 py-5 flex items-start gap-4">
        <span className="text-2xl">📖</span>
        <div>
          <p className="text-sm font-medium text-gray-800">Need more detail?</p>
          <p className="text-sm text-gray-500 mt-0.5">
            The full Docuplete documentation — including API reference, webhook payloads, and integration guides — is at{" "}
            <a
              href="https://docs.docuplete.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-800 underline underline-offset-2 hover:text-gray-600"
            >
              docs.docuplete.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
