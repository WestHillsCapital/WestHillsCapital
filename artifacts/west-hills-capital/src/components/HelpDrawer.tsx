import { useEffect, useRef, useState } from "react";

interface Section {
  id: string;
  title: string;
  icon: string;
  summary?: string;
  items: { label: string; detail: string }[];
}

const SECTIONS: Section[] = [
  {
    id: "packages",
    icon: "📦",
    title: "Package Builder",
    summary: "A Package bundles one or more PDF forms into a single guided interview. Build it in three steps: Documents → Map Fields → Finalize.",
    items: [
      { label: "Create a package", detail: "Click '+ New Package', give it a name (e.g. 'IRA Transfer'), then upload your PDF files. You can upload multiple PDFs at once by dragging them all onto the drop zone." },
      { label: "Document order", detail: "Drag document tiles in the Documents tab to set the order they appear in the final PDF packet. Clients receive a single merged file with all documents in this order." },
      { label: "Replacing a PDF", detail: "Click 'Replace' under any document tile to swap out the PDF without losing any field mappings that are already placed on it." },
      { label: "Draft vs. Active", detail: "Packages start in Draft. Only Active packages can be used in sessions, batch runs, or customer links. Keep packages in Draft while building or making changes — switching back to Draft doesn't break existing sessions." },
      { label: "Tags", detail: "Add free-form tags (e.g. 'IRA', 'onboarding', 'joint-account') to a package in the settings area. Tags filter the package picker — click a tag chip to show only matching packages." },
      { label: "Package types and groups", detail: "Assign a Transaction Type (e.g. 'New Account') and a Group (e.g. 'Retirement') to a package for reporting and filtering. Types and Groups are managed in Library → Types and Library → Groups." },
      { label: "Auto-save", detail: "Changes save automatically when you navigate between builder steps. A 'Saved' indicator appears in the toolbar when auto-save completes." },
      { label: "Test interview", detail: "Click 'Launch test interview' in the Finalize step to run through the package as a staff member would see it — no session is created and no PDF is generated." },
    ],
  },
  {
    id: "mapper",
    icon: "🗺️",
    title: "Visual Mapper — Controls & Toggles",
    summary: "The Map Fields view is the PDF canvas where you place fields. It has several toolbar toggles and supports both mouse and keyboard interactions.",
    items: [
      { label: "Placing a field (drag)", detail: "Drag any field from the right-hand field list and drop it onto the PDF page at the exact spot the answer should appear. A colored box appears where the data will print." },
      { label: "Placing a field (click-to-place)", detail: "Click a field card in the right panel — the cursor becomes a crosshair. Then click anywhere on the PDF to place it precisely. Press Esc to cancel without placing." },
      { label: "Double-clicking a field card", detail: "Double-clicking a field card in the right panel opens its editor so you can change the field name, type, validation, or interview mode without leaving the mapper." },
      { label: "Moving a placed field", detail: "Click the field box on the PDF to select it, then drag the field body to reposition it anywhere on the page." },
      { label: "Resizing a placed field", detail: "Select a field on the PDF, then drag any edge or corner handle to resize the box. The resize tooltip shows the current width × height in PDF points." },
      { label: "Right-clicking a placed field", detail: "Right-click any placed field to open the inspector immediately, regardless of which inspector mode is active. The inspector shows format, alignment, font size, orientation, multi-line, and recipient options." },
      { label: "Deleting a placed field", detail: "Select a field on the PDF, then press Delete or Backspace to remove that placement. The field still exists in the field list — only the PDF placement is removed." },
      { label: "Page / Scroll mode toggle", detail: "The toolbar has two view modes. Page mode shows one document page at a time — use the left panel to navigate pages. Scroll mode renders all documents and all pages as a continuous vertical canvas so you can drag fields across documents without switching views." },
      { label: "Text / Labels toggle", detail: "Controls what the colored field boxes display on the PDF canvas. 'Labels' shows the field name (e.g. 'Client Name'). 'Text' shows a sample of how the actual output will look after format is applied (e.g. 'JOHN SMITH' for an uppercase-format name field)." },
      { label: "Snap to grid toggle (S)", detail: "When on, placed fields snap to a 4-point grid so edges align cleanly across the page. When off, fields can be positioned at any sub-point location. Toggle with the Snap button or press S. A gold underline on the button means snap is active." },
      { label: "PDF Fields toggle", detail: "When the uploaded PDF has existing AcroForm fields (interactive form fields baked into the PDF), this toggle reveals them as blue dashed overlays. Use this as a positioning guide — overlay your Docuplete field boxes on top of the matching AcroForm fields." },
      { label: "Auto-map button", detail: "Appears when PDF Fields is on and the PDF has AcroForm fields. Click it to automatically create Docuplete field mappings from every detected AcroForm field in one step. Review and adjust after auto-mapping." },
      { label: "Inspector: Panel vs. Popup", detail: "The inspector shows the settings for the currently selected field placement. Panel mode docks the inspector into the right sidebar. Popup mode shows a floating panel that appears only when you click or right-click a placed field. Toggle with the Panel / Popup button; your choice is remembered." },
      { label: "Zoom controls (+ / −)", detail: "Use the − and + buttons to zoom the PDF canvas. Click the percentage label to reset to 100%. Keyboard shortcuts: + to zoom in, − to zoom out." },
      { label: "Field orientation / rotation", detail: "In the inspector, the Rotation option lets you rotate a field box to 0°, 90°, 180°, or 270°. Use 90° or 270° for fields that run along the side of a form, such as a vertical signature line." },
    ],
  },
  {
    id: "keyboard",
    icon: "⌨️",
    title: "Keyboard Shortcuts",
    summary: "All keyboard shortcuts work while the Map Fields view is active. They save time during high-volume mapping sessions.",
    items: [
      { label: "← / → arrow keys", detail: "Navigate to the previous or next page of the currently selected document. Works in single-page (Page) mode only." },
      { label: "+ / − keys", detail: "Zoom the PDF canvas in or out by 25% increments. The zoom level resets when you switch documents." },
      { label: "S key", detail: "Toggle snap-to-grid on or off. The Snap button in the toolbar shows the current state — a gold underline means snap is active." },
      { label: "Esc key", detail: "Close an open popover, cancel a click-to-place operation, or deselect the currently selected field placement." },
      { label: "Delete / Backspace", detail: "Remove the currently selected field placement from the PDF. The field definition itself is not deleted — only its position on the PDF page is removed." },
    ],
  },
  {
    id: "formats",
    icon: "🔣",
    title: "Output Formats",
    summary: "Each field placement has an Output Format that controls how the collected answer is written into the PDF — separate from what the client types.",
    items: [
      { label: "As entered", detail: "The answer is printed exactly as the client typed it. This is the default for most text fields." },
      { label: "Uppercase / Lowercase", detail: "Converts the answer to ALL CAPS or all lowercase before printing. Useful for forms that require a specific text style regardless of how the client typed it." },
      { label: "First name / Last name / Middle name", detail: "Extracts only the first word, last word, or middle word from the answer. Use when a form has separate boxes for first, middle, and last name but you are collecting the full name in one field." },
      { label: "Last, First M.", detail: "Reformats a full name to 'Smith, John A.' format — last name, comma, first name, middle initial. Commonly required on financial and legal forms." },
      { label: "First Last", detail: "Normalizes spacing in a full name to 'First Last' order. Removes extra spaces and ensures consistent formatting." },
      { label: "Initials", detail: "Reduces a name to its initials (e.g. 'John Adam Smith' → 'J.A.S.'). Used for initialing pages." },
      { label: "Digits only", detail: "Strips all non-numeric characters from the answer, leaving only the digits. Useful for phone numbers, SSNs, or account numbers when the PDF field expects digits without formatting." },
      { label: "Last four", detail: "Prints only the last four digits of the answer. Common for SSNs on forms that show only the last four (e.g. '•••-••-1234')." },
      { label: "Currency", detail: "Formats the numeric answer as a currency amount (e.g. '50000' → '$50,000.00'). The field collects a plain number; the format adds the dollar sign and commas." },
      { label: "Date MM/DD/YYYY", detail: "Formats a date answer to the MM/DD/YYYY pattern. Use when the field collects a date but the form requires a specific date format." },
      { label: "Signature", detail: "Reserved for the system Signature field. Renders the client's drawn or typed signature image into the PDF bounding box." },
    ],
  },
  {
    id: "field-modes",
    icon: "🔧",
    title: "Field Interview Modes",
    summary: "Every field has an Interview Mode that controls whether and how the field appears in the staff interview or customer form.",
    items: [
      { label: "Required", detail: "The client or staff must provide an answer before they can submit. The interview blocks at this question until it is answered. Use for fields that must appear on the final PDF — blank required fields produce incomplete documents." },
      { label: "Optional", detail: "The field appears in the interview but can be skipped. If skipped, the corresponding PDF area is left blank. Use for fields that are not always applicable (e.g. 'Middle Name', 'Secondary Phone')." },
      { label: "Read-only", detail: "The field appears in the interview with its default value pre-filled and visible, but the client cannot change it. Used for fields you want to display for acknowledgment (e.g. the firm's name or a fixed account type)." },
      { label: "Omitted", detail: "The field is not shown in the interview at all. The PDF placement is still filled using the field's default value (if set). Use for calculated or pre-filled fields that should appear on the PDF but require no user input — for example, today's date auto-filled by a date field with a default of '{today}'." },
      { label: "Sensitive (masked)", detail: "Mark SSN, date-of-birth, account numbers, and similar PII as Sensitive. Sensitive fields are masked with dots on screen during the interview, redacted from webhook payloads and logs, and excluded from exports. The unmasked value still fills the PDF correctly." },
      { label: "Conditional display", detail: "Add a 'Show if…' condition to any field so it only appears when another field has (or doesn't have) a specific value. For example, show 'Joint Account Holder Name' only when 'Account Type' equals 'Joint'. Conditions use equals, not equals, is answered, or is not answered operators. When the trigger field is a radio, dropdown, or checkbox type, the Value input becomes a dropdown of that field's options — select from the list to avoid typos and case mismatches that would prevent the condition from firing." },
      { label: "Auto-fill from another field", detail: "In the field editor, expand 'Auto-fill from another field when' to configure a copy trigger: choose the source field (the field to copy from), the trigger field (whose answer activates the copy), and the trigger value. For radio, dropdown, and checkbox trigger fields, the 'Equals' input is a dropdown showing the field's actual defined options — select from the list rather than typing free-form text to avoid mismatches. When the condition is met during the interview, the value copies automatically. The copied value can still be edited by the user." },
      { label: "Deleting a field with dependencies", detail: "If a field you are deleting is referenced by another field's 'Show if…' condition or auto-fill trigger, Docuplete shows a dependency guard before proceeding. You have two options: 'Replace & Remove' lets you pick a replacement field — all references are automatically rewired to the replacement. 'Remove & Flag for Repair' deletes the field immediately and marks every dependent field with a ⚠ Repair badge so you can fix the references later. You can also cancel and keep the field." },
      { label: "Repair badge (broken references)", detail: "An amber ⚠ Repair badge appears on any field whose 'Show if…' condition or auto-fill trigger references a field that no longer exists. Open the flagged field's editor to see which rule is broken and update it to a valid field. Once all broken references in the field are resolved the badge disappears automatically." },
    ],
  },
  {
    id: "validation",
    icon: "✅",
    title: "Field Validation",
    summary: "Validation rules reject badly formatted answers before the session is submitted — catching errors before they reach the PDF.",
    items: [
      { label: "Built-in validation types", detail: "Choose from: Name (alphabetic with spaces), Number (numeric only), Currency (numeric with optional $ and commas), Email (valid email format), Phone (US phone number), Date (MM/DD/YYYY), Time (HH:MM), ZIP (5-digit), ZIP+4 (9-digit), SSN (###-##-####), Percent (0–100), or String (any non-empty text)." },
      { label: "Custom validation", detail: "Select 'Custom' and enter a regular expression pattern. The field answer must match the pattern to pass validation. Enter a custom error message to show when the pattern does not match." },
      { label: "Validation message", detail: "Every validation type lets you set a custom error message. If left blank, a generic message is shown. A specific message (e.g. 'Please enter your SSN as ###-##-####') helps clients fix errors faster." },
      { label: "None", detail: "No validation — any text, including blank, is accepted. This is the default for text fields. Use None for free-form fields like 'Special Instructions' where content cannot be validated." },
    ],
  },
  {
    id: "finalize",
    icon: "⚙️",
    title: "Finalize Settings (Per-Package)",
    summary: "The Finalize step has output and compliance options that are set individually for each package.",
    items: [
      { label: "Filled PDF Packet — always on", detail: "Every package always generates a completed PDF packet when an interview is submitted. This cannot be turned off — it is the core output of Docuplete." },
      { label: "Staff Interview", detail: "When enabled, staff can launch a guided interview from the Sessions tab or Deal Builder. Disable for packages that are batch-only — hiding the interview option keeps the package list cleaner for staff who don't need it." },
      { label: "Batch CSV", detail: "When enabled, the package appears in the Batch tab's package selector and accepts CSV uploads. Disable for packages that are staff-interview-only to prevent accidental bulk runs on individual-client forms." },
      { label: "Customer Link", detail: "When enabled, sessions on this package can generate a time-limited, branded link sent directly to the client. They fill it out on their own device with no login. Disable for packages that must only be completed with staff guidance." },
      { label: "Require document preview before signing", detail: "When on, the signer must open the filled PDF and view it before the signing step unlocks. Recommended for compliance with regulations requiring clients to review documents they are signing." },
      { label: "Require full scroll through document", detail: "When on, Docuplete renders the PDF inline and tracks whether the client has scrolled to the bottom. 'Proceed to sign' is locked until they have. Stricter than Preview — use for dense disclosure documents or regulatory forms." },
      { label: "Webhook / Make.com", detail: "When enabled, Docuplete fires an HTTPS POST to a URL you specify whenever an interview or customer form on this package is submitted. The payload includes all answers (sensitive fields are redacted). Each package has its own webhook URL and signing secret." },
      { label: "Interview order", detail: "The left panel in Finalize shows all interview questions in the order clients will see them. Drag to reorder. Click 'Sort by PDF order' to automatically sort fields to match the top-to-bottom position of their placements on the PDF page." },
      { label: "Fields hidden from interview", detail: "The collapsed section at the bottom of the interview order list shows all Omitted fields. These fields have placements on the PDF but will not be asked during the interview — they use their default values. E-sign system fields always appear here." },
    ],
  },
  {
    id: "sessions",
    icon: "🔗",
    title: "Sessions",
    summary: "A Session is one interview instance for a specific client. Each session gets a unique secure link. The session dashboard tracks progress in real time.",
    items: [
      { label: "Create a session", detail: "Go to the Sessions tab, select a package, enter the client's name and any known values, then click 'Create Session'. A unique link is generated immediately." },
      { label: "Pre-filling values", detail: "Enter known data (name, email, account number, date of birth) when creating the session — it appears pre-populated for the client. Pre-filled required fields still show in the interview for the client to confirm." },
      { label: "Send to client", detail: "Copy the session link or use 'Email link' to send it directly. The client clicks the link and completes the interview from any device without logging in." },
      { label: "Session statuses", detail: "Draft = created but not opened. In Progress = client has opened the link. Generated = client submitted and the PDF packet is ready. Voided = cancelled; the client's link no longer works." },
      { label: "Download the PDF", detail: "Once a session reaches Generated status, click 'Download PDF' on the session row to get the completed, signed PDF packet." },
      { label: "Session audit trail", detail: "Click into any Generated session to see the full audit trail: when the link was opened, each page viewed, when the client signed, their IP address, and browser. This log is immutable." },
      { label: "Void a session", detail: "Use 'Void' to cancel a session. The client's link stops working immediately. Voided sessions remain in the list for record-keeping but cannot be re-opened." },
      { label: "Email OTP verification", detail: "When enabled on a package, the client must enter a one-time code sent to their email address before they can access the interview. This verifies the client is the person who received the link." },
    ],
  },
  {
    id: "batch",
    icon: "📊",
    title: "Batch CSV",
    summary: "Batch CSV creates many sessions at once by uploading a spreadsheet — one row per client. Useful for generating dozens or hundreds of filled PDFs in a single operation.",
    items: [
      { label: "Download the template", detail: "Select a package in the Batch tab, then click 'Download template CSV'. The file has one column per interview field, with the correct header names the importer expects." },
      { label: "Fill in the spreadsheet", detail: "Each row is one client. Add any pre-fill values — name, email, account number, etc. Leave a cell blank if you don't have the data; optional fields will remain blank in the PDF, required fields will be flagged during validation." },
      { label: "Upload and validate", detail: "Drag the CSV onto the upload area or click to browse. The system validates every row before importing — mismatched column names and data format errors are flagged row-by-row before any sessions are created." },
      { label: "Fixing errors before import", detail: "If validation finds errors, a table shows each problem row and what is wrong. Correct the CSV and re-upload, or click individual errors to fix them inline before proceeding." },
      { label: "Emailing links after import", detail: "After importing, click 'Email all clients' in the Batch Runs view to send every client their unique session link in one action. You can also email individual rows." },
      { label: "Track results", detail: "The Batch Runs view shows a progress bar with Generated (completed), In Progress (client opened), and Pending (not yet opened) counts for each batch. Click any row to drill into individual sessions." },
      { label: "Batch run history", detail: "Previous batch runs are saved in the Batch Runs tab. You can re-download the original CSV, download a results export, or email stragglers who haven't completed their session." },
    ],
  },
  {
    id: "tags",
    icon: "🏷️",
    title: "Tags vs. Compliance Tags",
    summary: "Docuplete has two distinct tagging systems that serve different purposes and live in different places.",
    items: [
      { label: "Package Tags — what they are", detail: "Free-form text labels you add to a package (e.g. 'IRA', 'joint', 'brokerage', 'advisor-use-only'). Tags belong to the package, not to any field. Set them in the package's Finalize step or Overview settings." },
      { label: "Package Tags — how to add", detail: "In the Finalize or Overview section of a package, look for the Tags field. Type a tag name and press Enter or comma to add it. Remove a tag by clicking the × on its chip." },
      { label: "Package Tags — how to use", detail: "The package picker (in Sessions and Batch) shows tag filter chips at the top. Clicking a tag hides all packages that don't have that tag. Useful when you have many packages and need to find the right one quickly." },
      { label: "Compliance Tags — what they are", detail: "Structured labels applied to individual library fields to indicate which regulatory or internal compliance requirements they satisfy (e.g. 'KYC', 'AML', 'FINRA Rule 4512', 'Suitability'). Compliance tags live on fields, not on packages." },
      { label: "Compliance Tags — where to set them", detail: "Open the Field Library, click any field, and scroll to the Compliance Tags section in the field editor. Add one or more compliance tag names. These tags are shared across the organization — using the same tag name on multiple fields links them to the same compliance requirement." },
      { label: "Compliance Tags — how to use", detail: "In Library → Compliance, Docuplete shows a matrix of every compliance tag and which packages include at least one field carrying that tag. A red cell means a package is missing a field for that compliance requirement." },
      { label: "Key difference", detail: "Package tags are for navigation and organization — they help staff find the right package. Compliance tags are for auditing — they prove each package covers the required regulatory fields. A package can have both." },
    ],
  },
  {
    id: "library",
    icon: "📚",
    title: "Field Library",
    summary: "The Library tab stores shared field definitions and organizational data your whole team uses across packages.",
    items: [
      { label: "Fields tab", detail: "The main list of all shared field definitions. Each library field has a label, type, validation, and optionally a description and compliance tags. Drag any library field into any package instead of defining it from scratch — it stays linked so changes propagate." },
      { label: "Field Groups tab", detail: "A Field Group bundles several related library fields under one name (e.g. 'Client Address' groups Street, City, State, ZIP). In the mapper's field list, click 'Browse groups' to add all fields from a group to a package at once." },
      { label: "Types tab", detail: "Transaction Types (e.g. 'New Account', 'Transfer', 'Withdrawal') are organization-defined categories you assign to packages. Used for reporting, filtering, and integrations. Create and manage types here." },
      { label: "Groups tab", detail: "Recipient Groups represent entities in a transaction (e.g. 'Custodian', 'Depository', 'Joint Account Holder'). A group can be assigned to a set of field placements in the mapper — those fields are then associated with that recipient for multi-signer e-sign workflows." },
      { label: "Compliance tab", detail: "Shows a coverage matrix: compliance tags as rows, packages as columns. A checkmark means the package contains at least one field carrying that compliance tag. A missing mark means the package lacks coverage for that requirement." },
      { label: "Importing a library field", detail: "From any package's field list in the mapper, click 'Browse groups' or search for the field. Library fields show a chain-link icon. When imported, changes to the library field definition propagate to the package for future sessions." },
      { label: "Detaching a library field", detail: "In the package field list, click ⋯ → Detach. The field becomes an independent copy. Future library updates no longer affect it. Detaching is permanent — to re-link, delete the field and import from the library again." },
      { label: "Version history", detail: "Every save to a library field creates a version entry. Click a field, then open History to see prior versions. You can restore any previous version — the rollback takes effect on future sessions immediately." },
      { label: "Field analytics", detail: "The Analytics view for each library field shows how many times it has been used across all sessions. Use this before making changes to understand the impact." },
      { label: "Export / Import", detail: "Use Export to download the entire field library as JSON or CSV for backup or migration. Use Import to load field definitions from a previously exported file — useful when setting up a new organization or environment." },
    ],
  },
  {
    id: "esign",
    icon: "✍️",
    title: "E-Signatures",
    summary: "Docuplete collects legally binding e-signatures directly in the interview or customer link. All signing events are timestamped and logged.",
    items: [
      { label: "System e-sign fields", detail: "Three special fields are available in the mapper: Signature (drawn or typed), Initials (drawn or typed initials), and Signer Date (auto-filled with today's date). These are system-managed — they do not appear in the interview and are omitted automatically." },
      { label: "Placing signature fields", detail: "In Map Fields, scroll to the E-Sign section at the bottom of the field list. Drag Signature, Initials, or Signer Date onto the exact location on the PDF where the client should sign or initial." },
      { label: "Multiple signature locations", detail: "Place the Signature or Initials field multiple times on different pages. Each placement collects the same signature or initials and fills it into every spot. The client signs once and it applies everywhere." },
      { label: "Email OTP", detail: "Enable in the package's e-sign settings. Before the client can reach the signing step, they must enter a one-time code sent to the email address on their session. Provides identity verification and is recommended for all client-facing links." },
      { label: "Require preview before signing", detail: "Set in Finalize. Forces the client to open and view the completed PDF before the signing step unlocks. The PDF preview is rendered inline so the client can read it without downloading." },
      { label: "Require scroll confirmation", detail: "Set in Finalize. The inline PDF renderer tracks scroll position. 'Proceed to sign' is locked until the client scrolls to the very bottom of the document. Strictest level of read confirmation." },
      { label: "Audit trail", detail: "Every signing event is logged: link open time, each page viewed, signing time, IP address, and browser user agent. This immutable log is attached to the session and can be downloaded as a PDF audit certificate." },
      { label: "RFC 3161 timestamp", detail: "Enterprise plans embed an RFC 3161 trusted timestamp certificate in every signed PDF. This cryptographically proves the document existed in its exact form at the moment of signing, satisfying legal requirements for time-of-signing evidence." },
    ],
  },
  {
    id: "recipients",
    icon: "👥",
    title: "Multi-Recipient & Signers",
    summary: "When a document needs signatures from more than one party — e.g. client and custodian — use Recipients to assign fields to different signers.",
    items: [
      { label: "Adding recipients", detail: "In the mapper toolbar, expand the Recipients panel (top-left, shows the current signer list). Click '+ Add Recipient' to add a new signer role: Customer, Group, Custodian, Depository, or Custom." },
      { label: "Assigning a field to a recipient", detail: "Select any placed field on the PDF. In the inspector, choose a recipient from the Recipient dropdown. That field's box changes to the recipient's color so you can visually distinguish who fills what." },
      { label: "Recipient types", detail: "Customer = the primary client filling out the form. Group = an internal team or entity (e.g. 'Custodian'). Depository = a receiving financial institution. Custom = any other named party. Each type can be linked to an existing organization entity." },
      { label: "Signing order", detail: "Recipients fill out and sign in the order they are listed in the Recipients panel. The first recipient completes their fields, then the next receives the link or is notified. Drag recipients to reorder." },
    ],
  },
  {
    id: "sessions-tab",
    icon: "📋",
    title: "Sessions Dashboard",
    summary: "The Sessions tab shows all interviews across packages and lets you manage their lifecycle.",
    items: [
      { label: "Interviews view", detail: "Lists all in-progress and completed sessions. Filter by package, status, or date range. Shows client name, package, status, creation date, and last activity." },
      { label: "Batch Runs view", detail: "Lists all batch CSV imports with their package, row count, and completion progress. Click a batch run to see all individual sessions from that batch." },
      { label: "Searching and filtering", detail: "Use the search bar to find sessions by client name. Use the package filter to see only sessions from a specific package. Status filters include Draft, In Progress, Generated, and Voided." },
    ],
  },
  {
    id: "settings",
    icon: "⚙️",
    title: "Settings & API",
    summary: "Organization-level settings control branding, team access, API keys, and webhooks that apply across all packages.",
    items: [
      { label: "Branding", detail: "Upload your logo and set a brand color in Settings → Branding. These appear on all client interview pages and customer link pages. Logos and colors can also be overridden per-package in the package's Finalize settings." },
      { label: "Team members", detail: "Invite colleagues in Settings → Team. Admins can create and edit packages and library fields, change settings, and access all sessions. Members can create sessions and run batch imports but cannot edit packages or settings." },
      { label: "Two-factor authentication", detail: "Require 2FA for all team members under Settings → Security. When enabled, each team member must set up an authenticator app before their next login. Existing sessions are not interrupted." },
      { label: "API keys", detail: "Generate API keys in Settings → API Keys to create and manage sessions programmatically. Each key can be scoped to specific actions. Rotate keys without downtime by creating a new key before revoking the old one." },
      { label: "Global webhooks", detail: "Settings → Webhooks lets you set a single webhook URL that receives events from all packages (subject to per-package webhook being enabled). Use this when you have a single integration (e.g. a central Zapier workflow) that handles events from every package." },
      { label: "Per-package vs. global webhooks", detail: "Per-package webhooks (set in Finalize) send to a URL specific to that package. The global webhook in Settings receives events from every package that has webhooks enabled. Both fire for the same events — you can use one or both." },
      { label: "Custom domain", detail: "Enterprise plans can configure a custom domain (e.g. docs.yourfirm.com) for all client interview and customer link URLs, so clients see your brand rather than a Docuplete domain." },
      { label: "Embed snippet", detail: "In a package's settings, the Embed panel provides an HTML snippet to embed the interview directly in your own website or portal. Clients can fill and submit without navigating away from your site." },
    ],
  },
];

function HelpItem({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex gap-2.5 text-sm">
      <span className="mt-[6px] shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300" />
      <span className="text-gray-600"><span className="font-medium text-gray-800">{label}:</span> {detail}</span>
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
        className={`fixed top-0 right-0 h-full w-[540px] max-w-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
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
          <nav className="w-48 shrink-0 border-r border-gray-100 bg-gray-50 py-3 overflow-y-auto">
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
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span className="text-lg">{section.icon}</span>
                {section.title}
              </h3>
              {section.summary && (
                <p className="text-xs text-gray-500 mt-1">{section.summary}</p>
              )}
            </div>
            <div className="space-y-3">
              {section.items.map((item) => (
                <HelpItem key={item.label} label={item.label} detail={item.detail} />
              ))}
            </div>
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
