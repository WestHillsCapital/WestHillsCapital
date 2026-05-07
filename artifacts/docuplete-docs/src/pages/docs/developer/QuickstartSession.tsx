export default function QuickstartSession() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Quickstart: Create a Session</h1>
        <p className="text-lg text-white/55 mt-2">
          Programmatically launch a prefilled Docuplete interview and redirect your client to the unique link — in
          under 10 lines of code.
        </p>
      </div>

      <div className="callout callout-info">
        <strong>Want to try it first?</strong> Before building a real integration, run the{" "}
        <a href="/developer/sandbox">Public Sandbox Demo</a> — a zero-config live session you can
        start in your browser with no API key.
      </div>

      <h2>What you'll need</h2>
      <ul>
        <li>A <strong>live API key</strong> (<code>dp_live_…</code>) — see <a href="/developer/authentication">Authentication</a>.</li>
        <li>The <strong>Package ID</strong> of an active package. Find it in the dashboard URL when viewing a package, or call <code>GET /api/v1/packages</code>.</li>
      </ul>

      <h2>1. Find your Package ID</h2>
      <p>
        Open the Docuplete dashboard, navigate to <strong>Packages</strong>, and click the package you want to use.
        The URL will contain the package ID:
      </p>
      <pre>{`https://app.docuplete.com/packages/42   ← package ID is 42`}</pre>
      <p>Or retrieve it programmatically:</p>
      <pre>{`curl https://api.docuplete.com/api/v1/packages \\
  -H "Authorization: Bearer dp_live_..."`}</pre>

      <h2>2. Create a session</h2>
      <p>
        Call <code>POST /api/v1/sessions</code> with the package ID and any prefill values you want the interview
        to start with. Prefill keys are the <strong>source keys</strong> of your fields (the short identifier shown
        in the field editor).
      </p>

      <pre>{`curl -X POST https://api.docuplete.com/api/v1/sessions \\
  -H "Authorization: Bearer dp_live_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "packageId": 42,
    "prefill": {
      "firstName": "Jane",
      "lastName":  "Smith",
      "email":     "jane@example.com",
      "phone":     "555-867-5309"
    },
    "linkExpiryDays": 7,
    "locale": "en"
  }'`}</pre>

      <p>A successful response looks like:</p>
      <pre>{`{
  "sessionToken": "df_a1b2c3d4e5f6...",
  "interviewUrl": "https://docuplete.com/docuplete/public/df_a1b2c3...",
  "expiresAt": "2026-05-14T12:00:00.000Z"
}`}</pre>

      <h2>3. Send the link to your client</h2>
      <p>
        Use <code>interviewUrl</code> however fits your workflow:
      </p>
      <ul>
        <li><strong>Email</strong> — include the link in a transactional email from your CRM or email service.</li>
        <li><strong>Redirect</strong> — redirect the browser directly after your own form submission.</li>
        <li><strong>Embed</strong> — open the URL in an <code>iframe</code> or modal within your portal.</li>
        <li><strong>SMS</strong> — shorten and send via your messaging provider.</li>
      </ul>

      <h2>Request reference</h2>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>packageId</code></td>
            <td>integer</td>
            <td>Yes</td>
            <td>ID of the active package to use for this session.</td>
          </tr>
          <tr>
            <td><code>prefill</code></td>
            <td>object</td>
            <td>No</td>
            <td>Map of field source key → string value. Keys that don't match any field are silently ignored.</td>
          </tr>
          <tr>
            <td><code>linkExpiryDays</code></td>
            <td>integer or null</td>
            <td>No</td>
            <td>Days until the link expires (1–3650). Pass <code>null</code> for a link that never expires. Defaults to your org setting.</td>
          </tr>
          <tr>
            <td><code>locale</code></td>
            <td>string</td>
            <td>No</td>
            <td>Interview language: <code>en</code>, <code>es</code>, <code>fr</code>, <code>de</code>, <code>pt</code>, <code>zh</code>, <code>ja</code>, <code>ko</code>, <code>ar</code>. Defaults to your org setting.</td>
          </tr>
        </tbody>
      </table>

      <h2>Node.js example</h2>
      <pre>{`const response = await fetch("https://api.docuplete.com/api/v1/sessions", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.DOCUPLETE_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    packageId: 42,
    prefill: {
      firstName: client.firstName,
      lastName:  client.lastName,
      email:     client.email,
    },
    linkExpiryDays: 7,
  }),
});

if (!response.ok) {
  const err = await response.json();
  throw new Error(err.error ?? "Session creation failed");
}

const { interviewUrl, expiresAt } = await response.json();
// Send interviewUrl to your client
console.log("Interview link:", interviewUrl);`}</pre>

      <h2>Python example</h2>
      <pre>{`import os, requests

resp = requests.post(
    "https://api.docuplete.com/api/v1/sessions",
    headers={
        "Authorization": f"Bearer {os.environ['DOCUPLETE_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "packageId": 42,
        "prefill": {
            "firstName": client["first_name"],
            "lastName":  client["last_name"],
            "email":     client["email"],
        },
        "linkExpiryDays": 7,
    },
)
resp.raise_for_status()
data = resp.json()
print("Interview link:", data["interviewUrl"])`}</pre>

      <h2>Next steps</h2>
      <ul>
        <li>
          <a href="/developer/quickstart-webhooks">Set up webhooks</a> to be notified when the client submits the
          interview.
        </li>
        <li>
          Call <code>GET /api/v1/sessions/{"{sessionToken}"}</code> to poll status or retrieve submitted answers.
        </li>
        <li>
          Call <code>POST /api/v1/sessions/{"{sessionToken}"}/void</code> to invalidate a link that was sent in
          error.
        </li>
      </ul>
    </div>
  );
}
