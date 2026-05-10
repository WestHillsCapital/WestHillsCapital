export default function PythonSdk() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Python SDK</h1>
        <p className="text-lg text-white/55 mt-2">
          The official Python client for the Docuplete API — fully typed with TypedDicts, one
          external dependency (<code>httpx</code>), compatible with Python 3.8+.
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
            <tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr>
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

      <p>
        The client supports use as a context manager — the underlying connection pool is
        closed automatically on exit:
      </p>
      <pre>{`with Docuplete(api_key=os.environ["DOCUPLETE_API_KEY"]) as client:
    result = client.sessions.create(package_id=42)`}</pre>

      <h2>Sessions</h2>
      <p>
        All session methods return plain <code>dict</code> values. Access fields with standard
        dict syntax — e.g. <code>result["interview_url"]</code>.
      </p>

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
        "interval_days": 2,
    },
    # Optional: multi-party sequential signing
    signers=[
        {"order": 1, "email": "jane@example.com", "name": "Jane Smith (Client)"},
        {"order": 2, "email": "bob@lawfirm.com",  "name": "Bob Torres (Notary)"},
    ],
)

# Send result["interview_url"] to your client via email, SMS, or redirect
print("Interview link:", result["interview_url"])
print("Session token:", result["session_token"])`}</pre>

      <h3>Get a session</h3>
      <p>
        Fetch the current state of a session. Use this to poll for completion or to retrieve
        submitted answers after the client submits.
      </p>
      <pre>{`session = client.sessions.get("df_a1b2c3d4...")

