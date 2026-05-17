# docuplete

The official Python client for the [Docuplete](https://docuplete.com) API.

- Fully typed with TypedDicts
- One external dependency (`httpx`)
- Python 3.8+

## Installation

```bash
pip install docuplete
# or with uv
uv add docuplete
```

## Quick start

```python
import os
from docuplete import Docuplete

client = Docuplete(api_key=os.environ["DOCUPLETE_API_KEY"])

result = client.sessions.create(
    package_id=42,
    prefill={
        "first_name": "Jane",
        "last_name":  "Smith",
        "email":      "jane@example.com",
    },
    link_expiry_days=7,
)

print("Interview link:", result["interview_url"])
print("Session token:", result["session_token"])
```

## Sessions

```python
# Get a session
session = client.sessions.get("df_a1b2c3d4...")
print(session["status"])   # "pending" | "in_progress" | "generated" | "voided" | "expired"
print(session["answers"])  # dict of submitted answers (after "generated")

# List sessions
result = client.sessions.list(package_id=42, status="generated", limit=50)
for s in result["sessions"]:
    print(s["token"], s["status"])

# Send / resend the interview link
client.sessions.send_link(
    "df_a1b2c3d4...",
    recipient_email="jane@example.com",
    recipient_name="Jane Smith",
    custom_message="Please complete your intake forms.",
)

# Void a session
result = client.sessions.void("df_a1b2c3d4...", reason="Sent to wrong client")
print(result["voided_at"])

# Bulk create (up to 100)
result = client.sessions.bulk_create([
    {"package_id": 42, "prefill": {"first_name": "Jane", "email": "jane@example.com"}},
    {"package_id": 42, "prefill": {"first_name": "Bob",  "email": "bob@example.com"}},
])
print(f'Created {result["succeeded"]} of {result["total"]}')

# Audit log
log = client.sessions.audit_log("df_a1b2c3d4...")
for entry in log["entries"]:
    print(f'[{entry["created_at"]}] {entry["event"]}')
```

## Packages

```python
packages = client.packages.list()
for pkg in packages:
    print(pkg["id"], pkg["name"])

pkg = client.packages.get(42)
print(pkg["name"])
```

## Webhook verification

```python
import os
from flask import Flask, request, abort
from docuplete import construct_webhook_event

app = Flask(__name__)

@app.post("/webhook")
def handle_webhook():
    sig = request.headers.get("X-Docuplete-Signature", "")

    try:
        event = construct_webhook_event(
            request.get_data(as_text=True),
            sig,
            os.environ["DOCUPLETE_WEBHOOK_SECRET"],
        )
    except ValueError:
        abort(401, "Invalid signature")

    if event["event"] == "session.submitted":
        print("Answers:", event["answers"])

    return "", 200
```

## Error handling

```python
from docuplete import Docuplete, DocupleteError

try:
    session = client.sessions.get("df_invalid")
except DocupleteError as err:
    print(err)          # Human-readable description
    print(err.status)   # HTTP status code (0 for network errors)
    print(err.code)     # Machine-readable code, e.g. "not_found"
    print(err.issues)   # Validation errors list
```

## Type hints

```python
from docuplete.types import Session, CreateSessionResult, BulkCreateSessionResult
```

## License

MIT
