export default function PythonSdk() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Python SDK</h1>
        <p className="text-lg text-white/55 mt-2">
          The official Python client for the Docuplete API — fully typed with dataclasses, zero
          external dependencies beyond <code>httpx</code>, compatible with Python 3.9+.
        </p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> API access requires an Enterprise plan.{" "}
        <a href="/getting-started/plans">Learn about plans →</a>
      </div>

      <h2>Installation</h2>
      <pre>{`pip install docuplete
# or with uv
uv add docuplete`}</pre>

      <h2>Initialization</h2>
      <p>
        Create a single client instance and reuse it across your application. Pass your API key from
        an environment variable — never hard-code it.
      </p>
      <pre>{`import os
from docuplete import Docuplete

client = Docuplete(api_key=os.environ["DOCUPLETE_API_KEY"])`}</pre>

      <h3>Options</h3>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Option</th><th>Type</th><th>Default</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>api_key</code></td>
              <td>str</td>
              <td>—</td>
              <td>Required. Your live API key (<code>dp_live_…</code>).</td>
            </tr>
            <tr>
              <td><code>timeout</code></td>
              <td>float</td>
              <td>30.0</td>
              <td>Request timeout in seconds.</td>
            </tr>
            <tr>
              <td><code>base_url</code></td>
              <td>str</td>
              <td><code>https://api.docuplete.com</code></td>
              <td>Override the base URL (useful in tests).</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Sessions</h2>

      <h3>Create a session</h3>
      <p>
        Returns a <code>session_token</code> and a ready-to-use <code>interview_url</code>. Send or
        redirect your client to the URL — no Docuplete account required on their end.
      </p>
      <pre>{`result = client.sessions.create(
    package_id=42,
    prefill={
        "first_name": "Jane",
        "last_name":  "Smith",
        "email":      "jane@example.com",
    },
    link_expiry_days=7,
    locale="en",
    # Optional: automated reminder emails
    reminders={
        "enabled":       True,
        "interval_days": 2,   # send a reminder every 2 days until submitted
    },
    # Optional: multi-party sequential signing
    signers=[
        {"order": 1, "email": "jane@example.com", "name": "Jane Smith (Client)"},
        {"order": 2, "email": "bob@lawfirm.com",  "name": "Bob Torres (Notary)"},
    ],
)

# Send result.interview_url to your client via email, SMS, or redirect
print("Interview link:", result.interview_url)`}</pre>

      <h3>Get a session</h3>
      <p>
        Fetch the current state of a session. Use this to poll for completion or to retrieve
        submitted answers after the client submits.
      </p>
      <pre>{`session = client.sessions.get("df_a1b2c3d4...")

print(session.status)   # "pending" | "in_progress" | "generated" | "voided" | "expired"
print(session.answers)  # dict of submitted answers (populated after "generated")`}</pre>

      <h3>List sessions</h3>
      <pre>{`result = client.sessions.list(
    package_id=42,          # filter by package
    status="generated",     # filter by status
    limit=50,
    offset=0,
)

print(f"{result.total} total sessions")`}</pre>

      <h3>Send (or resend) the interview link by email</h3>
      <pre>{`result = client.sessions.send_link(
    "df_a1b2c3d4...",
    recipient_email="jane@example.com",
    recipient_name="Jane Smith",
    custom_message="Please complete your intake forms at your earliest convenience.",
)`}</pre>

      <h3>Void a session</h3>
      <p>
        Immediately invalidates the interview link. The client sees a closure message if they
        attempt to open it. Voiding cannot be undone.
      </p>
      <pre>{`result = client.sessions.void(
    "df_a1b2c3d4...",
    reason="Sent to wrong client",
    notify_signer=True,  # sends the client an email notifying them
)`}</pre>

      <h3>Bulk-create sessions</h3>
      <p>
        Create up to 100 sessions in one request. Each item is processed independently — partial
        failures do not block the rest. The response is always HTTP{" "}
        <code>207 Multi-Status</code> with a per-item <code>ok</code> flag.
      </p>
      <pre>{`result = client.sessions.bulk_create(
    sessions=[
        {"package_id": 42, "prefill": {"first_name": "Jane", "email": "jane@example.com"}},
        {"package_id": 42, "prefill": {"first_name": "Bob",  "email": "bob@example.com"}},
    ]
)

print(f"Created {result.succeeded} of {result.total}")

for item in result.results:
    if item.ok:
        print(item.session_token, "→", item.interview_url)
    else:
        print(f"[index {item.index}] {item.error}")`}</pre>
      <p>
        <a href="/developer/bulk-sessions">Full bulk session documentation →</a>
      </p>

      <h3>Session audit log</h3>
      <p>
        Retrieve the immutable chronological trail of every action on a session — creation, link
        opens, submission, signing, voids, and PDF generation.
      </p>
      <pre>{`log = client.sessions.audit_log("df_a1b2c3d4...")

for entry in log.entries:
    print(f"[{entry.created_at}] {entry.event} — {entry.actor_type}")`}</pre>
      <p>
        <a href="/developer/audit-log">Full audit log documentation →</a>
      </p>

      <h3>Multi-party signers</h3>
      <p>
        Check the status of every signer in a sequential multi-party signing flow. Use this to track
        progress, surface completion in your dashboard, or gate PDF generation.
      </p>
      <pre>{`result = client.sessions.signers("df_a1b2c3d4...")

for signer in result.signers:
    print(f"[{signer.order}] {signer.email} — {signer.status}")`}</pre>
      <p>
        <a href="/developer/signers">Full multi-party signers documentation →</a>
      </p>

      <h3>Generate a PDF (server-side)</h3>
      <p>
        After filling a session's answers programmatically with <code>update_answers</code>, call
        this to trigger PDF generation and fire any enabled integrations (webhooks, Google Drive,
        HubSpot).
      </p>
      <pre>{`import time

# Fill answers programmatically
client.sessions.update_answers("df_a1b2c3d4...", {
    "first_name":    "Jane",
    "last_name":     "Smith",
    "date_of_birth": "1985-07-22",
})

# Trigger PDF generation
result = client.sessions.generate("df_a1b2c3d4...")

if result.status == "generated":
    # Synchronous (rare fallback) — ready immediately
    print("Download:", result.download_url)
else:
    # Asynchronous (normal) — poll until ready
    while True:
        time.sleep(2)
        status = client.sessions.get_generate_status("df_a1b2c3d4...", result.job_id)
        if status.status == "ready":
            print("Download:", status.download_url)
            break
        if status.status == "failed":
            raise RuntimeError(status.error or "Generation failed")`}</pre>

      <h2>Packages</h2>

      <h3>List packages</h3>
      <pre>{`packages = client.packages.list()

for pkg in packages:
    print(pkg.id, pkg.name)  # 42, "New Client Intake"`}</pre>

      <h3>Get a package</h3>
      <pre>{`pkg = client.packages.get(42)`}</pre>

      <h3>Webhook delivery log</h3>
      <p>Retrieve the delivery history for a package's webhook — useful for debugging failed deliveries.</p>
      <pre>{`result = client.packages.webhook_deliveries(42, limit=50, offset=0)

for d in result.deliveries:
    print(d.attempt_number, d.http_status, d.duration_ms)`}</pre>

      <h2>Sandbox</h2>
      <p>
        The sandbox endpoint is publicly accessible — no API key required. It creates a live demo
        session against a fixed 8-field sample package.
      </p>
      <pre>{`# No API key needed — pass an empty string or any placeholder
client = Docuplete(api_key="")

result = client.sandbox.start(
    first_name="Jane",
    last_name="Smith",
    email="jane@example.com",
)

# Open result.interview_url in a browser to walk through the sandbox interview
print("Demo link:", result.interview_url)`}</pre>

      <div className="callout callout-info">
        <strong>Sandbox sessions</strong> are prefixed <code>df_sbx_</code>, expire after 7 days,
        and do not trigger webhooks or count against your submission quota. See the{" "}
        <a href="/developer/sandbox">Sandbox Demo page</a> for full details.
      </div>

      <h2>Webhook verification</h2>
      <p>
        The SDK ships with built-in helpers for verifying the <code>X-Docuplete-Signature</code>{" "}
        header and parsing the payload. They use Python's standard <code>hmac</code> module and
        work without any additional dependencies.
      </p>

      <h3>Verify and parse in one step</h3>
      <pre>{`import os
from flask import Flask, request, abort
from docuplete import construct_webhook_event, DocupleteError

app = Flask(__name__)

@app.post("/webhook")
def handle_webhook():
    sig = request.headers.get("X-Docuplete-Signature", "")

    try:
        # Raises DocupleteError if the signature is invalid
        event = construct_webhook_event(
            payload=request.get_data(as_text=True),  # raw body — do NOT parse as JSON first
            signature=sig,
            secret=os.environ["DOCUPLETE_WEBHOOK_SECRET"],
        )
    except DocupleteError:
        abort(401, "Invalid signature")

    if event.event == "interview.submitted":
        print("Session token:", event.session_token)
        print("Package ID:",    event.package_id)
        print("Answers:",       event.answers)
        print("PDF URL:",       event.generated_pdf_url)

    return "", 200`}</pre>

      <h3>Verify only</h3>
      <pre>{`from docuplete import verify_webhook_signature

valid = verify_webhook_signature(
    payload=request.get_data(as_text=True),          # raw body string
    signature=request.headers["X-Docuplete-Signature"],  # header value
    secret=os.environ["DOCUPLETE_WEBHOOK_SECRET"],    # your package's signing secret
)

if not valid:
    abort(401, "Invalid signature")`}</pre>

      <h2>Error handling</h2>
      <p>
        All SDK methods raise a <code>DocupleteError</code> on API or network errors. Catch it to
        access structured error details.
      </p>
      <pre>{`from docuplete import Docuplete, DocupleteError

try:
    session = client.sessions.get("df_invalid")
except DocupleteError as err:
    print(err.message)  # Human-readable description
    print(err.status)   # HTTP status code — 0 for network errors
    print(err.code)     # Machine-readable code, e.g. "not_found"
    print(err.issues)   # Validation errors list (only on 400 responses)`}</pre>

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Property</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><code>message</code></td><td>str</td><td>Human-readable error description.</td></tr>
            <tr><td><code>status</code></td><td>int</td><td>HTTP status code. <code>0</code> for network/timeout errors.</td></tr>
            <tr><td><code>code</code></td><td>str</td><td>Machine-readable error code (e.g. <code>"not_found"</code>, <code>"unauthorized"</code>).</td></tr>
            <tr><td><code>issues</code></td><td>list[str] | None</td><td>Field-level validation errors returned on <code>400</code> responses.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Type hints</h2>
      <p>All response types are importable from the package root:</p>
      <pre>{`from docuplete import (
    # Sessions — core
    Session,                      # Full session object returned by sessions.get()
    SessionListItem,              # Abbreviated session returned in sessions.list()
    SessionStatus,                # Literal["pending", "in_progress", "generated", "voided", "expired"]
    CreateSessionParams,          # TypedDict for sessions.create()
    CreateSessionResult,          # Return type of sessions.create()
    GenerateSessionResult,        # Union: pending (job_id) | generated (download_url)
    GenerateStatusResult,         # Return type of sessions.get_generate_status()
    # Sessions — enterprise
    BulkCreateSessionItem,        # TypedDict for one item in sessions.bulk_create()
    BulkCreateSessionResult,      # Return type of sessions.bulk_create()
    BulkCreateSessionResultItem,  # Per-item result (ok, session_token, interview_url, error, code)
    AuditLogResult,               # Return type of sessions.audit_log()
    AuditLogEntry,                # Single event in the audit log
    SessionSignersResult,         # Return type of sessions.signers()
    SessionSigner,                # One signer record (order, email, status, signer_token, …)
    # Packages & account
    Package,                      # Package object
    Account,                      # Return type of account.get()
    # Sandbox & webhooks
    SandboxStartResult,           # Return type of sandbox.start()
    WebhookPayload,               # Typed webhook event body (Union of event types)
)`}</pre>
    </div>
  );
}
