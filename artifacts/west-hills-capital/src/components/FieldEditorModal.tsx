import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type {
  FieldItem,
  FieldInterviewMode,
  FieldCondition,
} from "@/lib/docuplete-types";

export type FieldEditorDraft = {
  name: string;
  color: string;
  type: FieldItem["type"];
  options: string[];
  interviewMode: FieldInterviewMode;
  hasDefault: boolean;
  defaultValue: string;
  validationType: FieldItem["validationType"];
  validationPattern: string;
  validationMessage: string;
  packageOnly: boolean;
  condition: FieldCondition | null;
  condition2: FieldCondition | null;
};

interface FieldEditorModalProps {
  modal: { mode: "add" | "edit"; fieldId: string | null } | null;
  draft: FieldEditorDraft;
  setDraft: React.Dispatch<React.SetStateAction<FieldEditorDraft>>;
  onClose: () => void;
  pos: { x: number; y: number };
  isDragging: boolean;
  panelRef: React.RefObject<HTMLDivElement | null>;
  onDragStart: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  saving: boolean;
  onSave: () => void;
  onRemove: (fieldId: string) => void;
  packageFields: FieldItem[];
  colorPalette: string[];
}

export function FieldEditorModal({
  modal,
  draft,
  setDraft,
  onClose,
  pos,
  isDragging,
  panelRef,
  onDragStart,
  onTouchStart,
  saving,
  onSave,
  onRemove,
  packageFields,
  colorPalette,
}: FieldEditorModalProps) {
  if (!modal) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      onClick={onClose}
      style={{ cursor: isDragging ? "grabbing" : "default" }}
    >
      <div
        ref={panelRef}
        className="absolute bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ left: "50%", top: "50%", transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-[#DDD5C4] select-none"
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
          onMouseDown={onDragStart}
          onTouchStart={onTouchStart}
        >
          <h2 className="text-sm font-semibold">{modal.mode === "add" ? "New Field" : "Edit Field"}</h2>
          <button type="button" onClick={onClose} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} className="text-[#8A9BB8] hover:text-[#0F1C3F]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Field Name */}
          <div>
            <label className="block text-xs font-medium text-[#6B7A99] mb-1">Field Name</label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter" && draft.name.trim() && !saving) onSave(); }}
              placeholder="e.g. Borrower Full Name"
            />
          </div>

          {/* Field Color */}
          <div>
            <label className="block text-xs font-medium text-[#6B7A99] mb-1.5">Field Color</label>
            <div className="grid grid-cols-5 gap-1 mb-2">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  onClick={() => setDraft((d) => ({ ...d, color }))}
                  className="w-full h-5 rounded-sm"
                  style={{
                    backgroundColor: color,
                    outline: draft.color.toUpperCase() === color.toUpperCase() ? `2px solid ${color}` : "none",
                    outlineOffset: "2px",
                    boxShadow: draft.color.toUpperCase() === color.toUpperCase() ? "0 0 0 1px white inset" : "none",
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft.color}
                onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                className="h-7 w-9 rounded cursor-pointer border border-[#D4C9B5] p-0.5 flex-shrink-0"
                title="Custom color"
              />
              <span className="text-xs text-[#8A9BB8] font-mono">{draft.color.toUpperCase()}</span>
              <span className="text-[10px] text-[#B0BAD0] ml-auto">custom</span>
            </div>
          </div>

          {/* Field Type */}
          <div>
            <label className="block text-xs font-medium text-[#6B7A99] mb-1">Field Type</label>
            <div className="flex flex-wrap gap-1.5">
              {([
                { value: "text",     label: "Text box",  tip: "A freeform typed response — any text the user types" },
                { value: "radio",    label: "Radio",     tip: "One selection from a group — only one option can be chosen" },
                { value: "checkbox", label: "Checkbox",  tip: "A checked or unchecked box — supports multiple selections when options are defined" },
                { value: "dropdown", label: "Dropdown",  tip: "A choice from a predefined list — single selection from a dropdown menu" },
              ] as const).map(({ value, label, tip }) => (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, type: value }))}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${draft.type === value ? "bg-[#0F1C3F] text-white border-[#0F1C3F]" : "bg-white text-[#6B7A99] border-[#D4C9B5] hover:border-[#0F1C3F] hover:text-[#0F1C3F]"}`}
                    >
                      {label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{tip}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Options (for radio/checkbox/dropdown) */}
          {(draft.type === "radio" || draft.type === "checkbox" || draft.type === "dropdown") && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#6B7A99]">Options</label>
                <button type="button" onClick={() => setDraft((d) => ({ ...d, options: [...d.options, ""] }))} className="text-xs text-[#C49A38] hover:underline">+ Add option</button>
              </div>
              <div className="space-y-1.5">
                {draft.options.map((opt, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/optionIdx", String(i)); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = Number(e.dataTransfer.getData("text/optionIdx"));
                      if (from === i) return;
                      setDraft((d) => {
                        const opts = [...d.options];
                        const [item] = opts.splice(from, 1);
                        opts.splice(i, 0, item);
                        return { ...d, options: opts };
                      });
                    }}
                    className="flex items-center gap-2 bg-[#F8F6F0] rounded px-2 py-1.5 border border-[#EFE8D8]"
                  >
                    <span className="text-[#C4B99A] cursor-grab select-none text-sm">⠿</span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraft((d) => { const opts = [...d.options]; opts[i] = v; return { ...d, options: opts }; });
                      }}
                      className="flex-1 bg-transparent text-sm outline-none border-b border-[#D4C9B5] py-0.5 min-w-0"
                      placeholder={`Option ${i + 1}`}
                    />
                    <button type="button" onClick={() => setDraft((d) => ({ ...d, options: d.options.filter((_, idx) => idx !== i) }))} className="text-red-400 hover:text-red-600 text-base leading-none px-1">×</button>
                  </div>
                ))}
                {draft.options.length === 0 && <p className="text-xs text-[#8A9BB8] italic py-1">No options yet — click "+ Add option" above</p>}
              </div>
            </div>
          )}

          {/* Interview mode */}
          <div className="space-y-2 rounded border border-[#EFE8D8] bg-[#F8F6F0] px-3 py-3">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={draft.interviewMode === "omitted"} onChange={(e) => setDraft((d) => ({ ...d, interviewMode: e.target.checked ? "omitted" : "optional" }))} className="rounded" />
                <span className="text-sm">Omit from interview</span>
              </label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center text-[#8A9BB8] cursor-default"><Info className="w-3 h-3" /></span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
                  <p>This field will be completely hidden from the interview form. It will not be shown or editable by staff, and will use its default value (if any) when generating the document.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {draft.interviewMode !== "omitted" && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-xs text-[#6B7A99]">Interview behavior</label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center text-[#8A9BB8] cursor-default"><Info className="w-3 h-3" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs leading-snug space-y-1">
                      <p><strong>Optional</strong> — staff may fill this in during the interview but it is not required.</p>
                      <p><strong>Required</strong> — staff must answer this field before the document can be generated.</p>
                      <p><strong>Read-only</strong> — the value is shown during the interview but cannot be edited.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <select value={draft.interviewMode} onChange={(e) => setDraft((d) => ({ ...d, interviewMode: e.target.value as FieldInterviewMode }))} className="w-full border border-[#D4C9B5] rounded px-2 py-1.5 text-xs bg-white">
                  <option value="optional">Optional — staff fills in during interview</option>
                  <option value="required">Required — must answer before generating</option>
                  <option value="readonly">Read only — shown but not editable</option>
                </select>
              </div>
            )}
          </div>

          {/* Conditions */}
          {draft.interviewMode !== "omitted" && (
            <div className="space-y-2 rounded border border-[#EFE8D8] bg-[#F8F6F0] px-3 py-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.condition !== null}
                    onChange={(e) => setDraft((d) => ({
                      ...d,
                      condition: e.target.checked ? { fieldId: "", operator: "is_answered", value: "" } : null,
                    }))}
                    className="rounded"
                  />
                  <span className="text-sm">Hide this field unless</span>
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center text-[#8A9BB8] cursor-default"><Info className="w-3 h-3" /></span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
                    <p>When enabled, this field is hidden until another field meets the condition you set. Hidden fields are skipped in validation and PDF generation.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {draft.condition !== null && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-xs text-[#6B7A99] mb-1 block">Trigger field</label>
                    <select
                      value={draft.condition.fieldId}
                      onChange={(e) => setDraft((d) => ({ ...d, condition: d.condition ? { ...d.condition, fieldId: e.target.value } : null }))}
                      className="w-full border border-[#D4C9B5] rounded px-2 py-1.5 text-xs bg-white"
                    >
                      <option value="">— select a field —</option>
                      {packageFields
                        .filter((f) => f.id !== modal.fieldId && f.interviewMode !== "omitted" && f.interviewMode !== "readonly")
                        .map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#6B7A99] mb-1 block">Condition</label>
                    <select
                      value={draft.condition.operator}
                      onChange={(e) => setDraft((d) => ({ ...d, condition: d.condition ? { ...d.condition, operator: e.target.value as FieldCondition["operator"] } : null }))}
                      className="w-full border border-[#D4C9B5] rounded px-2 py-1.5 text-xs bg-white"
                    >
                      <option value="is_answered">has any answer</option>
                      <option value="is_not_answered">has no answer</option>
                      <option value="equals">equals</option>
                      <option value="not_equals">does not equal</option>
                    </select>
                  </div>
                  {(draft.condition.operator === "equals" || draft.condition.operator === "not_equals") && (
                    <div>
                      <label className="text-xs text-[#6B7A99] mb-1 block">Value</label>
                      <Input
                        placeholder="Enter expected value"
                        value={draft.condition.value}
                        onChange={(e) => setDraft((d) => ({ ...d, condition: d.condition ? { ...d.condition, value: e.target.value } : null }))}
                      />
                    </div>
                  )}
                </div>
              )}
              {draft.condition !== null && (
                <div className="pt-2 mt-1 border-t border-[#EFE8D8]">
                  {draft.condition2 === null ? (
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, condition2: { fieldId: "", operator: "is_answered", value: "" } }))}
                      className="text-xs text-[#6B7A99] hover:text-[#0F1C3F] underline underline-offset-2"
                    >
                      + Add second condition (AND)
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wide">AND</span>
                        <button type="button" onClick={() => setDraft((d) => ({ ...d, condition2: null }))} className="text-xs text-red-500 hover:underline">Remove</button>
                      </div>
                      <div>
                        <label className="text-xs text-[#6B7A99] mb-1 block">Trigger field</label>
                        <select
                          value={draft.condition2.fieldId}
                          onChange={(e) => setDraft((d) => ({ ...d, condition2: d.condition2 ? { ...d.condition2, fieldId: e.target.value } : null }))}
                          className="w-full border border-[#D4C9B5] rounded px-2 py-1.5 text-xs bg-white"
                        >
                          <option value="">— select a field —</option>
                          {packageFields
                            .filter((f) => f.id !== modal.fieldId && f.interviewMode !== "omitted" && f.interviewMode !== "readonly")
                            .map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-[#6B7A99] mb-1 block">Condition</label>
                        <select
                          value={draft.condition2.operator}
                          onChange={(e) => setDraft((d) => ({ ...d, condition2: d.condition2 ? { ...d.condition2, operator: e.target.value as FieldCondition["operator"] } : null }))}
                          className="w-full border border-[#D4C9B5] rounded px-2 py-1.5 text-xs bg-white"
                        >
                          <option value="is_answered">has any answer</option>
                          <option value="is_not_answered">has no answer</option>
                          <option value="equals">equals</option>
                          <option value="not_equals">does not equal</option>
                        </select>
                      </div>
                      {(draft.condition2.operator === "equals" || draft.condition2.operator === "not_equals") && (
                        <div>
                          <label className="text-xs text-[#6B7A99] mb-1 block">Value</label>
                          <Input
                            placeholder="Enter expected value"
                            value={draft.condition2.value}
                            onChange={(e) => setDraft((d) => ({ ...d, condition2: d.condition2 ? { ...d.condition2, value: e.target.value } : null }))}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Default value */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={draft.hasDefault} onChange={(e) => setDraft((d) => ({ ...d, hasDefault: e.target.checked }))} className="rounded" />
              <span className="text-sm">Set a default value</span>
            </label>
            {draft.hasDefault && (
              <Input placeholder="Default value" value={draft.defaultValue} onChange={(e) => setDraft((d) => ({ ...d, defaultValue: e.target.value }))} />
            )}
          </div>

          {/* Validation format */}
          <div>
            <label className="block text-xs font-medium text-[#6B7A99] mb-1">Validation format</label>
            <div role="group" aria-label="Validation format" className="flex flex-wrap gap-1">
              {([
                { value: "none",     label: "None",     tip: "No validation — any input is accepted" },
                { value: "string",   label: "String",   tip: "Accepts any text — no format restrictions" },
                { value: "name",     label: "Name",     tip: "Validates as a person's name — letters, spaces, hyphens, and apostrophes" },
                { value: "number",   label: "Number",   tip: "Validates as a numeric value — digits only, no formatting" },
                { value: "currency", label: "Currency", tip: "Validates as a dollar amount — accepts values like 1,234.56 or $1234" },
                { value: "percent",  label: "Percent",  tip: "Validates as a percentage — numeric value between 0 and 100" },
                { value: "email",    label: "Email",    tip: "Validates as an email address — must contain @ and a valid domain" },
                { value: "phone",    label: "Phone",    tip: "Validates as a US phone number — 10 digits, accepts common formats like (555) 555-5555" },
                { value: "date",     label: "Date",     tip: "Validates as a date — expects MM/DD/YYYY format" },
                { value: "time",     label: "Time",     tip: "Validates as a time — expects HH:MM AM/PM format" },
                { value: "zip",      label: "ZIP",      tip: "Validates as a US ZIP code — exactly 5 digits" },
                { value: "zip4",     label: "ZIP+4",    tip: "Validates as a US ZIP+4 code — format 12345-6789" },
                { value: "ssn",      label: "SSN",      tip: "Validates as a Social Security Number — expects NNN-NN-NNNN format" },
                { value: "custom",   label: "Custom",   tip: "Validates against a custom regular expression pattern you provide below" },
              ] as const).map(({ value, label, tip }) => (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-pressed={(draft.validationType ?? "none") === value}
                      onClick={() => setDraft((d) => ({ ...d, validationType: value as FieldItem["validationType"] }))}
                      className={`px-2 py-0.5 text-xs rounded border transition-colors ${(draft.validationType ?? "none") === value ? "bg-[#0F1C3F] text-white border-[#0F1C3F]" : "bg-white text-[#6B7A99] border-[#D4C9B5] hover:border-[#0F1C3F] hover:text-[#0F1C3F]"}`}
                    >
                      {label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">{tip}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            {draft.validationType === "custom" && (
              <Input className="mt-2 text-sm" placeholder="Regex pattern, e.g. ^[A-Z]{2}$" value={draft.validationPattern} onChange={(e) => setDraft((d) => ({ ...d, validationPattern: e.target.value }))} />
            )}
          </div>

          {/* Package-only checkbox (add mode only) */}
          {modal.mode === "add" && (
            <label className="flex items-center gap-2 rounded border border-[#DDD5C4] bg-[#F8F6F0] px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={draft.packageOnly} onChange={(e) => setDraft((d) => ({ ...d, packageOnly: e.target.checked }))} className="rounded" />
              <span className="text-sm text-[#6B7A99]">Package only — don't save to shared library</span>
            </label>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#DDD5C4] flex items-center justify-between gap-2">
          {modal.mode === "edit" && modal.fieldId && (
            <button type="button" onClick={() => onRemove(modal.fieldId!)} className="text-xs text-red-600 hover:underline">Remove field</button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded border border-[#D4C9B5] text-[#6B7A99] hover:bg-[#F8F6F0]">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="text-sm px-4 py-2 rounded bg-[#C49A38] hover:bg-[#b58c31] text-black font-medium disabled:opacity-50">
              {saving ? "Saving…" : modal.mode === "add" ? "Add Field" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
