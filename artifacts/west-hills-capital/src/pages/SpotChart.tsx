import { useState, useRef, useMemo, useEffect } from "react";
import { useSpotHistory, type ChartPeriod } from "@/hooks/use-pricing";
import SpotChartSkeleton from "./SpotChartSkeleton";
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

const PERIODS: ChartPeriod[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y", "ALL"];

const PERIOD_DATE_FORMAT: Record<ChartPeriod, string> = {
  "1D":  "h:mm a",
  "1W":  "MMM d",
  "1M":  "MMM d",
  "3M":  "MMM d",
  "6M":  "MMM yyyy",
  "1Y":  "MMM yyyy",
  "5Y":  "MMM yyyy",
  "ALL": "yyyy",
};

const PERIOD_TOOLTIP_FORMAT: Record<ChartPeriod, string> = {
  "1D":  "MMM d, h:mm a",
  "1W":  "MMM d, yyyy",
  "1M":  "MMM d, yyyy",
  "3M":  "MMM d, yyyy",
  "6M":  "MMM yyyy",
  "1Y":  "MMM yyyy",
  "5Y":  "MMM yyyy",
  "ALL": "yyyy",
};

function formatSilverTick(v: number): string {
  if (v >= 100) return `$${v.toFixed(0)}`;
  if (v >= 10)  return `$${v.toFixed(0)}`;
  if (v >= 1)   return `$${v.toFixed(1)}`;
  return `$${v.toFixed(2)}`;
}

export default function SpotChart() {
  const [period, setPeriod] = useState<ChartPeriod>("1M");
  const [isPeriodSwitching, setIsPeriodSwitching] = useState(false);
  const [chartAnimKey, setChartAnimKey] = useState(0);
  const { data, isLoading, isFetching, isError } = useSpotHistory(period);

  const seenFetchingRef = useRef(false);
  useEffect(() => {
    if (!isPeriodSwitching) return;
    if (isFetching) {
      seenFetchingRef.current = true;
    } else if (seenFetchingRef.current) {
      seenFetchingRef.current = false;
      setIsPeriodSwitching(false);
    } else {
      setIsPeriodSwitching(false);
    }
  }, [isFetching, isPeriodSwitching]);

  const showSkeleton = isLoading || isPeriodSwitching;
  const prevShowSkeletonRef = useRef(showSkeleton);
  useEffect(() => {
    if (prevShowSkeletonRef.current && !showSkeleton) {
      setChartAnimKey((k) => k + 1);
    }
    prevShowSkeletonRef.current = showSkeleton;
  }, [showSkeleton]);

  const chartData = useMemo(() => {
    if (!data?.history?.length) return [];
    const h = data.history;
    const step = Math.max(1, Math.floor(h.length / 200));
    const dateFmt = PERIOD_DATE_FORMAT[period];
    return h
      .filter((_, i) => i % step === 0 || i === h.length - 1)
      .map((pt) => ({
        ...pt,
        label: format(new Date(pt.timestamp), dateFmt),
        tooltipLabel: format(new Date(pt.timestamp), PERIOD_TOOLTIP_FORMAT[period]),
      }));
  }, [data, period]);

  const goldRange = useMemo((): [number, number] => {
    if (!chartData.length) return [3000, 5000];
    const vals = chartData.map((d) => d.goldBid);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.12, 20);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [chartData]);

  const silverRange = useMemo((): [number, number] => {
    if (!chartData.length) return [1, 80];
    const vals = chartData.map((d) => d.silverBid);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.12, 0.5);
    return [
      Math.max(0, parseFloat((min - pad).toFixed(2))),
      parseFloat((max + pad).toFixed(2)),
    ];
  }, [chartData]);

  const isSynthetic = period !== "1D" && period !== "1W" && period !== "1M";

  if (!showSkeleton && (isError || !chartData.length)) {
    return (
      <div className="h-[300px] rounded-xl bg-muted/10 border border-border/20 flex flex-col items-center justify-center gap-2">
        <p className="text-sm text-foreground/40">
          {isError ? "Price history is temporarily unavailable." : "No price data available for this period."}
        </p>
        <p className="text-xs text-foreground/30">Please check back shortly.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Chart content — fades in when data is ready */}
      <div
        data-testid="chart-content"
        className="transition-opacity duration-300"
        style={{ opacity: showSkeleton ? 0 : 1 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-4 text-xs text-foreground/50">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-500 inline-block rounded" /> Gold (left axis)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-slate-400 inline-block rounded" /> Silver (right axis)
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => { if (p !== period) { seenFetchingRef.current = false; setIsPeriodSwitching(true); setPeriod(p); } }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-foreground text-white"
                    : "bg-muted text-foreground/50 hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart key={chartAnimKey} data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#B5934F" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#B5934F" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="silverGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#94A3B8" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="gold"
              orientation="left"
              domain={goldRange}
              tick={{ fontSize: 10, fill: "#B5934F" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v.toLocaleString()}`}
              width={62}
            />
            <YAxis
              yAxisId="silver"
              orientation="right"
              domain={silverRange}
              tick={{ fontSize: 10, fill: "#94A3B8" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatSilverTick}
              width={46}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const gold = payload.find((p) => p.dataKey === "goldBid");
                const silver = payload.find((p) => p.dataKey === "silverBid");
                return (
                  <div className="bg-white border border-border/40 rounded-lg p-3 shadow-md text-xs">
                    <p className="text-foreground/50 mb-1.5">{payload[0]?.payload?.tooltipLabel}</p>
                    {gold && (
                      <p className="font-semibold text-amber-600">
                        Gold: ${Number(gold.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    {silver && (
                      <p className="font-semibold text-slate-500">
                        Silver: ${Number(silver.value).toFixed(2)}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Area yAxisId="gold"   type="monotone" dataKey="goldBid"   stroke="#B5934F" strokeWidth={1.5} fill="url(#goldGrad)"   dot={false} isAnimationActive animationDuration={400} animationEasing="ease-out" />
            <Area yAxisId="silver" type="monotone" dataKey="silverBid" stroke="#94A3B8" strokeWidth={1.5} fill="url(#silverGrad)" dot={false} isAnimationActive animationDuration={400} animationEasing="ease-out" />
          </ComposedChart>
        </ResponsiveContainer>

        {isSynthetic && (
          <p className="text-[10px] text-foreground/35 mt-3 text-right">
            Historical prices sourced from COMEX futures markets (GC=F / SI=F). Gold began trading freely after the Bretton Woods system ended in August 1971.
          </p>
        )}
      </div>

      {/* Skeleton overlay — fades out when data is ready */}
      <div
        data-testid="chart-skeleton-overlay"
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: showSkeleton ? 1 : 0,
          pointerEvents: showSkeleton ? "auto" : "none",
        }}
      >
        <SpotChartSkeleton />
      </div>
    </div>
  );
}
