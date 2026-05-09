import { useState, useRef, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Search,
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
  Lock,
  HelpCircle,
  FileText,
} from "lucide-react";
import type { ConfidenceTier, EdgeCase, LibraryField, ReviewField } from "./types";
import { LIBRARY_FIELDS, INITIAL_FIELDS } from "./types";

// ── Docuplete design tokens ──────────────────────────────────────────────────
const NAV    = "#0F1C3F";
const CREAM  = "#F8F6F0";
const BORDER = "#DDD5C4";
const MUTED  = "#6B7A99";
const GOLD   = "#C49A38";

// ── Small shared components ──────────────────────────────────────────────────

function ConfidenceDot({ tier }: { tier: ConfidenceTier }) {
  if (tier === "high")   return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Auto-confirmed
    </span>
  );
  if (tier === "medium") return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Verify
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2 py-0.5 bg-red-50 text-red-600 border border-red-100">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />Needs action
    </span>
  );
}

function EdgeCaseBadge({ type }: { type: EdgeCase }) {
  const map: Record<EdgeCase, { icon: React.ReactNode; label: string; cls: string }> = {
    "off-page":       { icon: <MapPin className="w-3 h-3" />,       label: "Off-page",              cls: "text-orange-600 bg-orange-50 border-orange-100" },
    "duplicate":      { icon: <CopyCheck className="w-3 h-3" />,    label: "Duplicate name",        cls: "text-purple-600 bg-purple-50 border-purple-100" },
    "checkbox-group": { icon: <LayoutGrid className="w-3 h-3" />,   label: "Radio / checkbox group",cls: "text-blue-600 bg-blue-50 border-blue-100" },
    "signature":      { icon: <Signature className="w-3 h-3" />,    label: "E-sign field",          cls: "text-indigo-600 bg-indigo-50 border-indigo-100" },
    "prefilled":      { icon: <Lock className="w-3 h-3" />,         label: "Pre-filled",            cls: "text-teal-700 bg-teal-50 border-teal-100" },
    "unnamed":        { icon: <HelpCircle className="w-3 h-3" />,   label: "No field name",         cls: "bg-white border-[#DDD5C4] text-[#6B7A99]" },
  };
  const { icon, label, cls } = map[type];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-1.5 py-0.5 ${cls}`}>
      {icon}{label}
    </span>
  );
}

function FieldTypeIcon({ type }: { type: ReviewField["pdfType"] }) {
  const base = "w-3.5 h-3.5";
  if (type === "signature") return <Signature className={`${base} text-indigo-400`} />;
  if (type === "checkbox")  return <CheckCircle2 className={`${base} text-blue-400`} />;
  if (type === "radio")     return <LayoutGrid className={`${base} text-blue-400`} />;
  return <FileText className={`${base}`} style={{ color: MUTED }} />;
}

// ── Library dropdown ─────────────────────────────────────────────────────────

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

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

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
    if (field.status === "blank")    return "italic text-[#6B7A99]";
    if (current) {
      return field.confidence === "high" && field.touched
        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
        : "bg-white text-[#0F1C3F] hover:border-[#C49A38]";
    }
    return "bg-red-50 border-red-200 text-red-700 hover:border-red-400";
  };

  const triggerLabel = () => {
    if (field.status === "deferred") return "↗ Resolve in mapper";
    if (field.status === "blank")    return "Leave blank";
    return current ? current.label : "— Select library field —";
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleOpen(); } }}
        className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border w-full text-left transition-all
          ${triggerStyle()}
          focus:outline-none focus:ring-2 focus:ring-offset-1`}
        style={{ borderColor: field.status === "blank" || (!current && field.status !== "deferred" && field.confidence !== "low") ? BORDER : undefined,
                 "--tw-ring-color": GOLD } as React.CSSProperties}
      >
        <span className="flex-1 truncate text-sm font-medium">{triggerLabel()}</span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform`} style={{ color: MUTED, transform: open ? "rotate(180deg)" : "" }} />
      </button>

      {open && (
        <div className={`absolute z-50 left-0 w-80 bg-white rounded-xl shadow-xl overflow-hidden border
          ${openUpward ? "bottom-full mb-1" : "top-full mt-1"}`}
          style={{ borderColor: BORDER, boxShadow: "0px 8px 20px rgba(0,0,0,0.10), 0px 2px 4px rgba(0,0,0,0.06)" }}>
          <div className="p-2 border-b" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border" style={{ background: CREAM, borderColor: BORDER }}>
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: MUTED }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape") close();
                  if (e.key === "Enter" && filtered.length === 1) { onSelect(filtered[0]); close(); }
                }}
                placeholder="Search library fields…"
                className="flex-1 text-sm bg-transparent outline-none placeholder-[#6B7A99]"
                style={{ color: NAV }}
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto">
            {Object.entries(grouped).map(([category, fields]) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider sticky top-0"
                     style={{ color: MUTED, background: CREAM }}>
                  {category}
                </div>
                {fields.map(f => (
                  <button
                    key={f.id}
                    onClick={() => { onSelect(f); close(); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between group`}
                    style={{
                      background: current?.id === f.id ? "#EEF2FF" : "transparent",
                      color: current?.id === f.id ? NAV : NAV,
                      fontWeight: current?.id === f.id ? 500 : 400,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F8F6F0")}
                    onMouseLeave={e => (e.currentTarget.style.background = current?.id === f.id ? "#EEF2FF" : "transparent")}
                  >
                    <span>{f.label}</span>
                    <span className="text-[10px] font-mono" style={{ color: MUTED }}>{f.key}</span>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-center" style={{ color: MUTED }}>No matching fields</div>
            )}
          </div>

          <div className="border-t p-2 flex flex-col gap-0.5" style={{ borderColor: BORDER, background: CREAM }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider px-2 pt-1 pb-1.5" style={{ color: MUTED }}>
              Can't map it from here?
            </p>
            <button
              onClick={() => { onDefer(); close(); }}
              className="flex items-start gap-2.5 text-left px-2 py-2 rounded-lg transition-colors hover:bg-orange-50"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-orange-700">Resolve in mapper</p>
                <p className="text-[11px] leading-tight" style={{ color: MUTED }}>Field passes through — flagged for attention once you see its position on the PDF.</p>
              </div>
            </button>
            <button
              onClick={() => { onBlank(); close(); }}
              className="flex items-start gap-2.5 text-left px-2 py-2 rounded-lg transition-colors hover:bg-white"
            >
              <MinusCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: MUTED }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: NAV }}>Leave blank</p>
                <p className="text-[11px] leading-tight" style={{ color: MUTED }}>Included in the package but always submits empty.</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({ field }: { field: ReviewField }) {
  const isPrefillProtected = field.edgeCases.includes("prefilled") && field.status === "blank" && field.touched;
  if (field.status === "deferred") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-100">
      <Eye className="w-3 h-3" /> In mapper
    </span>
  );
  if (isPrefillProtected) return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-100">
      <Lock className="w-3 h-3" /> Protected
    </span>
  );
  if (field.status === "blank") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-white border text-[#6B7A99]"
          style={{ borderColor: BORDER }}>
      <MinusCircle className="w-3 h-3" /> Blank
    </span>
  );
  if (field.status === "confirmed" && field.touched) return (
    <span className="text-[11px] font-medium text-emerald-700">Confirmed</span>
  );
  if (field.confidence === "low" && !field.touched) return (
    <span className="text-[11px] font-medium text-red-600">Required</span>
  );
  return <span className="text-[11px] font-medium text-amber-600">Pending</span>;
}

