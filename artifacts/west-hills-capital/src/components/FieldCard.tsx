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
    <div style={{ maxHeight: "55%", overflowY: "auto" }} className="flex flex-col flex-shrink-0 border-b border-[#E2E8F0]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#E2E8F0] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {field && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: field.color }} />}
          <h2 className="text-xs font-semibold text-[#0F1C3F] uppercase tracking-wide truncate">
            {field?.name ?? "Placement"}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {field && !isSystemEsignFieldId(field.id) && (
            <button
              type="button"
              onClick={() => onOpenFieldEditor(field.id)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-[#C49A38] border border-[#C49A38]/40 hover:bg-[#FEF3C7] transition-colors"
              title="Edit field definition"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>
            </button>
          )}
          <button type="button" onClick={onClose} className="text-[#8A9BB8] hover:text-[#0F1C3F]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
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
              className={`w-full border border-[#E2E8F0] rounded px-2.5 py-1.5 text-xs text-[#0F1C3F] focus:outline-none ${isSystemEsignFieldId(field.id) ? "bg-[#F8FAFC] text-[#6B7A99] cursor-default" : "focus:ring-1 focus:ring-[#C49A38] focus:border-[#C49A38]"}`}
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
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border transition-colors ${!assignedRecipient ? "border-[#0F1C3F] bg-[#0F1C3F] text-white" : "border-[#E2E8F0] text-[#6B7A99] hover:bg-[#F8FAFC]"}`}
              >
                <span className="w-2 h-2 rounded-full border border-current inline-block" />
                <span>None</span>
              </button>
              {recipients.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onUpdateMapping({ recipientId: r.id })}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border transition-colors ${mapping.recipientId === r.id ? "border-[#0F1C3F] bg-[#0F1C3F] text-white" : "border-[#E2E8F0] text-[#6B7A99] hover:bg-[#F8FAFC]"}`}
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
                <div className="flex rounded overflow-hidden border border-[#E2E8F0]">
                  {INTERVIEW_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => onUpdateField(field.id, { interviewMode: m.value })}
                      className={`flex-1 py-1.5 text-[10px] font-medium border-r last:border-r-0 border-[#E2E8F0] transition-colors leading-tight ${fieldInterviewMode === m.value ? `${m.textClass} bg-white` : "text-[#6B7A99] hover:bg-[#F8FAFC]"}`}
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
          <div className="flex rounded overflow-hidden border border-[#E2E8F0]">
            {([0, 90, 180, 270] as const).map((deg) => (
              <button key={deg} type="button" onClick={() => onUpdateMapping({ rotation: deg })}
                className={`flex-1 py-1 text-[11px] font-medium border-r last:border-r-0 border-[#E2E8F0] transition-colors ${rotation === deg ? "bg-[#0F1C3F] text-white" : "text-[#6B7A99] hover:bg-[#F8FAFC]"}`}
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
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-[#F8FAFC] ${mapping.format === option.value ? "bg-[#F8FAFC] text-[#0F1C3F] font-semibold" : "text-[#334155]"}`}
                >
                  <span>{option.label}</span>
                  <span className="text-[10px] text-[#8A9BB8]">{option.group}</span>
                </button>
              ))}
            </div>
          </div>
        )}


      </div>
      <div className="flex gap-2 border-t border-[#E2E8F0] px-3 py-2.5 flex-shrink-0">
        {field && (
          <button type="button" onClick={() => onCopyField(field.id)} className="flex-1 rounded border border-[#E2E8F0] px-2 py-1.5 text-[11px] text-[#334155] hover:bg-[#F8FAFC] text-center">
            Copy
          </button>
        )}
        <button type="button" onClick={() => onDuplicateMapping(mapping.id)} className="flex-1 rounded border border-[#E2E8F0] px-2 py-1.5 text-[11px] text-[#334155] hover:bg-[#F8FAFC] text-center">
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
