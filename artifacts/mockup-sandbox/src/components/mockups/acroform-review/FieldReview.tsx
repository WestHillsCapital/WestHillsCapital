import { useState, useRef, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
  Search,
  FileText,
  AlertTriangle,
  CopyCheck,
  Signature,
  LayoutGrid,
  MapPin,
  SkipForward,
  RotateCcw,
  ArrowRight,
} from "lucide-react";

type ConfidenceTier = "high" | "medium" | "low";
type FieldStatus = "confirmed" | "needs-review" | "skipped" | "unused";
type EdgeCase = "off-page" | "duplicate" | "checkbox-group" | "signature";

interface LibraryField {
  id: string;
  label: string;
  key: string;
  category: string;
}

interface ReviewField {
  id: string;
  pdfName: string;
  pdfType: "text" | "checkbox" | "radio" | "signature" | "select";
  page: number;
  confidence: ConfidenceTier;
  suggestedMatch: LibraryField | null;
  selectedMatch: LibraryField | null;
  status: FieldStatus;
  edgeCases: EdgeCase[];
  touched: boolean;
}

const LIBRARY_FIELDS: LibraryField[] = [
  { id: "borrower_first_name", label: "Borrower First Name", key: "borrower_first_name", category: "Borrower" },
  { id: "borrower_last_name", label: "Borrower Last Name", key: "borrower_last_name", category: "Borrower" },
  { id: "borrower_full_name", label: "Borrower Full Name", key: "borrower_full_name", category: "Borrower" },
  { id: "co_borrower_name", label: "Co-Borrower Full Name", key: "co_borrower_name", category: "Borrower" },
  { id: "date_signed", label: "Date Signed", key: "date_signed", category: "Dates" },
  { id: "loan_origination_date", label: "Loan Origination Date", key: "loan_origination_date", category: "Dates" },
  { id: "closing_date", label: "Closing Date", key: "closing_date", category: "Dates" },
  { id: "property_address", label: "Property Address", key: "property_address", category: "Property" },
  { id: "property_city", label: "Property City", key: "property_city", category: "Property" },
  { id: "property_state", label: "Property State", key: "property_state", category: "Property" },
  { id: "property_zip", label: "Property ZIP", key: "property_zip", category: "Property" },
  { id: "loan_amount", label: "Loan Amount", key: "loan_amount", category: "Loan" },
  { id: "interest_rate", label: "Interest Rate", key: "interest_rate", category: "Loan" },
  { id: "loan_term_months", label: "Loan Term (months)", key: "loan_term_months", category: "Loan" },
  { id: "monthly_payment", label: "Monthly Payment", key: "monthly_payment", category: "Loan" },
  { id: "email", label: "Email Address", key: "email", category: "Contact" },
  { id: "phone_number", label: "Phone Number", key: "phone_number", category: "Contact" },
  { id: "ssn_last4", label: "SSN (last 4)", key: "ssn_last4", category: "Identity" },
  { id: "borrower_signature", label: "Borrower Signature", key: "borrower_signature", category: "Signatures" },
  { id: "co_borrower_signature", label: "Co-Borrower Signature", key: "co_borrower_signature", category: "Signatures" },
  { id: "notary_acknowledgment", label: "Notary Acknowledgment", key: "notary_acknowledgment", category: "Signatures" },
  { id: "owns_property", label: "Currently Owns Property?", key: "owns_property", category: "Disclosures" },
  { id: "primary_residence", label: "Primary Residence?", key: "primary_residence", category: "Disclosures" },
];

