import { useMemo, useState, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, Minus, X, Lock, ChevronDown, Search, ArrowRight, Info, Zap, TrendingUp, FileText, Flag } from "lucide-react";
import type { FieldItem } from "@/lib/docuplete-types";
import type { FieldLibraryItem } from "@/lib/docuplete-local-types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PendingAnnotation = {
  fieldName: string;
  rect: [number, number, number, number];
  fieldType: string;
  page: number;
  pageW: number;
  pageH: number;
  prefillValue?: string;
};

export type RowChoice =
  | { source: "package"; fieldId: string; label: string }
  | { source: "library"; libraryId: string; label: string }
  | { source: "mapper" }
  | { source: "none" };

type RowDecision = {
  choice: RowChoice;
  autoMatch: RowChoice | null;
  initialScore: number;
  userModified: boolean;
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

const MODIFIER_WORDS = new Set(["client","mailing","physical","account","applicant","signer","legal","primary","secondary","billing","home","work","middle","holder","registered","beneficial","joint","co","current"]);
const STOP_WORDS = new Set(["the","a","an","of","in","for","to","on","at","by","or","and","if"]);
const FORMAT_HINTS = /\s*(mm[\/-]?dd[\/-]?yyyy|mmddyyyy|yyyymmdd|mm\/dd\/yy|\(mm\/dd\/yyyy\))\s*/gi;

function norm(name: string): string {
  return name.toLowerCase().replace(FORMAT_HINTS," ").replace(/\s+-\s+.*$/,"").replace(/_\d+$/,"").replace(/\s+\d+$/,"").replace(/_/g," ").replace(/[^\w\s]/g," ").replace(/\s+/g," ").trim();
}
function stripMods(name: string) { return name.split(" ").filter((w) => !MODIFIER_WORDS.has(w)).join(" ").trim(); }
function acronym(name: string) { return name.split(/\s+/).map((w) => w[0] ?? "").join("").toLowerCase(); }
function meaningfulWords(name: string) { return new Set(name.split(/\s+/).filter((w) => w.length >= 2 && !STOP_WORDS.has(w))); }

function scoreMatch(fieldName: string, pdfName: string): number {
  const nf = norm(fieldName); const np = norm(pdfName);
  if (!nf || !np) return 0;
  if (nf === np) return 100;
  const sf = stripMods(nf); const sp = stripMods(np);
  if (sf === np || nf === sp || sf === sp) return 90;
  if (sf.length >= 2 && np.includes(sf)) return 75;
  if (sp.length >= 2 && nf.includes(sp)) return 75;
  if (nf.includes(np) || np.includes(nf)) return 70;
  if (sf.includes(sp) || sp.includes(sf)) return 70;
  const wf = meaningfulWords(sf); const wp = meaningfulWords(sp);
  if (wf.size > 0 && wp.size > 0) {
    const inter = [...wf].filter((w) => wp.has(w)).length;
    const union = new Set([...wf, ...wp]).size;
    const j = inter / union;
    if (j >= 0.5) return Math.round(40 + j * 30);
  }
  const acf = acronym(nf); const acp = acronym(np);
  if (acf.length >= 2 && acf === np) return 60;
  if (acp.length >= 2 && acp === nf) return 60;
  return 0;
}

function computeInitialDecisions(
  annotations: PendingAnnotation[],
  packageFields: FieldItem[],
  fieldLibrary: FieldLibraryItem[],
): RowDecision[] {
  const usedPkgIds = new Set<string>();
  const usedLibIds = new Set<string>();

  function findBestMatch(fieldName: string): RowChoice | null {
    let bestPkg: FieldItem | undefined; let bestPkgScore = 0;
    for (const f of packageFields) {
      const s = scoreMatch(f.name, fieldName);
      if (s > bestPkgScore) { bestPkgScore = s; bestPkg = f; }
    }
    let bestLib: FieldLibraryItem | undefined; let bestLibScore = 0;
    for (const lib of fieldLibrary) {
      if (!lib.active) continue;
      const s = scoreMatch(lib.label, fieldName);
      if (s > bestLibScore) { bestLibScore = s; bestLib = lib; }
    }
    if (bestPkg && bestPkgScore >= bestLibScore && bestPkgScore > 0)
      return { source: "package", fieldId: bestPkg.id, label: bestPkg.name };
    if (bestLib && bestLibScore > 0)
      return { source: "library", libraryId: bestLib.id, label: bestLib.label };
    return null;
  }

  return annotations.map((ann) => {
    if (ann.prefillValue) return { choice: { source: "none" }, autoMatch: null, initialScore: 0, userModified: false };
    if (!ann.fieldName)   return { choice: { source: "none" }, autoMatch: null, initialScore: 0, userModified: false };

    let bestPkg: FieldItem | undefined; let bestPkgScore = 0;
    for (const f of packageFields) {
      if (usedPkgIds.has(f.id)) continue;
      const s = scoreMatch(f.name, ann.fieldName);
      if (s >= 35 && s > bestPkgScore) { bestPkgScore = s; bestPkg = f; }
    }
    let bestLib: FieldLibraryItem | undefined; let bestLibScore = 0;
    for (const lib of fieldLibrary) {
      if (!lib.active) continue;
      if (usedLibIds.has(lib.id)) continue;
      const s = scoreMatch(lib.label, ann.fieldName);
      if (s >= 35 && s > bestLibScore) { bestLibScore = s; bestLib = lib; }
    }
    if (bestPkg && bestPkgScore >= bestLibScore) {
      usedPkgIds.add(bestPkg.id);
      const choice: RowChoice = { source: "package", fieldId: bestPkg.id, label: bestPkg.name };
      return { choice, autoMatch: choice, initialScore: bestPkgScore, userModified: false };
    }
    if (bestLib) {
      usedLibIds.add(bestLib.id);
      const choice: RowChoice = { source: "library", libraryId: bestLib.id, label: bestLib.label };
      return { choice, autoMatch: choice, initialScore: bestLibScore, userModified: false };
    }
    return { choice: { source: "none" }, autoMatch: findBestMatch(ann.fieldName), initialScore: 0, userModified: false };
  });
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const NAV    = "#0F1C3F";
const CREAM  = "#F8FAFC";
const BORDER = "#E2E8F0";
const MUTED  = "#6B7A99";

const GRID = "24px minmax(140px,1fr) 56px 48px minmax(200px,260px) 128px 108px";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fieldTypeLabel(ft: string): string {
  if (ft === "Tx") return "Text";
  if (ft === "Btn") return "Button";
  if (ft === "Ch") return "Choice";
  if (ft === "Sig") return "Signature";
  return ft || "Text";
}

function statusOf(ann: PendingAnnotation, dec: RowDecision): { label: string; color: string } {
  if (ann.prefillValue) return { label: "Protected", color: "#6B7A99" };
  if (dec.choice.source === "mapper") return { label: "→ Mapper", color: "#D97706" };
  if (dec.choice.source === "none") return { label: "Needs action", color: "#DC2626" };
  if (dec.userModified) return { label: "Confirmed", color: "#059669" };
  if (dec.initialScore >= 75) return { label: "Confirmed", color: "#059669" };
  if (dec.initialScore >= 35) return { label: "Verify", color: "#D97706" };
  return { label: "Confirmed", color: "#059669" };
}

function confidenceLabelOf(ann: PendingAnnotation, dec: RowDecision): { label: string; color: string; bg: string; dot: string } {
  if (ann.prefillValue) return { label: "Pre-filled", color: "#6B7A99", bg: "#F1EEE8", dot: "#9CA3AF" };
  if (dec.choice.source === "mapper") return { label: "Flagged", color: "#D97706", bg: "#FFFBEB", dot: "#F59E0B" };
  if (dec.choice.source === "none") return { label: "Needs action", color: "#DC2626", bg: "#FEF2F2", dot: "#DC2626" };
  if (dec.userModified) return { label: "Auto-confirmed", color: "#059669", bg: "#F0FDF4", dot: "#10B981" };
  if (dec.initialScore >= 75) return { label: "Auto-confirmed", color: "#059669", bg: "#F0FDF4", dot: "#10B981" };
  return { label: "Verify", color: "#D97706", bg: "#FFFBEB", dot: "#F59E0B" };
}

// ─── Tooltip button helper ────────────────────────────────────────────────────

function IconActionButton({
  icon,
  label,
  description,
  color,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div className="relative flex-1">
      <button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={`w-full flex items-center justify-center py-1.5 rounded transition-colors ${
          disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-[#F8FAFC]"
        }`}
        style={{ color }}
      >
        {icon}
      </button>
      {hover && !disabled && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-[60] w-44 rounded-lg border bg-white shadow-xl px-3 py-2 pointer-events-none"
          style={{ borderColor: BORDER }}
        >
          <div className="text-xs font-semibold mb-0.5" style={{ color: NAV }}>{label}</div>
          <div className="text-[10px] leading-relaxed" style={{ color: MUTED }}>{description}</div>
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `5px solid ${BORDER}` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── FieldDropdown ────────────────────────────────────────────────────────────

interface DropdownProps {
  current: RowChoice;
  autoMatch: RowChoice | null;
  packageFields: FieldItem[];
  fieldLibrary: FieldLibraryItem[];
  disabled?: boolean;
  onChange: (choice: RowChoice) => void;
}

function FieldDropdown({ current, autoMatch, packageFields, fieldLibrary, disabled, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setQuery(""); return; }
    setTimeout(() => inputRef.current?.focus(), 30);
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const q = query.toLowerCase();
  const filteredPkg = packageFields.filter((f) => f.name.toLowerCase().includes(q));
  const filteredLib = fieldLibrary.filter((f) => f.label.toLowerCase().includes(q));
  const categories = [...new Set(filteredLib.map((f) => f.category))].sort();

  const currentLabel = current.source === "package" ? current.label
    : current.source === "library" ? current.label
    : null;

  const select = (choice: RowChoice) => { onChange(choice); setOpen(false); };

  const autoMatchLabel = autoMatch && autoMatch.source !== "none" && autoMatch.source !== "mapper"
    ? autoMatch.label
    : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full h-8 flex items-center justify-between gap-1.5 px-2.5 rounded border text-sm transition-colors ${
          disabled ? "bg-[#F1EEE8] cursor-default opacity-70 border-[#E2E8F0]"
            : current.source === "mapper"
            ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
            : current.source === "none"
            ? "bg-[#FEF2F2] border-red-200 text-red-700 hover:bg-[#FEE2E2]"
            : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
        }`}
      >
        <span className="truncate text-left">
          {current.source === "mapper"
            ? <span className="italic text-amber-600 flex items-center gap-1"><Flag className="w-3 h-3 inline-block" /> Resolve in mapper</span>
            : currentLabel ?? <span className="italic text-red-500">— Select library field —</span>
          }
        </span>
        {!disabled && <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 w-72 bg-white rounded-xl shadow-2xl border flex flex-col"
          style={{ borderColor: BORDER, maxHeight: "340px" }}
        >
          {/* ── Search bar ── */}
          <div className="shrink-0 p-2 border-b" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#F8FAFC] rounded-lg">
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: MUTED }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
                placeholder="Search library fields..."
                className="flex-1 text-xs bg-transparent outline-none"
                style={{ color: NAV }}
              />
            </div>
          </div>

          {/* ── Scrollable field list ── */}
          <div className="overflow-y-auto flex-1 min-h-0 py-1">
            {filteredPkg.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>
                  This Package
                </div>
                {filteredPkg.map((f) => (
                  <button key={f.id} onClick={() => select({ source: "package", fieldId: f.id, label: f.name })}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F8FAFC] flex items-center justify-between gap-2 transition-colors"
                    style={{ color: NAV }}>
                    <span className="truncate">{f.name}</span>
                    <span className="text-[10px] text-emerald-600 font-medium shrink-0">pkg</span>
                  </button>
                ))}
              </div>
            )}

            {categories.map((cat) => {
              const catFields = filteredLib.filter((f) => f.category === cat);
              if (!catFields.length) return null;
              return (
                <div key={cat}>
                  <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>
                    {cat}
                  </div>
                  {catFields.map((f) => (
                    <button key={f.id} onClick={() => select({ source: "library", libraryId: f.id, label: f.label })}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#F8FAFC] flex items-center justify-between gap-2 transition-colors"
                      style={{ color: NAV }}>
                      <span className="truncate">{f.label}</span>
                      <span className="text-[10px] font-mono" style={{ color: MUTED }}>{f.id.slice(0, 18)}</span>
                    </button>
                  ))}
                </div>
              );
            })}

            {filteredPkg.length === 0 && filteredLib.length === 0 && (
              <div className="px-3 py-4 text-sm text-center italic" style={{ color: MUTED }}>
                No fields match &quot;{query}&quot;
              </div>
            )}
          </div>

          {/* ── Compact action buttons footer ── */}
          <div className="shrink-0 border-t" style={{ borderColor: BORDER }}>
            <div className="px-3 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>
              Can't map it from here?
            </div>
            <div className="flex gap-1 px-2 pb-2">
              <IconActionButton
                icon={<Zap className="w-4 h-4" />}
                label="Auto map"
                description={autoMatchLabel ? `Best match: ${autoMatchLabel}` : "No algorithmic match found"}
                color="#1D4ED8"
                disabled={!autoMatch}
                onClick={() => autoMatch && select(autoMatch)}
              />
              <IconActionButton
                icon={<Flag className="w-4 h-4" />}
                label="Resolve in mapper"
                description="Flagged for attention once you see its position on the PDF."
                color="#D97706"
                onClick={() => select({ source: "mapper" })}
              />
              <IconActionButton
                icon={<Minus className="w-4 h-4" />}
                label="Leave blank"
                description="Included in the package but always submits empty."
                color={MUTED}
                onClick={() => select({ source: "none" })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mapping guide modal ───────────────────────────────────────────────────────

function MappingGuide({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl border shadow-2xl max-w-md w-full overflow-hidden"
           style={{ borderColor: BORDER }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: NAV }}>
              <span className="text-white text-[11px] font-bold">D</span>
            </div>
            <h3 className="font-semibold text-sm" style={{ color: NAV }}>How field mapping works</h3>
          </div>
          <button onClick={onClose} className="hover:opacity-60 transition-opacity" style={{ color: MUTED }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-sm mb-0.5" style={{ color: NAV }}>Auto-mapping</p>
              <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                Docuplete scores each AcroForm field name against your field library using fuzzy matching.
                High-confidence matches are auto-confirmed; lower-confidence ones are flagged for review.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-sm mb-0.5" style={{ color: NAV }}>Gets better over time</p>
              <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                Each package you build expands your field library. As more fields are confirmed,
                accuracy improves with every document you add.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-sm mb-0.5" style={{ color: NAV }}>AcroField quality matters</p>
              <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                PDFs with descriptive field names (e.g. <span className="font-mono text-[10px] bg-[#F1EEE8] px-1 rounded">clientFirstName</span>) map
                far better than generic labels like <span className="font-mono text-[10px] bg-[#F1EEE8] px-1 rounded">field_47</span>.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full border flex items-center justify-center shrink-0 mt-0.5"
                 style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}>
              <Flag className="w-4 h-4" style={{ color: "#D97706" }} />
            </div>
            <div>
              <p className="font-semibold text-sm mb-0.5" style={{ color: NAV }}>Resolve in mapper</p>
              <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                Can't tell what a field is from its name alone? Flag it and Docuplete will
                highlight it in the visual mapper where you can see exactly where it sits on the PDF.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: NAV }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1a2d5a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = NAV)}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Document preview drawer ──────────────────────────────────────────────────

function DocPreviewDrawer({ pdfUrl, onClose }: { pdfUrl: string | null | undefined; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full bg-white border-l" style={{ borderColor: BORDER }}>
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: MUTED }} />
          <span className="text-sm font-semibold" style={{ color: NAV }}>Document Preview</span>
        </div>
        <button onClick={onClose} className="hover:opacity-60 transition-opacity" style={{ color: MUTED }}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {pdfUrl ? (
          <iframe
            src={`${pdfUrl}#navpanes=0`}
            className="w-full h-full border-none"
            title="Document preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <FileText className="w-10 h-10 opacity-20" style={{ color: MUTED }} />
            <p className="text-sm" style={{ color: MUTED }}>Document preview not available</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  annotations: PendingAnnotation[];
  packageFields: FieldItem[];
  fieldLibrary?: FieldLibraryItem[];
  documentTitle: string;
  documentIndex?: number;
  documentTotal?: number;
  pdfUrl?: string | null;
  onConfirm: (choices: RowChoice[]) => void;
  onSkip: () => void;
}

export function AcroFieldReviewOverlay({
  annotations,
  packageFields,
  fieldLibrary = [],
  documentTitle,
  documentIndex,
  documentTotal,
  pdfUrl,
  onConfirm,
  onSkip,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [decisions, setDecisions] = useState<RowDecision[]>(() =>
    computeInitialDecisions(annotations, packageFields, fieldLibrary)
  );
  const [showGuide, setShowGuide] = useState(() => {
    try { return !localStorage.getItem("docuplete_acro_guide_seen"); }
    catch { return true; }
  });
  const [showDrawer, setShowDrawer] = useState(false);

  function dismissGuide() {
    try { localStorage.setItem("docuplete_acro_guide_seen", "1"); } catch {}
    setShowGuide(false);
  }

  const activeLib = useMemo(() => fieldLibrary.filter((f) => f.active), [fieldLibrary]);

  const autoMappableCount = useMemo(
    () => decisions.filter((d, i) => !annotations[i]?.prefillValue && d.choice.source === "none" && d.autoMatch !== null).length,
    [decisions, annotations],
  );

  // Auto map: apply best match where found; flag all remaining unmapped for mapper
  function autoMapAll() {
    setDecisions((prev) =>
      prev.map((d, i) => {
        if (annotations[i]?.prefillValue) return d;
        if (d.choice.source !== "none") return d;
        if (d.autoMatch) return { ...d, choice: d.autoMatch, userModified: true };
        // No match — flag for mapper so it doesn't sit as "Needs action"
        return { ...d, choice: { source: "mapper" }, userModified: true };
      }),
    );
  }

  const stats = useMemo(() => {
    let confirmed = 0, verify = 0, needsAction = 0, prefilled = 0, flagged = 0;
    annotations.forEach((ann, i) => {
      if (ann.prefillValue) { prefilled++; return; }
      const dec = decisions[i];
      if (!dec) return;
      if (dec.choice.source === "none") { needsAction++; return; }
      if (dec.choice.source === "mapper") { flagged++; return; }
      if (!dec.userModified && dec.initialScore < 75) verify++;
      else confirmed++;
    });
    return { confirmed, verify, needsAction, prefilled, flagged };
  }, [annotations, decisions]);

  const nonProtected = annotations.filter((a) => !a.prefillValue).length;
  const decided = stats.confirmed + stats.verify + stats.flagged;
  const progressPct = nonProtected > 0 ? Math.round((decided / nonProtected) * 100) : 100;

  const handleConfirm = () => {
    if (dismissed) return;
    setDismissed(true);
    onConfirm(decisions.map((d) => d.choice));
  };

  const handleSkip = () => {
    if (dismissed) return;
    setDismissed(true);
    onSkip();
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "Enter") handleConfirm();
      if (e.key === "Escape") handleSkip();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Main panel ── */}
      <div className="flex flex-col flex-1 min-w-0" style={{ background: CREAM }}>

        {/* ── Top bar ── */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3 bg-white border-b" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: NAV }}>
              <span className="text-white text-[11px] font-bold">D</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: NAV }}>AcroForm fields detected</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#F1EEE8", color: MUTED }}>
                  {documentTitle}
                </span>
                {documentTotal && documentTotal > 1 && documentIndex && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {documentIndex} of {documentTotal}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-4 flex-shrink-0">
            <button
              onClick={() => setShowGuide(true)}
              title="How field mapping works"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs hover:bg-[#F1EEE8] transition-colors"
              style={{ color: MUTED }}
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">How it works</span>
            </button>
            <button
              onClick={() => setShowDrawer((v) => !v)}
              title="Preview document"
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
                showDrawer ? "bg-[#F1EEE8]" : "hover:bg-[#F1EEE8]"
              }`}
              style={{ color: showDrawer ? NAV : MUTED }}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Document</span>
            </button>
            <button onClick={handleSkip} className="flex items-center gap-1 px-2 py-1 text-sm hover:opacity-70 transition-opacity" style={{ color: MUTED }}>
              <X className="w-4 h-4" /> Skip
            </button>
          </div>
        </div>

        {/* ── Keyboard shortcuts bar ── */}
        <div className="shrink-0 px-6 py-2 bg-white border-b flex items-center gap-1.5 flex-wrap" style={{ borderColor: BORDER }}>
          <span className="text-[10px] font-bold uppercase tracking-wider mr-2" style={{ color: MUTED }}>Keyboard</span>
          {[["Tab","next row"],["Space","open dropdown"],["Enter","confirm all"],["Esc","skip"]].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1 text-[11px] mr-3" style={{ color: MUTED }}>
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F1EEE8] border" style={{ borderColor: BORDER, color: NAV }}>{key}</kbd>
              {label}
            </span>
          ))}
          <div className="flex-1" />
          <span className="text-[11px]" style={{ color: MUTED }}>
            Can't map a field? Open the dropdown →{" "}
            <span style={{ color: "#D97706" }} className="font-medium">Resolve in mapper</span>
          </span>
        </div>

        {/* ── Mapping guide modal ── */}
        {showGuide && <MappingGuide onClose={dismissGuide} />}

        {/* ── Summary strip ── */}
        <div className="shrink-0 px-6 py-2.5 bg-white border-b flex items-center gap-6 flex-wrap" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-emerald-700">{stats.confirmed}</span>
            <span style={{ color: MUTED }}>auto-confirmed</span>
          </div>
          {stats.verify > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-amber-700">{stats.verify}</span>
              <span style={{ color: MUTED }}>to verify</span>
            </div>
          )}
          {stats.needsAction > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <Minus className="w-4 h-4 text-red-400" />
              <span className="font-semibold text-red-600">{stats.needsAction}</span>
              <span style={{ color: MUTED }}>need action</span>
            </div>
          )}
          {stats.flagged > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <Flag className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-amber-700">{stats.flagged}</span>
              <span style={{ color: MUTED }}>flagged for mapper</span>
            </div>
          )}
          {stats.prefilled > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <Lock className="w-4 h-4" style={{ color: MUTED }} />
              <span className="font-semibold" style={{ color: MUTED }}>{stats.prefilled}</span>
              <span style={{ color: MUTED }}>pre-filled / protected</span>
            </div>
          )}
          <div className="flex-1" />
          {autoMappableCount > 0 && (
            <button
              onClick={autoMapAll}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border transition-colors hover:bg-blue-50"
              style={{ color: "#1D4ED8", borderColor: "#BFDBFE", background: "#EFF6FF" }}
            >
              <Zap className="w-3 h-3" />
              Auto map {autoMappableCount} field{autoMappableCount !== 1 ? "s" : ""}
            </button>
          )}
          {stats.needsAction > 0 && autoMappableCount === 0 && packageFields.length > 0 && (
            <span className="text-xs" style={{ color: MUTED }}>
              {stats.needsAction} unresolved — will defer to mapper
            </span>
          )}
        </div>

        {/* ── Column headers ── */}
        <div className="shrink-0 bg-white border-b" style={{ borderColor: BORDER }}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid items-center py-2 text-[10px] font-bold uppercase tracking-wider gap-3"
                 style={{ gridTemplateColumns: GRID, color: MUTED }}>
              <div />
              <div>PDF Field</div>
              <div>Type</div>
              <div>Page</div>
              <div>Library Match</div>
              <div>Confidence</div>
              <div>Status</div>
            </div>
          </div>
        </div>

        {/* ── Field rows ── */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-6 py-3 flex flex-col gap-1">
            {annotations.map((ann, i) => {
              const dec = decisions[i]!;
              const isPrefilled = Boolean(ann.prefillValue);
              const conf = confidenceLabelOf(ann, dec);
              const status = statusOf(ann, dec);

              const icon = isPrefilled ? (
                <Lock className="w-4 h-4 flex-shrink-0" style={{ color: MUTED }} />
              ) : dec.choice.source === "mapper" ? (
                <Flag className="w-4 h-4 flex-shrink-0 text-amber-400" />
              ) : dec.choice.source === "none" ? (
                <Minus className="w-4 h-4 flex-shrink-0 text-red-400" />
              ) : dec.initialScore >= 75 || dec.userModified ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              );

              return (
                <div
                  key={i}
                  className={`grid items-center gap-3 px-4 py-2.5 bg-white rounded-lg border transition-colors ${
                    isPrefilled ? "opacity-75" : "hover:border-[#C49A38]/40"
                  }`}
                  style={{ gridTemplateColumns: GRID, borderColor: BORDER }}
                >
                  {icon}

                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: NAV }}>
                      {ann.fieldName || <span className="italic" style={{ color: MUTED }}>No field name</span>}
                    </div>
                    {isPrefilled && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Lock className="w-2.5 h-2.5" style={{ color: MUTED }} />
                        <span className="text-[10px]" style={{ color: MUTED }}>Pre-filled</span>
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] font-medium" style={{ color: MUTED }}>
                    {fieldTypeLabel(ann.fieldType)}
                  </div>

                  <div className="text-[11px]" style={{ color: MUTED }}>
                    p.{ann.page}
                  </div>

                  {isPrefilled ? (
                    <div className="h-8 flex items-center px-2.5 rounded border text-sm"
                         style={{ background: "#F1EEE8", borderColor: BORDER, color: MUTED }}>
                      <Lock className="w-3 h-3 mr-2 flex-shrink-0" />
                      <span className="truncate italic">Pre-filled — not overwritten</span>
                    </div>
                  ) : (
                    <FieldDropdown
                      current={dec.choice}
                      autoMatch={dec.autoMatch}
                      packageFields={packageFields}
                      fieldLibrary={activeLib}
                      onChange={(choice) => {
                        setDecisions((prev) => prev.map((d, idx) =>
                          idx === i ? { ...d, choice, userModified: true } : d
                        ));
                      }}
                    />
                  )}

                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded px-1.5 py-0.5"
                        style={{ color: conf.color, background: conf.bg, border: `1px solid ${conf.dot}30` }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: conf.dot }} />
                    {conf.label}
                  </span>

                  <span className="text-xs font-medium" style={{ color: status.color }}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="shrink-0 bg-white border-t" style={{ borderColor: BORDER }}>
          <div className="h-1.5 w-full" style={{ background: "#F1EEE8" }}>
            <div
              className="h-full transition-all duration-500 rounded-r"
              style={{
                width: `${progressPct}%`,
                background: stats.needsAction > 0 ? "#10B981" : "#059669",
              }}
            />
          </div>

          <div className="px-6 py-4 flex items-center gap-4 flex-wrap">
            <div className="text-xs flex-1" style={{ color: MUTED }}>
              {decided} of {nonProtected} fields mapped
              {stats.flagged > 0 && ` · ${stats.flagged} flagged for mapper`}
              {stats.prefilled > 0 && ` · ${stats.prefilled} protected`}
            </div>
            <button
              onClick={handleSkip}
              className="text-sm hover:opacity-70 transition-opacity"
              style={{ color: MUTED }}
            >
              Open Mapper without auto-mapping
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white transition-all"
              style={{ background: NAV }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1a2d5a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = NAV)}
            >
              {documentTotal && documentTotal > 1 && documentIndex && documentIndex < documentTotal
                ? `Apply & Review Next Document`
                : `Apply & Open Mapper`}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Document preview drawer (slides in from right) ── */}
      <div
        className="shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
        style={{ width: showDrawer ? 420 : 0 }}
      >
        <div style={{ width: 420, height: "100%" }}>
          <DocPreviewDrawer pdfUrl={pdfUrl} onClose={() => setShowDrawer(false)} />
        </div>
      </div>
    </div>
  );
}
