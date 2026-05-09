import { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  ChevronDown,
  ArrowLeft,
  Flag,
  MinusCircle,
  LayoutGrid,
  Zap,
  CheckCheck,
} from "lucide-react";
import type { ReviewField, LibraryField } from "./types";
import { LIBRARY_FIELDS } from "./types";

// Approximate field positions on each PDF page (x, y, w, h as % of page dimensions)
const FIELD_POSITIONS: Record<string, { x: number; y: number; w: number; h: number }> = {
  // Page 1
  "f14": { x: 12, y: 14, w: 74, h: 5   }, // Account Type
  "f15": { x: 30, y: 22, w: 55, h: 5   }, // Fund How
  "f16": { x: 12, y: 23, w: 16, h: 4   }, // Contribution Year
  "f1":  { x: 12, y: 38, w: 37, h: 4   }, // Social Security Number
  "f2":  { x: 53, y: 38, w: 37, h: 4   }, // Date of Birth
  "f17": { x: 53, y: 43, w: 37, h: 3.5 }, // SingleorMarried
  "f25": { x: 12, y: 43, w: 37, h: 3.5 }, // Married Not Married
  "f4":  { x: 12, y: 48, w: 52, h: 4   }, // Physical Address
  "f13": { x: 12, y: 54, w: 74, h: 4   }, // Mailing Address
  "f5":  { x: 12, y: 60, w: 27, h: 4   }, // Home Phone Number
  "f6":  { x: 43, y: 60, w: 22, h: 4   }, // Cell Phone
  "f24": { x: 12, y: 66, w: 25, h: 4   }, // Email Notifications…
  "f3":  { x: 57, y: 66, w: 33, h: 4   }, // Email Address
  "f22": { x: 12, y: 72, w: 28, h: 4   }, // undefined
  "f23": { x: 44, y: 72, w: 28, h: 4   }, // undefined_2
  "f7":  { x: 35, y: 80, w: 40, h: 4   }, // Card Number
  "f8":  { x: 79, y: 80, w: 13, h: 4   }, // Exp Date
  "f12": { x: 35, y: 85, w: 40, h: 4   }, // Exact Name on Card
  "f9":  { x: 79, y: 85, w: 13, h: 4   }, // 3 Digit Security Code
  "f11": { x: 64, y: 91, w: 28, h: 4   }, // Date
  // Page 2
  "f20": { x: 10, y: 18, w: 16, h: 7   }, // Beneficiary Group 1
  "f18": { x: 29, y: 19, w: 40, h: 5   }, // Name (ben1)
  "f19": { x: 72, y: 19, w: 22, h: 5   }, // Relationship
  "f21": { x: 73, y: 88, w: 22, h: 4   }, // Date_2
  "f27": { x: 12, y: 78, w: 64, h: 4   }, // I
  "f26": { x: 12, y: 84, w: 32, h: 5   }, // By
  "f10": { x: 12, y: 92, w: 60, h: 4   }, // Printed Name
  // Page 3
  "f28": { x: 12, y: 12, w: 42, h: 4   }, // undefined_9
};

function chipColor(status: ReviewField["status"], confidence: ReviewField["confidence"]) {
  if (status === "confirmed") return { bg: "bg-emerald-500", text: "text-white", border: "border-emerald-600" };
  if (status === "deferred")  return { bg: "bg-orange-500", text: "text-white", border: "border-orange-600" };
  if (status === "blank")     return { bg: "bg-slate-300",  text: "text-slate-700", border: "border-slate-400" };
  // needs-review (shouldn't hit mapper, but handle gracefully)
  return confidence === "medium"
    ? { bg: "bg-amber-400", text: "text-white", border: "border-amber-500" }
    : { bg: "bg-red-400",   text: "text-white", border: "border-red-500" };
}

function chipLabel(field: ReviewField) {
  if (field.status === "confirmed") return field.selectedMatch?.label ?? field.pdfName;
  if (field.status === "blank")     return "blank";
  return field.pdfName;
}