const INITIAL_FIELDS: ReviewField[] = [
  {
    id: "f1", pdfName: "BorrowerFirstName", pdfType: "text", page: 1,
    confidence: "high",
    suggestedMatch: LIBRARY_FIELDS.find(f => f.id === "borrower_first_name")!,
    selectedMatch: LIBRARY_FIELDS.find(f => f.id === "borrower_first_name")!,
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f2", pdfName: "BorrowerLastName", pdfType: "text", page: 1,
    confidence: "high",
    suggestedMatch: LIBRARY_FIELDS.find(f => f.id === "borrower_last_name")!,
    selectedMatch: LIBRARY_FIELDS.find(f => f.id === "borrower_last_name")!,
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f3", pdfName: "Email", pdfType: "text", page: 1,
    confidence: "high",
    suggestedMatch: LIBRARY_FIELDS.find(f => f.id === "email")!,
    selectedMatch: LIBRARY_FIELDS.find(f => f.id === "email")!,
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f4", pdfName: "Date", pdfType: "text", page: 1,
    confidence: "medium",
    suggestedMatch: LIBRARY_FIELDS.find(f => f.id === "loan_origination_date")!,
    selectedMatch: LIBRARY_FIELDS.find(f => f.id === "loan_origination_date")!,
    status: "needs-review", edgeCases: [], touched: false,
  },
  {
    id: "f5", pdfName: "PrintedName", pdfType: "text", page: 2,
    confidence: "medium",
    suggestedMatch: LIBRARY_FIELDS.find(f => f.id === "borrower_full_name")!,
    selectedMatch: LIBRARY_FIELDS.find(f => f.id === "borrower_full_name")!,
    status: "needs-review", edgeCases: [], touched: false,
  },
  {
    id: "f6", pdfName: "PropertyAddress", pdfType: "text", page: 2,
    confidence: "high",
    suggestedMatch: LIBRARY_FIELDS.find(f => f.id === "property_address")!,
    selectedMatch: LIBRARY_FIELDS.find(f => f.id === "property_address")!,
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f7", pdfName: "LoanAmount", pdfType: "text", page: 2,
    confidence: "high",
    suggestedMatch: LIBRARY_FIELDS.find(f => f.id === "loan_amount")!,
    selectedMatch: LIBRARY_FIELDS.find(f => f.id === "loan_amount")!,
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f8", pdfName: "field_12", pdfType: "text", page: 3,
    confidence: "low",
    suggestedMatch: null,
    selectedMatch: null,
    status: "needs-review", edgeCases: [], touched: false,
  },
  {
    id: "f9", pdfName: "Signer", pdfType: "text", page: 3,
    confidence: "low",
    suggestedMatch: null,
    selectedMatch: null,
    status: "needs-review", edgeCases: [], touched: false,
  },
  {
    id: "f10", pdfName: "Date", pdfType: "text", page: 3,
    confidence: "medium",
    suggestedMatch: LIBRARY_FIELDS.find(f => f.id === "closing_date")!,
    selectedMatch: LIBRARY_FIELDS.find(f => f.id === "closing_date")!,
    status: "needs-review", edgeCases: ["duplicate"], touched: false,
  },
  {
    id: "f11", pdfName: "OccupancyType", pdfType: "radio", page: 3,
    confidence: "medium",
    suggestedMatch: LIBRARY_FIELDS.find(f => f.id === "primary_residence")!,
    selectedMatch: LIBRARY_FIELDS.find(f => f.id === "primary_residence")!,
    status: "needs-review", edgeCases: ["checkbox-group"], touched: false,
  },
  {
    id: "f12", pdfName: "BorrowerSignature", pdfType: "signature", page: 4,
    confidence: "high",
    suggestedMatch: LIBRARY_FIELDS.find(f => f.id === "borrower_signature")!,
    selectedMatch: LIBRARY_FIELDS.find(f => f.id === "borrower_signature")!,
    status: "needs-review", edgeCases: ["signature"], touched: false,
  },
  {
    id: "f13", pdfName: "Text23", pdfType: "text", page: 4,
    confidence: "low",
    suggestedMatch: null,
    selectedMatch: null,
    status: "needs-review", edgeCases: ["off-page"], touched: false,
  },
  {
    id: "f14", pdfName: "InterestRate", pdfType: "text", page: 4,
    confidence: "high",
    suggestedMatch: LIBRARY_FIELDS.find(f => f.id === "interest_rate")!,
    selectedMatch: LIBRARY_FIELDS.find(f => f.id === "interest_rate")!,
    status: "confirmed", edgeCases: [], touched: true,
  },
];

function ConfidenceDot({ tier }: { tier: ConfidenceTier }) {
  if (tier === "high") return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Auto-confirmed</span>;
  if (tier === "medium") return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Verify</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Needs action</span>;
}

