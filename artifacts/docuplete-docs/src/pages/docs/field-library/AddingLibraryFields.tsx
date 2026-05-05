import { DocScreenshot } from "@/components/DocScreenshot";

export default function AddingLibraryFields() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Field Library</div>
        <h1>Adding Library Fields</h1>
        <p className="text-lg text-white/55 mt-2">Import pre-configured fields from the library into any package in seconds.</p>
      </div>

      <h2>Importing a library field into a package</h2>
      <ol>
        <li>Open the package and go to the <strong>Fields</strong> tab.</li>
        <li>Click <strong>Add from Library</strong>.</li>
        <li>Browse or search the library. Fields are grouped by category (Personal, Financial, Address, etc.).</li>
        <li>Select one or more fields to add (use checkboxes for multi-select).</li>
        <li>Click <strong>Import Selected</strong>. The fields appear at the bottom of the package's field list.</li>
        <li>Drag them to the correct position in the interview order.</li>
      </ol>

      <DocScreenshot
        src="/screenshots/add-library-fields.svg"
        alt="The Add from Library modal showing a search bar, category tabs, a scrollable list of library fields with checkboxes, and an Import Selected button showing 3 fields selected"
        caption="The Add from Library picker — browse by category or search by name, check the fields you want, and import them all at once."
      />

      <div className="callout callout-info">
        <strong>Linked, not copied:</strong> When you import a library field, the package maintains a live link to it. If the library field is updated (label, validation, options), the change is reflected in the package for new sessions.
      </div>

      <h2>Overriding a library field within a package</h2>
      <p>Sometimes you need a slightly different version of a library field for one specific package — for example, making an optional field required, or adding a package-specific placeholder. You can override individual settings at the package level without modifying the library field:</p>
      <ol>
        <li>Click the library field in the package Fields tab.</li>
        <li>Toggle <strong>Override library settings</strong>.</li>
        <li>Change only the settings you need to differ.</li>
      </ol>
      <p>Overridden settings are tracked with a visual indicator. If the library field is later updated, overridden settings are not changed — your local overrides take precedence.</p>

      <h2>Detaching a library field</h2>
      <p>To fully decouple a field from the library (making it a standalone package field), click <strong>⋯ → Detach from Library</strong>. The field becomes an independent copy. Future library updates no longer affect it.</p>

      <div className="callout callout-warning">
        <strong>Detaching is permanent:</strong> You cannot re-link a detached field to the library. If you need to re-establish the link, delete the detached field and import from the library again.
      </div>
    </div>
  );
}
