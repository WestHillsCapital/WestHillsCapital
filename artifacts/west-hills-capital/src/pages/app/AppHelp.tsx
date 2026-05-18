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
      { label: "Text / Labels toggle", detail: "Controls what the colored field boxes display on the PDF canvas. 'Labels' shows the field name (e.g. 'Client Name'). 'Text' shows a sample of how the actual output will look after format is applied (e.g. 'JOHN SMITH' for an uppercase-format name field) — useful for checking spacing and alignment." },
      { label: "Snap to grid toggle (S)", detail: "When on, placed fields snap to a 4-point grid so edges align cleanly across the page. When off, fields can be positioned at any sub-point location. Toggle with the Snap button or press S. A gold underline on the button means snap is active." },
      { label: "PDF Fields toggle", detail: "When the uploaded PDF has existing AcroForm fields (interactive form fields baked into the PDF), this toggle reveals them as blue dashed overlays. Use this as a positioning guide — overlay your Docuplete field boxes on top of the matching AcroForm fields so the answers print in exactly the right spot." },
      { label: "Auto-map button", detail: "Appears when PDF Fields is on and the PDF has AcroForm fields. Click it to automatically create Docuplete field mappings from every detected AcroForm field in one step. Docuplete matches each AcroForm field name to a matching package field (by name) and places a mapping at the same location. Review and adjust after auto-mapping." },
      { label: "Inspector: Panel vs. Popup", detail: "The inspector shows the settings for the currently selected field placement (format, size, orientation, etc.). Panel mode docks the inspector into the right sidebar — it stays open as you work. Popup mode shows a floating panel that appears only when you click or right-click a placed field. Toggle with the Panel / Popup button in the toolbar; your choice is remembered." },
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
      { label: "Checkbox: Yes", detail: "Prints 'Yes' if the checkbox is checked, or leaves the field blank if unchecked. Used when a PDF text field should say 'Yes' or nothing based on a checkbox answer." },
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
      { label: "Conditional display", detail: "Add a 'Show if…' condition to any field so it only appears when another field has (or doesn't have) a specific value. For example, show 'Joint Account Holder Name' only when 'Account Type' equals 'Joint'. Conditions use equals, not equals, is answered, or is not answered operators." },
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
    summary: "The Finalize step has output and compliance options that are set individually for each package. These are intentionally per-package because different packages have different workflows, audiences, and compliance requirements.",
    items: [
      { label: "Filled PDF Packet — always on", detail: "Every package always generates a completed PDF packet when an interview is submitted. This cannot be turned off — it is the core output of Docuplete." },
      { label: "Staff Interview", detail: "When enabled, staff can launch a guided interview from the Sessions tab or Deal Builder. Disable for packages that are batch-only — hiding the interview option keeps the package list cleaner for staff who don't need it." },
      { label: "Batch CSV", detail: "When enabled, the package appears in the Batch tab's package selector and accepts CSV uploads. Disable for packages that are staff-interview-only to prevent accidental bulk runs on individual-client forms." },
      { label: "Customer Link", detail: "When enabled, sessions on this package can generate a time-limited, branded link sent directly to the client. They fill it out on their own device with no login. Disable for packages that must only be completed with staff guidance (e.g., complex suitability forms)." },
      { label: "Require document preview before signing", detail: "When on, the signer must open the filled PDF and view it before the signing step unlocks. Recommended for compliance with regulations requiring clients to review documents they are signing. Not all packages require this — a simple W-9 may not need it while an investment advisory agreement would." },
      { label: "Require full scroll through document", detail: "When on, Docuplete renders the PDF inline and tracks whether the client has scrolled to the bottom. 'Proceed to sign' is locked until they have. Stricter than Preview — use for dense disclosure documents or regulatory forms where regulators expect proof the client read the content." },
      { label: "Webhook / Make.com", detail: "When enabled, Docuplete fires an HTTPS POST to a URL you specify whenever an interview or customer form on this package is submitted. The payload includes all answers (sensitive fields are redacted). Each package has its own webhook URL and signing secret, so different packages can route to different systems (e.g. CRM, archival, Slack)." },
      { label: "Why not global?", detail: "Global settings would force all packages into the same mode — but a bulk account-opening CSV package and a one-on-one suitability interview have nothing in common. Per-package settings let each package behave exactly as its workflow requires." },
      { label: "Interview order", detail: "The left panel in Finalize shows all interview questions in the order clients will see them. Drag to reorder. Click 'Sort by PDF order' to automatically sort fields to match the top-to-bottom position of their placements on the PDF page." },
      { label: "Fields hidden from interview", detail: "The collapsed section at the bottom of the interview order list shows all Omitted fields. These fields have placements on the PDF but will not be asked during the interview — they use their default values. E-sign system fields (Signature, Initials, Signer Date) always appear here." },
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
      { label: "Compliance Tags — how to use", detail: "In Library → Compliance, Docuplete shows a matrix of every compliance tag and which packages include at least one field carrying that tag. A red cell means a package is missing a field for that compliance requirement. Use this view to audit packages before submission or examination." },
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
      { label: "Field Groups tab", detail: "A Field Group bundles several related library fields under one name (e.g. 'Client Address' groups Street, City, State, ZIP). In the mapper's field list, click 'Browse groups' to add all fields from a group to a package at once. Use groups for sets of fields that always appear together." },
      { label: "Types tab", detail: "Transaction Types (e.g. 'New Account', 'Transfer', 'Withdrawal') are organization-defined categories you assign to packages. Used for reporting, filtering, and integrations. Create and manage types here." },
      { label: "Groups tab", detail: "Recipient Groups represent entities in a transaction (e.g. 'Custodian', 'Depository', 'Joint Account Holder'). A group can be assigned to a set of field placements in the mapper — those fields are then associated with that recipient for multi-signer e-sign workflows." },
      { label: "Compliance tab", detail: "Shows a coverage matrix: compliance tags as rows, packages as columns. A checkmark means the package contains at least one field carrying that compliance tag. A missing mark means the package lacks coverage for that requirement. Use this to prepare for regulatory reviews." },
      { label: "Importing a library field", detail: "From any package's field list in the mapper, click 'Browse groups' or search for the field. Library fields show a chain-link icon. When imported, changes to the library field definition propagate to the package for future sessions." },
      { label: "Detaching a library field", detail: "In the package field list, click ⋯ → Detach. The field becomes an independent copy. Future library updates no longer affect it. Detaching is permanent — to re-link, delete the field and import from the library again." },
      { label: "Version history", detail: "Every save to a library field creates a version entry. Click a field, then open History to see prior versions. You can restore any previous version — the rollback takes effect on future sessions immediately." },
      { label: "Field analytics", detail: "The Analytics view for each library field shows how many times it has been used across all sessions. Use this before making changes to understand the impact." },
      { label: "Export", detail: "Click Export in the Library tab to download the entire field library as JSON (includes field groups, best for full backups and migration) or CSV (best for bulk editing in Excel or Google Sheets). Only fields your organization owns are included — global and inherited fields are excluded." },
      { label: "Import — adding new fields", detail: "Click Import and select a JSON or CSV file. A preview appears before anything is saved: new fields are shown with a green badge. Click Import to add them. The result banner shows how many were added, updated, or skipped." },
      { label: "Import — updating existing fields", detail: "If the imported file contains a field label that already exists in your library and any property differs (required, sensitive, active, category, type, validation, options, etc.), it shows a blue 'Update' badge in the preview. Identical fields show a grey 'No change' badge and are skipped automatically. Only your own fields can be updated — global fields are always skipped." },
      { label: "CSV round-trip bulk editing", detail: "The fastest way to update many fields at once: Export → CSV, open the file in Excel or Google Sheets, edit the values (required, sensitive, active, sort order, validation, etc.), save as CSV, then Import. Boolean columns (sensitive, required, active) accept TRUE, FALSE, true, or false — any capitalization works, including what Excel or Google Sheets generates automatically." },
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
      { label: "Multiple signature locations", detail: "Place the Signature or Initials field multiple times on different pages. Each placement collects the same signature or initials and fills it into every spot. This is correct — the client signs once and it applies everywhere." },
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
    id: "sum-groups",
    icon: "📊",
    title: "Sum Groups — Allocation Fields",
    summary: "Tag a set of percent or number fields with a shared Sum Group label so they must total exactly 100% before the client can submit.",
    items: [
      { label: "What it's for", detail: "Sum Groups are designed for beneficiary allocation, asset allocation splits, and any pattern where a set of percentage fields must add up to exactly 100%. The client sees a live progress bar while typing, and the form blocks submission until every group in the package reaches 100%." },
      { label: "Setting up a Sum Group", detail: "Double-click a percent or number field to open its editor. Set validation type to Percent (or Number), then enter a Sum Group label in the field that appears below — for example 'primary_beneficiaries'. Assign the exact same label to every field in the group. The label is case-sensitive." },
      { label: "Naming convention", detail: "Use lowercase with underscores for Sum Group labels (e.g. 'primary_beneficiaries', 'contingent_beneficiaries'). The label is automatically humanized in the client interview — 'primary_beneficiaries' displays as 'Primary Beneficiaries — Allocation'." },
      { label: "What the client sees", detail: "A live banner appears below the field group showing a color-coded progress bar (amber = under 100%, red = over 100%, green = exactly 100%) and a running total like '45% / 100%'. The form blocks submission and highlights the banner in red if the total isn't exactly 100% when the client tries to proceed." },
      { label: "Multiple groups", detail: "A single package can have multiple independent Sum Groups — e.g. 'primary_beneficiaries' and 'contingent_beneficiaries'. Each group has its own banner. The client must satisfy every group before submitting." },
      { label: "Conditional fields in a group", detail: "Only fields that are currently visible in the interview count toward the group total. If a field is Omitted or hidden by a conditional logic rule, it is excluded. This lets you add optional extra beneficiary slots that only appear when the client indicates they need them." },
      { label: "Partial answers", detail: "The progress banner and the 100% validation only activate once the client has typed a value into at least one field in the group. Completely empty groups don't block submission unless the individual fields are also marked Required." },
    ],
  },
  {
    id: "sessions-tab",
    icon: "📋",
    title: "Sessions Dashboard",
    summary: "The Sessions tab (separate from creating individual sessions) shows all interviews across packages and lets you manage their lifecycle.",
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

const KBD_SHORTCUTS = [
  { keys: ["← / →"], label: "Previous / next PDF page" },
  { keys: ["+ / −"], label: "Zoom in / zoom out" },
  { keys: ["S"], label: "Toggle snap to grid" },
  { keys: ["Esc"], label: "Cancel placement / close inspector" },
  { keys: ["Delete / Backspace"], label: "Remove selected field placement" },
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
          A comprehensive reference for every feature in Docuplete — from placing fields on a PDF to managing compliance coverage.
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

        {/* Keyboard shortcuts quick-reference card */}
        <div id="help-shortcuts" className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <span className="text-2xl">⌨️</span>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Keyboard Shortcuts — Quick Reference</h3>
              <p className="text-xs text-gray-500 mt-0.5">All shortcuts are active while the Map Fields view is open.</p>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="rounded-lg border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              {KBD_SHORTCUTS.map(({ keys, label }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-600">{label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {keys.map((k) => (
                      <kbd key={k} className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-gray-700 font-mono text-xs leading-none">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
