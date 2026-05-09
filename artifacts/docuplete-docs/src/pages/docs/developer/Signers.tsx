export default function Signers() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Multi-Party Signers</h1>
        <p className="text-lg text-white/55 mt-2">
          Orchestrate documents that require sequential sign-off from multiple parties. Each signer
          gets their own private link and cannot proceed until the party before them has completed.
        </p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> Multi-party signing requires an Enterprise plan.{" "}
        <a href="/getting-started/plans">Learn about plans →</a>
      </div>

      <h2>How sequential signing works</h2>
      <p>
        When a session is created with a <code>signers</code> list, Docuplete gates access by{" "}
        <code>order</code>. Signer 1 receives the interview link immediately. After they complete
        their step, signer 2 is notified automatically and receives their own private link — and so
        on down the chain. Each signer has a unique <code>signerToken</code> (<code>sgn_…</code>)
        and cannot view another signer's responses.
      </p>

      <h2>Creating a multi-party session</h2>
      <pre>{`import { Docuplete } from "@docuplete/sdk";

const client = new Docuplete({ apiKey: process.env.DOCUPLETE_API_KEY! });

const { sessionToken, interviewUrl } = await client.sessions.create({
  packageId: 42,
  signers: [
    { order: 1, email: "alice@example.com", name: "Alice Chen (Client)"   },
    { order: 2, email: "bob@lawfirm.com",   name: "Bob Torres (Notary)"   },
    { order: 3, email: "carol@firm.com",    name: "Carol Kim (Manager)"   },
  ],
});

// interviewUrl is signer 1 (Alice)'s link — send it to her now
// Bob and Carol receive links automatically after each preceding signer completes
console.log("Send to Alice:", interviewUrl);`}</pre>

      <div className="callout callout-info">
        The <code>interviewUrl</code> returned by <code>sessions.create</code> is always the link for{" "}
        <strong>signer 1</strong> (<code>order: 1</code>). Subsequent signers receive their unique
        links via email automatically once the previous signer finishes.
      </div>

      <h2>Checking signer status</h2>
      <p>
        Call <code>sessions.signers(token)</code> to get the current status of every signer in the
        chain. Use this to display progress in your dashboard, trigger custom notifications, or gate
        downstream steps like PDF generation.
      </p>
      <pre>{`const { token, signers, allSigned } = await client.sessions.signers("df_a1b2c3d4...");

console.log("All parties signed:", allSigned);

for (const signer of signers) {
  console.log(\`[\${signer.order}] \${signer.email} — \${signer.status}\`);

  if (signer.status === "signed") {
    console.log(\`    Completed: \${signer.signedAt}\`);
  }
  if (signer.status === "declined") {
    console.log(\`    Declined: \${signer.declinedReason ?? "no reason given"}\`);
  }
}`}</pre>

      <h2>Signer statuses</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Status</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>pending</code></td>
              <td>Waiting for a previous signer to complete. This signer has not been notified yet.</td>
            </tr>
            <tr>
              <td><code>awaiting</code></td>
              <td>This signer has been notified by email and their link is active.</td>
            </tr>
            <tr>
              <td><code>signed</code></td>
              <td>Signer has completed their step.</td>
            </tr>
            <tr>
              <td><code>declined</code></td>
              <td>Signer declined to sign. The session is halted and no further signers are notified.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Response reference</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><code>token</code></td><td>string</td><td>The parent session token.</td></tr>
            <tr><td><code>signers</code></td><td>SessionSigner[]</td><td>All signers, sorted by <code>order</code>.</td></tr>
            <tr>
              <td><code>allSigned</code></td><td>boolean</td>
              <td><code>true</code> when every signer's status is <code>"signed"</code>.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>SessionSigner fields</h3>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><code>id</code></td><td>number</td><td>Internal signer record ID.</td></tr>
            <tr><td><code>order</code></td><td>number</td><td>1-based signing position in the chain.</td></tr>
            <tr><td><code>email</code></td><td>string</td><td>Signer's email address.</td></tr>
            <tr><td><code>name</code></td><td>string | null</td><td>Signer's display name.</td></tr>
            <tr>
              <td><code>status</code></td><td>string</td>
              <td><code>"pending"</code> | <code>"awaiting"</code> | <code>"signed"</code> | <code>"declined"</code></td>
            </tr>
            <tr>
              <td><code>signerToken</code></td><td>string | null</td>
              <td>
                Unique token for this signer's interview link (<code>sgn_…</code>). Available once
                the signer has been notified (<code>"awaiting"</code> or beyond).
              </td>
            </tr>
            <tr>
              <td><code>signedAt</code></td><td>string | null</td>
              <td>ISO 8601 timestamp when the signer completed their step. <code>null</code> until signed.</td>
            </tr>
            <tr>
              <td><code>declinedReason</code></td><td>string | null</td>
              <td>Reason text provided by the signer when declining, if any.</td>
            </tr>
            <tr>
              <td><code>createdAt</code></td><td>string</td>
              <td>ISO 8601 timestamp when this signer record was created.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Polling for completion</h2>
      <pre>{`async function waitForAllSigners(token: string): Promise<void> {
  for (;;) {
    const { allSigned, signers } = await client.sessions.signers(token);

    if (allSigned) {
      console.log("All parties signed — triggering PDF generation.");
      await client.sessions.generate(token);
      return;
    }

    const declined = signers.find(s => s.status === "declined");
    if (declined) {
      throw new Error(
        \`Signer \${declined.email} declined: \${declined.declinedReason ?? "no reason given"}\`
      );
    }

    await new Promise(r => setTimeout(r, 10_000)); // poll every 10 s
  }
}`}</pre>

      <div className="callout callout-tip">
        <strong>Prefer webhooks over polling.</strong> Subscribe to the <code>signer.completed</code>{" "}
        and <code>session.submitted</code> events on your package's webhook to react in real time
        without a polling loop. See{" "}
        <a href="/webhooks/payload">Webhook Event Payload →</a>
      </div>

      <h2>TypeScript types</h2>
      <pre>{`import type { SessionSignersResult, SessionSigner } from "@docuplete/sdk";`}</pre>
    </div>
  );
}