print(session["status"])   # "pending" | "in_progress" | "generated" | "voided" | "expired"
print(session["answers"])  # dict of submitted answers (populated after "generated")`}</pre>

      <h3>List sessions</h3>
      <pre>{`result = client.sessions.list(
    package_id=42,          # filter by package
    status="generated",     # filter by status
    limit=50,
    offset=0,
)

print(f'{result["total"]} total sessions')
for s in result["sessions"]:
    print(s["token"], s["status"])`}</pre>

      <h3>Send (or resend) the interview link by email</h3>
      <pre>{`client.sessions.send_link(
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
)
print(result["voided_at"])`}</pre>

      <h3>Bulk-create sessions</h3>
      <p>
        Create up to 100 sessions in one request. Each item is processed independently — partial
        failures do not block the rest. The response always includes a per-item <code>ok</code> flag.
      </p>
      <pre>{`result = client.sessions.bulk_create([
    {"package_id": 42, "prefill": {"first_name": "Jane", "email": "jane@example.com"}},
    {"package_id": 42, "prefill": {"first_name": "Bob",  "email": "bob@example.com"}},
])

print(f'Created {result["succeeded"]} of {result["total"]}')

for item in result["results"]:
    if item["ok"]:
        print(item["session_token"], "→", item["interview_url"])
    else:
        print(f'[index {item["index"]}] {item["error"]}')`}</pre>
      <p>
        <a href="/developer/bulk-sessions">Full bulk session documentation →</a>
      </p>

      <h3>Session audit log</h3>
      <p>
        Retrieve the immutable chronological trail of every action on a session — creation, link
        opens, submission, signing, voids, and PDF generation.
      </p>
      <pre>{`log = client.sessions.audit_log("df_a1b2c3d4...")

for entry in log["entries"]:
    print(f'[{entry["created_at"]}] {entry["event"]} — {entry["actor_type"]}')`}</pre>
      <p>
        <a href="/developer/audit-log">Full audit log documentation →</a>
      </p>

      <h3>Multi-party signers</h3>
      <p>
        Check the status of every signer in a sequential multi-party signing flow. Use this to track
        progress, surface completion in your dashboard, or gate PDF generation.
      </p>
      <pre>{`result = client.sessions.signers("df_a1b2c3d4...")

for signer in result["signers"]:
    print(f'[{signer["order"]}] {signer["email"]} — {signer["status"]}')`}</pre>
      <p>
        <a href="/developer/signers">Full multi-party signers documentation →</a>
      </p>

      <h3>Generate a PDF (server-side)</h3>
      <pre>{`import time

# Trigger PDF generation
result = client.sessions.generate("df_a1b2c3d4...")

if result["status"] == "generated":
    # Synchronous (rare fallback) — ready immediately
    print("Download:", result["download_url"])
else:
    # Asynchronous (normal) — poll until ready
    job_id = result["job_id"]
    while True:
        time.sleep(2)
        s = client.sessions.get_generate_status("df_a1b2c3d4...", job_id)
        if s["status"] == "ready":
            print("Download:", s["download_url"])
            break
        if s["status"] == "failed":
            raise RuntimeError(s.get("error") or "Generation failed")`}</pre>

      <h2>Packages</h2>

      <h3>List packages</h3>
      <pre>{`packages = client.packages.list()

for pkg in packages:
    print(pkg["id"], pkg["name"])  # 42, "New Client Intake"`}</pre>

      <h3>Get a package</h3>
      <pre>{`pkg = client.packages.get(42)
print(pkg["name"])`}</pre>

      <h3>Webhook delivery log</h3>
      <p>
        Retrieve the delivery history for a package's webhook — useful for debugging failed
        deliveries. This method is not yet on <code>client.packages</code>, so call the API
        directly:
      </p>
      <pre>{`import httpx, os

resp = httpx.get(
    f"https://api.docuplete.com/api/v1/packages/42/webhook-deliveries",
    headers={"Authorization": f'Bearer {os.environ["DOCUPLETE_API_KEY"]}'},
    params={"limit": 50, "offset": 0},
)
resp.raise_for_status()
data = resp.json()

for d in data.get("deliveries", []):
    print(d["attempt_number"], d["http_status"], d["duration_ms"])`}</pre>

      <h2>Sandbox</h2>
      <p>
        The sandbox endpoint is publicly accessible — no API key required. Because the Python SDK
        requires a non-empty API key, call the endpoint directly with <code>httpx</code> or{" "}
        <code>requests</code>:
      </p>
      <pre>{`import httpx

# /sandbox/start is GET — prefill is supplied via query params (all optional).
# Accepted keys: firstName, lastName, email, dateOfBirth,
# addressLine1, city, state, zip
response = httpx.get(
    "https://api.docuplete.com/api/v1/sandbox/start",
    params={
        "firstName": "Jane",
        "lastName":  "Smith",
        "email":     "jane@example.com",
    },
)
response.raise_for_status()
data = response.json()

# Open data["interviewUrl"] in a browser to walk through the sandbox interview
print("Demo link:", data["interviewUrl"])`}</pre>

      <div className="callout callout-info">
        <strong>Sandbox sessions</strong> are prefixed <code>df_sbx_</code>, expire after 7 days,
        and do not trigger webhooks or count against your submission quota. See the{" "}
        <a href="/developer/sandbox">Sandbox Demo page</a> for full details.
      </div>

      <h2>Webhook verification</h2>
      <p>
        The SDK ships with built-in helpers for verifying the <code>X-Docuplete-Signature</code>{" "}
        header and parsing the payload. They use Python's standard <code>hmac</code> module and
        work without any additional dependencies beyond <code>httpx</code>.
      </p>

      <h3>Verify and parse in one step</h3>
      <pre>{`import os
from flask import Flask, request, abort
from docuplete import construct_webhook_event

app = Flask(__name__)

@app.post("/webhook")
def handle_webhook():
    sig = request.headers.get("X-Docuplete-Signature", "")

    try:
        # Raises ValueError if the signature is invalid
        event = construct_webhook_event(
            request.get_data(as_text=True),     # raw body — do NOT parse as JSON first
            sig,
            os.environ["DOCUPLETE_WEBHOOK_SECRET"],
        )
    except ValueError:
        abort(401, "Invalid signature")

    if event["event"] == "session.submitted":
        print("Session token:", event["session_token"])
        print("Package ID:",    event["package_id"])
        print("Answers:",       event["answers"])

    if event["event"] == "pdf.generated":
        print("PDF ready:",     event["download_url"])

    return "", 200`}</pre>

      <h3>Verify only</h3>
      <pre>{`from docuplete import verify_webhook_signature

valid = verify_webhook_signature(
    request.get_data(as_text=True),                  # raw body string
    request.headers["X-Docuplete-Signature"],         # header value
    os.environ["DOCUPLETE_WEBHOOK_SECRET"],            # your package's signing secret
)

if not valid:
    abort(401, "Invalid signature")`}</pre>

      <h2>Error handling</h2>
      <p>
        All SDK methods raise <code>DocupleteError</code> on API or network errors. Catch it to
        access structured error details.
      </p>
      <pre>{`from docuplete import Docuplete, DocupleteError

try:
    session = client.sessions.get("df_invalid")
except DocupleteError as err:
    print(err)          # Human-readable description (from str(err))
    print(err.status)   # HTTP status code — 0 for network errors
    print(err.code)     # Machine-readable code, e.g. "not_found"
    print(err.issues)   # Validation errors list (may be empty)`}</pre>

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Attribute</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><code>str(err)</code></td><td>str</td><td>Human-readable error description.</td></tr>
            <tr><td><code>err.status</code></td><td>int</td><td>HTTP status code. <code>0</code> for network/timeout errors.</td></tr>
            <tr><td><code>err.code</code></td><td>str</td><td>Machine-readable error code (e.g. <code>"not_found"</code>, <code>"unauthorized"</code>).</td></tr>
            <tr><td><code>err.issues</code></td><td>list[str]</td><td>Field-level validation errors returned on <code>400</code> responses. Empty list when not applicable.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Type hints</h2>
      <p>
        All return values are plain <code>dict</code> instances at runtime. TypedDicts are available
        for static analysis — import them from <code>docuplete.types</code>:
      </p>
      <pre>{`from docuplete.types import (
    # Session core
    Session,                      # Full session dict returned by sessions.get()
    SessionListItem,              # Abbreviated session in sessions.list()["sessions"]
    SessionStatus,                # Literal of all status strings
    CreateSessionResult,          # Return type of sessions.create()
    ListSessionsResult,           # Return type of sessions.list()
    GenerateSessionResult,        # Union: pending (job_id) | generated (download_url)
    GenerateStatusResult,         # Return type of sessions.get_generate_status()
    # Sessions — enterprise
    BulkCreateSessionItem,        # Input TypedDict for one item in sessions.bulk_create()
    BulkCreateSessionResult,      # Return type of sessions.bulk_create()
    BulkCreateSessionResultItem,  # Per-item result (ok, session_token, interview_url, error)
    AuditLogResult,               # Return type of sessions.audit_log()
    AuditLogEntry,                # Single event in the audit log
    SessionSignersResult,         # Return type of sessions.signers()
    SessionSignerStatus,          # One signer record (order, email, status, signer_token, …)
    # Input helpers
    RemindersConfig,              # {"enabled": bool, "interval_days": int}
    SessionSigner,                # {"email": str, "name": str, "order": int}
    VoidSessionResult,            # Return type of sessions.void()
    # Webhook payloads
    WebhookPayload,               # Union of all typed webhook event dicts
)`}</pre>
    </div>
  );
}
