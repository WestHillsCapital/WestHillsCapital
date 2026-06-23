const PERIODS = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y", "ALL"];

export default function SpotChartSkeleton() {
  return (
    <div>
      {/* Legend row + period tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        {/* Legend items */}
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-200 inline-block rounded" />
            <span className="w-20 h-3 bg-muted/50 rounded animate-pulse" />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-slate-200 inline-block rounded" />
            <span className="w-24 h-3 bg-muted/50 rounded animate-pulse" />
          </span>
        </div>
        {/* Period tab pills */}
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <span
              key={p}
              className="px-2.5 py-1 rounded-full bg-muted/40 animate-pulse"
              style={{ minWidth: p.length > 2 ? "2.75rem" : "2rem", height: "1.5rem" }}
            />
          ))}
        </div>
      </div>

      {/* Chart body */}
      <div className="h-[300px] rounded-xl bg-muted/30 animate-pulse" />
    </div>
  );
}
