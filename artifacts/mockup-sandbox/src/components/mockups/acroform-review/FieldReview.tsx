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
  RotateCcw,
  ArrowRight,
  MinusCircle,
  ArrowUpRight,
  Eye,
  Zap,
} from "lucide-react";

type ConfidenceTier = "high" | "medium" | "low";
type FieldStatus = "confirmed" | "needs-review" | "deferred" | "blank";
type EdgeCase = "off-page" | "duplicate" | "checkbox-group" | "signature" | "prefilled";

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
  prefilledValue?: string;
}

const LIBRARY_FIELDS: LibraryField[] = [
  // Applicant
  { id: "applicant_ssn", label: "Applicant SSN", key: "applicant_ssn", category: "Applicant" },
  { id: "applicant_dob", label: "Date of Birth", key: "applicant_dob", category: "Applicant" },
  { id: "applicant_title", label: "Applicant Title (Mr/Ms/Dr)", key: "applicant_title", category: "Applicant" },
  { id: "applicant_legal_name", label: "Legal Name", key: "applicant_legal_name", category: "Applicant" },
  { id: "applicant_printed_name", label: "Printed Name", key: "applicant_printed_name", category: "Applicant" },
  { id: "marital_status", label: "Marital Status", key: "marital_status", category: "Applicant" },
  // Contact
  { id: "email", label: "Email Address", key: "email", category: "Contact" },
  { id: "phone_home", label: "Home Phone", key: "phone_home", category: "Contact" },
  { id: "phone_cell", label: "Cell Phone", key: "phone_cell", category: "Contact" },
  { id: "fax", label: "Fax Number", key: "fax", category: "Contact" },
  { id: "address_physical", label: "Physical Address", key: "address_physical", category: "Contact" },
  { id: "address_mailing", label: "Mailing Address", key: "address_mailing", category: "Contact" },
  { id: "city", label: "City", key: "city", category: "Contact" },
  { id: "state", label: "State", key: "state", category: "Contact" },
  { id: "zip", label: "ZIP Code", key: "zip", category: "Contact" },
  // Account
  { id: "account_type", label: "Account Type (IRA/HSA)", key: "account_type", category: "Account" },
  { id: "funding_method", label: "Funding Method", key: "funding_method", category: "Account" },
  { id: "contribution_year", label: "Contribution Year", key: "contribution_year", category: "Account" },
  { id: "employer_name", label: "Employer Name", key: "employer_name", category: "Account" },
  // Payment
  { id: "cc_type", label: "Credit Card Type", key: "cc_type", category: "Payment" },
  { id: "cc_number", label: "Card Number", key: "cc_number", category: "Payment" },
  { id: "cc_expiration", label: "Card Expiration Date", key: "cc_expiration", category: "Payment" },
  { id: "cc_name", label: "Name on Card", key: "cc_name", category: "Payment" },
  { id: "cc_cvv", label: "Card Security Code (CVV)", key: "cc_cvv", category: "Payment" },
  { id: "payment_method", label: "Payment Method", key: "payment_method", category: "Payment" },
  // Beneficiary
  { id: "ben1_name", label: "Beneficiary 1 — Name", key: "ben1_name", category: "Beneficiary" },
  { id: "ben1_type", label: "Beneficiary 1 — Primary / Contingent", key: "ben1_type", category: "Beneficiary" },
  { id: "ben1_relationship", label: "Beneficiary 1 — Relationship", key: "ben1_relationship", category: "Beneficiary" },
  { id: "ben1_ssn", label: "Beneficiary 1 — SSN", key: "ben1_ssn", category: "Beneficiary" },
  { id: "ben1_dob", label: "Beneficiary 1 — Date of Birth", key: "ben1_dob", category: "Beneficiary" },
  { id: "ben1_share", label: "Beneficiary 1 — Share %", key: "ben1_share", category: "Beneficiary" },
  // Advisor / Agent
  { id: "advisor_name", label: "Advisor / Agent Name", key: "advisor_name", category: "Advisor" },
  { id: "referral_source", label: "Referral Source", key: "referral_source", category: "Advisor" },
  { id: "coupon_code", label: "Coupon Code", key: "coupon_code", category: "Advisor" },
  // Signatures & Dates
  { id: "date_signed", label: "Date Signed", key: "date_signed", category: "Signatures" },
  { id: "applicant_signature", label: "Applicant Signature", key: "applicant_signature", category: "Signatures" },
  { id: "spouse_name", label: "Spouse Name (Consent)", key: "spouse_name", category: "Signatures" },
  { id: "spouse_signature", label: "Spouse Signature", key: "spouse_signature", category: "Signatures" },
  { id: "email_notifications", label: "Email Notifications Preference", key: "email_notifications", category: "Communication" },
];

