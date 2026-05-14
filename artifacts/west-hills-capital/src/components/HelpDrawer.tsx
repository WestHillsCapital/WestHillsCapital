import { useEffect, useRef, useState } from "react";

interface Section {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "packages",
    title: "Package Builder",
    icon: "📦",
    content: (
      <div className="space-y-3 text-sm text-gray-700">
        <p>A <strong>Package</strong> bundles one or more PDF forms into a single guided interview. Clients fill everything out in one session — no back-and-forth.</p>
        <div className="space-y-2">
          <HelpItem label="New Package" detail="Click '+ New Package' to start. Give it a clear name clients will recognize (e.g. 'IRA Transfer')." />
          <HelpItem label="Documents tab" detail="Upload your PDF forms here. Drag them up or down to set the order they'll appear in the generated packet." />
          <HelpItem label="Map Fields tab" detail="Place data-entry fields on each page of your PDFs — client name, date, signature, etc." />
          <HelpItem label="Finalize tab" detail="Review the interview question order, set required vs. optional fields, then mark the package Active so it can be used in sessions." />
          <HelpItem label="Draft vs. Active" detail="Packages in Draft mode cannot be sent to clients. Switch to Active once your field layout is complete." />
          <HelpItem label="Save" detail="Changes auto-save when you navigate between steps. You can also press 'Save' manually at any time." />
        </div>
      </div>
    ),
  },
  {
    id: "fields",
    title: "Fields & Mapping",
    icon: "🗂",
    content: (
      <div className="space-y-3 text-sm text-gray-700">
        <p>Fields define what information you collect. Mapping places those fields onto the PDF so the answers fill in automatically.</p>
        <div className="space-y-2">
          <HelpItem label="Adding a field" detail="In the Map Fields view, drag a field from the right-hand rail and drop it onto the PDF page where the answer should appear." />
          <HelpItem label="Resizing & moving" detail="Click a placed field to select it, then drag its edges to resize or drag it to reposition." />
          <HelpItem label="Field types" detail="Text, Date, Dropdown, Checkbox, Radio, and Signature fields are supported. Choose the type that matches the PDF field." />
          <HelpItem label="Required vs. Optional" detail="Set a field as Required to block submission until it's answered. Optional fields can be skipped." />
          <HelpItem label="Sensitive fields" detail="Mark SSN, date-of-birth, and similar fields as Sensitive — the value is masked on screen and redacted from logs." />
          <HelpItem label="Conditions" detail="Use 'Show if…' conditions to display a field only when another field has a specific answer (e.g. show 'Beneficiary name' only when 'Add beneficiary?' is Yes)." />
          <HelpItem label="Field Library" detail="Save reusable fields (e.g. 'Client Name', 'SSN') to the Library so you can drop them into any package without reconfiguring from scratch." />
        </div>
      </div>
    ),
  },
  {
    id: "sessions",
    title: "Sessions",
    icon: "🔗",
    content: (
      <div className="space-y-3 text-sm text-gray-700">
        <p>A <strong>Session</strong> is one interview instance for a specific client. Each session gets a unique secure link.</p>
        <div className="space-y-2">
          <HelpItem label="Create a session" detail="Go to the Sessions tab, select a package, enter the client's name and any pre-fill values, then click 'Create Session'." />
          <HelpItem label="Send to client" detail="Copy the session link or use 'Email link' to send it directly. The client clicks the link and fills out the interview on their own." />
          <HelpItem label="Pre-fill" detail="Enter known values (name, email, account number) when creating the session — they appear pre-populated for the client." />
          <HelpItem label="Statuses" detail="Draft = not yet started. In Progress = client has opened it. Generated = client submitted and the PDF packet is ready. Voided = cancelled." />
          <HelpItem label="Downloading the packet" detail="Once Generated, open the session row and click 'Download PDF' to get the completed, filled PDF packet." />
          <HelpItem label="Voiding" detail="If a session needs to be cancelled, use 'Void' on the session row. The client's link will no longer work." />
          <HelpItem label="Expiry" detail="Sessions can be configured to expire after a set number of days. Expired sessions cannot be submitted." />
        </div>
      </div>
    ),
  },
  {
    id: "batch",
    title: "Batch CSV",
    icon: "📊",
    content: (
      <div className="space-y-3 text-sm text-gray-700">
        <p>Batch lets you create many sessions at once by uploading a CSV file — one row per client.</p>
        <div className="space-y-2">
          <HelpItem label="Download template" detail="Click 'Download template CSV' to get a file with the correct column headers for the selected package." />
          <HelpItem label="Fill in the CSV" detail="Each row is one client. Fill in whatever pre-fill values you have (name, email, account number, etc.)." />
          <HelpItem label="Upload & import" detail="Upload the completed CSV. The system validates each row and shows any mismatched or missing columns before importing." />
          <HelpItem label="Email links" detail="After importing, you can email all clients their unique session links in one click from the Batch Runs dashboard." />
          <HelpItem label="Tracking results" detail="The Batch Runs tab shows how many sessions are Generated, In Progress, or still Pending for each batch import." />
        </div>
      </div>
    ),
  },
  {
    id: "library",
    title: "Field Library",
    icon: "📚",
    content: (
      <div className="space-y-3 text-sm text-gray-700">
        <p>The Library stores shared field definitions you can reuse across all your packages — saving setup time and ensuring consistency.</p>
        <div className="space-y-2">
          <HelpItem label="Fields" detail="Reusable question definitions (e.g. 'Client Full Name', 'SSN', 'Date of Birth'). Once saved, drag them into any package." />
          <HelpItem label="Field Groups" detail="Bundle related library fields (e.g. all address fields) into a Group so you can add them all to a package in one step." />
          <HelpItem label="Version history" detail="Every time you edit a library field, the previous version is saved. You can restore an older version if needed." />
          <HelpItem label="Analytics" detail="See how many times each library field has been used across sessions to identify your most important fields." />
          <HelpItem label="Compliance tags" detail="Tag fields with compliance labels (e.g. 'KYC', 'AML'). The Compliance audit report shows which packages are missing required tagged fields." />
        </div>
      </div>
    ),
  },
  {
    id: "settings",
    title: "Settings & API",
    icon: "⚙️",
    content: (
      <div className="space-y-3 text-sm text-gray-700">
        <div className="space-y-2">
          <HelpItem label="Branding" detail="Upload your organization logo and set a brand color in Settings → Branding. These appear on the client interview page." />
          <HelpItem label="API keys" detail="Generate API keys in Settings → API Keys to use the Docuplete API for programmatic session creation and status checks." />
          <HelpItem label="Webhooks" detail="Set a webhook URL to receive real-time notifications (JSON POST) whenever a session is generated or its status changes." />
          <HelpItem label="Team members" detail="Invite colleagues under Settings → Team. Admins can manage packages and settings; Members can create and view sessions." />
          <HelpItem label="Two-factor auth" detail="Admins can require 2FA for all team members under Settings → Security." />
          <HelpItem label="Custom domain" detail="Enterprise plans can configure a custom domain so client interview links use your own URL." />
        </div>
      </div>
    ),
  },
  {
    id: "esign",
    title: "E-Signatures",
    icon: "✍️",
    content: (
      <div className="space-y-3 text-sm text-gray-700">
        <p>Docuplete supports legally binding e-signatures as part of the interview flow.</p>
        <div className="space-y-2">
          <HelpItem label="Adding signature fields" detail="In the Map Fields view, add 'Signature', 'Initials', and 'Signer Date' system fields. Drag them onto the PDF where the client should sign." />
          <HelpItem label="Email OTP verification" detail="For packages requiring verified identity, enable Email OTP. The client enters a one-time code sent to their email before they can submit." />
          <HelpItem label="Review before signing" detail="Enable 'Require preview' so the client must view the filled PDF before they can submit — a best practice for compliance." />
          <HelpItem label="Scroll confirmation" detail="Enable 'Require scroll confirmation' to ensure the client has scrolled through the full document before signing." />
          <HelpItem label="Timestamping" detail="Enterprise plans include RFC 3161 timestamp authority (TSA) certificates, providing cryptographic proof of when the document was signed." />
        </div>
      </div>
    ),
  },
];

function HelpItem({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-[7px]" />
      <span><strong>{label}:</strong> {detail}</span>
    </div>
  );
}

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  const [activeSection, setActiveSection] = useState("packages");
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  const section = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" aria-hidden />
      )}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-[480px] max-w-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Help guide"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Docuplete Help Guide</h2>
            <p className="text-xs text-gray-400 mt-0.5">Everything you need to get the most out of Docuplete</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close help"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar nav */}
          <nav className="w-44 shrink-0 border-r border-gray-100 bg-gray-50 py-3 overflow-y-auto">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                  activeSection === s.id
                    ? "bg-white text-gray-900 font-medium border-r-2 border-gray-900"
                    : "text-gray-500 hover:text-gray-800 hover:bg-white/70"
                }`}
              >
                <span className="text-base leading-none">{s.icon}</span>
                <span className="leading-snug">{s.title}</span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-lg">{section.icon}</span>
              {section.title}
            </h3>
            {section.content}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-400">Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-mono text-[10px]">Esc</kbd> to close</p>
          <a
            href="https://docs.docuplete.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 transition-colors"
          >
            Full documentation →
          </a>
        </div>
      </div>
    </>
  );
}
