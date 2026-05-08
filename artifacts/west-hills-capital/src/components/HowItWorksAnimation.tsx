import { useState, useEffect, useRef } from "react";

const FIELDS = [
  { label: "First name",     value: "Jane",             color: "#E67E56" },
  { label: "Last name",      value: "Smith",            color: "#C49A38" },
  { label: "Email address",  value: "jane@example.com", color: "#5BA8E6" },
  { label: "Date of birth",  value: "01/01/2025",       color: "#9B7DE6" },
  { label: "Address",        value: "123 Abc",          color: "#56C49A" },
  { label: "City",           value: "Wichita",          color: "#E67E9B" },
  { label: "State",          value: "KS",               color: "#5BE6D8" },
  { label: "ZIP code",       value: "67206",            color: "#E6B856" },
];

// Layout constants (all in px, within the 256px inner width of the p-3 container)
const DOC_W    = 148;   // width of the scaled document panel
const GAP      = 16;    // gap between doc and chip column
const CHIP_L   = DOC_W + GAP; // 164 — left edge of chip column
const DOC_HDR  = 34;    // document title + subtitle area
const ROW_H    = 21;    // height of each field row
const TOTAL_H  = DOC_HDR + FIELDS.length * ROW_H + 6; // total stage height ≈ 210px

