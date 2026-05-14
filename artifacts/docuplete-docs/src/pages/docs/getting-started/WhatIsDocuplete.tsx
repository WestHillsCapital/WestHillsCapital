import { Link } from "wouter";
import { DocScreenshot } from "@/components/DocScreenshot";

export default function WhatIsDocuplete() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Getting Started</div>
        <h1>What is Docuplete?</h1>
        <p className="text-lg text-white/55 mt-2">The fastest way to collect filled, signed PDFs from your clients — without the back-and-forth.</p>
      </div>

      <p>
        Docuplete is a document automation platform for financial advisors, insurance agents, real estate professionals, lawyers, and healthcare providers. It eliminates the manual work of collecting client paperwork by turning any PDF into a guided online interview that clients complete on their own time.
      </p>

      <DocScreenshot
        src="/screenshots/dashboard-overview.png"
        alt="Docuplete dashboard showing a list of packages with session counts and status"
        caption="The Docuplete dashboard — manage all your PDF packages and track sessions from one place."
      />

      <h2>The core model: Package → Session → Filled PDF</h2>
      <p>Every workflow in Docuplete follows three steps:</p>
      <ol>
        <li><strong>Package</strong> — You upload a PDF template and configure how it works: which fields to ask, what to call them, how to place them on the document, and what branding or notifications to use. Packages are reusable templates.</li>
        <li><strong>Session</strong> — You generate a unique client link from a package. The client opens the link, answers the questions in a clean interview UI, and submits. No account required on their end.</li>
        <li><strong>Filled PDF</strong> — Docuplete takes the client's answers and stamps them onto the original PDF template — exactly where you mapped them. The completed document is stored and available for download.</li>
      </ol>

      <div className="callout callout-tip">
        <strong>No reformatting needed.</strong> Docuplete works with any PDF you already use — intake forms, applications, disclosures, agreements. You don't need to recreate your documents.
      </div>

      <h2>Key features</h2>

      <h3>Interview-driven data collection</h3>
      <p>
        Clients answer questions in a step-by-step interview — no staring at a blank PDF. Fields can be conditional (only show a question if a previous answer triggers it), required or optional, read-only, or pre-filled. The experience is clean, mobile-friendly, and requires no login.
      </p>

      <h3>E-sign support</h3>
      <p>
        Packages can require electronic signature and initials. Docuplete verifies the signer's identity via email OTP before accepting a signature, producing a legally defensible audit trail.
      </p>

      <h3>Batch CSV import</h3>
      <p>
        On Pro and Enterprise plans, you can upload a CSV file to generate hundreds of filled PDFs in one operation — one row per client. Useful for renewals, mass disclosures, or any high-volume document run.
      </p>

      <h3>Webhooks & API access</h3>
      <p>
        Developer and Enterprise accounts can configure a webhook URL per package. When a client submits, Docuplete fires a signed HTTP POST to your server with the submitted answers. This enables real-time integration with CRMs, databases, or downstream workflows. The Developer plan also includes a full REST API with TypeScript and Python SDKs, headless interview embedding, and bulk session creation.
      </p>

      <h3>Integrations</h3>
      <p>
        Completed PDFs can be automatically saved to Google Drive, and submissions can create or update contacts in HubSpot. Both integrations are available on Pro and Enterprise plans.
      </p>

      <h2>Who uses Docuplete?</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Industry</th>
              <th>Common use cases</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Financial services</td><td>New account applications, IRA rollovers, beneficiary forms, KYC/AML intake</td></tr>
            <tr><td>Insurance</td><td>Applications, change of beneficiary, coverage requests</td></tr>
            <tr><td>Real estate</td><td>Buyer agreements, disclosure forms, lease packets</td></tr>
            <tr><td>Legal</td><td>Engagement letters, estate planning questionnaires, intake forms</td></tr>
            <tr><td>Healthcare</td><td>Patient intake, consent forms, HIPAA acknowledgements</td></tr>
          </tbody>
        </table>
      </div>

      <div className="callout callout-info">
        <strong>Ready to get started?</strong> The <Link href="/getting-started/quick-start">Quick Start guide</Link> walks you through uploading your first PDF and sending a client link in under 10 minutes.
      </div>
    </div>
  );
}
