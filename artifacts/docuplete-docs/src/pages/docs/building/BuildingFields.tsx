import { Link } from "wouter";
import { DocScreenshot } from "@/components/DocScreenshot";

export default function BuildingFields() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Building a Package</div>
        <h1>Adding & Editing Fields</h1>
        <p className="text-lg text-white/55 mt-2">Fields define the interview your client sees. Add, reorder, and configure them in the Fields tab.</p>
      </div>

      <h2>Adding a field</h2>
      <ol>
        <li>Open the package and click the <strong>Fields</strong> tab.</li>
        <li>Click <strong>Add Field</strong> at the bottom of the field list.</li>
        <li>Choose a field type (text, checkbox, date, etc.).</li>
        <li>Set the <strong>Label</strong> — this is what the client sees in the interview ("First Name", "Date of Birth", etc.).</li>
        <li>Set the <strong>Interview mode</strong>: required, optional, read-only, or hidden.</li>
        <li>Configure any type-specific options (placeholder text, dropdown choices, date constraints, etc.).</li>
        <li>Optionally, add <strong>conditional logic</strong> to show/hide this field based on other answers.</li>
        <li>Click <strong>Save</strong>.</li>
      </ol>

      <DocScreenshot
        src="/screenshots/field-editor.png"
        alt="The Fields tab showing a list of fields on the left and the field editor panel on the right with label, key, interview mode, and conditional logic settings"
        caption="The field editor — the left panel lists all fields in interview order; the right panel lets you configure every aspect of the selected field."
      />

      <h2>Reordering fields</h2>
      <p>Drag fields by the handle (⠿) on the left to reorder them. The order you set here is the order the client sees in the interview.</p>

      <h2>Field groups</h2>
      <p>Add a <strong>Group Header</strong> (from the Add Field menu) to insert a section label. All fields below the group header until the next header are visually grouped together in the interview. This helps break long interviews into clear sections.</p>

      <h2>Field key (internal name)</h2>
      <p>Each field has an auto-generated key (e.g., <code>first_name</code>, <code>date_of_birth</code>). This key is used in:</p>
      <ul>
        <li>Conditional logic rules</li>
        <li>Mapping formulas and calculated expressions</li>
        <li>Prefill values when creating a session via the dashboard or API</li>
        <li>Webhook payload field names</li>
        <li>CSV import column headers</li>
      </ul>
      <p>You can edit the key — it must be lowercase letters, numbers, and underscores, and must be unique within the package. Changing a key after the package is live will break any existing references to that key.</p>

      <h2>Duplicating a field</h2>
      <p>Click the <strong>⋯</strong> menu on any field and choose <strong>Duplicate</strong>. The duplicate appears below the original with the same type and settings, and a new auto-generated key.</p>

      <h2>Importing from the Field Library</h2>
      <p>If your organization has built a shared <Link href="/field-library/overview">Field Library</Link>, you can import pre-configured fields from it rather than creating them from scratch. Click <strong>Add from Library</strong> to browse and select library fields.</p>

      <div className="callout callout-tip">
        <strong>Tip:</strong> Common fields like Full Name, Date of Birth, SSN, and Address are typically in the Field Library. Import them for consistent labels, validation, and formatting across all your packages.
      </div>

      <h2>Deleting a field</h2>
      <p>Click the <strong>⋯</strong> menu on any field and choose <strong>Delete</strong>. If no other fields reference this field, it is removed immediately.</p>
      <p>If the field is used in another field's <strong>Show if…</strong> condition or <strong>auto-fill trigger</strong>, Docuplete shows a dependency guard before deleting. You have two options:</p>
      <ul>
        <li><strong>Replace &amp; Remove</strong> — Choose a replacement field from the list. All conditions and auto-fill rules that pointed to the deleted field are automatically rewired to the replacement. No references are left broken.</li>
        <li><strong>Remove &amp; Flag for Repair</strong> — Deletes the field immediately. Any field whose condition or auto-fill trigger referenced it is flagged with an amber <strong>⚠ Repair</strong> badge. You can fix those references at any time by opening the flagged field's editor.</li>
      </ul>
      <p>You can also click <strong>Cancel</strong> to abort the deletion and keep the field unchanged.</p>

      <h2>Repair badge — fixing broken references</h2>
      <p>A field shows an amber <strong>⚠ Repair</strong> badge when one of its rules (a "Show if…" condition or an auto-fill trigger) references a field that no longer exists. This can happen after a field is deleted with "Remove &amp; Flag for Repair".</p>
      <p>To resolve it:</p>
      <ol>
        <li>Click the field with the ⚠ badge to open its editor.</li>
        <li>Locate the condition or auto-fill rule that shows a missing field indicator.</li>
        <li>Update the rule to reference a valid field (or delete the rule if it is no longer needed).</li>
        <li>Save. Once all broken references are resolved, the badge disappears automatically.</li>
      </ol>

      <div className="callout callout-warning">
        <strong>Note:</strong> Fields with unresolved ⚠ repair badges still work in interviews — broken conditions are simply skipped. However, you should resolve them before making a package Active to ensure logic behaves as intended.
      </div>

      <h2>Auto-fill trigger value</h2>
      <p>When configuring an auto-fill rule, the <strong>Equals</strong> input for the trigger value behaves differently depending on the trigger field's type:</p>
      <ul>
        <li>For <strong>radio</strong>, <strong>dropdown</strong>, and <strong>checkbox</strong> fields, the value input is a dropdown showing the field's actual defined options. Select from the list — this prevents typos and case mismatches that would cause the trigger to never fire.</li>
        <li>For <strong>text</strong> and <strong>date</strong> fields, the value input remains free-form text.</li>
      </ul>
    </div>
  );
}