export function HowItWorksAnimation() {
  const [placedCount,   setPlacedCount]   = useState(0);
  const [flyingIdx,     setFlyingIdx]     = useState<number | null>(null);
  const [flyingLanded,  setFlyingLanded]  = useState(false);
  const [revealed,      setRevealed]      = useState(false);
  const [isDone,        setIsDone]        = useState(false);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const cancelRef = useRef(false);

  function runStep(idx: number) {
    if (cancelRef.current) return;

    if (idx >= FIELDS.length) {
      // All chips placed — pause then reveal values all at once
      setFlyingIdx(null);
      setTimeout(() => {
        if (cancelRef.current) return;
        setRevealed(true);
        setTimeout(() => {
          if (cancelRef.current) return;
          setIsDone(true);
          setIsPlaying(false);
        }, 500);
      }, 350);
      return;
    }

    setFlyingIdx(idx);
    setFlyingLanded(false);

    // Two rAF ticks to flush layout before starting transition
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (cancelRef.current) return;
        setFlyingLanded(true);
        setTimeout(() => {
          if (cancelRef.current) return;
          setPlacedCount(idx + 1);
          setFlyingIdx(null);
          setTimeout(() => runStep(idx + 1), 200);
        }, 460);
      }),
    );
  }

  function handlePlay() {
    cancelRef.current = false;
    setPlacedCount(0);
    setFlyingIdx(null);
    setFlyingLanded(false);
    setRevealed(false);
    setIsDone(false);
    setIsPlaying(true);
    setTimeout(() => runStep(0), 180);
  }

  useEffect(() => () => { cancelRef.current = true; }, []);

  return (
    <div className="rounded-lg border border-white/10 bg-[#0D1630] p-3 space-y-2.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-[#8A9BB8] uppercase tracking-widest">
          How it works
        </p>
        <button
          onClick={handlePlay}
          disabled={isPlaying}
          className="flex items-center gap-1 text-[10px] font-semibold text-[#C49A38] hover:text-[#E0B84A] transition-colors disabled:opacity-40"
        >
          {isDone ? (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Replay
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </>
          )}
        </button>
      </div>

      {/* Animation stage */}
      <div className="relative" style={{ height: TOTAL_H }}>

        {/* ── Document panel (LEFT) ─────────────────────────────────────── */}
        <div
          className="absolute rounded overflow-hidden"
          style={{
            left: 0, top: 0,
            width: DOC_W, height: TOTAL_H,
            backgroundColor: "#ffffff",
            border: "1px solid rgba(0,0,0,0.1)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
        >
          {/* Document title area */}
          <div className="px-2 pt-2" style={{ height: DOC_HDR }}>
            <div style={{ fontSize: 7.5, fontWeight: 700, color: "#0F1C3F", lineHeight: 1.2 }}>
              Client Information Form
            </div>
            <div style={{ fontSize: 6, color: "#C49A38", marginTop: 2 }}>
              Demo — for testing purposes only
            </div>
          </div>

          {/* Field rows */}
          {FIELDS.map((field, i) => {
            const isPlaced = placedCount > i;
            return (
              <div
                key={field.label}
                className="absolute px-2"
                style={{
                  top: DOC_HDR + i * ROW_H,
                  left: 0, right: 0,
                  height: ROW_H,
                }}
              >
                {/* Label line */}
                <div
                  className="flex items-center gap-0.5"
                  style={{ marginTop: 2 }}
                >
                  {isPlaced && (
                    <div
                      className="rounded-full shrink-0"
                      style={{ width: 4, height: 4, backgroundColor: field.color, marginRight: 2 }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: 6,
                      color: isPlaced ? field.color : "#9CA3AF",
                      fontWeight: isPlaced ? 600 : 400,
                      transition: "color 0.2s ease",
                    }}
                  >
                    {field.label}
                  </span>
                </div>

                {/* Value + underline */}
                <div
                  style={{
                    height: 11,
                    borderBottom: `1px solid ${isPlaced ? field.color + "55" : "rgba(0,0,0,0.1)"}`,
                    transition: "border-color 0.3s ease",
                    display: "flex",
                    alignItems: "flex-end",
                    paddingBottom: 1,
                  }}
                >
                  {revealed && (
                    <span
                      style={{
                        fontSize: 7,
                        fontWeight: 600,
                        color: "#0F1C3F",
                        lineHeight: 1,
                        animation: "howItWorksReveal 0.35s ease forwards",
                      }}
                    >
                      {field.value}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Arrow ──────────────────────────────────────────────────────── */}
        <div
          className="absolute select-none font-bold"
          style={{
            color: "#1E2D4A",
            fontSize: 9,
            left: DOC_W + 3,
            top: TOTAL_H / 2 - 5,
          }}
        >
          ←
        </div>

        {/* ── Chip column label ──────────────────────────────────────────── */}
        <div
          className="absolute"
          style={{
            left: CHIP_L,
            top: 0,
            fontSize: 7,
            fontWeight: 600,
            color: "#3A4A6A",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Fields
        </div>

        {/* ── Static chips in right column ───────────────────────────────── */}
        {FIELDS.map((field, i) => {
          const isPlaced = placedCount > i;
          const isFlying = flyingIdx === i;
          return (
            <div
              key={field.label}
              className="absolute flex items-center gap-1 rounded"
              style={{
                left: CHIP_L,
                top: DOC_HDR + i * ROW_H + 2,
                paddingLeft: 4, paddingRight: 5,
                paddingTop: 2, paddingBottom: 2,
                backgroundColor: field.color + "18",
                border: `1px solid ${field.color}45`,
                opacity: isPlaced || isFlying ? 0.12 : 0.92,
                transition: "opacity 0.2s ease",
              }}
            >
              <div
                className="rounded-full shrink-0"
                style={{ width: 5, height: 5, backgroundColor: field.color }}
              />
              <span style={{ fontSize: 7.5, color: field.color, fontWeight: 600, whiteSpace: "nowrap" }}>
                {field.label}
              </span>
            </div>
          );
        })}

        {/* ── Flying chip (animated) ─────────────────────────────────────── */}
        {flyingIdx !== null && (
          <div
            className="absolute flex items-center gap-1 rounded pointer-events-none"
            style={{
              top: DOC_HDR + flyingIdx * ROW_H + 2,
              left: flyingLanded ? 5 : CHIP_L,
              transition: "left 0.44s cubic-bezier(0.34, 1.3, 0.64, 1)",
              paddingLeft: 4, paddingRight: 5,
              paddingTop: 2, paddingBottom: 2,
              backgroundColor: FIELDS[flyingIdx].color + "28",
              border: `1px solid ${FIELDS[flyingIdx].color}90`,
              boxShadow: `0 2px 10px ${FIELDS[flyingIdx].color}55`,
              zIndex: 10,
            }}
          >
            <div
              className="rounded-full shrink-0"
              style={{ width: 5, height: 5, backgroundColor: FIELDS[flyingIdx].color }}
            />
            <span style={{ fontSize: 7.5, color: FIELDS[flyingIdx].color, fontWeight: 700, whiteSpace: "nowrap" }}>
              {FIELDS[flyingIdx].label}
            </span>
          </div>
        )}
      </div>

      {/* Reveal keyframe injection */}
      <style>{`
        @keyframes howItWorksReveal {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Done badge ─────────────────────────────────────────────────────── */}
      {isDone && (
        <div className="flex items-center gap-1.5 text-green-400">
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <span style={{ fontSize: 10 }} className="font-medium">
            PDF generated &amp; sealed
          </span>
        </div>
      )}
    </div>
  );
}