interface AssignDropdownProps {
  field: ReviewField;
  onAssign: (f: LibraryField) => void;
  onBlank: () => void;
}
function AssignDropdown({ field, onAssign, onBlank }: AssignDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = LIBRARY_FIELDS.filter(f =>
    f.label.toLowerCase().includes(query.toLowerCase()) ||
    f.key.toLowerCase().includes(query.toLowerCase())
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
    function outside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  const close = () => { setOpen(false); setQuery(""); };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border bg-white border-slate-300
          text-slate-700 hover:border-blue-400 hover:text-blue-700 transition-all w-full text-left focus:outline-none
          focus:ring-2 focus:ring-blue-500"
      >
        <span className="flex-1 truncate">
          {field.selectedMatch ? field.selectedMatch.label : "— Assign library field —"}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 bottom-full mb-1 left-0 w-72 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape") close();
                  if (e.key === "Enter" && filtered.length === 1) { onAssign(filtered[0]); close(); }
                }}
                placeholder="Search library fields…"
                className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {Object.entries(grouped).map(([category, fields]) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 sticky top-0">
                  {category}
                </div>
                {fields.map(f => (
                  <button
                    key={f.id}
                    onClick={() => { onAssign(f); close(); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between
                      ${field.selectedMatch?.id === f.id ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`}
                  >
                    <span>{f.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{f.key}</span>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-slate-400 text-center">No match</div>
            )}
          </div>
          <div className="border-t border-slate-100 p-2">
            <button
              onClick={() => { onBlank(); close(); }}
              className="flex items-center gap-2 w-full text-left px-2 py-2 rounded-lg hover:bg-slate-100 text-sm text-slate-600 transition-colors"
            >
              <MinusCircle className="w-3.5 h-3.5 text-slate-400" /> Leave blank
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface PdfPageProps {
  page: number;
  fields: ReviewField[];
  highlightedId: string | null;
  onClickChip: (id: string) => void;
}
function PdfPage({ page, fields, highlightedId, onClickChip }: PdfPageProps) {
  const pageFields = fields.filter(f => f.page === page);

  const PAGE_SECTION_LABELS: Record<number, Array<{ y: number; label: string }>> = {
    1: [
      { y: 10,  label: "1. Account Type" },
      { y: 20,  label: "2. Funding Method" },
      { y: 34,  label: "3. Personal Information" },
      { y: 56,  label: "3. cont." },
      { y: 70,  label: "Referral / How Did You Hear" },
      { y: 77,  label: "4. Account Set-Up Fee / Payment" },
    ],
    2: [
      { y: 13,  label: "5. Beneficiaries" },
      { y: 75,  label: "6. Spousal Consent" },
      { y: 89,  label: "7. Signature" },
    ],
    3: [
      { y: 8,   label: "8. Acknowledgements & Agreement" },
    ],
  };

  return (
    <div className="relative bg-white rounded shadow-md border border-slate-200 mx-auto"
      style={{ width: "100%", paddingBottom: "133%" }}>
      {/* Page header bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-medium text-slate-500">New Direction IRA — Application</span>
        </div>
        <span className="text-[10px] text-slate-400">p. {page} of 3</span>
      </div>

      {/* Section labels */}
      {(PAGE_SECTION_LABELS[page] || []).map(s => (
        <div
          key={s.label}
          className="absolute left-0 right-0 flex items-center"
          style={{ top: `calc(${s.y}% + 28px)` }}
        >
          <div className="h-px flex-1 bg-slate-100 ml-3 mr-2" />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap pr-3">
            {s.label}
          </span>
        </div>
      ))}

      {/* Field chips */}
      {pageFields.map(field => {
        const pos = FIELD_POSITIONS[field.id];
        if (!pos) return null;
        const { bg, text, border } = chipColor(field.status, field.confidence);
        const label = chipLabel(field);
        const isHighlighted = highlightedId === field.id;
        return (
          <button
            key={field.id}
            onClick={() => onClickChip(field.id)}
            title={`${field.pdfName}${field.selectedMatch ? ` → ${field.selectedMatch.label}` : ""}`}
            className={`absolute flex items-center overflow-hidden rounded border text-left transition-all
              ${bg} ${text} ${border}
              ${isHighlighted ? "ring-2 ring-offset-1 ring-blue-500 z-20" : "z-10"}
              ${field.status === "deferred" ? "animate-pulse-slow" : ""}
              hover:z-20 hover:shadow-md`}
            style={{
              left: `${pos.x}%`,
              top: `calc(${pos.y}% + 28px)`,
              width: `${pos.w}%`,
              height: `${pos.h}%`,
              minHeight: "14px",
              fontSize: "9px",
              lineHeight: "1.2",
              padding: "1px 4px",
            }}
          >
            {field.status === "deferred" && (
              <Flag className="w-2 h-2 flex-shrink-0 mr-0.5" style={{ width: 8, height: 8 }} />
            )}
            {field.edgeCases.includes("prefilled") && field.status !== "deferred" && (
              <Zap className="flex-shrink-0 mr-0.5" style={{ width: 8, height: 8 }} />
            )}
            {field.pdfType === "radio" && field.status !== "deferred" && (
              <LayoutGrid className="flex-shrink-0 mr-0.5" style={{ width: 8, height: 8 }} />
            )}
            <span className="truncate font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  fields: ReviewField[];
  onBack: () => void;
}

export function VisualMapper({ fields: initialFields, onBack }: Props) {
  const [fields, setFields] = useState<ReviewField[]>(initialFields);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const deferred = fields.filter(f => f.status === "deferred");
  const confirmed = fields.filter(f => f.status === "confirmed");
  const blank     = fields.filter(f => f.status === "blank");
  const canFinish = deferred.length === 0;

  const assignField = (id: string, match: LibraryField) => {
    setFields(prev => prev.map(f => f.id !== id ? f : {
      ...f, selectedMatch: match, status: "confirmed", touched: true,
    }));
  };

  const blankField = (id: string) => {
    setFields(prev => prev.map(f => f.id !== id ? f : {
      ...f, selectedMatch: null, status: "blank", touched: true,
    }));
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Mapping complete</h2>
          <p className="text-slate-500 mb-8">
            {confirmed.length} fields mapped, {blank.length} left blank. This template is ready to use.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-8 text-center">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-900">{confirmed.length}</p>
              <p className="text-xs text-slate-500 mt-1">Fields mapped</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-900">{blank.length}</p>
              <p className="text-xs text-slate-500 mt-1">Left blank</p>
            </div>
          </div>
          <button
            onClick={() => setDone(false)}
            className="text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Back to mapper
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Review
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium leading-none mb-0.5">Visual Mapper</p>
              <p className="text-sm font-semibold text-slate-900 leading-none">Application_1778347711374.pdf</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span className="font-semibold text-slate-900">{confirmed.length}</span> mapped
            </span>
            {deferred.length > 0 && (
              <span className="flex items-center gap-1.5 text-orange-700 font-medium">
                <Flag className="w-3.5 h-3.5" />
                {deferred.length} need assignment
              </span>
            )}
            {blank.length > 0 && (
              <span className="flex items-center gap-1.5 text-slate-500">
                <MinusCircle className="w-3.5 h-3.5" />
                {blank.length} blank
              </span>
            )}
          </div>
          <button
            onClick={() => canFinish && setDone(true)}
            disabled={!canFinish}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${canFinish
                ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
          >
            <CheckCheck className="w-4 h-4" />
            Complete mapping
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-slate-800 text-slate-300 text-xs px-6 py-2 flex items-center gap-6">
        <span className="text-slate-500 font-medium">Legend</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Confirmed — pre-filled from review</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block" /> Flagged — assign in right panel</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" /> Blank — not mapped</span>
        <span className="ml-auto text-slate-500">Click any chip to highlight it in the panel →</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* Left — PDF schematic */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-8 max-w-md mx-auto">
            {[1, 2, 3].map(page => {
              const pageFields = fields.filter(f => f.page === page);
              if (pageFields.length === 0 && page === 3 && !fields.find(f => f.page === 3)) return null;
              return (
                <div key={page}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                    Page {page}
                  </p>
                  <PdfPage
                    page={page}
                    fields={fields}
                    highlightedId={highlightedId}
                    onClickChip={id => setHighlightedId(prev => prev === id ? null : id)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — Assignment panel */}
        <div className="w-96 border-l border-slate-200 bg-white flex flex-col overflow-hidden">

          {/* Deferred attention section */}
          {deferred.length > 0 ? (
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-4 border-b border-orange-100 bg-orange-50">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <p className="text-sm font-semibold text-orange-900">
                    {deferred.length} field{deferred.length !== 1 ? "s" : ""} need assignment
                  </p>
                </div>
                <p className="text-xs text-orange-700 leading-relaxed">
                  These were flagged during review. Click any chip on the PDF to locate it, then assign it below.
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {deferred.map(field => (
                  <div
                    key={field.id}
                    className={`px-5 py-4 transition-all ${highlightedId === field.id ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-slate-50"}`}
                    onClick={() => setHighlightedId(prev => prev === field.id ? null : field.id)}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Flag className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-mono font-semibold text-slate-800 truncate" title={field.pdfName}>
                          {field.pdfName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400 capitalize">{field.pdfType}</span>
                          <span className="text-slate-200">·</span>
                          <span className="text-xs text-slate-400">p. {field.page}</span>
                          {field.prefilledValue && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span className="text-xs text-teal-700 font-medium flex items-center gap-0.5">
                                <Zap className="w-2.5 h-2.5" />"{field.prefilledValue}"
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      <AssignDropdown
                        field={field}
                        onAssign={match => { assignField(field.id, match); setHighlightedId(null); }}
                        onBlank={() => { blankField(field.id); setHighlightedId(null); }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-5 py-6 border-b border-emerald-100 bg-emerald-50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">All fields assigned</p>
              </div>
              <p className="text-xs text-emerald-700 mt-1">
                Click "Complete mapping" to save this template.
              </p>
            </div>
          )}

          {/* Confirmed fields summary */}
          <div className="border-t border-slate-100">
            <details className="group">
              <summary className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors list-none">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium text-slate-700">
                    {confirmed.length} mapped from review
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="border-t border-slate-100 max-h-60 overflow-y-auto">
                {[1, 2, 3].map(page => {
                  const pageConfirmed = confirmed.filter(f => f.page === page);
                  if (!pageConfirmed.length) return null;
                  return (
                    <div key={page}>
                      <div className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50">
                        Page {page}
                      </div>
                      {pageConfirmed.map(field => (
                        <button
                          key={field.id}
                          onClick={() => setHighlightedId(prev => prev === field.id ? null : field.id)}
                          className={`w-full flex items-center gap-3 px-5 py-2 text-left hover:bg-slate-50 transition-colors
                            ${highlightedId === field.id ? "bg-blue-50" : ""}`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-mono text-slate-600 truncate">{field.pdfName}</p>
                            <p className="text-[11px] text-emerald-700 font-medium truncate">→ {field.selectedMatch?.label}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </details>
          </div>

          {/* Blank summary */}
          {blank.length > 0 && (
            <div className="border-t border-slate-100">
              <details className="group">
                <summary className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50 list-none">
                  <div className="flex items-center gap-2">
                    <MinusCircle className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-500">{blank.length} left blank</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="border-t border-slate-100">
                  {blank.map(field => (
                    <div key={field.id} className="flex items-center gap-3 px-5 py-2">
                      <MinusCircle className="w-3 h-3 text-slate-300 flex-shrink-0" />
                      <p className="text-[11px] font-mono text-slate-400 truncate">{field.pdfName}</p>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
