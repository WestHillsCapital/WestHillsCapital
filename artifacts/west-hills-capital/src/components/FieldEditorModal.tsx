import { useState } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { OPTION_COLORS } from "@/lib/docuplete-mapping-utils";
import type {
  FieldItem,
  FieldInterviewMode,
  FieldCondition,
} from "@/lib/docuplete-types";

const TYPE_KEY_LABELS: Record<string, string> = {
  name: "Name", email: "Email", phone: "Phone", date: "Date",
  ssn: "SSN", dob: "Date of Birth", currency: "Currency", number: "Number",
  state: "State", zip: "ZIP Code", percent: "Percent", zip4: "ZIP+4",
  time: "Time", custom: "Custom", string: "String",
  radio: "Radio button", checkbox: "Checkbox", dropdown: "Dropdown",
};

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
  conditionOperator: "and" | "or";
  sumGroup: string;
  copyFrom: { fieldId: string; whenFieldId: string; whenValue: string } | null;
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
  typeColors?: Record<string, string>;
  onUpdateTypeColor?: (typeKey: string, color: string) => void;
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
  typeColors,
  onUpdateTypeColor,
}: FieldEditorModalProps) {
  const [pendingColor, setPendingColor] = useState<string | null>(null);

  const activeTypeKey: string | null = (() => {
    const vt = draft.validationType;
    if (vt && vt !== "none") return vt as string;
    const ft = draft.type;
    if (ft === "radio" || ft === "checkbox" || ft === "dropdown") return ft;
    return null;
  })();
  // Show the type-managed view for ANY field with a type key — whether or not
  // a Settings override exists yet. The displayed color is always the field's
  // current color; the Change prompt lets the user override just this field or
  // update the type-level color globally in Settings.
  const isTypeLocked: boolean = activeTypeKey !== null;

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
          className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] select-none"
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
            {isTypeLocked && pendingColor === null ? (
              <div className="flex items-center gap-2 py-0.5">
                <span className="w-8 h-5 rounded-sm border border-black/10 flex-shrink-0" style={{ backgroundColor: draft.color }} />
                <span className="flex-1 text-xs text-[#6B7A99]">
                  {TYPE_KEY_LABELS[activeTypeKey!] ?? activeTypeKey} field — color managed by type
                </span>
                <button
                  type="button"
                  onClick={() => setPendingColor(draft.color)}
                  className="text-xs text-[#C49A38] hover:underline flex-shrink-0"
                >
                  Change
                </button>
              </div>
            ) : isTypeLocked && pendingColor !== null ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={pendingColor}
                    onChange={(e) => setPendingColor(e.target.value)}
                    className="h-8 w-10 rounded cursor-pointer border border-[#D1D5DB] p-0.5 flex-shrink-0"
                  />
                  <span className="flex-1 text-xs text-[#6B7A99] font-mono tracking-wider">{pendingColor.toUpperCase()}</span>
                  <button type="button" onClick={() => setPendingColor(null)} className="text-xs text-[#8A9BB8] hover:text-[#0F1C3F]">Cancel</button>
                </div>
                <div>
                  <p className="text-[11px] text-[#6B7A99] mb-1.5">Apply color to:</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setDraft((d) => ({ ...d, color: pendingColor })); setPendingColor(null); }}
                      className="px-3 py-1.5 text-xs rounded border border-[#E2E8F0] text-[#0F1C3F] hover:border-[#0F1C3F] transition-colors"
                    >
                      Just this field
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft((d) => ({ ...d, color: pendingColor }));
                        onUpdateTypeColor?.(activeTypeKey!, pendingColor);
                        setPendingColor(null);
                      }}
                      className="px-3 py-1.5 text-xs rounded bg-[#0F1C3F] text-white hover:bg-[#1a2d5a] transition-colors"
                    >
                      All {TYPE_KEY_LABELS[activeTypeKey!] ?? activeTypeKey} fields
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
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
                <div className="flex items-center gap-4 px-1 mt-1">
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                    className="h-8 w-10 rounded cursor-pointer border border-[#D1D5DB] p-0.5 flex-shrink-0"
                    title="Custom color"
                  />
                  <span className="flex-1 text-xs text-[#6B7A99] font-mono tracking-wider">{draft.color.toUpperCase()}</span>
                  <span className="text-[10px] text-[#B0BAD0]">custom</span>
                </div>
              </>
            )}
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
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${draft.type === value ? "bg-[#0F1C3F] text-white border-[#0F1C3F]" : "bg-white text-[#6B7A99] border-[#E2E8F0] hover:border-[#0F1C3F] hover:text-[#0F1C3F]"}`}
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
                    className="flex items-center gap-2 bg-[#F8FAFC] rounded px-2 py-1.5 border border-[#E2E8F0]"
                  >
                    <span className="text-[#CBD5E1] cursor-grab select-none text-sm">⠿</span>
                    {(draft.type === "radio" || draft.type === "checkbox") && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0 border-2 cursor-default"
                            style={{ borderColor: OPTION_COLORS[i % OPTION_COLORS.length], backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length] + "33" }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Mapper color for this option</TooltipContent>
                      </Tooltip>
                    )}
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraft((d) => { const opts = [...d.options]; opts[i] = v; return { ...d, options: opts }; });
                      }}
                      className="flex-1 bg-transparent text-sm outline-none border-b border-[#E2E8F0] py-0.5 min-w-0"
                      placeholder={`Option ${i + 1}`}
                    />
                    <button type="button" onClick={() => setDraft((d) => ({ ...d, options: d.options.filter((_, idx) => idx !== i) }))} className="text-red-400 hover:text-red-600 text-base leading-none px-1">×</button>
                  </div>
                ))}
                {draft.options.length === 0 && <p className="text-xs text-[#8A9BB8] italic py-1">No options yet — click "+ Add option" above</p>}
                {(draft.type === "radio" || draft.type === "checkbox") && draft.options.filter(Boolean).length > 0 && (
                  <p className="text-[10px] text-[#8A9BB8] italic pt-0.5">Each option gets its own colored box on the PDF mapper.</p>
                )}
              </div>
            </div>
          )}

          {/* Interview mode */}
          <div className="space-y-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
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
                <select value={draft.interviewMode} onChange={(e) => setDraft((d) => ({ ...d, interviewMode: e.target.value as FieldInterviewMode }))} className="w-full border border-[#D1D5DB] rounded px-2 py-1.5 text-xs bg-white">
                  <option value="optional">Optional — staff fills in during interview</option>
                  <option value="required">Required — must answer before generating</option>
                  <option value="readonly">Read only — shown but not editable</option>
                </select>
                {draft.interviewMode === "required" && draft.condition !== null && (
                  <p className="mt-2 text-[11px] text-[#7A6A3A] bg-[#FDF8EC] border border-[#E8D9A0] rounded px-2.5 py-1.5 leading-snug">
                    This field is required <em>only when its conditions are met</em>. If they're not, it's hidden and skipped automatically.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Conditions */}
          {draft.interviewMode !== "omitted" && (
            <div className="space-y-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
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
                      className="w-full border border-[#D1D5DB] rounded px-2 py-1.5 text-xs bg-white"
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
                      className="w-full border border-[#D1D5DB] rounded px-2 py-1.5 text-xs bg-white"
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
                      {(() => {
                        const triggerField = packageFields.find((f) => f.id === draft.condition!.fieldId);
                        const triggerOpts = (triggerField?.type === "radio" || triggerField?.type === "dropdown" || triggerField?.type === "checkbox")
                          ? (triggerField.options ?? []).filter(Boolean) : [];
                        return triggerOpts.length > 0 ? (
                          <select
                            value={draft.condition!.value}
                            onChange={(e) => setDraft((d) => ({ ...d, condition: d.condition ? { ...d.condition, value: e.target.value } : null }))}
                            className="w-full border border-[#D1D5DB] rounded px-2 py-1.5 text-xs bg-white"
                          >
                            <option value="">— select value —</option>
                            {triggerOpts.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <Input
                            placeholder="Enter expected value"
                            value={draft.condition!.value}
                            onChange={(e) => setDraft((d) => ({ ...d, condition: d.condition ? { ...d.condition, value: e.target.value } : null }))}
                          />
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
              {draft.condition !== null && (
                <div className="pt-2 mt-1 border-t border-[#E2E8F0]">
                  {draft.condition2 === null ? (
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, condition2: { fieldId: "", operator: "is_answered", value: "" } }))}
                      className="text-xs text-[#6B7A99] hover:text-[#0F1C3F] underline underline-offset-2"
                    >
                      + Add second condition
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded border border-[#E2E8F0] overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() => setDraft((d) => ({ ...d, conditionOperator: "and" }))}
                            className={`px-2 py-0.5 font-semibold uppercase tracking-wide transition-colors ${draft.conditionOperator !== "or" ? "bg-[#0F1C3F] text-white" : "bg-white text-[#6B7A99] hover:bg-[#F0EDE6]"}`}
                          >AND</button>
                          <button
                            type="button"
                            onClick={() => setDraft((d) => ({ ...d, conditionOperator: "or" }))}
                            className={`px-2 py-0.5 font-semibold uppercase tracking-wide transition-colors ${draft.conditionOperator === "or" ? "bg-[#0F1C3F] text-white" : "bg-white text-[#6B7A99] hover:bg-[#F0EDE6]"}`}
                          >OR</button>
                        </div>
                        <button type="button" onClick={() => setDraft((d) => ({ ...d, condition2: null }))} className="text-xs text-red-500 hover:underline">Remove</button>
                      </div>
                      <div>
                        <label className="text-xs text-[#6B7A99] mb-1 block">Trigger field</label>
                        <select
                          value={draft.condition2.fieldId}
                          onChange={(e) => setDraft((d) => ({ ...d, condition2: d.condition2 ? { ...d.condition2, fieldId: e.target.value } : null }))}
                          className="w-full border border-[#D1D5DB] rounded px-2 py-1.5 text-xs bg-white"
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
                          className="w-full border border-[#D1D5DB] rounded px-2 py-1.5 text-xs bg-white"
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
                          {(() => {
                            const triggerField2 = packageFields.find((f) => f.id === draft.condition2!.fieldId);
                            const triggerOpts2 = (triggerField2?.type === "radio" || triggerField2?.type === "dropdown" || triggerField2?.type === "checkbox")
                              ? (triggerField2.options ?? []).filter(Boolean) : [];
                            return triggerOpts2.length > 0 ? (
                              <select
                                value={draft.condition2!.value}
                                onChange={(e) => setDraft((d) => ({ ...d, condition2: d.condition2 ? { ...d.condition2, value: e.target.value } : null }))}
                                className="w-full border border-[#D1D5DB] rounded px-2 py-1.5 text-xs bg-white"
                              >
                                <option value="">— select value —</option>
                                {triggerOpts2.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <Input
                                placeholder="Enter expected value"
                                value={draft.condition2!.value}
                                onChange={(e) => setDraft((d) => ({ ...d, condition2: d.condition2 ? { ...d.condition2, value: e.target.value } : null }))}
                              />
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {draft.condition !== null && (
                <p className="mt-1 text-[11px] text-[#7A6A3A] bg-[#FDF8EC] border border-[#E8D9A0] rounded px-2.5 py-1.5 leading-snug">
                  The trigger field doesn't need a PDF placement. A field used only to drive conditions can be left unmapped — it still gates the interview without writing to the document.
                </p>
              )}
            </div>
          )}

          {/* Copy From — auto-fill from another field when condition is met */}
          {draft.interviewMode !== "omitted" && draft.interviewMode !== "readonly" && (
            <div className="space-y-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.copyFrom !== null}
                    onChange={(e) => setDraft((d) => ({
                      ...d,
                      copyFrom: e.target.checked ? { fieldId: "", whenFieldId: "", whenValue: "" } : null,
                    }))}
                    className="rounded"
                  />
                  <span className="text-sm">Auto-fill from another field when</span>
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center text-[#8A9BB8] cursor-default"><Info className="w-3 h-3" /></span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
                    <p>When the trigger field equals the specified value, this field is automatically filled with the value from the source field. Useful for copying address fields when a beneficiary relationship is "Spouse".</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {draft.copyFrom !== null && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-xs text-[#6B7A99] mb-1 block">Copy value from</label>
                    <select
                      value={draft.copyFrom.fieldId}
                      onChange={(e) => setDraft((d) => ({ ...d, copyFrom: d.copyFrom ? { ...d.copyFrom, fieldId: e.target.value } : null }))}
                      className="w-full border border-[#D1D5DB] rounded px-2 py-1.5 text-xs bg-white"
                    >
                      <option value="">— select source field —</option>
                      {packageFields
                        .filter((f) => f.id !== modal.fieldId)
                        .map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#6B7A99] mb-1 block">When this field</label>
                    <select
                      value={draft.copyFrom.whenFieldId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        const newTrigger = packageFields.find((f) => f.id === newId);
                        const newOpts = (newTrigger?.type === "radio" || newTrigger?.type === "dropdown" || newTrigger?.type === "checkbox")
                          ? (newTrigger.options ?? []) : [];
                        setDraft((d) => ({
                          ...d,
                          copyFrom: d.copyFrom ? {
                            ...d.copyFrom,
                            whenFieldId: newId,
                            whenValue: newOpts.length > 0 && !newOpts.includes(d.copyFrom.whenValue) ? "" : d.copyFrom.whenValue,
                          } : null,
                        }));
                      }}
                      className="w-full border border-[#D1D5DB] rounded px-2 py-1.5 text-xs bg-white"
                    >
                      <option value="">— select trigger field —</option>
                      {packageFields
                        .filter((f) => f.id !== modal.fieldId)
                        .map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#6B7A99] mb-1 block">Equals</label>
                    {(() => {
                      const triggerField = packageFields.find((f) => f.id === draft.copyFrom!.whenFieldId);
                      const triggerOpts = (triggerField?.type === "radio" || triggerField?.type === "dropdown" || triggerField?.type === "checkbox")
                        ? (triggerField.options ?? []) : [];
                      return triggerOpts.length > 0 ? (
                        <select
                          value={draft.copyFrom!.whenValue}
                          onChange={(e) => setDraft((d) => ({ ...d, copyFrom: d.copyFrom ? { ...d.copyFrom, whenValue: e.target.value } : null }))}
                          className="w-full border border-[#D1D5DB] rounded px-2 py-1.5 text-xs bg-white"
                        >
                          <option value="">— select value —</option>
                          {triggerOpts.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <Input
                          placeholder="e.g. Spouse"
                          value={draft.copyFrom!.whenValue}
                          onChange={(e) => setDraft((d) => ({ ...d, copyFrom: d.copyFrom ? { ...d.copyFrom, whenValue: e.target.value } : null }))}
                        />
                      );
                    })()}
                  </div>
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
                      className={`px-2 py-0.5 text-xs rounded border transition-colors ${(draft.validationType ?? "none") === value ? "bg-[#0F1C3F] text-white border-[#0F1C3F]" : "bg-white text-[#6B7A99] border-[#E2E8F0] hover:border-[#0F1C3F] hover:text-[#0F1C3F]"}`}
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

          {/* Sum Group */}
          {(draft.validationType === "percent" || draft.validationType === "number") && (
            <div className="space-y-1.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-[#6B7A99]">Sum Group</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center text-[#8A9BB8] cursor-default"><Info className="w-3 h-3" /></span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs leading-snug space-y-1">
                    <p><strong>What it does:</strong> Groups percentage fields together so their values must total exactly 100% before the client can proceed.</p>
                    <p><strong>How to use:</strong> Give the same label to every share % field in the same group. For example, tag all primary beneficiary share fields <em>primary_beneficiary</em> and all contingent share fields <em>contingent_beneficiary</em>.</p>
                    <p><strong>Live feedback:</strong> The client sees a running total and a progress bar while filling in the form, so they always know how much is left to allocate.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {(() => {
                const existingGroups = [...new Set(
                  packageFields
                    .filter((f) => f.id !== modal.fieldId && f.sumGroup?.trim())
                    .map((f) => f.sumGroup!.trim())
                )];
                const listId = `sum-group-list-${modal.fieldId ?? "new"}`;
                return (
                  <>
                    <input
                      list={listId}
                      value={draft.sumGroup}
                      onChange={(e) => setDraft((d) => ({ ...d, sumGroup: e.target.value }))}
                      placeholder={existingGroups.length > 0 ? "Select or type a group name…" : "e.g. primary_beneficiary (optional)"}
                      className="w-full border border-[#D1D5DB] rounded px-2 py-1.5 text-xs bg-white"
                    />
                    {existingGroups.length > 0 && (
                      <datalist id={listId}>
                        {existingGroups.map((g) => <option key={g} value={g} />)}
                      </datalist>
                    )}
                  </>
                );
              })()}
              {draft.sumGroup.trim() && (
                <p className="text-[10px] text-[#7A6A3A]">
                  All visible fields tagged <strong>{draft.sumGroup.trim()}</strong> must sum to 100% before the client can advance.
                </p>
              )}
            </div>
          )}

          {/* Package-only checkbox (add mode only) */}
          {modal.mode === "add" && (
            <label className="flex items-center gap-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={draft.packageOnly} onChange={(e) => setDraft((d) => ({ ...d, packageOnly: e.target.checked }))} className="rounded" />
              <span className="text-sm text-[#6B7A99]">Package only — don't save to shared library</span>
            </label>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
          {modal.mode === "edit" && modal.fieldId && (
            <button type="button" onClick={() => onRemove(modal.fieldId!)} className="text-xs text-red-600 hover:underline">Remove field</button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded border border-[#E2E8F0] text-[#6B7A99] hover:bg-[#F8FAFC]">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="text-sm px-4 py-2 rounded bg-[#C49A38] hover:bg-[#b58c31] text-black font-medium disabled:opacity-50">
              {saving ? "Saving…" : modal.mode === "add" ? "Add Field" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
