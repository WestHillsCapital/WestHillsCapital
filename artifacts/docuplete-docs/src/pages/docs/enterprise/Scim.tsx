export default function Scim() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Enterprise</div>
        <h1>SCIM 2.0 Provisioning</h1>
        <p className="text-lg text-white/55 mt-2">
          Automate user provisioning and deprovisioning in Docuplete from your Identity Provider
          using the SCIM 2.0 standard — no manual seat management required.
        </p>
      </div>

      <div className="callout callout-enterprise">
        <strong>Enterprise feature.</strong> SCIM provisioning is available on Enterprise plans only.{" "}
        <a href="/getting-started/plans">Learn about plans →</a>
      </div>

      <h2>What SCIM does</h2>
      <p>
        SCIM (System for Cross-domain Identity Management) lets your Identity Provider (IdP) push
        user lifecycle events directly into Docuplete. When someone joins your company, they are
        automatically provisioned. When they leave, their account is deactivated immediately — with
        no manual steps required from your Docuplete admin.
      </p>
      <ul>
        <li><strong>Provision</strong> — New users appear in Docuplete automatically when assigned in your IdP.</li>
        <li><strong>Update</strong> — Display name changes sync in real time.</li>
        <li><strong>Deprovision</strong> — Disabling or removing a user in your IdP immediately revokes their Docuplete access.</li>
      </ul>

      <h2>Supported identity providers</h2>
      <p>Any IdP that supports SCIM 2.0 works out of the box, including:</p>
      <ul>
        <li>Okta</li>
        <li>Microsoft Azure AD / Entra ID</li>
        <li>OneLogin</li>
        <li>JumpCloud</li>
        <li>Google Workspace (via a third-party SCIM bridge)</li>
      </ul>

      <h2>Setup</h2>
      <ol>
        <li>
          In Docuplete, go to <strong>Settings → Security → SCIM</strong> and click{" "}
          <strong>Generate SCIM Token</strong>. Copy the token — it is shown only once.
        </li>
        <li>
          In your IdP, create a new SCIM application pointing to Docuplete (use a generic
          "SCIM 2.0" app template if a native connector is unavailable).
        </li>
        <li>
          Configure the IdP with:
          <ul>
            <li>
              <strong>SCIM Base URL:</strong>{" "}
              <code>https://api.docuplete.com/api/scim/v2</code>
            </li>
            <li>
              <strong>Authentication type:</strong> Bearer token — paste the SCIM token from step 1.
            </li>
          </ul>
        </li>
        <li>
          Assign users (or groups) to the Docuplete application in your IdP and run an initial sync.
          Assigned users are provisioned automatically.
        </li>
      </ol>

      <div className="callout callout-tip">
        <strong>Okta tip:</strong> Search the Okta Integration Network for "Docuplete". If a native
        integration is available, it pre-fills the SCIM Base URL and authentication settings for
        you — only the token needs to be pasted.
      </div>

      <h2>SCIM endpoints</h2>
      <p>
        All SCIM requests are made to{" "}
        <code>https://api.docuplete.com/api/scim/v2</code> and must include your SCIM token:
      </p>
      <pre>{`Authorization: Bearer scim_live_...`}</pre>

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Method</th><th>Path</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>GET</code></td><td><code>/ServiceProviderConfig</code></td>
              <td>Returns Docuplete's SCIM capability metadata (used by IdPs during setup).</td>
            </tr>
            <tr>
              <td><code>GET</code></td><td><code>/Schemas</code></td>
              <td>Returns the supported User schema definition.</td>
            </tr>
            <tr>
              <td><code>GET</code></td><td><code>/Users</code></td>
              <td>Lists all users. Supports filtering: <code>?filter=userName eq "jane@example.com"</code>.</td>
            </tr>
            <tr>
              <td><code>POST</code></td><td><code>/Users</code></td>
              <td>Provisions a new user.</td>
            </tr>
            <tr>
              <td><code>GET</code></td><td><code>/Users/:id</code></td>
              <td>Returns a single user by their SCIM ID.</td>
            </tr>
            <tr>
              <td><code>PATCH</code></td><td><code>/Users/:id</code></td>
              <td>Updates a user's display name or <code>active</code> status.</td>
            </tr>
            <tr>
              <td><code>DELETE</code></td><td><code>/Users/:id</code></td>
              <td>Deprovisions (soft-deletes) a user.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Provision a user — POST /Users</h3>
      <p>
        Your IdP sends this request automatically when a user is assigned to the Docuplete app. The
        body follows the SCIM User schema:
      </p>
      <pre>{`{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "userName": "jane@example.com",
  "displayName": "Jane Smith",
  "active": true
}`}</pre>
      <p>
        Docuplete responds with <code>201 Created</code> and the full SCIM User object, including the
        internal <code>id</code> your IdP will use for subsequent PATCH and DELETE calls.
      </p>

      <h3>Deprovision a user — PATCH /Users/:id</h3>
      <p>
        Most IdPs deprovision by sending a PATCH that sets <code>active</code> to <code>false</code>:
      </p>
      <pre>{`{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
  "Operations": [
    { "op": "replace", "path": "active", "value": false }
  ]
}`}</pre>
      <p>
        The user's status is set to <code>deactivated</code> and they lose access to Docuplete
        immediately.
      </p>

      <h2>Seat limits</h2>
      <p>
        SCIM provisioning respects your plan's seat limit. If you attempt to provision a user when all
        seats are occupied, the API returns <code>403 Forbidden</code> with error code{" "}
        <code>seat_limit_exceeded</code>. Either upgrade your plan or deprovision an existing user to
        free a seat before retrying.
      </p>

      <h2>Rotating the SCIM token</h2>
      <p>
        Go to <strong>Settings → Security → SCIM</strong> and click <strong>Rotate Token</strong>.
        The old token is immediately invalidated and a new one is issued.
      </p>
      <div className="callout callout-warning">
        <strong>Update your IdP before rotating.</strong> Any provisioning requests in flight at the
        moment of rotation will fail with <code>401 Unauthorized</code>. Schedule rotations during
        low-activity windows and update your IdP's bearer token within minutes of generating the new
        one.
      </div>

      <h2>Troubleshooting</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Symptom</th><th>Likely cause</th><th>Fix</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>IdP reports <code>401</code> on all SCIM requests</td>
              <td>Wrong or expired SCIM token</td>
              <td>Regenerate the token in Settings and update your IdP configuration.</td>
            </tr>
            <tr>
              <td>User provisioned in IdP but not appearing in Docuplete</td>
              <td>SCIM Base URL misconfigured</td>
              <td>Verify the URL is exactly <code>https://api.docuplete.com/api/scim/v2</code>.</td>
            </tr>
            <tr>
              <td>Provisioning returns <code>403 seat_limit_exceeded</code></td>
              <td>All seats are occupied</td>
              <td>Deprovision an inactive user or upgrade your plan.</td>
            </tr>
            <tr>
              <td>User deprovisioned in IdP but still active in Docuplete</td>
              <td>IdP is sending DELETE instead of PATCH with <code>active: false</code></td>
              <td>Both DELETE and PATCH <code>active: false</code> are supported — check your IdP's deprovisioning method setting.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
