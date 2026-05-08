export default function QuickstartWebhooks() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Quickstart: Handling Webhooks</h1>
        <p className="text-lg text-white/55 mt-2">
          Receive real-time notifications when a client completes an interview — so your system can
          react instantly without polling.
        </p>
      </div>

      <h2>How webhooks work</h2>
      <p>
        When a client submits an interview, Docuplete sends an HTTP <code>POST</code> request to an
        HTTPS endpoint of your choosing. Your server must respond with <code>200 OK</code> within 10
        seconds; otherwise the delivery is retried up to 5 times with exponential backoff.
      </p>

      <h2>1. Register your endpoint</h2>
      <ol>
        <li>Go to <strong>Settings → Webhooks</strong> in the Docuplete dashboard.</li>
        <li>Click <strong>Add endpoint</strong>.</li>
        <li>Enter your server's HTTPS URL (e.g., <code>https://yourapp.com/webhooks/docuplete</code>).</li>
        <li>Save. Docuplete generates a <strong>signing secret</strong> — copy it now.</li>
      </ol>

      <div className="callout callout-warning">
        <strong>Always verify the signature.</strong> Never process a webhook payload without first
        confirming the HMAC signature. An unverified endpoint can be spoofed by anyone who knows your URL.
      </div>

      <h2>2. Verify the signature</h2>
      <p>
        Every webhook request includes an <code>X-Docuplete-Signature</code> header formatted as{" "}
        <code>sha256=&lt;hex-digest&gt;</code>. This is an HMAC-SHA256 of the raw request body keyed
        with your signing secret.
      </p>

      <h3>Using the SDK (recommended)</h3>
      <p>
        The <a href="/developer/sdk">Node.js SDK</a> handles verification and parsing in one call:
      </p>
      <pre>{`import express from "express";
import { constructWebhookEvent } from "@docuplete/sdk";

app.post(
  "/webhooks/docuplete",
  express.raw({ type: "application/json" }), // ← must be raw bytes, not parsed JSON
  async (req, res) => {
    const sig = req.headers["x-docuplete-signature"] as string;

    let event;
    try {
      event = await constructWebhookEvent(
        req.body.toString(),
        sig,
        process.env.DOCUPLETE_WEBHOOK_SECRET!,
      );
    } catch {
      return res.status(401).send("Invalid signature");
    }

    if (event.event === "interview.submitted") {
      await handleSubmission(event);
    }

    res.sendStatus(200);
  },
);`}</pre>

      <h3>Without the SDK</h3>
      <pre>{`import crypto from "crypto";

function verifyDocupleteSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
): boolean {
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader),
  );
}

app.post(
  "/webhooks/docuplete",
  express.raw({ type: "application/json" }), // ← must be raw bytes
  (req, res) => {
    const sig = req.headers["x-docuplete-signature"] as string;
    if (!verifyDocupleteSignature(req.body, sig, process.env.DOCUPLETE_WEBHOOK_SECRET!)) {
      return res.status(401).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());
    // Handle event below…
    res.sendStatus(200);
  },
);`}</pre>

      <div className="callout">
        <strong>Parse after verification.</strong> Parse the JSON body only after the HMAC check
        passes. Use <code>express.raw()</code> (not <code>express.json()</code>) so the body is
        available as a raw <code>Buffer</code> for hashing.
      </div>

      <h2>3. Handle the event</h2>
      <p>Every webhook payload has this structure:</p>
      <pre>{`{
  "event":           "interview.submitted",
  "packageId":       42,
  "packageName":     "New Client Intake",
  "sessionToken":    "df_a1b2c3d4...",
  "submittedAt":     "2026-05-08T14:22:58Z",
  "prefill": {
    "firstName": "Jane",
    "email":     "jane@example.com"
  },
  "answers": {
    "firstName": "Jane",
    "lastName":  "Smith",
    "email":     "jane@example.com"
  },
  "generatedPdfUrl": "https://api.docuplete.com/api/v1/sessions/df_a1b2c3.../packet.pdf"
}`}</pre>

      <p>See the full <a href="/webhooks/payload">Event Payload reference</a> for all fields.</p>

      <h2>4. Test your endpoint</h2>
      <p>
        Use the <strong>Send test event</strong> button in <strong>Settings → Webhooks → Delivery
        Logs</strong> to fire a sample payload to your endpoint and confirm signature verification
        works before going live.
      </p>

      <h2>Retry behavior</h2>
      <p>
        If your endpoint returns any status other than 2xx, or times out after 10 seconds, Docuplete
        retries the delivery:
      </p>
      <table>
        <thead>
          <tr>
            <th>Attempt</th>
            <th>Delay</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>1 (initial)</td><td>Immediate</td></tr>
          <tr><td>2</td><td>30 seconds</td></tr>
          <tr><td>3</td><td>5 minutes</td></tr>
          <tr><td>4</td><td>30 minutes</td></tr>
          <tr><td>5</td><td>2 hours</td></tr>
        </tbody>
      </table>
      <p>
        After 5 failed attempts, the delivery is marked as failed and no further retries are made.
        Review failed deliveries in <strong>Settings → Webhooks → Delivery Logs</strong> and
        re-trigger manually if needed.
      </p>

      <h2>Python example</h2>
      <pre>{`import hashlib, hmac, os
from flask import Flask, request, abort

app = Flask(__name__)

WEBHOOK_SECRET = os.environ["DOCUPLETE_WEBHOOK_SECRET"].encode()

@app.route("/webhooks/docuplete", methods=["POST"])
def docuplete_webhook():
    sig = request.headers.get("X-Docuplete-Signature", "")
    expected = "sha256=" + hmac.new(WEBHOOK_SECRET, request.get_data(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        abort(401)

    event = request.get_json()
    if event["event"] == "interview.submitted":
        handle_submission(event)

    return "", 200`}</pre>

      <h2>Next steps</h2>
      <ul>
        <li>Read the full <a href="/webhooks/payload">event payload reference</a> for all fields returned in the event.</li>
        <li>Learn how to <a href="/webhooks/rotating">rotate your signing secret</a> without downtime.</li>
        <li>View past deliveries and retry failures in <a href="/webhooks/logs">Delivery Logs</a>.</li>
      </ul>
    </div>
  );
}
