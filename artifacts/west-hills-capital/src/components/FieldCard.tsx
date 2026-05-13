import { isSystemEsignFieldId } from "@/lib/docuplete-redaction";
import { mappingFormatOptionsForField } from "@/lib/docuplete-mapping-utils";
import {
  type FieldInterviewMode,
  type FieldItem,
  type MappingItem,
  type MappingFormat,
  type RecipientItem,
} from "@/lib/docuplete-types";

export interface FieldCardProps {
  mapping: MappingItem;
  field: FieldItem | undefined;
  recipients: RecipientItem[];
  onClose: () => void;
  onUpdateField: (fieldId: string, patch: Partial<FieldItem>) => void;
  onUpdateMapping: (patch: Partial<MappingItem>) => void;
  onChooseMappingFormat: (mappingId: string, format: MappingFormat | string) => void;
  onCopyField: (fieldId: string) => void;
  onDuplicateMapping: (mappingId: string) => void;
  onRemoveMapping: () => void;
  onOpenFieldEditor: (fieldId: string) => void;
}

const INTERVIEW_MODES: { value: FieldInterviewMode; label: string; color: string; textClass: string }[] = [
  { value: "optional",  label: "Optional",  color: "#0F1C3F", textClass: "text-[#0F1C3F]" },
  { value: "required",  label: "Required",  color: "#dc2626", textClass: "text-red-600" },
  { value: "readonly",  label: "Read-only", color: "#2563eb", textClass: "text-blue-600" },
  { value: "omitted",   label: "Omit",      color: "#6B7A99", textClass: "text-[#6B7A99]" },
];

