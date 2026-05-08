import { useState, useEffect, useRef } from "react";

const FIELDS = [
  { label: "First Name",    value: "Jane",         color: "#E67E56" },
  { label: "Last Name",     value: "Smith",         color: "#C49A38" },
  { label: "Email",         value: "jane@...",      color: "#5BA8E6" },
  { label: "Date of Birth", value: "03/15/1985",    color: "#9B7DE6" },
  { label: "Address",       value: "123 Main St",   color: "#56C49A" },
  { label: "City",          value: "Portland",      color: "#E67E9B" },
  { label: "State",         value: "OR",            color: "#5BE6D8" },
  { label: "ZIP",           value: "97201",         color: "#E6B856" },
];

const ROW_H   = 22;
const HEADER  = 14;
const LIST_L  = 6;
const DOC_L   = 120;
const TOTAL_H = HEADER + FIELDS.length * ROW_H + 4;

export function HowItWorksAnimation() {
  const [placedCount, setPlacedCount] = useState(0);
  const [flyingIdx,   setFlyingIdx]   = useState<number | null>(null);
  const [flyingLanded, setFlyingLanded] = useState(false);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const cancelRef = useRef(false);

  const isDone = placedCount === FIELDS.length && !isPlaying;

  function runStep(idx: number) {
    if (cancelRef.current || idx >= FIELDS.length) {
      setIsPlaying(false);
      setFlyingIdx(null);
      return;
    }
    setFlyingIdx(idx);
    setFlyingLanded(false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (cancelRef.current) return;
        setFlyingLanded(true);
        setTimeout(() => {
          if (cancelRef.current) return;
          setPlacedCount(idx + 1);
          setFlyingIdx(null);
          setTimeout(() => runStep(idx + 1), 220);
        }, 500);
      }),
    );
  }

  function handlePlay() {
    cancelRef.current = false;
    setPlacedCount(0);
    setFlyingIdx(null);
    setFlyingLanded(false);
    setIsPlaying(true);
    setTimeout(() => runStep(0), 150);
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
      <div className="relative overflow-hidden" style={{ height: TOTAL_H }}>
        {/* Column labels */}
        <span
          className="absolute text-[8px] font-semibold uppercase tracking-wider select-none"
          style={{ color: "#3A4A6A", left: LIST_L, top: 0 }}
        >
          Fields
        </span>
        <span
          className="absolute text-[8px] font-semibold uppercase tracking-wider select-none"
          style={{ color: "#3A4A6A", left: DOC_L, top: 0 }}
        >
          Document
        </span>

        {/* List panel background */}
        <div
          className="absolute rounded"
          style={{
            left: LIST_L - 2,
            top: HEADER,
            width: DOC_L - LIST_L - 12,
            bottom: 0,
            backgroundColor: "#090F1E",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />

        {/* Document panel background */}
        <div
          className="absolute rounded"
          style={{
            left: DOC_L - 6,
            top: HEADER,
            right: 0,
            bottom: 0,
            backgroundColor: "#111827",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />

        {/* Arrow divider */}
        <span
          className="absolute font-bold select-none"
          style={{
            color: "#1E2D4A",
            fontSize: 11,
            left: DOC_L - 14,
            top: HEADER + FIELDS.length * ROW_H / 2 - 7,
          }}
        >
          →
        </span>

        {/* Rows */}
        {FIELDS.map((field, i) => {
          const y       = HEADER + i * ROW_H;
          const isPlaced = placedCount > i;
          const isFlying = flyingIdx === i;

          return (
            <div key={field.label}>
              {/* List chip (fades when placed or flying) */}
              <div
                className="absolute flex items-center gap-1"
                style={{
                  left: LIST_L + 4,
                  top: y + 5,
                  opacity: isPlaced || isFlying ? 0.12 : 0.85,
                  transition: "opacity 0.2s ease",
                }}
              >
                <div
                  className="rounded-full shrink-0"
                  style={{ width: 6, height: 6, backgroundColor: field.color }}
                />
                <span
                  className="truncate select-none"
                  style={{ fontSize: 8, color: "rgba(255,255,255,0.65)", maxWidth: 62 }}
                >
                  {field.label}
                </span>
              </div>

              {/* Document line */}
              <div
                className="absolute flex items-center"
                style={{ left: DOC_L, top: y + 5, right: 6 }}
              >
                {isPlaced ? (
                  <div className="flex items-center gap-1 w-full">
                    <div
                      className="rounded-full shrink-0"
                      style={{ width: 5, height: 5, backgroundColor: field.color }}
                    />
                    <span
                      className="font-medium truncate"
                      style={{ fontSize: 8, color: field.color, maxWidth: 88 }}
                    >
                      {field.value}
                    </span>
                  </div>
                ) : (
                  <div
                    className="w-full rounded-full"
                    style={{ height: 1, backgroundColor: "rgba(255,255,255,0.07)" }}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Flying chip — the animated element */}
        {flyingIdx !== null && (
          <div
            className="absolute flex items-center gap-1 rounded pointer-events-none"
            style={{
              paddingLeft: 5,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              top: HEADER + flyingIdx * ROW_H + 2,
              left: flyingLanded ? DOC_L - 6 : LIST_L - 2,
              transition: "left 0.46s cubic-bezier(0.34, 1.3, 0.64, 1)",
              backgroundColor: FIELDS[flyingIdx].color + "22",
              border: `1px solid ${FIELDS[flyingIdx].color}70`,
              boxShadow: `0 2px 10px ${FIELDS[flyingIdx].color}44`,
              zIndex: 10,
            }}
          >
            <div
              className="rounded-full shrink-0"
              style={{ width: 6, height: 6, backgroundColor: FIELDS[flyingIdx].color }}
            />
            <span
              className="font-semibold"
              style={{ fontSize: 8, color: FIELDS[flyingIdx].color }}
            >
              {FIELDS[flyingIdx].label}
            </span>
          </div>
        )}
      </div>

      {/* Completion badge */}
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
