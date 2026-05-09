import { useState, useRef, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Search,
  FileText,
  AlertTriangle,
  CopyCheck,
  Signature,
  LayoutGrid,
  MapPin,
  ArrowRight,
  MinusCircle,
  ArrowUpRight,
  Eye,
  Zap,
  Wand2,
} from "lucide-react";
import type { ConfidenceTier, FieldStatus, EdgeCase, LibraryField, ReviewField } from "./types";
import { LIBRARY_FIELDS, INITIAL_FIELDS } from "./types";

function ConfidenceDot({ tier }: { tier: ConfidenceTier }) {
  if (tier === "high")   return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Auto-confirmed</span>;
  if (tier === "medium") return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Verify</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Needs action</span>;
}

function EdgeCaseBadge({ type }: { type: EdgeCase }) {
  const map: Record<EdgeCase, { icon: React.ReactNode; label: string; color: string }> = {
    "off-page":      { icon: <MapPin className="w-3 h-3" />,     label: "Off-page",             color: "text-orange-600 bg-orange-50 border-orange-200" },
    "duplicate":     { icon: <CopyCheck className="w-3 h-3" />,  label: "Duplicate name",       color: "text-purple-600 bg-purple-50 border-purple-200" },
    "checkbox-group":{ icon: <LayoutGrid className="w-3 h-3" />, label: "Radio / checkbox group", color: "text-blue-600 bg-blue-50 border-blue-200" },
    "signature":     { icon: <Signature className="w-3 h-3" />,  label: "E-sign field",         color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
    "prefilled":     { icon: <Zap className="w-3 h-3" />,        label: "Pre-filled",           color: "text-teal-600 bg-teal-50 border-teal-200" },
  };
  const { icon, label, color } = map[type];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-0.5 ${color}`}>
      {icon}{label}
    </span>
  );
}

function FieldTypeIcon({ type }: { type: ReviewField["pdfType"] }) {
  const base = "w-4 h-4";
  if (type === "signature") return <Signature className={`${base} text-indigo-500`} />;
  if (type === "checkbox")  return <CheckCircle2 className={`${base} text-blue-500`} />;
  if (type === "radio")     return <LayoutGrid className={`${base} text-blue-500`} />;
  return <FileText className={`${base} text-slate-400`} />;
}

interface DropdownProps {
  field: ReviewField;
  onSelect: (libraryField: LibraryField | null) => void;
  onDefer: () => void;
  onBlank: () => void;
  autoFocus?: boolean;
}

function LibraryDropdown({ field, onSelect, onDefer, onBlank, autoFocus }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const filtered = LIBRARY_FIELDS.filter(f =>
    f.label.toLowerCase().includes(query.toLowerCase()) ||
    f.key.toLowerCase().includes(query.toLowerCase()) ||
    f.category.toLowerCase().includes(query.toLowerCase())
  );

  const grouped = filtered.reduce((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {} as Record<string, LibraryField[]>);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (autoFocus && !open) {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setOpenUpward(window.innerHeight - rect.bottom < 380);
      }
      setOpen(true);
    }
  }, [autoFocus]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setOpenUpward(window.innerHeight - rect.bottom < 380);
    }
    setOpen(o => !o);
  };

  const close = () => { setOpen(false); setQuery(""); };
  const current = field.selectedMatch;

  const triggerStyle = () => {
    if (field.status === "deferred") return "bg-orange-50 border-orange-200 text-orange-800";
    if (field.status === "blank")    return "bg-slate-50 border-slate-200 text-slate-500 italic";
    if (current) {
      return field.confidence === "high" && field.touched
        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
        : "bg-white border-slate-300 text-slate-800 hover:border-slate-400";
    }
    return "bg-red-50 border-red-200 text-red-700 hover:border-red-400";
  };

  const triggerLabel = () => {
    if (field.status === "deferred") return "↗ Resolve in mapper";
    if (field.status === "blank")    return "Leave blank (no input)";
    return current ? current.label : "— Select library field —";
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleOpen(); } }}
        className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border w-full text-left transition-all
          ${triggerStyle()}
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
      >
        <span className="flex-1 truncate font-medium">{triggerLabel()}</span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className={`absolute z-50 left-0 w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden
          ${openUpward ? "bottom-full mb-1" : "top-full mt-1"}`}>
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape") close();
                  if (e.key === "Enter" && filtered.length === 1) { onSelect(filtered[0]); close(); }
                }}
                placeholder="Search library fields…"
                className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto">
            {Object.entries(grouped).map(([category, fields]) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 sticky top-0">
                  {category}
                </div>
                {fields.map(f => (
                  <button
                    key={f.id}
                    onClick={() => { onSelect(f); close(); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between group
                      ${current?.id === f.id ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`}
                  >
                    <span>{f.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono group-hover:text-blue-400">{f.key}</span>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-slate-400 text-center">No matching fields</div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50 p-2 flex flex-col gap-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 pt-1 pb-1.5">
              Can't map it from here?
            </p>
            <button
              onClick={() => { onDefer(); close(); }}
              className="flex items-start gap-2.5 text-left px-2 py-2 rounded-lg hover:bg-orange-50 transition-colors group"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-orange-700 group-hover:text-orange-800">Resolve in mapper</p>
                <p className="text-[11px] text-slate-400 leading-tight">Field passes through — flagged for attention. Assign it once you see its position on the PDF.</p>
              </div>
            </button>
            <button
              onClick={() => { onBlank(); close(); }}
              className="flex items-start gap-2.5 text-left px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors group"
            >
              <MinusCircle className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-600 group-hover:text-slate-700">Leave blank</p>
                <p className="text-[11px] text-slate-400 leading-tight">Included in the package but always submits empty. For fields that don't apply to every process type.</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ field }: { field: ReviewField }) {
  if (field.status === "deferred") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
      <Eye className="w-3 h-3" /> In mapper
    </span>
  );
  if (field.status === "blank") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
      <MinusCircle className="w-3 h-3" /> Blank
    </span>
  );
  if (field.status === "confirmed" && field.touched) return <span className="text-xs text-emerald-700 font-medium">Confirmed</span>;
  if (field.confidence === "low" && !field.touched)  return <span className="text-xs text-red-600 font-medium">Required</span>;
  return <span className="text-xs text-amber-600 font-medium">Pending</span>;
}