export function FieldCard({
  mapping,
  field,
  recipients,
  onClose,
  onUpdateField,
  onUpdateMapping,
  onChooseMappingFormat,
  onCopyField,
  onDuplicateMapping,
  onRemoveMapping,
  onOpenFieldEditor,
}: FieldCardProps) {
  const formatOptions = mappingFormatOptionsForField(field);
  const assignedRecipient = mapping.recipientId ? recipients.find((r) => r.id === mapping.recipientId) : undefined;
  const fieldInterviewMode: FieldInterviewMode = field?.interviewMode ?? "optional";
  const isMasked = field?.sensitive === true;
  const isMultiLine = mapping.multiLine === true;
  const rotation = (mapping.rotation ?? 0) as 0 | 90 | 180 | 270;

  return (
    <div style={{ maxHeight: "55%", overflowY: "auto" }} className="flex flex-col flex-shrink-0 border-b border-[#DDD5C4]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#DDD5C4] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {field && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: field.color }} />}
          <h2 className="text-xs font-semibold text-[#0F1C3F] uppercase tracking-wide truncate">
            {field?.name ?? "Placement"}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="text-[#8A9BB8] hover:text-[#0F1C3F] flex-shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">

        {field && (
          <div>
            <div className="text-[10px] font-semibold text-[#6B7A99] uppercase tracking-wide mb-1 flex items-center gap-1.5">
              Field Name
              {isSystemEsignFieldId(field.id) && <span className="text-[10px] uppercase tracking-wide rounded bg-indigo-50 text-indigo-600 border border-indigo-200 px-1 py-0.5 font-semibold">E-Sign</span>}
            </div>
            <input
              type="text"
              value={field.name}
              onChange={(e) => { if (!isSystemEsignFieldId(field.id)) onUpdateField(field.id, { name: e.target.value }); }}
              readOnly={isSystemEsignFieldId(field.id)}
              className={`w-full border border-[#D4C9B5] rounded px-2.5 py-1.5 text-xs text-[#0F1C3F] focus:outline-none ${isSystemEsignFieldId(field.id) ? "bg-[#F8F6F0] text-[#6B7A99] cursor-default" : "focus:ring-1 focus:ring-[#C49A38] focus:border-[#C49A38]"}`}
              placeholder="Field name"
            />
          </div>
        )}

        {recipients.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-[#6B7A99] uppercase tracking-wide mb-1.5">Recipient</div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => onUpdateMapping({ recipientId: undefined })}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border transition-colors ${!assignedRecipient ? "border-[#0F1C3F] bg-[#0F1C3F] text-white" : "border-[#D4C9B5] text-[#6B7A99] hover:bg-[#F8F6F0]"}`}
              >
                <span className="w-2 h-2 rounded-full border border-current inline-block" />
                <span>None</span>
              </button>
              {recipients.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onUpdateMapping({ recipientId: r.id })}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border transition-colors ${mapping.recipientId === r.id ? "border-[#0F1C3F] bg-[#0F1C3F] text-white" : "border-[#D4C9B5] text-[#6B7A99] hover:bg-[#F8F6F0]"}`}
                >
                  <span className="w-2 h-2 rounded-full inline-block flex-shrink-0 border-2" style={{ borderColor: r.color }} />
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {field && (
          <div>
            <div className="text-[10px] font-semibold text-[#6B7A99] uppercase tracking-wide mb-1.5">Interview</div>
            {isSystemEsignFieldId(field.id) ? (
              <div className="rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] text-indigo-700 flex items-center gap-1.5">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                Always omitted — E-Sign system field
              </div>
            ) : (
              <>
                <div className="flex rounded overflow-hidden border border-[#D4C9B5]">
                  {INTERVIEW_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => onUpdateField(field.id, { interviewMode: m.value })}
                      className={`flex-1 py-1.5 text-[10px] font-medium border-r last:border-r-0 border-[#D4C9B5] transition-colors leading-tight ${fieldInterviewMode === m.value ? `${m.textClass} bg-white` : "text-[#6B7A99] hover:bg-[#F8F6F0]"}`}
                      style={fieldInterviewMode === m.value ? { boxShadow: `inset 0 0 0 2px ${m.color}` } : undefined}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {fieldInterviewMode === "omitted" && (
                  <p className="mt-1 text-[10px] text-[#6B7A99]">Prints on PDF but won't appear as a question — needs a default value or prefill.</p>
                )}
              </>
            )}
          </div>
        )}

        {field && (
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={isMasked} onChange={() => onUpdateField(field.id, { sensitive: !isMasked })} className="w-3 h-3 accent-[#C49A38] cursor-pointer" />
              <span className="text-xs text-[#334155]">Mask</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={isMultiLine} onChange={() => onUpdateMapping({ multiLine: !isMultiLine })} className="w-3 h-3 accent-[#C49A38] cursor-pointer" />
              <span className="text-xs text-[#334155]">Multi-line</span>
            </label>
          </div>
        )}

        <div>
          <div className="text-[10px] font-semibold text-[#6B7A99] uppercase tracking-wide mb-1.5">Rotation</div>
          <div className="flex rounded overflow-hidden border border-[#D4C9B5]">
            {([0, 90, 180, 270] as const).map((deg) => (
              <button key={deg} type="button" onClick={() => onUpdateMapping({ rotation: deg })}
                className={`flex-1 py-1 text-[11px] font-medium border-r last:border-r-0 border-[#D4C9B5] transition-colors ${rotation === deg ? "bg-[#0F1C3F] text-white" : "text-[#6B7A99] hover:bg-[#F8F6F0]"}`}
              >{deg}°</button>
            ))}
          </div>
        </div>

        {formatOptions.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-[#6B7A99] uppercase tracking-wide mb-1.5">Orientation</div>
            <div className="space-y-0.5 max-h-44 overflow-y-auto">
              {formatOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChooseMappingFormat(mapping.id, option.value)}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-[#F8F6F0] ${mapping.format === option.value ? "bg-[#F8F6F0] text-[#0F1C3F] font-semibold" : "text-[#334155]"}`}
                >
                  <span>{option.label}</span>
                  <span className="text-[10px] text-[#8A9BB8]">{option.group}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {field && (
          <div className="border-t border-[#EFE8D8] pt-3">
            <div className="text-[10px] font-semibold text-[#6B7A99] uppercase tracking-wide mb-1.5">Field</div>
            <button type="button" onClick={() => onOpenFieldEditor(field.id)} className="w-full text-left rounded border border-[#D4C9B5] px-2.5 py-2 text-xs text-[#334155] hover:bg-[#F8F6F0] flex items-center justify-between">
              <span>Edit field definition</span>
              <svg className="w-3 h-3 text-[#8A9BB8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}

      </div>
      <div className="flex gap-2 border-t border-[#EFE8D8] px-3 py-2.5 flex-shrink-0">
        {field && (
          <button type="button" onClick={() => onCopyField(field.id)} className="flex-1 rounded border border-[#D4C9B5] px-2 py-1.5 text-[11px] text-[#334155] hover:bg-[#F8F6F0] text-center">
            Copy
          </button>
        )}
        <button type="button" onClick={() => onDuplicateMapping(mapping.id)} className="flex-1 rounded border border-[#D4C9B5] px-2 py-1.5 text-[11px] text-[#334155] hover:bg-[#F8F6F0] text-center">
          Duplicate
        </button>
        <button
          type="button"
          onClick={onRemoveMapping}
          className="flex-1 rounded border border-red-200 px-2 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50 hover:border-red-300 text-center"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
