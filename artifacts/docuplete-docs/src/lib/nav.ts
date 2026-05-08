export type NavItem = {
  title: string;
  slug: string;
  children?: NavItem[];
};

export const NAV: NavItem[] = [
  {
    title: "Getting Started",
    slug: "getting-started",
    children: [
      { title: "What is Docuplete?", slug: "getting-started/what-is-docuplete" },
      { title: "Quick Start", slug: "getting-started/quick-start" },
      { title: "Plans & Pricing", slug: "getting-started/plans" },
    ],
  },
  {
    title: "Core Concepts",
    slug: "core-concepts",
    children: [
      { title: "Packages", slug: "core-concepts/packages" },
      { title: "Sessions", slug: "core-concepts/sessions" },
      { title: "Fields & Interview Logic", slug: "core-concepts/fields" },
      { title: "Mappings & Formatting", slug: "core-concepts/mappings" },
    ],
  },
  {
    title: "Building a Package",
    slug: "building-a-package",
    children: [
      { title: "Uploading a PDF", slug: "building-a-package/uploading" },
      { title: "Adding & Editing Fields", slug: "building-a-package/fields" },
      { title: "E-Sign Fields", slug: "building-a-package/esign-fields" },
      { title: "Visual Mapper", slug: "building-a-package/mapper" },
      { title: "Single-line vs Multiline", slug: "building-a-package/text-boxes" },
      { title: "Validation & Conditional Logic", slug: "building-a-package/validation" },
      { title: "Package Configuration", slug: "building-a-package/configuration" },
    ],
  },
  {
    title: "Field Library",
    slug: "field-library",
    children: [
      { title: "What is the Field Library?", slug: "field-library/overview" },
      { title: "Adding Library Fields", slug: "field-library/adding" },
      { title: "Editing Shared Fields", slug: "field-library/editing" },
    ],
  },
  {
    title: "Sending to Clients",
    slug: "sending-to-clients",
    children: [
      { title: "Generating a Session", slug: "sending-to-clients/sessions" },
      { title: "Client Interview Experience", slug: "sending-to-clients/experience" },
      { title: "E-Sign Identity Verification", slug: "sending-to-clients/esign" },
      { title: "Post-Submission Outcomes", slug: "sending-to-clients/outcomes" },
      { title: "Voiding a Session", slug: "sending-to-clients/voiding" },
    ],
  },
  {
    title: "Batch CSV Import",
    slug: "batch-csv",
    children: [
      { title: "When to Use Batch Import", slug: "batch-csv/overview" },
      { title: "Downloading the Template", slug: "batch-csv/template" },
      { title: "Filling Out the CSV", slug: "batch-csv/filling" },
      { title: "Uploading & Reviewing Results", slug: "batch-csv/uploading" },
      { title: "Understanding Errors", slug: "batch-csv/errors" },
    ],
  },
  {
    title: "Sessions Dashboard",
    slug: "sessions-dashboard",
    children: [
      { title: "Interviews Tab", slug: "sessions-dashboard/interviews" },
      { title: "Batch Runs Tab", slug: "sessions-dashboard/batch-runs" },
    ],
  },
  {
    title: "Webhooks & API",
    slug: "webhooks",
    children: [
      { title: "Setup", slug: "webhooks/setup" },
      { title: "Event Payload", slug: "webhooks/payload" },
      { title: "Signature Verification", slug: "webhooks/signature" },
      { title: "Retry Behavior", slug: "webhooks/retries" },
      { title: "Delivery Logs", slug: "webhooks/logs" },
      { title: "Rotating the Secret", slug: "webhooks/rotating" },
    ],
  },
  {
    title: "Integrations",
    slug: "integrations",
    children: [
      { title: "Google Drive", slug: "integrations/google-drive" },
      { title: "HubSpot", slug: "integrations/hubspot" },
    ],
  },
  {
    title: "Developer API",
    slug: "developer",
    children: [
      { title: "Authentication & API Keys", slug: "developer/authentication" },
      { title: "Node.js SDK", slug: "developer/sdk" },
      { title: "Quickstart: Create a Session", slug: "developer/quickstart-session" },
      { title: "Quickstart: Handling Webhooks", slug: "developer/quickstart-webhooks" },
      { title: "Public Sandbox Demo", slug: "developer/sandbox" },
    ],
  },
  {
    title: "Account & Settings",
    slug: "account",
    children: [
      { title: "Seats & Billing", slug: "account/billing" },
      { title: "Organization Branding", slug: "account/branding" },
      { title: "Channel Defaults", slug: "account/channels" },
      { title: "API Keys", slug: "account/api-keys" },
    ],
  },
];

export function allPages(): { slug: string; title: string; section: string }[] {
  const pages: { slug: string; title: string; section: string }[] = [];
  for (const section of NAV) {
    if (section.children) {
      for (const page of section.children) {
        pages.push({ slug: page.slug, title: page.title, section: section.title });
      }
    }
  }
  return pages;
}
