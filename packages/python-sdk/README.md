# Docuplete Python SDK

Official Python client for the [Docuplete](https://docuplete.com) API — document automation, guided client interviews, and e-signatures for high-compliance industries.

## Installation

```bash
pip install docuplete
# or
poetry add docuplete
```

Requires Python 3.8+ and [`httpx`](https://www.python-httpx.org/) (installed automatically).

## Quick start

```python
import os
from docuplete import Docuplete

client = Docuplete(api_key=os.environ["DOCUPLETE_API_KEY"])

# Create a session — returns an interview URL to send to your client
result = client.sessions.create(
    package_id=42,
    prefill={
        "first_name": "Jane",
        "last_name":  "Smith",
        "email":      "jane@example.com",
        "phone":      "555-867-5309",
    },
    link_expiry_days=14,
    reminders={"enabled": True, "interval_days": 3},
)

print(result["interview_url"])   # https://docuplete.com/...
print(result["session_token"])   # df_a1b2c3...
print(result["expires_at"])      # 2026-05-23T14:00:00Z
```

## Sessions

### Create a session

```python
result = client.sessions.create(
    package_id=42,
    prefill={"first_name": "Jane", "email": "jane@example.com"},
    link_expiry_days=7,
    locale="es",
    reminders={"enabled": True, "interval_days": 2},
)
```

### Multi-party signing

```python
result = client.sessions.create(
    package_id=42,
    prefill={"property_address": "123 Main St"},
    signers=[
        {"email": "buyer@example.com",  "name": "Alice Buyer",  "order": 0},
        {"email": "seller@example.com", "name": "Bob Seller",   "order": 1},
        {"email": "agent@example.com",  "name": "Carol Agent",  "order": 2},
    ],
)
```

### Bulk session creation (up to 100)

```python
contacts = [{"email": "a@co.com", "name": "Alice"}, {"email": "b@co.com", "name": "Bob"}]

result = client.sessions.bulk_create([
    {
        "package_id": 42,
        "prefill": {"email": c["email"], "first_name": c["name"]},
    }
    for c in contacts
])

for r in result["results"]:
    if r["ok"]:
        print("Created:", r["session_token"])
    else:
        print(f"Item {r['index']} failed: {r['error']}")
```

### Get session status

```python
session = client.sessions.get("df_a1b2c3...")
print(session["status"])    # "generated"
print(session["answers"])   # {"first_name": "Jane", ...}
print(session["pdf_url"])   # download URL (when generated)
```

### Session audit log

```python
log = client.sessions.audit_log("df_a1b2c3...")
for entry in log["entries"]:
    print(entry["event"], entry["created_at"], entry["actor_ip"])
```

### Multi-party signer status

```python
result = client.sessions.signers("df_a1b2c3...")
for signer in result["signers"]:
    print(signer["email"], signer["status"])
```

### Send or re-send a link

```python
client.sessions.send_link(
    "df_a1b2c3...",
    recipient_email="jane@example.com",
    recipient_name="Jane Smith",
    custom_message="Please complete your intake form at your earliest convenience.",
)
```

### Void a session

```python
client.sessions.void("df_a1b2c3...", reason="Sent to wrong client", notify_signer=True)
```

### PDF generation (manual trigger)

```python
import time

result = client.sessions.generate("df_a1b2c3...")
if result["status"] == "generated":
    print("Ready:", result["download_url"])
else:
    # Poll until ready
    while True:
        time.sleep(2)
        status = client.sessions.get_generate_status(result["token"])
        if status["status"] == "ready":
            print("PDF:", status["download_url"])
            break
        if status["status"] == "failed":
            raise RuntimeError(status.get("error", "PDF generation failed"))
```

## Packages

```python
# List all packages
packages = client.packages.list()
for pkg in packages:
    print(pkg["id"], pkg["name"])

# Get a specific package
pkg = client.packages.get(42)
```

## Webhook verification

Always verify the `X-Docuplete-Signature` header before processing a webhook payload.

### FastAPI

```python
import os
from fastapi import FastAPI, Request, HTTPException
from docuplete import construct_webhook_event

app = FastAPI()

@app.post("/webhook/docuplete")
async def docuplete_webhook(request: Request):
    raw_body = (await request.body()).decode()
    sig = request.headers.get("x-docuplete-signature", "")

    try:
        event = construct_webhook_event(
            raw_body, sig, os.environ["DOCUPLETE_WEBHOOK_SECRET"]
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid signature")

    if event["event"] == "pdf.generated":
        print("PDF ready:", event["download_url"])
    elif event["event"] == "session.submitted":
        print("Submitted answers:", event["answers"])

    return {"ok": True}
```

### Flask

```python
import os
from flask import Flask, request
from docuplete import construct_webhook_event

app = Flask(__name__)

@app.post("/webhook/docuplete")
def docuplete_webhook():
    raw_body = request.get_data(as_text=True)
    sig = request.headers.get("X-Docuplete-Signature", "")

    try:
        event = construct_webhook_event(
            raw_body, sig, os.environ["DOCUPLETE_WEBHOOK_SECRET"]
        )
    except ValueError:
        return "Invalid signature", 401

    match event["event"]:
        case "pdf.generated":
            print("PDF ready:", event["download_url"])
        case "session.submitted":
            print("Submitted answers:", event["answers"])

    return "", 200
```

### Django

```python
import os, json
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from docuplete import construct_webhook_event

@csrf_exempt
def docuplete_webhook(request):
    raw_body = request.body.decode("utf-8")
    sig = request.headers.get("X-Docuplete-Signature", "")

    try:
        event = construct_webhook_event(
            raw_body, sig, os.environ["DOCUPLETE_WEBHOOK_SECRET"]
        )
    except ValueError:
        return HttpResponse(status=401)

    if event["event"] == "pdf.generated":
        print("PDF ready:", event["download_url"])

    return HttpResponse(status=200)
```

## Error handling

```python
from docuplete import Docuplete, DocupleteError

client = Docuplete(api_key=os.environ["DOCUPLETE_API_KEY"])

try:
    result = client.sessions.create(package_id=999, prefill={})
except DocupleteError as e:
    print(e.status)   # 404
    print(e.code)     # "package_not_found"
    print(str(e))     # "Package not found"
    print(e.issues)   # [] or ["field_name: message"]
```

## Context manager

```python
with Docuplete(api_key=os.environ["DOCUPLETE_API_KEY"]) as client:
    result = client.sessions.create(package_id=42, prefill={})
    # Connection pool is closed automatically on exit
```

## Configuration

```python
client = Docuplete(
    api_key="dp_live_...",
    timeout=60.0,           # seconds (default: 30)
    base_url="https://api.docuplete.com",  # override for testing
)
```

## Links

- [Full API documentation](https://docuplete.com/docuplete-docs/)
- [Developer Quickstart Guide](https://docuplete.com/docuplete-docs/developer/quickstart-guide)
- [Node.js / TypeScript SDK](https://www.npmjs.com/package/@docuplete/sdk)
- [Status page](https://status.docuplete.com)
