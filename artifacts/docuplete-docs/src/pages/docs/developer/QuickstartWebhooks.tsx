export default function QuickstartWebhooks() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Quickstart: Handling Webhooks</h1>
        <p className="text-lg text-white/55 mt-2">
          Receive real-time notifications when a client completes, abandons, or signs an interview — so your
          system can react instantly without polling.
        </p>
      </div>

      <h2>How webhooks work</h2>
      <p>
        When a significant event occurs in Docuplete — such as a session being submitted — we send an HTTP{" "}
        <code>POST</code> request to an HTTPS endpoint of your choosing. Your server must respond with{" "}
        <code>200 OK</code> within 10 seconds; otherwise the delivery is retried up to 5 times with exponential
        back-off.
      </p>

      <h2>1. Register your endpoint</h2>
      <ol>
        <li>Go to <strong>Settings → Webhooks</strong> in the Docuplete dashboard.</li>
        <li>Click <strong>Add endpoint</strong>.</li>
        <li>Enter your server's HTTPS URL (e.g., <code>https://yourapp.com/webhooks/docuplete</code>).</li>
        <li>Select the events you want to receive (e.g., <strong>session.submitted</strong>).</li>
        <li>Save. Docuplete generates a <strong>signing secret</strong> — copy it now.</li>
      </ol>

      <div className="callout callout-warning">
        <strong>Always verify the signature.</strong> Never process a webhook payload without first confirming the
        HMAC signature. An unverified endpoint can be spoofed by anyone who knows your URL.
      </div>

      <h2>2. Verify the signature</h2>
      <p>
        Every webhook request includes a <code>X-Docuplete-Signature</code> header. This is an HMAC-SHA256
        digest of the raw request body, keyed with your signing secret. Verify it before processing:
      </p>

      <pre>{`// Node.js (Express)
import crypto from "crypto";

function verifyDocupleteSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
): boolean {
  const expected = crypto
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
        <strong>Parse after verification.</strong> Parse the JSON body only after the HMAC check passes.
        Use <code>express.raw()</code> (not <code>express.json()</code>) so the body is available as a raw{" "}
        <code>Buffer</code> for hashing.
      </div>

      <h2>3. Handle events</h2>
      <p>
        Every event payload shares a common envelope:
      </p>
      <pre>{`{
  "id":        "evt_01HXQ...",
  "event":     "session.submitted",
  "createdAt": "2026-05-07T14:23:00Z",
  "data": {
    "sessionToken": "df_a1b2c3d4...",
    "packageId":    42,
    "status":       "submitted",
    "submittedAt":  "2026-05-07T14:22:58Z",
    "answers": {
      "firstName": "Jane",
      "lastName":  "Smith",
      "email":     "jane@example.com"
    }
  }
}`}</pre>

      <p>Branch on the <code>event</code> field to route to the right handler:</p>
      <pre>{`switch (event.event) {
  case "session.submitted":
    await handleSubmission(event.data);
    break;
  case "session.voided":
    await handleVoid(event.data);
    break;
  case "session.expired":
    await handleExpiry(event.data);
    break;
  default:
    // Unknown event type — log and ignore for forward compatibility
    console.warn("Unknown Docuplete event:", event.event);
}`}</pre>

      <h2>Event reference</h2>
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Trigger</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>session.submitted</code></td>
            <td>Client completes and submits the interview. PDF is generated and answers are available.</td>
          </tr>
          <tr>
            <td><code>session.voided</code></td>
            <td>An admin voids the session, invalidating the link.</td>
          </tr>
          <tr>
            <td><code>session.expired</code></td>
            <td>The session link passed its <code>expiresAt</code> date without being submitted.</td>
          </tr>
          <tr>
            <td><code>session.esign_completed</code></td>
            <td>All e-sign fields have been signed (enterprise e-sign packages only).</td>
          </tr>
        </tbody>
      </table>

      <h2>4. Test your endpoint</h2>
      <p>
        Use the <strong>Send test event</strong> button in <strong>Settings → Webhooks → Delivery Logs</strong> to
        fire a sample payload to your endpoint and confirm the signature verification works before going live.
      </p>

      <h2>Retry behavior</h2>
      <p>
        If your endpoint returns any status other than 2xx, or times out after 10 seconds, Docuplete retries the
        delivery:
      </p>
      <table>
        <thead>
          <tr>
            <th>Attempt</th>
            <th>Delay</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>Immediate</td></tr>
          <tr><td>2</td><td>30 seconds</td></tr>
          <tr><td>3</td><td>5 minutes</td></tr>
          <tr><td>4</td><td>30 minutes</td></tr>
          <tr><td>5</td><td>2 hours</td></tr>
        </tbody>
      </table>
      <p>
        After 5 failed attempts, the delivery is marked as failed and no further retries are made. Review failed
        deliveries in <strong>Settings → Webhooks → Delivery Logs</strong> and re-trigger manually if needed.
      </p>

      <h2>Python example</h2>
      <pre>{`import hashlib, hmac, os
from flask import Flask, request, abort

app = Flask(__name__)

WEBHOOK_SECRET = os.environ["DOCUPLETE_WEBHOOK_SECRET"].encode()

@app.route("/webhooks/docuplete", methods=["POST"])
def docuplete_webhook():
    sig = request.headers.get("X-Docuplete-Signature", "")
    expected = hmac.new(WEBHOOK_SECRET, request.get_data(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        abort(401)

    event = request.get_json()
    if event["event"] == "session.submitted":
        handle_submission(event["data"])

    return "", 200`}</pre>

      <h2>Next steps</h2>
      <ul>
        <li>Read the full <a href="/webhooks/payload">event payload reference</a> for all fields returned in each event type.</li>
        <li>Learn how to <a href="/webhooks/rotating">rotate your signing secret</a> without downtime.</li>
        <li>View past deliveries and retry failures in <a href="/webhooks/logs">Delivery Logs</a>.</li>
      </ul>
    </div>
  );
}
