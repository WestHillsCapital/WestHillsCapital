export type SearchEntry = {
  slug: string;
  title: string;
  section: string;
  headings: string[];
};

export const SEARCH_INDEX: SearchEntry[] = [
  {
    slug: "getting-started/what-is-docuplete",
    title: "What is Docuplete?",
    section: "Getting Started",
    headings: ["The core model: Package → Session → Filled PDF", "Key features", "Interview-driven data collection", "E-sign support", "Batch CSV import", "Webhooks & API access", "Integrations", "Who uses Docuplete?"],
  },
  {
    slug: "getting-started/quick-start",
    title: "Quick Start",
    section: "Getting Started",
    headings: ["Create a package", "Upload your PDF", "Add fields", "Map fields to the PDF", "Send a client link", "Get the completed PDF"],
  },
  {
    slug: "getting-started/plans",
    title: "Plans & Pricing",
    section: "Getting Started",
    headings: ["Annual billing", "Submission counting", "Seats", "Free trial", "Upgrading or downgrading"],
  },
  {
    slug: "core-concepts/packages",
    title: "Packages",
    section: "Core Concepts",
    headings: ["What a package contains", "Package lifecycle", "Versioning", "Multi-document packages", "Organizing packages"],
  },
  {
    slug: "core-concepts/sessions",
    title: "Sessions",
    section: "Core Concepts",
    headings: ["Session states", "Session link behavior", "Prefilling fields", "Expiration", "E-sign sessions"],
  },
  {
    slug: "core-concepts/fields",
    title: "Fields & Interview Logic",
    section: "Core Concepts",
    headings: ["Field types", "Interview modes", "Conditional logic", "Field groups", "Validation rules"],
  },
  {
    slug: "core-concepts/mappings",
    title: "Mappings & Formatting",
    section: "Core Concepts",
    headings: ["One field, many positions", "Formatting options", "Calculated fields", "Conditional render", "Visual Mapper"],
  },
  {
    slug: "building-a-package/uploading",
    title: "Uploading a PDF",
    section: "Building a Package",
    headings: ["Supported PDF types", "Uploading a file", "Multiple documents in one package", "Replacing a document"],
  },
  {
    slug: "building-a-package/fields",
    title: "Adding & Editing Fields",
    section: "Building a Package",
    headings: ["Adding a field", "Reordering fields", "Field groups", "Field key (internal name)", "Duplicating a field", "Importing from the Field Library"],
  },
  {
    slug: "building-a-package/esign-fields",
    title: "E-Sign Fields",
    section: "Building a Package",
    headings: ["Available e-sign field types", "Adding e-sign fields", "How the client signs", "Enabling e-sign on a package", "Legal standing"],
  },
  {
    slug: "building-a-package/mapper",
    title: "Visual Mapper",
    section: "Building a Package",
    headings: ["Opening the Mapper", "Adding a mapping", "Precision positioning", "Navigating pages", "Zoom and pan", "Checkbox and radio group mappings", "Signature mappings"],
  },
  {
    slug: "building-a-package/text-boxes",
    title: "Single-line vs. Multiline",
    section: "Building a Package",
    headings: ["Single-line mode", "Multiline mode", "Auto-scale font size", "Line height", "Choosing between the modes"],
  },
  {
    slug: "building-a-package/validation",
    title: "Validation & Conditional Logic",
    section: "Building a Package",
    headings: ["Validation rules", "Text fields", "Number fields", "Date fields", "Conditional logic", "Condition structure", "Combining conditions", "Required fields with conditions"],
  },
  {
    slug: "building-a-package/configuration",
    title: "Package Configuration",
    section: "Building a Package",
    headings: ["General settings", "Branding", "Notifications", "Submission behavior", "Session settings", "Integrations"],
  },
  {
    slug: "field-library/overview",
    title: "What is the Field Library?",
    section: "Field Library",
    headings: ["Why use the Field Library?", "What belongs in the library?", "Accessing the Field Library"],
  },
  {
    slug: "field-library/adding",
    title: "Adding Library Fields",
    section: "Field Library",
    headings: ["Importing a library field into a package", "Overriding a library field within a package", "Detaching a library field"],
  },
  {
    slug: "field-library/editing",
    title: "Editing Shared Fields",
    section: "Field Library",
    headings: ["Editing a library field", "Changing a field's type", "Deleting a library field", "Viewing usage"],
  },
  {
    slug: "sending-to-clients/sessions",
    title: "Generating a Session",
    section: "Sending to Clients",
    headings: ["From the dashboard", "Prefilling field values", "Sharing the link", "Tracking sessions", "One session per client per submission"],
  },
  {
    slug: "sending-to-clients/experience",
    title: "Client Interview Experience",
    section: "Sending to Clients",
    headings: ["What the client experiences", "Interview flow", "Mobile-friendly", "Autosave", "No account required", "Branding customization"],
  },
  {
    slug: "sending-to-clients/esign",
    title: "E-Sign Identity Verification",
    section: "Sending to Clients",
    headings: ["Verification flow", "Audit trail", "Prefilling the client email", "Failed verification", "Legal compliance"],
  },
  {
    slug: "sending-to-clients/outcomes",
    title: "Post-Submission Outcomes",
    section: "Sending to Clients",
    headings: ["What triggers on submission", "Client redirect", "Viewing the completed PDF", "Notification email contents", "Handling errors"],
  },
  {
    slug: "sending-to-clients/voiding",
    title: "Voiding a Session",
    section: "Sending to Clients",
    headings: ["When to void a session", "How to void", "Voiding a completed session", "Mass voiding (bulk action)"],
  },
  {
    slug: "batch-csv/overview",
    title: "When to Use Batch Import",
    section: "Batch CSV Import",
    headings: ["What is batch import?", "When to use it", "When not to use it", "Output"],
  },
  {
    slug: "batch-csv/template",
    title: "Downloading the Template",
    section: "Batch CSV Import",
    headings: ["How to download the template", "Template structure", "Special columns", "Updating the template"],
  },
  {
    slug: "batch-csv/filling",
    title: "Filling Out the CSV",
    section: "Batch CSV Import",
    headings: ["General rules", "Value formats by field type", "Blank values", "Special characters", "Radio and dropdown exact matching"],
  },
  {
    slug: "batch-csv/uploading",
    title: "Uploading & Reviewing Results",
    section: "Batch CSV Import",
    headings: ["Uploading the CSV", "Monitoring progress", "Downloading results", "Google Drive sync", "Re-running failed rows"],
  },
  {
    slug: "batch-csv/errors",
    title: "Understanding Errors",
    section: "Batch CSV Import",
    headings: ["Structural errors (pre-processing)", "Per-row errors (during processing)", "Error report"],
  },
  {
    slug: "sessions-dashboard/interviews",
    title: "Interviews Tab",
    section: "Sessions Dashboard",
    headings: ["Columns", "Filtering", "Searching", "Session detail view", "Sending reminders", "Exporting"],
  },
  {
    slug: "sessions-dashboard/batch-runs",
    title: "Batch Runs Tab",
    section: "Sessions Dashboard",
    headings: ["Batch run list columns", "Batch run detail view", "Downloading output", "Batch run retention"],
  },
  {
    slug: "webhooks/setup",
    title: "Webhook Setup",
    section: "Webhooks & API",
    headings: ["How webhooks work", "Configuring a webhook URL", "Webhook secret", "Test ping", "Organization-level webhook"],
  },
  {
    slug: "webhooks/payload",
    title: "Event Payload",
    section: "Webhooks & API",
    headings: ["Payload structure", "Top-level fields", "Field value types in payload", "Deduplication"],
  },
  {
    slug: "webhooks/signature",
    title: "Signature Verification",
    section: "Webhooks & API",
    headings: ["How signatures work", "Signature header format", "Verification examples", "Node.js", "Python", "Timing-safe comparison"],
  },
  {
    slug: "webhooks/retries",
    title: "Retry Behavior",
    section: "Webhooks & API",
    headings: ["What triggers a retry", "Retry schedule", "Idempotency", "Manual retry", "Webhook health alerts"],
  },
  {
    slug: "webhooks/logs",
    title: "Delivery Logs",
    section: "Webhooks & API",
    headings: ["Viewing delivery logs", "Log entry details", "Inspecting request and response", "Manual retry", "Log retention"],
  },
  {
    slug: "webhooks/rotating",
    title: "Rotating the Secret",
    section: "Webhooks & API",
    headings: ["When to rotate", "Zero-downtime rotation process", "Viewing current secret"],
  },
  {
    slug: "integrations/google-drive",
    title: "Google Drive",
    section: "Integrations",
    headings: ["Connecting Google Drive", "Per-package folder override", "File naming", "Batch runs and Drive", "Disconnecting"],
  },
  {
    slug: "integrations/hubspot",
    title: "HubSpot",
    section: "Integrations",
    headings: ["Connecting HubSpot", "What syncs on submission", "Field mapping", "Deal creation", "Disconnecting"],
  },
  {
    slug: "account/billing",
    title: "Seats & Billing",
    section: "Account & Settings",
    headings: ["Viewing your current plan", "Adding or removing seats", "Upgrading your plan", "Downgrading your plan", "Invoices", "Canceling"],
  },
  {
    slug: "account/branding",
    title: "Organization Branding",
    section: "Account & Settings",
    headings: ["Configuring organization branding", "Logo", "Brand color", "Interview header text", "Footer text", "Email sender name", "Per-package branding overrides", "Preview"],
  },
  {
    slug: "account/channels",
    title: "Channel Defaults",
    section: "Account & Settings",
    headings: ["What are channels?", "Team notification channel", "Default notification recipients", "Client confirmation channel", "Expiration reminder", "Slack notifications"],
  },
  {
    slug: "account/api-keys",
    title: "API Keys",
    section: "Account & Settings",
    headings: ["What you can do with the API", "Creating an API key", "Using an API key", "Key types", "Revoking a key", "Rate limits"],
  },
];

export function searchIndex(query: string): SearchEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const terms = q.split(/\s+/).filter(Boolean);

  const scored: { entry: SearchEntry; score: number }[] = [];

  for (const entry of SEARCH_INDEX) {
    let score = 0;
    const titleLower = entry.title.toLowerCase();
    const sectionLower = entry.section.toLowerCase();
    const headingsLower = entry.headings.map((h) => h.toLowerCase()).join(" ");

    for (const term of terms) {
      if (titleLower.includes(term)) score += 10;
      if (titleLower === term) score += 20;
      if (sectionLower.includes(term)) score += 3;
      if (headingsLower.includes(term)) score += 5;
    }

    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8).map((s) => s.entry);
}
