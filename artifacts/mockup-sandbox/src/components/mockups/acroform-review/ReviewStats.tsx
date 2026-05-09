import { useEffect, useState } from "react";
import { CheckCircle2, ArrowUpRight, Lock, HelpCircle, ArrowRight } from "lucide-react";
import type { ReviewField } from "./types";

const NAV    = "#0F1C3F";
const CREAM  = "#F8F6F0";
const BORDER = "#DDD5C4";
const MUTED  = "#6B7A99";

interface Props {
  fields: ReviewField[];
  onContinue: () => void;
}

export function ReviewStats({ fields, onContinue }: Props) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const confirmed  = fields.filter(f => f.status === "confirmed").length;
  const deferred   = fields.filter(f => f.status === "deferred").length;
  const protected_ = fields.filter(f => f.edgeCases.includes("prefilled") && f.status === "blank").length;
  const blank      = fields.filter(f => f.status === "blank" && !f.edgeCases.includes("prefilled")).length;
  const total      = fields.length;

  // Animate the mapper-prep progress bar over 2.8 s, then mark done
  useEffect(() => {
    const start = performance.now();
    const duration = 2800;
    const tick = () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct < 100) requestAnimationFrame(tick);
      else setDone(true);
    };
    requestAnimationFrame(tick);
  }, []);

  // Auto-advance 600 ms after the bar completes
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onContinue, 600);
    return () => clearTimeout(t);
  }, [done, onContinue]);

  const stats = [
    {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      label: "Auto-mapped",
      count: confirmed,
      sub: "Confirmed and ready to fill",
      accent: "text-emerald-700",
      bar: "bg-emerald-500",
    },
    {
      icon: <ArrowUpRight className="w-5 h-5 text-orange-400" />,
      label: "Deferred to mapper",
      count: deferred,
      sub: "Flagged for visual placement",
      accent: "text-orange-600",
      bar: "bg-orange-400",
    },
    {
      icon: <Lock className="w-5 h-5 text-teal-500" />,
      label: "Pre-filled — protected",
      count: protected_,
      sub: "Already filled, will not be overwritten",
      accent: "text-teal-700",
      bar: "bg-teal-400",
    },
    {
      icon: <HelpCircle className="w-5 h-5" style={{ color: MUTED }} />,
      label: "Left blank",
      count: blank,
      sub: "Included but always submits empty",
      accent: "",
      bar: "bg-slate-300",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center"
         style={{ background: CREAM, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header breadcrumb */}
      <div className="absolute top-0 left-0 right-0 bg-white border-b flex items-center px-6 py-3"
           style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: NAV }}>
            <span className="text-white text-[11px] font-bold">D</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: NAV }}>Docuplete</span>
          <span className="text-xs" style={{ color: MUTED }}>/ Application_1778347711374.pdf</span>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-white rounded-xl border shadow-sm px-8 py-8"
           style={{ borderColor: BORDER, boxShadow: "0px 2px 8px rgba(0,0,0,0.07)" }}>

        {/* Title */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: MUTED }}>
            Field Review Complete
          </p>
          <h1 className="text-lg font-semibold" style={{ color: NAV }}>
            {confirmed} of {total} fields mapped automatically
          </h1>
          <p className="text-sm mt-1" style={{ color: MUTED }}>
            Preparing the visual mapper with your results…
          </p>
        </div>

        {/* Stat rows */}
        <div className="flex flex-col gap-3 mb-7">
          {stats.filter(s => s.count > 0).map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="flex-shrink-0">{s.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: NAV }}>{s.label}</span>
                  <span className={`text-sm font-semibold ${s.accent}`}>{s.count}</span>
                </div>
                <div className="w-full h-1 rounded-full" style={{ background: BORDER }}>
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${s.bar}`}
                    style={{ width: `${(s.count / total) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mapper loading bar */}
        <div className="border-t pt-5" style={{ borderColor: BORDER }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: done ? "#059669" : MUTED }}>
              {done ? "✓ Mapper ready" : "Preparing Visual Mapper…"}
            </span>
            <span className="text-xs font-semibold" style={{ color: NAV }}>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
            <div
              className="h-full rounded-full transition-none"
              style={{
                width: `${progress}%`,
                background: done ? "#10B981" : NAV,
                transition: "background 0.3s",
              }}
            />
          </div>
        </div>

        {/* Skip button */}
        <button
          onClick={onContinue}
          className="mt-5 w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold text-white transition-all"
          style={{ background: NAV }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1a2d5a")}
          onMouseLeave={e => (e.currentTarget.style.background = NAV)}
        >
          {done ? "Open Mapper" : "Skip to Mapper"}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
