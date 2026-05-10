import { useState } from "react";
import { SandboxKeyModal } from "@/components/SandboxKeyModal";

export default function SandboxDemo() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="docs-content">
      {showModal && <SandboxKeyModal onClose={() => setShowModal(false)} />}

      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Public Sandbox Demo</h1>
        <p className="text-lg text-white/55 mt-2">
          A zero-friction live demo anyone can run in under 2 minutes — no account, no API key, no
          credit card. Use it to show prospects the Docuplete interview experience or test URL-prefill
          before wiring up your own integration.
        </p>
      </div>

      <div className="callout callout-info">
        <strong>Try it now.</strong> Visit{" "}
        <a href="https://westhillscapital.com/sandbox" target="_blank" rel="noopener noreferrer">
          westhillscapital.com/sandbox
        </a>{" "}
        to run the demo in your browser. No login required.
      </div>

      {/* Sandbox key access CTA */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 border border-[#1B4FD8]/25 bg-[#1B4FD8]/6 rounded-xl">
        <div>
          <p className="text-sm font-medium text-white/85">Ready to test with your own code?</p>
          <p className="text-xs text-white/45 mt-0.5">
            Get free sandbox keys for Node.js and Python — verify your email, no account needed.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 bg-[#1B4FD8] hover:bg-[#1740B8] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          Get sandbox keys →
        </button>
      </div>

      <h2>How the sandbox works</h2>
      <p>
        The sandbox runs against a pre-seeded demo package called <strong>Demo — Client
        Information</strong>. It contains 8 fields covering the most common personal information
        collected in a client onboarding flow: first name, last name, email, date of birth, address,
        city, state, and ZIP code.
      </p>
      <p>
        When you (or a prospect) starts the sandbox, Docuplete creates a real session against this
        demo package and returns a unique interview link. The session has{" "}
        <code>auth_level: none</code>, so the OTP gate is bypassed — the interview opens
        immediately. When the form is submitted, Docuplete generates a real, SHA-256 sealed PDF and
        displays it in the result screen alongside the raw API payload.
      </p>

      <p className="text-sm">
        Testing against the sandbox endpoint from your own code?{" "}
        <button
          onClick={() => setShowModal(true)}
          className="text-[#5B8DEF] hover:text-[#93B4F7] underline underline-offset-2 decoration-[#5B8DEF]/40 hover:decoration-[#93B4F7]/60 transition-colors font-medium"
        >
          Get your free sandbox API keys →
        </button>
      </p>

      <h2>The sandbox endpoint</h2>
      <p>
        The sandbox exposes a single public endpoint — no API key required:
      </p>
      <pre>{`GET https://api.docuplete.com/api/v1/sandbox/start`}</pre>

      <h3>Query parameters</h3>
      <p>
        All parameters are optional. Any values you pass are used to prefill matching fields in the
        interview — exactly the same mechanism as the authenticated{" "}
        <a href="/developer/quickstart-session">session prefill API</a>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Field it prefills</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>firstName</code></td><td>First name</td></tr>
          <tr><td><code>lastName</code></td><td>Last name</td></tr>
          <tr><td><code>email</code></td><td>Email address</td></tr>
          <tr><td><code>dateOfBirth</code></td><td>Date of birth</td></tr>
          <tr><td><code>addressLine1</code></td><td>Street address</td></tr>
          <tr><td><code>city</code></td><td>City</td></tr>
          <tr><td><code>state</code></td><td>State</td></tr>
          <tr><td><code>zip</code></td><td>ZIP code</td></tr>
        </tbody>
      </table>

      <h3>Response</h3>
      <pre>{`{
  "sessionToken": "df_sbx_a1b2c3d4e5...",
  "interviewUrl": "https://westhillscapital.com/docuplete/public/df_sbx_...?sandbox=1",
  "prefill": {
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com"
  },
  "expiresAt": "2026-05-14T12:00:00.000Z"
}`}</pre>
      <p>
        Sandbox session tokens are prefixed <code>df_sbx_</code> to distinguish them from live
        sessions. The <code>interviewUrl</code> points to the west-hills-capital demo site and
        includes the <code>?sandbox=1</code> flag, which activates the sandbox UI chrome (progress
        widget, result screen).
      </p>

      <h2>Shareable landing page</h2>
      <p>
        Instead of calling the API directly, you can send prospects to the sandbox landing page:
      </p>
      <pre>{`https://westhillscapital.com/sandbox`}</pre>
      <p>
        The landing page explains what will happen (8 questions, instant PDF, SHA-256 sealed) and
        has a <strong>Start the demo</strong> button that calls the sandbox API and redirects
        automatically.
      </p>

      <h2>URL prefill for demos</h2>
      <p>
        Append any of the query parameters above to the landing page URL to have the interview
        open with those fields already filled. This is useful when demoing to a specific prospect:
      </p>
      <pre>{`https://westhillscapital.com/sandbox?firstName=Jane&lastName=Smith&email=jane@example.com`}</pre>
      <p>
        When <code>firstName</code> is present, the landing page is skipped and the session starts
        immediately — the prospect goes straight into the interview.
      </p>

      <h2>Call the endpoint directly</h2>
      <p>
        You can also call the sandbox endpoint from your own code to generate a prefilled demo link
        on the fly — useful for embedding a "Try a live demo" button inside a product tour or sales
        email sequence.
      </p>

      <pre>{`curl "https://api.docuplete.com/api/v1/sandbox/start?firstName=Jane&lastName=Smith&email=jane@example.com"`}</pre>

      <h3>Node.js SDK</h3>
      <pre>{`import { Docuplete } from "@docuplete/sdk";

// No API key required — the sandbox endpoint is public
const client = new Docuplete({ apiKey: "" });

const { interviewUrl } = await client.sandbox.start({
  firstName: prospect.firstName,
  lastName:  prospect.lastName,
  email:     prospect.email,
});

console.log("Sandbox demo link:", interviewUrl);`}</pre>

      <h3>Node.js (raw fetch)</h3>
      <pre>{`const params = new URLSearchParams({
  firstName: prospect.firstName,
  lastName:  prospect.lastName,
  email:     prospect.email,
});

const res = await fetch(
  \`https://api.docuplete.com/api/v1/sandbox/start?\${params}\`
);
const { interviewUrl } = await res.json();

// Redirect the prospect or include the link in an email
console.log("Sandbox demo link:", interviewUrl);`}</pre>

      <h3>Python</h3>
      <pre>{`import requests

resp = requests.get(
    "https://api.docuplete.com/api/v1/sandbox/start",
    params={
        "firstName": prospect["first_name"],
        "lastName":  prospect["last_name"],
        "email":     prospect["email"],
    },
)
resp.raise_for_status()
interview_url = resp.json()["interviewUrl"]
print("Sandbox demo link:", interview_url)`}</pre>

      <h2>What the prospect sees</h2>
      <p>
        After opening the interview link, the prospect sees:
      </p>
      <ol>
        <li>
          <strong>The interview form</strong> — 8 questions in Docuplete's standard interview UI,
          with any prefilled values already present. A live progress widget in the corner counts
          answers as they're captured and shows a real-time field-insertion indicator.
        </li>
        <li>
          <strong>The result screen</strong> — after submitting, a dark-theme result screen shows
          the generated PDF in an inline viewer, the SHA-256 integrity hash of the document, a UTC
          timestamp, and a <strong>View the data</strong> toggle that reveals the raw JSON payload
          exactly as Docuplete would deliver it to a webhook.
        </li>
      </ol>

      <div className="callout callout-info">
        <strong>Session expiry.</strong> Sandbox sessions expire after 7 days. Prefilled data is
        not retained — each call to the sandbox endpoint creates a fresh session. Sandbox sessions
        are not included in your submission quota.
      </div>

      <h2>Limitations</h2>
      <ul>
        <li>The demo package is fixed (8 fields). You cannot use a custom package via the sandbox endpoint.</li>
        <li>E-sign fields are not part of the sandbox demo.</li>
        <li>Sandbox sessions do not trigger webhooks.</li>
        <li>Generated PDFs are retained for 7 days then purged.</li>
        <li>Rate-limited to 60 requests per hour per IP address (no API key required).</li>
      </ul>

      <h2>Next steps</h2>
      <ul>
        <li>
          Ready to build the real thing?{" "}
          <a href="/developer/quickstart-session">Create your first live session</a> with your own
          package and an API key.
        </li>
        <li>
          <a href="/developer/authentication">Get an API key</a> to access the full Docuplete API.
        </li>
        <li>
          <a href="/developer/quickstart-webhooks">Set up webhooks</a> to receive submission data
          in your backend the moment a client submits the form.
        </li>
      </ul>
    </div>
  );
}
