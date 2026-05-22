export default function Changelog() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">What's New</div>
        <h1>Changelog</h1>
        <p className="text-lg text-white/55 mt-2">Recent releases, improvements, and fixes — newest first.</p>
      </div>

      <div className="space-y-10">

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2026</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Library UX improvements — Tags panel, deep-link, session table polish</h2>
          <ul>
            <li><strong>Compliance Tags panel (Library → Tags)</strong> — A new sixth Library sub-tab lets you create, edit, and delete custom compliance tags without leaving the Library. Each row shows a live color swatch, the tag's name, description, and Required/Optional badge. Built-in tags are labeled and protected from deletion. The inline "New Tag" form has a preset color palette, a custom color picker, an optional description field, and a Required toggle.</li>
            <li><strong>Compliance → Field deep-link</strong> — In the Compliance audit, every field in the Missing list is now a clickable underlined button. Clicking it switches to the Fields sub-tab and automatically opens that field's edit drawer, scrolled into view, so you can immediately add the required compliance tag.</li>
            <li><strong>Sessions table — badge clarity</strong> — Draft and In Progress status badges now use a low-contrast muted gray style to visually separate incomplete sessions from terminal states (Completed, Signed, Submitted). Helps admins triage active sessions faster at a glance.</li>
            <li><strong>Sessions table — signer email subtitle</strong> — When a session's signer name and email address are both available, the email is shown as a small muted subtitle line beneath the name with <code>max-w-[200px] truncate</code> and a hover tooltip — preventing long addresses from stretching the row.</li>
            <li><strong>Sessions table — stronger zebra stripes</strong> — Alternating rows now use <code>bg-[#F5F2EC]</code> (warm tan) instead of the near-white previous shade, making large session lists easier to scan.</li>
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2026</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Shared Field Library — redesigned tab UIs</h2>
          <p>All five Library sub-tabs have been redesigned for faster scanning and editing at scale.</p>
          <ul>
            <li><strong>Fields tab</strong> — Field rows are now collapsible. Click any row to expand an inline edit drawer with all settings, a History tab, and an Analytics tab. Prefill Source and Sort Order sit side-by-side in the drawer body. Save and Delete moved into an isolated shaded footer bar inside the drawer, eliminating accidental clicks. History entries now show labeled diffs (<em>Label: "old" → "new"</em>) instead of raw JSON objects.</li>
            <li><strong>Field Groups tab</strong> — Cards are equal-height via <code>items-stretch</code>. Each card shows two badge types: a blue pill for field count and a green pill listing packages that use the group (gray "No packages" when unused). The Add button in the header is now a bordered icon button matching the platform's tool style.</li>
            <li><strong>Types tab</strong> — Fully rewritten as a compact single-row ledger. Label and sort number edit in place and auto-save on blur. Group assignments appear as inline tag strips and toggle immediately on click. The Active checkbox saves on change. A ⋮ popover at the far right shows the type's scope slug and a Delete option — removing the inline Delete/Save clutter.</li>
            <li><strong>Groups tab</strong> — Contact info now uses a three-column horizontal grid: <strong>PHONE NUMBER · EMAIL ADDRESS · STATUS</strong>, each with a compact uppercase metadata label above the input. The Active checkbox occupies the third column, aligning with phone and email on a shared baseline. Delete and Save moved into a dedicated shaded footer bar at the bottom of each card.</li>
            <li><strong>Compliance tab</strong> — Compliant packages show a soft green card with a <strong>✓ Compliant</strong> badge. Packages with missing required fields switch to an amber background with a <strong>⚠️ Non-Compliant · N missing</strong> badge for immediate visual triage. The Present and Missing field lists are constrained to a 600 px side-by-side grid inside each card. The Refresh button now shows a spinning arrow icon while loading; Export CSV has a download icon.</li>
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2026</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Interview Order — field metadata badges</h2>
          <p>The <strong>Interview Order</strong> list in the package builder now shows a badge row beneath each field name, making the key properties of every field visible at a glance without opening the editor. The following badges appear when applicable:</p>
          <ul>
            <li><strong>Field type</strong> — always shown (text, radio, checkbox, dropdown, date, initials).</li>
            <li><strong>Required</strong> (gold) — field must be answered before submission.</li>
            <li><strong>Read-only</strong> (blue) — field is prefilled and cannot be edited by the user.</li>
            <li><strong>↳ If [Field Name]</strong> (purple) — field is conditional on another field's answer; the source field name is shown inline. A second condition (and / or) is shown as an additional badge.</li>
            <li><strong>🔒 Sensitive</strong> (red) — field value is masked in the sessions dashboard.</li>
            <li><strong>Auto-fill</strong> (teal) — field value is automatically copied from another field when a trigger condition is met.</li>
            <li><strong>Σ [Group]</strong> (orange) — field participates in a sum group allocation check.</li>
            <li><strong>Validation type</strong> (gray) — shown when a non-default validation rule (e.g., ssn, phone, email) is active.</li>
          </ul>
          <p>Fields set to <strong>Optional</strong> (the default mode) show no mode badge — only non-default modes are called out to keep the list scannable.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2026</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Non-disruptive save notifications</h2>
          <p>Save confirmations throughout the package builder (<em>Saved.</em>, <em>Saved package.</em>, etc.) now appear as <strong>toast notifications</strong> in the bottom-right corner of the screen rather than as an inline status bar in the page layout. The previous inline message caused the page content to shift vertically each time it appeared and disappeared — particularly disruptive when reordering fields by drag-and-drop, as the layout shift would knock fields out of position mid-drag. Toast notifications are fixed-position overlays that sit outside the document flow and have no effect on page layout or scroll position. They auto-dismiss after 2.5 seconds.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2026</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/15 text-green-400">Fix</span>
          </div>
          <h2 className="mt-0">OTP attempt limit corrected to 5</h2>
          <p>The e-sign identity verification flow allows up to <strong>5 OTP attempts</strong> before the code expires and a new one must be requested. Previous documentation incorrectly stated 3. The 5-attempt limit has been the live behavior since OTP verification launched; the docs now reflect this accurately.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2026</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Answer input sanitization — null bytes and password-mask glyphs</h2>
          <p>Docuplete now strips two classes of problematic characters from interview answer values before saving: <strong>null bytes</strong> (U+0000) and <strong>password-mask glyphs</strong> (U+25CF ●). Null bytes can corrupt PDF generation in some PDF libraries; the password-mask glyph (●●●●) is occasionally pasted into text fields by autofill managers. Both are silently removed so the rest of the answer text is preserved without error.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2026</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">is_answered and is_not_answered condition operators</h2>
          <p>Two additional condition operators are now documented for field show/hide logic: <code>is_answered</code> (show this field when the trigger has any non-empty value) and <code>is_not_answered</code> (show this field only while the trigger is still blank). These complement the existing <code>equals</code> and <code>not_equals</code> operators. All four are enforced both in the interview UI and at PDF generation time.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2026</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Signer Date auto-injection at generation time</h2>
          <p>The <strong>Signer Date</strong> system field is now auto-injected by the server at the moment the packet PDF is generated if the session does not already carry an explicit signing date. This means packages with a Signer Date placement never produce a blank date field — even for sessions completed through the API without an explicit <code>signedAt</code> value.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2026</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Signature text fallback for non-e-sign sessions</h2>
          <p>When a package has a Signature placement but the session was not completed with a captured signature image, Docuplete now renders the signer's name as plain text in the signature box rather than leaving it blank. This applies to sessions where e-sign verification was not required or was bypassed via the API. The resulting PDF always has something in the signature position.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2026</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Cross-tenant isolation — 404 instead of 403 for foreign resources</h2>
          <p>API requests that target a resource belonging to a different organization (a session token, signer record, or package owned by another account) now consistently return <code>404 Not Found</code> rather than <code>403 Forbidden</code>. This removes resource-existence disclosure: a caller with a valid API key cannot probe whether a given token or ID exists in another tenant's data by observing whether they receive a 403 or 404. The behavior is documented in the <a href="/enterprise/security">Security &amp; Compliance</a> page under Tenant Isolation.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-400">New</span>
          </div>
          <h2 className="mt-0">Safe field deletion — dependency guard</h2>
          <p>Deleting a field that is referenced by another field's <strong>Show if…</strong> condition or <strong>auto-fill trigger</strong> now shows a dependency guard modal before proceeding. You can choose to <strong>Replace &amp; Remove</strong> (pick a substitute field and have all references automatically rewired) or <strong>Remove &amp; Flag for Repair</strong> (delete immediately and mark dependent fields with a ⚠ Repair badge for later review). Fields with outstanding repair badges are highlighted in the field list so nothing gets silently lost.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">"Hide unless" condition value is now a dropdown for choice fields</h2>
          <p>When configuring a <strong>Hide this field unless</strong> condition, the <strong>Value</strong> input is now a dropdown of the trigger field's defined options when that field is a radio, dropdown, or checkbox type. This applies to both the primary condition and the optional second condition. Previously a free-form text box, this prevents conditions from silently never firing due to a typo or case difference in the entered value.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Sum Group field suggests existing groups as you type</h2>
          <p>When assigning a Sum Group to a percent or number field, the Sum Group input now shows autocomplete suggestions populated from all other sum groups already defined in the same package. This makes it easy to join an existing group — like <code>primary_beneficiaries</code> — without retyping the label. Free-form entry still works for creating new groups.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Auto-fill trigger value is now a dropdown for choice fields</h2>
          <p>When setting up an auto-fill rule, the <strong>Equals</strong> input for the trigger condition is now a dropdown of the trigger field's actual defined options when that field is a radio button, dropdown, or checkbox type. Previously a plain text box, this change prevents silent trigger failures caused by value mismatches — for example, typing "Yes" when the option label is "Yes, I agree".</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Multi-document scroll view in the Visual Mapper</h2>
          <p>The Visual Mapper now supports a continuous scroll view when a package contains more than one PDF. Instead of switching between documents via a dropdown, all pages from all documents render in a single vertically scrollable canvas. Switch between <strong>Scroll</strong> and <strong>Single</strong> mode using the toggle in the toolbar. Single mode retains the previous paginated experience for focused editing.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">May 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/15 text-green-400">Fix</span>
          </div>
          <h2 className="mt-0">Field Library edits now save correctly for shared (system) fields</h2>
          <p>Editing a field in the Field Library was returning a <code>404</code> error for fields that belong to the organization's shared field set (fields not owned by a specific account). This has been fixed. All library fields — both account-specific and shared — now save and restore versions correctly.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">April 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Contextual placeholder text in the Options field</h2>
          <p>When editing a Radio, Checkbox, or Dropdown field in the Field Library or package field editor, the <strong>Options</strong> textarea now shows a concrete example that matches the field type. Radio fields show a Yes / No / Unsure example, Dropdown fields show account type options, and Checkbox fields show agreement text examples.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">April 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#5B8DEF]/15 text-[#5B8DEF]">Improvement</span>
          </div>
          <h2 className="mt-0">Sidebar scrolling in the Visual Mapper</h2>
          <p>The left panel (field list) and right panel (field inspector) in the Visual Mapper now scroll independently at full viewport height. Long field lists and deeply configured fields no longer require scrolling the entire page.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">March 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-400">New</span>
          </div>
          <h2 className="mt-0">Batch CSV import</h2>
          <p>Generate hundreds of sessions at once by uploading a CSV file. Download the template for your package, fill in one row per client, and upload. Docuplete validates each row, reports errors inline, and creates sessions for all valid rows. Useful for annual renewals, large client cohorts, or migrating from another document system.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">February 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-400">New</span>
          </div>
          <h2 className="mt-0">Webhook delivery logs and retry visibility</h2>
          <p>The Webhooks section now includes a full delivery log for every event — HTTP status code, response body (truncated), delivery timestamp, and retry count. Failed deliveries show the exact error returned by your endpoint and when the next retry is scheduled.</p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-white/40">January 2025</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-400">New</span>
          </div>
          <h2 className="mt-0">E-sign identity verification</h2>
          <p>Signature fields can now require identity verification before the client can sign. Supported methods: email OTP, SMS OTP, and knowledge-based authentication (KBA). The verification method is set per-package in the package configuration. The session audit log records which method was used and when it was completed.</p>
        </div>

      </div>
    </div>
  );
}
