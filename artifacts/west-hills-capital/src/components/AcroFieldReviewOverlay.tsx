import { useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, Minus, ArrowRight, X } from "lucide-react";
import type { FieldItem } from "@/lib/docufill-types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PendingAnnotation = {
  fieldName: string;
  rect: [number, number, number, number];
  fieldType: string;
  page: number;
  pageW: number;
  pageH: number;
};

type MatchResult = {
  field: FieldItem | undefined;
  score: number;
};

// ─── Scoring (mirrors DocuFill.tsx findBestFieldForAnnotation) ────────────────

const MODIFIER_WORDS = new Set([
  "client", "mailing", "physical", "account", "applicant", "signer",
  "legal", "primary", "secondary", "billing", "home", "work", "middle",
  "holder", "registered", "beneficial", "joint", "co", "current",
]);
const STOP_WORDS = new Set(["the", "a", "an", "of", "in", "for", "to", "on", "at", "by", "or", "and", "if"]);
const FORMAT_HINTS = /\s*(mm[\/-]?dd[\/-]?yyyy|mmddyyyy|yyyymmdd|mm\/dd\/yy|\(mm\/dd\/yyyy\))\s*/gi;

function norm(name: string): string {
  return name
    .toLowerCase()
    .replace(FORMAT_HINTS, " ")
    .replace(/\s+-\s+.*$/, "")
    .replace(/_\d+$/, "")
    .replace(/\s+\d+$/, "")
    .replace(/_/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function stripMods(name: string) {
  return name.split(" ").filter((w) => !MODIFIER_WORDS.has(w)).join(" ").trim();
}
function acronym(name: string) {
  return name.split(/\s+/).map((w) => w[0] ?? "").join("").toLowerCase();
}
function meaningfulWords(name: string) {
  return new Set(name.split(/\s+/).filter((w) => w.length >= 2 && !STOP_WORDS.has(w)));
}
function scoreMatch(fieldName: string, pdfName: string): number {
  const nf = norm(fieldName); const np = norm(pdfName);
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

function findMatch(ann: PendingAnnotation, fields: FieldItem[], alreadyMatched: Set<string>): MatchResult {
  if (!ann.fieldName) return { field: undefined, score: 0 };
  const THRESHOLD = 35;
  const candidates = fields
    .map((f) => ({ field: f, score: scoreMatch(f.name, ann.fieldName) }))
    .filter((c) => c.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score);
  if (candidates.length === 0) return { field: undefined, score: 0 };
  const unmatched = candidates.filter((c) => !alreadyMatched.has(c.field.id));
  const winner = (unmatched.length > 0 && unmatched[0].score >= candidates[0].score - 15)
    ? unmatched[0] : candidates[0];
  return { field: winner.field, score: winner.score };
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const NAV    = "#0F1C3F";
const CREAM  = "#F8F6F0";
const BORDER = "#DDD5C4";
const MUTED  = "#6B7A99";

// ─── Sub-components ───────────────────────────────────────────────────────────

type Confidence = "high" | "medium" | "none";

function confidenceOf(score: number): Confidence {
  if (score >= 75) return "high";
  if (score >= 35) return "medium";
  return "none";
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  if (confidence === "high") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Auto-match
    </span>
  );
  if (confidence === "medium") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      Verify
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded px-1.5 py-0.5"
          style={{ color: MUTED, background: "#F1EEE8", border: `1px solid ${BORDER}` }}>
      Unmatched
    </span>
  );
}

function RowIcon({ confidence }: { confidence: Confidence }) {
  if (confidence === "high") return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
  if (confidence === "medium") return <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
  return <Minus className="w-4 h-4 flex-shrink-0" style={{ color: MUTED }} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  annotations: PendingAnnotation[];
  packageFields: FieldItem[];
  documentTitle: string;
  onConfirm: () => void;
  onSkip: () => void;
}

export function AcroFieldReviewOverlay({ annotations, packageFields, documentTitle, onConfirm, onSkip }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const rows = useMemo(() => {
    const seen = new Set<string>();
    return annotations.map((ann) => {
      const match = findMatch(ann, packageFields, seen);
      if (match.field) seen.add(match.field.id);
      const confidence = confidenceOf(match.score);
      return { ann, match, confidence };
    });
  }, [annotations, packageFields]);

  const autoCount   = rows.filter((r) => r.confidence === "high").length;
  const verifyCount = rows.filter((r) => r.confidence === "medium").length;
  const noneCount   = rows.filter((r) => r.confidence === "none").length;

  if (dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: CREAM, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b shrink-0" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: NAV }}>
            <span className="text-white text-[11px] font-bold">D</span>
          </div>
          <div>
            <span className="text-sm font-semibold" style={{ color: NAV }}>AcroForm fields detected</span>
            <span className="text-xs ml-2" style={{ color: MUTED }}>{documentTitle}</span>
          </div>
        </div>
        <button onClick={() => { setDismissed(true); onSkip(); }} className="text-sm flex items-center gap-1 hover:opacity-70 transition-opacity" style={{ color: MUTED }}>
          <X className="w-4 h-4" /> Skip
        </button>
      </div>

      {/* Summary strip */}
      <div className="shrink-0 px-6 py-3 bg-white border-b flex items-center gap-6" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-1.5 text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="font-semibold text-emerald-700">{autoCount}</span>
          <span style={{ color: MUTED }}>auto-matched</span>
        </div>
        {verifyCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-amber-700">{verifyCount}</span>
            <span style={{ color: MUTED }}>to verify</span>
          </div>
        )}
        {noneCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <Minus className="w-4 h-4" style={{ color: MUTED }} />
            <span className="font-semibold" style={{ color: MUTED }}>{noneCount}</span>
            <span style={{ color: MUTED }}>unmatched</span>
          </div>
        )}
        <div className="flex-1" />
        <span className="text-xs" style={{ color: MUTED }}>
          Unmatched fields will be skipped by auto-map — drag them manually in the mapper.
        </span>
      </div>

      {/* Column headers */}
      <div className="shrink-0 grid gap-4 px-6 py-2 border-b text-[10px] font-semibold uppercase tracking-wider bg-white"
           style={{ gridTemplateColumns: "20px 1fr auto 1fr auto", borderColor: BORDER, color: MUTED }}>
        <div />
        <div>PDF Field</div>
        <div />
        <div>Package Field Match</div>
        <div>Confidence</div>
      </div>

      {/* Field rows */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-4 flex flex-col gap-1">
          {rows.map((row, i) => (
            <div key={i}
                 className="grid gap-4 items-center px-4 py-3 bg-white rounded-lg border"
                 style={{ gridTemplateColumns: "20px 1fr auto 1fr auto", borderColor: BORDER }}>
              <RowIcon confidence={row.confidence} />
              <div>
                <span className="text-sm font-medium" style={{ color: NAV }}>
                  {row.ann.fieldName || <span style={{ color: MUTED }}>—</span>}
                </span>
                <span className="ml-2 text-[11px]" style={{ color: MUTED }}>p.{row.ann.page} · {row.ann.fieldType || "text"}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: BORDER }} />
              <div className="text-sm" style={{ color: row.match.field ? NAV : MUTED }}>
                {row.match.field ? row.match.field.name : <span className="italic">No match found</span>}
              </div>
              <ConfidenceBadge confidence={row.confidence} />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="shrink-0 bg-white border-t px-6 py-4 flex items-center gap-4" style={{ borderColor: BORDER }}>
        <button
          onClick={() => { setDismissed(true); onConfirm(); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white transition-all"
          style={{ background: NAV }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1a2d5a")}
          onMouseLeave={(e) => (e.currentTarget.style.background = NAV)}
        >
          Auto-map {autoCount + verifyCount} field{autoCount + verifyCount !== 1 ? "s" : ""} &amp; Open Mapper
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setDismissed(true); onSkip(); }}
          className="text-sm hover:opacity-70 transition-opacity"
          style={{ color: MUTED }}
        >
          Open Mapper without auto-mapping
        </button>
      </div>
    </div>
  );
}
