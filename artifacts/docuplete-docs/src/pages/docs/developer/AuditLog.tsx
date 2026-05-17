export default function AuditLog() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Developer API</div>
        <h1>Session Audit Log</h1>
        <p className="text-lg text-white/55 mt-2">
          Retrieve the immutable, chronological trail of every action taken on a session — from
          creation through signing, submission, and PDF generation.
        </p>
      </div>

      <div className="callout callout-info">
        <strong>Developer plan and above.</strong> Audit log access is available on the Developer,
        Scale, and Enterprise plans.{" "}
        <a href="/getting-started/plans">Compare plans →</a>
      </div>

      <h2>Fetching the audit log</h2>
      <pre>{`import { Docuplete } from "@docuplete/sdk";

const client = new Docuplete({ apiKey: process.env.DOCUPLETE_API_KEY! });

const log = await client.sessions.auditLog("df_a1b2c3d4...");

console.log(\`\${log.entries.length} events for session \${log.token}\`);

for (const entry of log.entries) {
  const actor = entry.actorEmail ?? entry.actorType;
  console.log(\`[\${entry.createdAt}] \${entry.event} — \${actor}\`);
}`}</pre>

      <h2>Optional parameters</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>limit</code></td><td>number</td><td>100</td>
              <td>Maximum number of entries to return (1–500). Entries are returned oldest-first.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Response</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>token</code></td><td>string</td>
              <td>The session token this audit log belongs to.</td>
            </tr>
            <tr>
              <td><code>entries</code></td><td>AuditLogEntry[]</td>
              <td>Chronological list of events, oldest first.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>AuditLogEntry fields</h3>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>id</code></td><td>number</td>
              <td>Unique entry ID. Monotonically increasing within a session.</td>
            </tr>
            <tr>
              <td><code>event</code></td><td>string</td>
              <td>The event type — see full list below.</td>
            </tr>
            <tr>
              <td><code>actorType</code></td><td>string</td>
              <td><code>"system"</code>, <code>"api"</code>, <code>"user"</code>, or <code>"signer"</code>.</td>
            </tr>
            <tr>
              <td><code>actorEmail</code></td><td>string | null</td>
              <td>Email of the acting user or signer, when applicable.</td>
            </tr>
            <tr>
              <td><code>actorIp</code></td><td>string | null</td>
              <td>IP address of the actor, when available.</td>
            </tr>
            <tr>
              <td><code>metadata</code></td><td>object | null</td>
              <td>
                Event-specific details, e.g.{" "}
                <code>{"{ packageId: 42 }"}</code> on creation or{" "}
                <code>{'{ reason: "wrong client" }'}</code> on void.
              </td>
            </tr>
            <tr>
              <td><code>createdAt</code></td><td>string</td>
              <td>ISO 8601 UTC timestamp.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Event types</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Event</th><th>Actor</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>session.created</code></td><td>system / api</td>
              <td>Session was created via the dashboard or API.</td>
            </tr>
            <tr>
              <td><code>session.link_sent</code></td><td>system / api</td>
              <td>Interview link was emailed to the signer.</td>
            </tr>
            <tr>
              <td><code>session.started</code></td><td>signer</td>
              <td>Client opened the interview link for the first time.</td>
            </tr>
            <tr>
              <td><code>session.submitted</code></td><td>signer</td>
              <td>Client completed and submitted the interview.</td>
            </tr>
            <tr>
              <td><code>session.voided</code></td><td>user / api</td>
              <td>Session was voided, with an optional reason recorded in metadata.</td>
            </tr>
            <tr>
              <td><code>signer.completed</code></td><td>signer</td>
              <td>One party in a multi-party flow completed their signing step.</td>
            </tr>
            <tr>
              <td><code>pdf.generated</code></td><td>system</td>
              <td>PDF was successfully generated and is ready to download.</td>
            </tr>
            <tr>
              <td><code>pdf.generation_failed</code></td><td>system</td>
              <td>PDF generation encountered an error.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Use cases</h2>
      <ul>
        <li>
          <strong>Compliance auditing</strong> — Demonstrate exactly when a document was opened,
          submitted, and signed, and by whom, for regulatory or legal review.
        </li>
        <li>
          <strong>Support investigations</strong> — Reconstruct what happened in a disputed or stuck
          session without guessing.
        </li>
        <li>
          <strong>SLA monitoring</strong> — Measure time elapsed between <code>session.created</code>{" "}
          and <code>session.submitted</code> to track completion rates and turnaround times.
        </li>
        <li>
          <strong>Automation triggers</strong> — Poll the audit log to drive downstream actions as
          an alternative to webhooks in environments where inbound webhook delivery is restricted.
        </li>
      </ul>

      <h2>Complete example</h2>
      <pre>{`import { Docuplete } from "@docuplete/sdk";
import type { AuditLogResult, AuditLogEntry } from "@docuplete/sdk";

const client = new Docuplete({ apiKey: process.env.DOCUPLETE_API_KEY! });

async function printAuditTrail(token: string): Promise<void> {
  const log: AuditLogResult = await client.sessions.auditLog(token, { limit: 500 });

  console.log(\`Audit trail for \${log.token} (\${log.entries.length} events)\\n\`);

  for (const entry of log.entries) {
    const ts    = new Date(entry.createdAt).toLocaleString();
    const actor = entry.actorEmail ?? entry.actorType;
    console.log(\`  \${ts}  \${entry.event.padEnd(28)}  \${actor}\`);

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console.log(\`              metadata: \${JSON.stringify(entry.metadata)}\`);
    }
  }
}

await printAuditTrail("df_a1b2c3d4...");`}</pre>

      <h2>TypeScript types</h2>
      <pre>{`import type { AuditLogResult, AuditLogEntry } from "@docuplete/sdk";`}</pre>
    </div>
  );
}