// ── Main component ───────────────────────────────────────────────────────────

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

  const blockers      = fields.filter(requiresAction);
  const autoConfirmed = fields.filter(f => f.confidence === "high").length;
  const pendingVerify = fields.filter(f => f.confidence === "medium" && f.status === "needs-review" && !f.touched).length;
  const pendingAction = fields.filter(f => f.confidence === "low" && f.status === "needs-review" && !f.touched).length;

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

  const autoFill = useCallback(() => {
    setFields(prev => prev.map(f => {
      if (f.touched) return f;
      if (f.confidence === "medium" && f.suggestedMatch)
        return { ...f, selectedMatch: f.suggestedMatch, status: "confirmed", touched: true };
      if (f.confidence === "low")
        return { ...f, status: "deferred", touched: true };
      return f;
    }));
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: CREAM, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="bg-white border-b flex items-center justify-between px-6 py-3 shrink-0"
              style={{ borderColor: BORDER }}>

        {/* Left: Docuplete logo + breadcrumb + stats */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: NAV }}>
              <span className="text-white text-[11px] font-bold">D</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: NAV }}>Docuplete</span>
            <span className="text-xs" style={{ color: MUTED }}>/ Application_1778347711374.pdf</span>
          </div>

          <div className="h-5 w-px" style={{ background: BORDER }} />

          <div className="flex items-center gap-4 text-xs" style={{ color: MUTED }}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-semibold" style={{ color: NAV }}>{autoConfirmed}</span> auto-confirmed
            </span>
            {pendingVerify > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="font-semibold" style={{ color: NAV }}>{pendingVerify}</span> to verify
              </span>
            )}
            {pendingAction > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span className="font-semibold" style={{ color: NAV }}>{pendingAction}</span> need action
              </span>
            )}
            {pendingVerify === 0 && pendingAction === 0 && (
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> All fields addressed
              </span>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2.5">
          {blockers.length > 0 && (
            <button
              onClick={autoFill}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all"
              style={{ borderColor: BORDER, color: MUTED, borderStyle: "dashed" }}
              onMouseEnter={e => { e.currentTarget.style.color = NAV; e.currentTarget.style.borderColor = MUTED; }}
              onMouseLeave={e => { e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = BORDER; }}
              title="Confirm all suggested matches; defer unrecognized fields to Visual Mapper"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Auto-fill suggestions
            </button>
          )}
          {blockers.length > 0 && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {blockers.length} unresolved — will defer to mapper
            </span>
          )}
          <button
            onClick={() => {
              const resolved = fields.map(f => {
                if (f.touched) return f;
                if (f.confidence === "medium" && f.suggestedMatch)
                  return { ...f, selectedMatch: f.suggestedMatch, status: "confirmed" as const, touched: true };
                return { ...f, status: "deferred" as const, touched: true };
              });
              onOpenMapper?.(resolved);
            }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold text-white transition-all"
            style={{ background: NAV }}
            onMouseEnter={e => (e.currentTarget.style.background = "#1a2d5a")}
            onMouseLeave={e => (e.currentTarget.style.background = NAV)}
          >
            Open in mapper
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── Keyboard hint bar ────────────────────────────────────────── */}
      <div className="border-b px-6 py-1.5 flex items-center gap-5 text-[11px] shrink-0"
           style={{ borderColor: BORDER, background: "white", color: MUTED }}>
        <span className="font-semibold uppercase tracking-wide text-[10px]" style={{ color: MUTED }}>Keyboard</span>
        {(["Tab","Space","Enter","Esc"] as const).map((k, i) => (
          <span key={k} className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                 style={{ background: CREAM, borderColor: BORDER, color: NAV }}>{k}</kbd>
            {["next row","open dropdown","confirm","close"][i]}
          </span>
        ))}
        <span className="ml-auto" style={{ color: MUTED }}>
          Can't map a field? Open the dropdown → <span className="font-medium text-orange-600">Resolve in mapper</span>
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl overflow-hidden border" style={{ borderColor: BORDER, boxShadow: "0px 1px 3px rgba(0,0,0,0.06)" }}>

          {/* Column headers */}
          <div className="grid grid-cols-[28px_220px_110px_60px_1fr_160px_120px] gap-4 px-5 py-2.5 border-b text-[10px] font-semibold uppercase tracking-wider"
               style={{ background: "white", borderColor: BORDER, color: MUTED }}>
            <div />
            <div>PDF Field</div>
            <div>Type</div>
            <div>Page</div>
            <div>Library Match</div>
            <div>Confidence</div>
            <div>Status</div>
          </div>

          {/* Rows */}
          {fields.map((field) => {
            const isFocused          = focusedRow === field.id;
            const isBlocker          = requiresAction(field);
            const isDeferred         = field.status === "deferred";
            const isBlank            = field.status === "blank";
            const isResolved         = field.touched && !isBlocker;
            const isPrefillProtected = field.edgeCases.includes("prefilled") && isBlank && field.touched;

            const rowBg = (): React.CSSProperties => ({ background: "white" });

            const rowIcon = () => {
              if (isPrefillProtected)                          return <Lock className="w-4 h-4 text-teal-400" />;
              if (isDeferred)                                  return <ArrowUpRight className="w-4 h-4 text-orange-400" />;
              if (isBlank)                                     return <MinusCircle className="w-4 h-4" style={{ color: BORDER }} />;
              if (field.status === "confirmed" && field.touched) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
              if (isBlocker)                                   return <AlertCircle className="w-4 h-4 text-red-400" />;
              return <AlertCircle className="w-4 h-4 text-amber-400" />;
            };

            return (
              <div
                key={field.id}
                onClick={() => setFocusedRow(isFocused ? null : field.id)}
                className="grid grid-cols-[28px_220px_110px_60px_1fr_160px_120px] gap-4 px-5 py-3.5 border-b last:border-0 transition-all cursor-pointer items-center"
                style={{
                  borderColor: BORDER,
                  outline: isFocused ? `2px solid ${GOLD}` : "none",
                  outlineOffset: "-2px",
                  ...rowBg(),
                }}
                onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = CREAM; }}
                onMouseLeave={e => { if (!isFocused) e.currentTarget.style.background = "white"; }}
              >
                {/* Icon */}
                <div className="flex items-center justify-center">{rowIcon()}</div>

                {/* PDF field name + badges */}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate"
                     style={{ color: isPrefillProtected ? MUTED : isDeferred ? "#92400e" : NAV }}
                     title={field.pdfName}>
                    {field.pdfName}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {field.edgeCases.map(ec => <EdgeCaseBadge key={ec} type={ec} />)}
                    {field.prefilledValue && (
                      <span className="text-[10px] font-medium text-teal-700">"{field.prefilledValue}"</span>
                    )}
                  </div>
                </div>

                {/* Type */}
                <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                  <FieldTypeIcon type={field.pdfType} />
                  <span className="capitalize">{field.pdfType}</span>
                </div>

                {/* Page */}
                <div className="text-sm font-medium" style={{ color: MUTED }}>p. {field.page}</div>

                {/* Library match / locked cell */}
                <div onClick={e => e.stopPropagation()}>
                  {isPrefillProtected ? (
                    <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border select-none"
                         style={{ background: "rgba(204,251,241,0.3)", borderColor: "#99F6E4", color: "#0F766E" }}
                         title="This field is already filled in the PDF — it will be left as-is">
                      <Lock className="w-3.5 h-3.5 flex-shrink-0 text-teal-500" />
                      <span className="font-medium text-sm">Pre-filled — not overwritten</span>
                    </div>
                  ) : (
                    <LibraryDropdown
                      field={field}
                      onSelect={(match) => confirmField(field.id, match)}
                      onDefer={() => deferField(field.id)}
                      onBlank={() => blankField(field.id)}
                      autoFocus={isFocused && isBlocker}
                    />
                  )}
                </div>

                {/* Confidence */}
                <div><ConfidenceDot tier={field.confidence} /></div>

                {/* Status + action */}
                <div className="flex items-center gap-1.5">
                  <StatusChip field={field} />
                  {(isDeferred || (isBlank && !isPrefillProtected)) && (
                    <button
                      onClick={e => { e.stopPropagation(); resetField(field.id); }}
                      className="text-[11px] underline transition-colors"
                      style={{ color: MUTED }}
                      onMouseEnter={e => (e.currentTarget.style.color = NAV)}
                      onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
                    >
                      Undo
                    </button>
                  )}
                  {isPrefillProtected && (
                    <button
                      onClick={e => { e.stopPropagation(); resetField(field.id); }}
                      className="text-[11px] underline transition-colors"
                      style={{ color: MUTED }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
                      onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
                      title="Override protection and map this field manually"
                    >
                      Override
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress footer */}
        <div className="mt-4 flex items-center gap-4 text-xs" style={{ color: MUTED }}>
          <span>{fields.filter(f => f.status === "confirmed").length} mapped</span>
          {fields.filter(f => f.status === "deferred").length > 0 && (
            <span className="text-orange-600 font-medium">{fields.filter(f => f.status === "deferred").length} deferred to mapper</span>
          )}
          {fields.filter(f => f.status === "blank").length > 0 && (
            <span>{fields.filter(f => f.status === "blank").length} blank / protected</span>
          )}
          <div className="flex-1 h-1 rounded-full overflow-hidden ml-2" style={{ background: BORDER }}>
            <div
              className="h-full rounded-full transition-all duration-300 flex"
              style={{ width: `${(fields.filter(f => f.touched).length / fields.length) * 100}%` }}
            >
              <div className="h-full bg-emerald-500" style={{ flex: fields.filter(f => f.status === "confirmed").length }} />
              <div className="h-full bg-amber-400"   style={{ flex: fields.filter(f => f.status === "deferred").length }} />
              <div className="h-full"               style={{ flex: fields.filter(f => f.status === "blank").length, background: BORDER }} />
            </div>
          </div>
          {blockers.length > 0 && (
            <span className="font-medium text-red-600">{blockers.length} need a decision</span>
          )}
        </div>
      </div>
    </div>
  );
}