interface Props {
  onOpenMapper?: (fields: ReviewField[]) => void;
}

export function FieldReview({ onOpenMapper }: Props) {
  const [fields, setFields] = useState<ReviewField[]>(INITIAL_FIELDS);
  const [focusedRow, setFocusedRow] = useState<string | null>(null);

  const requiresAction = (f: ReviewField) =>
    !f.touched &&
    f.status === "needs-review" &&
    (f.confidence === "medium" || f.confidence === "low");

  const blockers       = fields.filter(requiresAction);
  const autoConfirmed  = fields.filter(f => f.confidence === "high").length;
  const pendingVerify  = fields.filter(f => f.confidence === "medium" && f.status === "needs-review" && !f.touched).length;
  const pendingAction  = fields.filter(f => f.confidence === "low" && f.status === "needs-review" && !f.touched).length;
  const canSave        = blockers.length === 0;

  const confirmField = useCallback((id: string, match: LibraryField | null) => {
    setFields(prev => prev.map(f => f.id !== id ? f : {
      ...f, selectedMatch: match, status: match ? "confirmed" : "blank", touched: true,
    }));
  }, []);

  const deferField = useCallback((id: string) => {
    setFields(prev => prev.map(f => f.id !== id ? f : { ...f, status: "deferred", touched: true }));
  }, []);

  const blankField = useCallback((id: string) => {
    setFields(prev => prev.map(f => f.id !== id ? f : { ...f, status: "blank", selectedMatch: null, touched: true }));
  }, []);

  const resetField = useCallback((id: string) => {
    setFields(prev => prev.map(f => f.id !== id ? f : {
      ...f,
      status: f.confidence === "high" ? "confirmed" : "needs-review",
      touched: f.confidence === "high",
      selectedMatch: f.suggestedMatch,
    }));
  }, []);

  // Auto-fill: confirm suggestions for medium, defer low-confidence to mapper
  const autoFill = useCallback(() => {
    setFields(prev => prev.map(f => {
      if (f.touched) return f;
      if (f.confidence === "medium" && f.suggestedMatch) {
        return { ...f, selectedMatch: f.suggestedMatch, status: "confirmed", touched: true };
      }
      if (f.confidence === "low") {
        return { ...f, status: "deferred", touched: true };
      }
      return f;
    }));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Reviewing fields in</p>
              <p className="text-sm font-semibold text-slate-900">Application_1778347711374.pdf</p>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-900">{autoConfirmed}</span> auto-confirmed
            </span>
            {pendingVerify > 0 && (
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="font-medium text-slate-900">{pendingVerify}</span> to verify
              </span>
            )}
            {pendingAction > 0 && (
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="font-medium text-slate-900">{pendingAction}</span> need action
              </span>
            )}
            {pendingVerify === 0 && pendingAction === 0 && (
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> All fields addressed
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-fill shortcut */}
          {blockers.length > 0 && (
            <button
              onClick={autoFill}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-300
                text-sm text-slate-500 hover:text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all"
              title="Confirm all suggested matches; defer unrecognized fields to Visual Mapper"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Auto-fill suggestions
            </button>
          )}
          {blockers.length > 0 && (
            <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {blockers.length} field{blockers.length !== 1 ? "s" : ""} still need a decision
            </span>
          )}
          <button
            onClick={() => canSave && onOpenMapper?.(fields)}
            disabled={!canSave}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all
              ${canSave
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm cursor-pointer"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
          >
            Open in mapper
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="bg-slate-900 text-slate-300 text-xs px-8 py-2 flex items-center gap-6">
        <span className="text-slate-500 font-medium">Keyboard</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">Tab</kbd> next row</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">Space</kbd> open dropdown</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">Enter</kbd> confirm</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">Esc</kbd> close</span>
        <span className="ml-auto text-slate-500">Can't map a field? Open the dropdown → <span className="text-orange-400 font-medium">Resolve in mapper</span></span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[28px_220px_110px_64px_1fr_160px_110px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <div></div>
            <div>PDF Field</div>
            <div>Type</div>
            <div>Page</div>
            <div>Library Match</div>
            <div>Confidence</div>
            <div>Status</div>
          </div>

          {fields.map((field) => {
            const isFocused   = focusedRow === field.id;
            const isBlocker   = requiresAction(field);
            const isDeferred  = field.status === "deferred";
            const isBlank     = field.status === "blank";
            const isResolved  = field.touched && !isBlocker;

            const rowBg = () => {
              if (isDeferred) return "bg-orange-50/50 hover:bg-orange-50/80";
              if (isBlank)    return "bg-slate-50/60 hover:bg-slate-50/90";
              if (isBlocker)  return "bg-red-50/40 hover:bg-red-50/70";
              if (field.confidence === "medium" && !isResolved) return "bg-amber-50/30 hover:bg-amber-50/50";
              return "hover:bg-slate-50/80";
            };

            const rowIcon = () => {
              if (isDeferred) return <ArrowUpRight className="w-4 h-4 text-orange-400" />;
              if (isBlank)    return <MinusCircle className="w-4 h-4 text-slate-300" />;
              if (field.status === "confirmed" && field.touched) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
              if (isBlocker)  return <AlertCircle className="w-4 h-4 text-red-400" />;
              return <AlertCircle className="w-4 h-4 text-amber-400" />;
            };

            return (
              <div
                key={field.id}
                onClick={() => setFocusedRow(isFocused ? null : field.id)}
                className={`grid grid-cols-[28px_220px_110px_64px_1fr_160px_110px] gap-4 px-5 py-3.5 border-b border-slate-100 last:border-0 transition-all cursor-pointer items-center
                  ${rowBg()}
                  ${isFocused ? "ring-2 ring-inset ring-blue-400" : ""}
                `}
              >
                <div className="flex items-center justify-center">{rowIcon()}</div>

                <div className="min-w-0">
                  <p className={`text-sm font-mono font-medium truncate ${isDeferred ? "text-orange-800" : isBlank ? "text-slate-400" : "text-slate-800"}`}
                     title={field.pdfName}>
                    {field.pdfName}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {field.edgeCases.map(ec => <EdgeCaseBadge key={ec} type={ec} />)}
                    {field.prefilledValue && (
                      <span className="text-[11px] text-teal-700 font-medium">"{field.prefilledValue}"</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FieldTypeIcon type={field.pdfType} />
                  <span className="capitalize">{field.pdfType}</span>
                </div>

                <div className="text-sm font-medium text-slate-500">p. {field.page}</div>

                <div onClick={e => e.stopPropagation()}>
                  <LibraryDropdown
                    field={field}
                    onSelect={(match) => confirmField(field.id, match)}
                    onDefer={() => deferField(field.id)}
                    onBlank={() => blankField(field.id)}
                    autoFocus={isFocused && isBlocker}
                  />
                </div>

                <div><ConfidenceDot tier={field.confidence} /></div>

                <div className="flex items-center gap-1.5">
                  <StatusChip field={field} />
                  {(isDeferred || isBlank) && (
                    <button
                      onClick={e => { e.stopPropagation(); resetField(field.id); }}
                      className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                    >
                      Undo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
          <span>{fields.filter(f => f.status === "confirmed").length} mapped</span>
          {fields.filter(f => f.status === "deferred").length > 0 && (
            <span className="text-orange-600 font-medium">{fields.filter(f => f.status === "deferred").length} deferred to mapper</span>
          )}
          {fields.filter(f => f.status === "blank").length > 0 && (
            <span>{fields.filter(f => f.status === "blank").length} blank</span>
          )}
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden ml-2">
            <div
              className="h-full rounded-full transition-all duration-300 flex"
              style={{ width: `${((fields.filter(f => f.touched).length) / fields.length) * 100}%` }}
            >
              <div className="h-full bg-emerald-500" style={{ flex: fields.filter(f => f.status === "confirmed").length }} />
              <div className="h-full bg-orange-400" style={{ flex: fields.filter(f => f.status === "deferred").length }} />
              <div className="h-full bg-slate-300"  style={{ flex: fields.filter(f => f.status === "blank").length }} />
            </div>
          </div>
          {blockers.length > 0 && (
            <span className="text-red-600 font-medium">{blockers.length} need a decision</span>
          )}
        </div>
      </div>
    </div>
  );
}
