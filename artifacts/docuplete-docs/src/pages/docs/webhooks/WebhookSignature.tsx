export default function WebhookSignature() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Webhooks & API</div>
        <h1>Signature Verification</h1>
        <p className="text-lg text-white/55 mt-2">Verify that webhook deliveries are genuinely from Docuplete using HMAC-SHA256 signatures.</p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> Webhooks are available exclusively on the Enterprise plan.
      </div>

      <h2>How signatures work</h2>
      <p>Every webhook delivery includes a <code>X-Docuplete-Signature</code> HTTP header. Its value is an HMAC-SHA256 hash of the raw request body, computed using your package's webhook secret as the key.</p>
      <p>Your server should recompute this hash from the raw body and your stored secret, then compare it to the header value. If they match, the delivery is authentic. If they don't match, reject it with HTTP 401.</p>

      <h2>Signature header format</h2>
      <pre>{`X-Docuplete-Signature: sha256=a1b2c3d4e5f6...`}</pre>
      <p>The value is the prefix <code>sha256=</code> followed by the hex-encoded HMAC-SHA256 digest.</p>

      <h2>Verification examples</h2>

      <h3>Node.js</h3>
      <pre>{`import crypto from "crypto";

function verifyWebhook(rawBody, signatureHeader, secret) {
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(rawBody)  // rawBody must be a Buffer or raw string, NOT parsed JSON
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader)
  );
}

// Express example (ensure body-parser is configured to expose rawBody)
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["x-docuplete-signature"];
  if (!verifyWebhook(req.body, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send("Invalid signature");
  }
  const payload = JSON.parse(req.body);
  // process payload...
  res.status(200).send("OK");
});`}</pre>

      <h3>Python</h3>
      <pre>{`import hmac, hashlib

def verify_webhook(raw_body: bytes, signature_header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)`}</pre>

      <div className="callout callout-warning">
        <strong>Use raw body, not parsed JSON.</strong> Always verify the signature against the raw request body bytes <em>before</em> JSON parsing. If you JSON-parse first and re-serialize, whitespace or key ordering may differ and the signature will not match.
      </div>

      <h2>Timing-safe comparison</h2>
      <p>Always use a timing-safe comparison function (<code>crypto.timingSafeEqual</code> in Node, <code>hmac.compare_digest</code> in Python) to prevent timing attacks. Do not use <code>===</code> or string equality.</p>
    </div>
  );
}