const lf = (id: string) => LIBRARY_FIELDS.find(f => f.id === id)!;

const INITIAL_FIELDS: ReviewField[] = [
  // ── HIGH CONFIDENCE ──────────────────────────────────────────────
  {
    id: "f1", pdfName: "Social Security Number", pdfType: "text", page: 1,
    confidence: "high",
    suggestedMatch: lf("applicant_ssn"), selectedMatch: lf("applicant_ssn"),
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f2", pdfName: "Date of Birth MMDDYYYY", pdfType: "text", page: 1,
    confidence: "high",
    suggestedMatch: lf("applicant_dob"), selectedMatch: lf("applicant_dob"),
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f3", pdfName: "Email Address", pdfType: "text", page: 1,
    confidence: "high",
    suggestedMatch: lf("email"), selectedMatch: lf("email"),
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f4", pdfName: "Physical Address", pdfType: "text", page: 1,
    confidence: "high",
    suggestedMatch: lf("address_physical"), selectedMatch: lf("address_physical"),
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f5", pdfName: "Home Phone Number", pdfType: "text", page: 1,
    confidence: "high",
    suggestedMatch: lf("phone_home"), selectedMatch: lf("phone_home"),
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f6", pdfName: "Cell Phone", pdfType: "text", page: 1,
    confidence: "high",
    suggestedMatch: lf("phone_cell"), selectedMatch: lf("phone_cell"),
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f7", pdfName: "Card Number", pdfType: "text", page: 1,
    confidence: "high",
    suggestedMatch: lf("cc_number"), selectedMatch: lf("cc_number"),
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f8", pdfName: "Exp Date", pdfType: "text", page: 1,
    confidence: "high",
    suggestedMatch: lf("cc_expiration"), selectedMatch: lf("cc_expiration"),
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f9", pdfName: "3 Digit Security Code", pdfType: "text", page: 1,
    confidence: "high",
    suggestedMatch: lf("cc_cvv"), selectedMatch: lf("cc_cvv"),
    status: "confirmed", edgeCases: [], touched: true,
  },
  {
    id: "f10", pdfName: "Printed Name", pdfType: "text", page: 2,
    confidence: "high",
    suggestedMatch: lf("applicant_printed_name"), selectedMatch: lf("applicant_printed_name"),
    status: "confirmed", edgeCases: [], touched: true,
  },

  // ── MEDIUM CONFIDENCE ─────────────────────────────────────────────
  {
    id: "f11", pdfName: "Date", pdfType: "text", page: 1,
    confidence: "medium",
    suggestedMatch: lf("date_signed"), selectedMatch: lf("date_signed"),
    status: "needs-review", edgeCases: ["duplicate"], touched: false,
  },
  {
    id: "f12", pdfName: "Exact Name on Card", pdfType: "text", page: 1,
    confidence: "medium",
    suggestedMatch: lf("cc_name"), selectedMatch: lf("cc_name"),
    status: "needs-review", edgeCases: ["prefilled"], touched: false,
    prefilledValue: "West Hills Capital",
  },
  {
    id: "f13", pdfName: "Mailing Address If different from Physical Address", pdfType: "text", page: 1,
    confidence: "medium",
    suggestedMatch: lf("address_mailing"), selectedMatch: lf("address_mailing"),
    status: "needs-review", edgeCases: [], touched: false,
  },
  {
    id: "f14", pdfName: "Account Type", pdfType: "radio", page: 1,
    confidence: "medium",
    suggestedMatch: lf("account_type"), selectedMatch: lf("account_type"),
    status: "needs-review", edgeCases: ["checkbox-group"], touched: false,
  },
  {
    id: "f15", pdfName: "Fund How", pdfType: "radio", page: 1,
    confidence: "medium",
    suggestedMatch: lf("funding_method"), selectedMatch: lf("funding_method"),
    status: "needs-review", edgeCases: ["checkbox-group", "prefilled"], touched: false,
    prefilledValue: "Transfer",
  },
  {
    id: "f16", pdfName: "Contribution Year", pdfType: "text", page: 1,
    confidence: "medium",
    suggestedMatch: lf("contribution_year"), selectedMatch: lf("contribution_year"),
    status: "needs-review", edgeCases: [], touched: false,
  },
  {
    id: "f17", pdfName: "SingleorMarried", pdfType: "radio", page: 1,
    confidence: "medium",
    suggestedMatch: lf("marital_status"), selectedMatch: lf("marital_status"),
    status: "needs-review", edgeCases: ["checkbox-group"], touched: false,
  },
  {
    id: "f18", pdfName: "Name", pdfType: "text", page: 2,
    confidence: "medium",
    suggestedMatch: lf("ben1_name"), selectedMatch: lf("ben1_name"),
    status: "needs-review", edgeCases: ["duplicate"], touched: false,
  },
  {
    id: "f19", pdfName: "Relationship", pdfType: "text", page: 2,
    confidence: "medium",
    suggestedMatch: lf("ben1_relationship"), selectedMatch: lf("ben1_relationship"),
    status: "needs-review", edgeCases: ["duplicate"], touched: false,
  },
  {
    id: "f20", pdfName: "Beneficiary Group 1", pdfType: "radio", page: 2,
    confidence: "medium",
    suggestedMatch: lf("ben1_type"), selectedMatch: lf("ben1_type"),
    status: "needs-review", edgeCases: ["checkbox-group"], touched: false,
  },
  {
    id: "f21", pdfName: "Date_2", pdfType: "text", page: 2,
    confidence: "medium",
    suggestedMatch: lf("date_signed"), selectedMatch: lf("date_signed"),
    status: "needs-review", edgeCases: ["duplicate"], touched: false,
  },

  // ── LOW CONFIDENCE ────────────────────────────────────────────────
  {
    id: "f22", pdfName: "undefined", pdfType: "text", page: 1,
    confidence: "low",
    suggestedMatch: null, selectedMatch: null,
    status: "needs-review", edgeCases: [], touched: false,
  },
  {
    id: "f23", pdfName: "undefined_2", pdfType: "text", page: 1,
    confidence: "low",
    suggestedMatch: null, selectedMatch: null,
    status: "needs-review", edgeCases: [], touched: false,
  },
  {
    id: "f24", pdfName: "Email Notifications with Account Changes Yes No", pdfType: "text", page: 1,
    confidence: "low",
    suggestedMatch: lf("email_notifications"), selectedMatch: null,
    status: "needs-review", edgeCases: [], touched: false,
  },
  {
    id: "f25", pdfName: "Married Not Married", pdfType: "text", page: 1,
    confidence: "low",
    suggestedMatch: lf("marital_status"), selectedMatch: null,
    status: "needs-review", edgeCases: [], touched: false,
  },
  {
    id: "f26", pdfName: "By", pdfType: "text", page: 2,
    confidence: "low",
    suggestedMatch: null, selectedMatch: null,
    status: "needs-review", edgeCases: [], touched: false,
  },
  {
    id: "f27", pdfName: "I", pdfType: "text", page: 2,
    confidence: "low",
    suggestedMatch: null, selectedMatch: null,
    status: "needs-review", edgeCases: [], touched: false,
  },
  {
    id: "f28", pdfName: "undefined_9", pdfType: "text", page: 3,
    confidence: "low",
    suggestedMatch: lf("advisor_name"), selectedMatch: null,
    status: "needs-review", edgeCases: ["prefilled"], touched: false,
    prefilledValue: "West Hills Capital",
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
    "checkbox-group": { icon: <LayoutGrid className="w-3 h-3" />, label: "Radio / checkbox group", color: "text-blue-600 bg-blue-50 border-blue-200" },
    "signature": { icon: <Signature className="w-3 h-3" />, label: "E-sign field", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
    "prefilled": { icon: <Zap className="w-3 h-3" />, label: "Pre-filled", color: "text-teal-600 bg-teal-50 border-teal-200" },
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
        setOpen(false);
        setQuery("");
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
    if (field.status === "blank") return "bg-slate-50 border-slate-200 text-slate-500 italic";
    if (current) {
      return field.confidence === "high" && field.touched
        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
        : "bg-white border-slate-300 text-slate-800 hover:border-slate-400";
    }
    return "bg-red-50 border-red-200 text-red-700 hover:border-red-400";
  };

  const triggerLabel = () => {
    if (field.status === "deferred") return "↗ Resolve in mapper";
    if (field.status === "blank") return "Leave blank (no input)";
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
  if (field.status === "confirmed" && field.touched) return (
    <span className="text-xs text-emerald-700 font-medium">Confirmed</span>
  );
  if (field.confidence === "low" && !field.touched) return (
    <span className="text-xs text-red-600 font-medium">Required</span>
  );
  return <span className="text-xs text-amber-600 font-medium">Pending</span>;
}

export function FieldReview() {
  const [fields, setFields] = useState<ReviewField[]>(INITIAL_FIELDS);
  const [focusedRow, setFocusedRow] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const requiresAction = (f: ReviewField) =>
    !f.touched &&
    f.status === "needs-review" &&
    (f.confidence === "medium" || f.confidence === "low");

  const blockers = fields.filter(requiresAction);
  const confirmed = fields.filter(f => f.status === "confirmed").length;
  const deferred = fields.filter(f => f.status === "deferred").length;
  const blank = fields.filter(f => f.status === "blank").length;
  const autoConfirmed = fields.filter(f => f.confidence === "high").length;
  const pendingVerify = fields.filter(f => f.confidence === "medium" && f.status === "needs-review" && !f.touched).length;
  const pendingAction = fields.filter(f => f.confidence === "low" && f.status === "needs-review" && !f.touched).length;
  const canSave = blockers.length === 0;

  const confirmField = useCallback((id: string, match: LibraryField | null) => {
    setFields(prev => prev.map(f => f.id !== id ? f : {
      ...f, selectedMatch: match, status: match ? "confirmed" : "blank", touched: true,
    }));
  }, []);

  const deferField = useCallback((id: string) => {
    setFields(prev => prev.map(f => f.id !== id ? f : {
      ...f, status: "deferred", touched: true,
    }));
  }, []);

  const blankField = useCallback((id: string) => {
    setFields(prev => prev.map(f => f.id !== id ? f : {
      ...f, status: "blank", selectedMatch: null, touched: true,
    }));
  }, []);

  const resetField = useCallback((id: string) => {
    setFields(prev => prev.map(f => f.id !== id ? f : {
      ...f,
      status: f.confidence === "high" ? "confirmed" : "needs-review",
      touched: f.confidence === "high",
      selectedMatch: f.suggestedMatch,
    }));
  }, []);

  if (saved) {
    const deferredList = fields.filter(f => f.status === "deferred");
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 max-w-lg w-full">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2 text-center">Review complete</h2>
          <p className="text-slate-500 mb-6 text-center">
            Opening Visual Mapper with {confirmed} fields pre-placed.
          </p>

          {deferredList.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-orange-600" />
                <p className="text-sm font-semibold text-orange-800">
                  {deferredList.length} field{deferredList.length !== 1 ? "s" : ""} flagged for mapper review
                </p>
              </div>
              <p className="text-xs text-orange-700 mb-3 leading-relaxed">
                These appear in the mapper with an attention flag. Click the field to see its location on the PDF, then assign it from the library panel.
              </p>
              <div className="flex flex-col gap-1">
                {deferredList.map(f => (
                  <div key={f.id} className="flex items-center gap-2 text-xs text-orange-800">
                    <ArrowUpRight className="w-3 h-3" />
                    <span className="font-mono font-medium">{f.pdfName}</span>
                    <span className="text-orange-500">— p. {f.page}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-6 text-center">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xl font-bold text-slate-900">{confirmed}</p>
              <p className="text-xs text-slate-500 mt-0.5">Mapped</p>
            </div>
            {blank > 0 && (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xl font-bold text-slate-900">{blank}</p>
                <p className="text-xs text-slate-500 mt-0.5">Left blank</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setSaved(false)}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 py-2"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Back to review
          </button>
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
          {blockers.length > 0 && (
            <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {blockers.length} field{blockers.length !== 1 ? "s" : ""} still need a decision
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
            const isFocused = focusedRow === field.id;
            const isBlocker = requiresAction(field);
            const isDeferred = field.status === "deferred";
            const isBlank = field.status === "blank";
            const isResolved = field.touched && !isBlocker;

            const rowBg = () => {
              if (isDeferred) return "bg-orange-50/50 hover:bg-orange-50/80";
              if (isBlank) return "bg-slate-50/60 hover:bg-slate-50/90";
              if (isBlocker) return "bg-red-50/40 hover:bg-red-50/70";
              if (field.confidence === "medium" && !isResolved) return "bg-amber-50/30 hover:bg-amber-50/50";
              return "hover:bg-slate-50/80";
            };

            const rowIcon = () => {
              if (isDeferred) return <ArrowUpRight className="w-4 h-4 text-orange-400" />;
              if (isBlank) return <MinusCircle className="w-4 h-4 text-slate-300" />;
              if (field.status === "confirmed" && field.touched) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
              if (isBlocker) return <AlertCircle className="w-4 h-4 text-red-400" />;
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

                <div className="text-sm font-medium text-slate-500">
                  p. {field.page}
                </div>

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
          <span>{confirmed} mapped</span>
          {deferred > 0 && <span className="text-orange-600 font-medium">{deferred} deferred to mapper</span>}
          {blank > 0 && <span>{blank} blank</span>}
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden ml-2">
            <div
              className="h-full rounded-full transition-all duration-300 flex"
              style={{ width: `${((confirmed + deferred + blank) / fields.length) * 100}%` }}
            >
              <div className="h-full bg-emerald-500" style={{ flex: confirmed }} />
              <div className="h-full bg-orange-400" style={{ flex: deferred }} />
              <div className="h-full bg-slate-300" style={{ flex: blank }} />
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