function EdgeCaseBadge({ type }: { type: EdgeCase }) {
  const map: Record<EdgeCase, { icon: React.ReactNode; label: string; color: string }> = {
    "off-page": { icon: <MapPin className="w-3 h-3" />, label: "Off-page", color: "text-orange-600 bg-orange-50 border-orange-200" },
    "duplicate": { icon: <CopyCheck className="w-3 h-3" />, label: "Duplicate name", color: "text-purple-600 bg-purple-50 border-purple-200" },
    "checkbox-group": { icon: <LayoutGrid className="w-3 h-3" />, label: "Radio group", color: "text-blue-600 bg-blue-50 border-blue-200" },
    "signature": { icon: <Signature className="w-3 h-3" />, label: "E-sign field", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
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
  if (type === "checkbox") return <CheckCircle2 className={`${base} text-blue-500`} />;
  if (type === "radio") return <LayoutGrid className={`${base} text-blue-500`} />;
  return <FileText className={`${base} text-slate-400`} />;
}

interface DropdownProps {
  field: ReviewField;
  onSelect: (libraryField: LibraryField | null) => void;
  onSkip: () => void;
  autoFocus?: boolean;
}

function LibraryDropdown({ field, onSelect, onSkip, autoFocus }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      setOpen(true);
    }
  }, [autoFocus]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = field.selectedMatch;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setOpen(o => !o); } }}
        className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border w-full text-left transition-all
          ${current
            ? field.confidence === "high" && field.touched
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-white border-slate-300 text-slate-800 hover:border-slate-400"
            : "bg-red-50 border-red-200 text-red-700 hover:border-red-400"
          }
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
      >
        <span className="flex-1 truncate font-medium">
          {current ? current.label : "— Select library field —"}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape") { setOpen(false); setQuery(""); }
                  if (e.key === "Enter" && filtered.length === 1) {
                    onSelect(filtered[0]);
                    setOpen(false);
                    setQuery("");
                  }
                }}
                placeholder="Search fields…"
                className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {Object.entries(grouped).map(([category, fields]) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 sticky top-0">
                  {category}
                </div>
                {fields.map(f => (
                  <button
                    key={f.id}
                    onClick={() => { onSelect(f); setOpen(false); setQuery(""); }}
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
          <div className="border-t border-slate-100 p-2 flex gap-2">
            <button
              onClick={() => { onSelect(null); onSkip(); setOpen(false); setQuery(""); }}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded hover:bg-slate-100 transition-colors"
            >
              <SkipForward className="w-3 h-3" /> Mark unused
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FieldReview() {
  const [fields, setFields] = useState<ReviewField[]>(INITIAL_FIELDS);
  const [focusedRow, setFocusedRow] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const requiresAction = (f: ReviewField) =>
    (f.confidence === "medium" || f.confidence === "low") && !f.touched && f.status !== "skipped" && f.status !== "unused";

  const blockers = fields.filter(requiresAction);
  const confirmed = fields.filter(f => f.status === "confirmed").length;
  const unused = fields.filter(f => f.status === "unused" || f.status === "skipped").length;
  const high = fields.filter(f => f.confidence === "high").length;
  const medium = fields.filter(f => f.confidence === "medium").length;
  const low = fields.filter(f => f.confidence === "low").length;
  const canSave = blockers.length === 0;

  const confirmField = useCallback((id: string, match: LibraryField | null) => {
    setFields(prev => prev.map(f => {
      if (f.id !== id) return f;
      return {
        ...f,
        selectedMatch: match,
        status: match ? "confirmed" : "unused",
        touched: true,
      };
    }));
  }, []);

  const skipField = useCallback((id: string) => {
    setFields(prev => prev.map(f => {
      if (f.id !== id) return f;
      return { ...f, status: "unused", touched: true };
    }));
  }, []);

  const resetField = useCallback((id: string) => {
    setFields(prev => prev.map(f => {
      if (f.id !== id) return f;
      return { ...f, status: f.confidence === "high" ? "confirmed" : "needs-review", touched: f.confidence === "high", selectedMatch: f.suggestedMatch };
    }));
  }, []);

  if (saved) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Review complete</h2>
          <p className="text-slate-500 mb-6">
            {confirmed} fields mapped, {unused} marked unused. Your package is ready in the Visual Mapper with all fields pre-positioned.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setSaved(false)}
              className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Back to review
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              <p className="text-sm font-semibold text-slate-900">Uniform_Residential_Loan_Application.pdf</p>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-900">{high}</span> auto-confirmed
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="font-medium text-slate-900">{medium}</span> verify
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="font-medium text-slate-900">{low}</span> need action
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {blockers.length > 0 && (
            <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {blockers.length} field{blockers.length !== 1 ? "s" : ""} still need attention
            </span>
          )}
          <button
            onClick={() => canSave && setSaved(true)}
            disabled={!canSave}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all
              ${canSave
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm cursor-pointer"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
          >
            Confirm mappings
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="bg-slate-900 text-slate-300 text-xs px-8 py-2 flex items-center gap-6">
        <span className="text-slate-500 font-medium">Keyboard shortcuts</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">Tab</kbd> next row</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">Space</kbd> open dropdown</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">Enter</kbd> confirm selection</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">Esc</kbd> close</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[28px_180px_90px_72px_1fr_160px_100px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <div></div>
            <div>PDF Field</div>
            <div>Type</div>
            <div>Page</div>
            <div>Library Match</div>
            <div>Confidence</div>
            <div>Status</div>
          </div>

          {/* Rows */}
          {fields.map((field) => {
            const isFocused = focusedRow === field.id;
            const isBlocker = requiresAction(field);
            const isUnused = field.status === "unused";

            return (
              <div
                key={field.id}
                onClick={() => setFocusedRow(isFocused ? null : field.id)}
                className={`grid grid-cols-[28px_180px_90px_72px_1fr_160px_100px] gap-4 px-5 py-3.5 border-b border-slate-100 last:border-0 transition-all cursor-pointer items-center
                  ${isBlocker ? "bg-red-50/40 hover:bg-red-50/70" : ""}
                  ${field.confidence === "medium" && !isBlocker && !isUnused ? "bg-amber-50/30 hover:bg-amber-50/50" : ""}
                  ${field.confidence === "high" && !isBlocker ? "hover:bg-slate-50/80" : ""}
                  ${isUnused ? "opacity-50 bg-slate-50/50" : ""}
                  ${isFocused ? "ring-2 ring-inset ring-blue-400" : ""}
                `}
              >
                {/* Status icon */}
                <div className="flex items-center justify-center">
                  {isUnused
                    ? <XCircle className="w-4 h-4 text-slate-300" />
                    : field.status === "confirmed" && field.touched
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : isBlocker
                    ? <AlertCircle className="w-4 h-4 text-red-400" />
                    : <AlertCircle className="w-4 h-4 text-amber-400" />
                  }
                </div>

                {/* PDF field name */}
                <div className="min-w-0">
                  <p className={`text-sm font-mono font-medium truncate ${isUnused ? "text-slate-400 line-through" : "text-slate-800"}`}>
                    {field.pdfName}
                  </p>
                  {field.edgeCases.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {field.edgeCases.map(ec => <EdgeCaseBadge key={ec} type={ec} />)}
                    </div>
                  )}
                </div>

                {/* Field type */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FieldTypeIcon type={field.pdfType} />
                  <span className="capitalize">{field.pdfType}</span>
                </div>

                {/* Page */}
                <div className={`text-sm font-medium ${field.edgeCases.includes("off-page") ? "text-orange-600" : "text-slate-500"}`}>
                  {field.edgeCases.includes("off-page") ? (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />p.{field.page}</span>
                  ) : (
                    `p. ${field.page}`
                  )}
                </div>

                {/* Library match dropdown */}
                <div onClick={e => e.stopPropagation()}>
                  {isUnused ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400 italic">Not included in interview</span>
                      <button
                        onClick={() => resetField(field.id)}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        Re-enable
                      </button>
                    </div>
                  ) : (
                    <LibraryDropdown
                      field={field}
                      onSelect={(match) => confirmField(field.id, match)}
                      onSkip={() => skipField(field.id)}
                      autoFocus={isFocused && isBlocker}
                    />
                  )}
                </div>

                {/* Confidence */}
                <div>
                  <ConfidenceDot tier={field.confidence} />
                </div>

                {/* Status */}
                <div>
                  {isUnused ? (
                    <span className="text-xs text-slate-400 font-medium">Unused</span>
                  ) : field.status === "confirmed" && field.touched ? (
                    <span className="text-xs text-emerald-700 font-medium">Confirmed</span>
                  ) : isBlocker ? (
                    <span className="text-xs text-red-600 font-medium">Required</span>
                  ) : (
                    <span className="text-xs text-amber-600 font-medium">Pending</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress summary */}
        <div className="mt-4 flex items-center gap-6 text-sm text-slate-500">
          <span>{confirmed} of {fields.length} confirmed</span>
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${(confirmed / fields.length) * 100}%` }}
            />
          </div>
          {unused > 0 && <span>{unused} marked unused</span>}
          {blockers.length > 0 && (
            <span className="text-red-600 font-medium">{blockers.length} blocking</span>
          )}
        </div>
      </div>
    </div>
  );
}
