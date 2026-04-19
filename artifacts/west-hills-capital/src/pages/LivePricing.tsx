import { useState, useMemo, useEffect, useCallback } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useProductPrices, useBuybackPrices, useSpotPrices, useSpotHistory, type ChartPeriod } from "@/hooks/use-pricing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Link } from "wouter";
import { Shield, ArrowRight, ZoomIn, RotateCcw, TrendingDown, TrendingUp, Info, X, RefreshCw } from "lucide-react";
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

type Product = NonNullable<ReturnType<typeof useProductPrices>["data"]>["products"][number];

// ─── PRODUCT CARD ─────────────────────────────────────────────────────────────

function ProductCard({ product, onZoom }: { product: Product; onZoom: (p: Product) => void }) {
  const [showReverse, setShowReverse] = useState(false);
  const hasReverse = !!product.reverseImageUrl;

  return (
    <Card className="overflow-hidden group bg-white border border-border/40 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div
        className="h-72 bg-white flex items-center justify-center relative p-10 cursor-zoom-in select-none"
        onMouseEnter={() => hasReverse && setShowReverse(true)}
        onMouseLeave={() => setShowReverse(false)}
        onClick={() => onZoom(product)}
      >
        <img
          src={product.imageUrl}
          alt={product.name}
          className={`absolute inset-0 w-full h-full object-contain p-10 transition-opacity duration-400 ${showReverse ? "opacity-0" : "opacity-100"}`}
        />
        {hasReverse && (
          <img
            src={product.reverseImageUrl}
            alt={`${product.name} reverse`}
            className={`absolute inset-0 w-full h-full object-contain p-10 transition-opacity duration-400 ${showReverse ? "opacity-100" : "opacity-0"}`}
          />
        )}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 bg-white/80 text-foreground/40 text-[10px] px-2 py-1 rounded-full border border-border/20 backdrop-blur-sm pointer-events-none transition-opacity">
          <ZoomIn className="w-3 h-3" />
          {hasReverse ? "Hover · Flip  Click · Zoom" : "Click to zoom"}
        </div>
        {product.iraEligible && (
          <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full border border-primary/20 shadow-sm text-xs font-semibold text-primary flex items-center gap-1.5 pointer-events-none">
            <Shield className="w-3.5 h-3.5" /> IRA Eligible
          </div>
        )}
        {hasReverse && (
          <div className={`absolute bottom-3 right-3 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all duration-300 pointer-events-none ${showReverse ? "bg-foreground/5 border-foreground/20 text-foreground/50" : "bg-primary/5 border-primary/20 text-primary/60"}`}>
            {showReverse ? "Reverse" : "Obverse"}
          </div>
        )}
      </div>

      <CardContent className="p-6">
        <div className="text-xs text-foreground/40 font-medium mb-1.5 uppercase tracking-widest">
          {product.weight} · {product.metal}
        </div>
        <h3 className="text-xl font-bold mb-4 leading-snug">{product.name}</h3>
        <div className="mb-2">
          <div className="text-3xl font-serif font-semibold text-foreground">
            ${product.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="space-y-1.5 mb-5 pb-5 border-b border-border/30 text-sm text-foreground/55">
          <div className="flex items-center justify-between">
            <span>{product.metal === "gold" ? "Gold Spot" : "Silver Spot"}</span>
            <span>${product.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          {product.deliveryWindow && (
            <div className="flex items-center justify-between">
              <span>Est. Delivery</span>
              <span className="font-medium text-foreground/70">{product.deliveryWindow}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          Available — Call to Confirm Pricing & Delivery
        </div>
      </CardContent>
    </Card>
  );
}

// ─── ZOOM DIALOG ──────────────────────────────────────────────────────────────

function ZoomDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [showReverse, setShowReverse] = useState(false);
  const hasReverse = !!product?.reverseImageUrl;
  if (!product) return null;
  return (
    <Dialog open={!!product} onOpenChange={(open) => { if (!open) { onClose(); setShowReverse(false); } }}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-white">
        <DialogTitle className="sr-only">{product.name} — Coin Image</DialogTitle>
        <div className="relative bg-white flex items-center justify-center" style={{ minHeight: 400 }}>
          <img
            src={showReverse ? (product.reverseImageUrl ?? product.imageUrl) : product.imageUrl}
            alt={`${product.name}${showReverse ? " reverse" : ""}`}
            className="w-full h-auto max-h-[500px] object-contain p-8"
          />
          {hasReverse && (
            <div className="absolute top-4 left-4 text-xs font-medium px-2.5 py-1 rounded-full bg-foreground/5 border border-foreground/15 text-foreground/50">
              {showReverse ? "Reverse" : "Obverse"}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border/20 bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{product.name}</p>
              <p className="text-xs text-foreground/50">{product.weight} · {product.metal}</p>
            </div>
            {hasReverse && (
              <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setShowReverse((v) => !v)}>
                <RotateCcw className="w-3.5 h-3.5" />
                {showReverse ? "Show Obverse" : "Show Reverse"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── SPOT CHART ───────────────────────────────────────────────────────────────

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

function SpotChart() {
  const [period, setPeriod] = useState<ChartPeriod>("1M");
  const { data, isLoading, isError } = useSpotHistory(period);

  const chartData = useMemo(() => {
    if (!data?.history?.length) return [];
    // Sample to at most 200 points for smooth rendering
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

  if (isLoading) {
    return <div className="h-[300px] rounded-xl bg-muted/30 animate-pulse" />;
  }

  if (isError || !chartData.length) {
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
    <div>
      {/* Legend + period tabs */}
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
              onClick={() => setPeriod(p)}
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
        <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
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
          <Area yAxisId="gold"   type="monotone" dataKey="goldBid"   stroke="#B5934F" strokeWidth={1.5} fill="url(#goldGrad)"   dot={false} />
          <Area yAxisId="silver" type="monotone" dataKey="silverBid" stroke="#94A3B8" strokeWidth={1.5} fill="url(#silverGrad)" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {isSynthetic && (
        <p className="text-[10px] text-foreground/35 mt-3 text-right">
          Historical prices sourced from COMEX futures markets (GC=F / SI=F). Gold began trading freely after the Bretton Woods system ended in August 1971.
        </p>
      )}
    </div>
  );
}

// ─── RATIO CARD ───────────────────────────────────────────────────────────────

function RatioCard({ ratio }: { ratio: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative bg-white rounded-2xl border border-border/40 p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-foreground/40 font-medium uppercase tracking-widest">
          Gold / Silver Ratio
        </p>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-foreground/30 hover:text-primary transition-colors p-0.5 -mr-0.5"
          aria-label="What is the gold-to-silver ratio?"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main number */}
      <p className="text-2xl font-serif font-semibold">
        {ratio ? `${ratio} : 1` : "—"}
      </p>

      {/* Plain-language explanation */}
      <p className="text-xs text-foreground/50 mt-1.5 leading-relaxed">
        {ratio
          ? `It takes ${ratio} ounces of silver to equal the value of 1 ounce of gold.`
          : "Calculating ratio…"}
      </p>

      {/* Secondary context line */}
      <p className="text-[11px] text-foreground/35 mt-1 leading-snug">
        Higher ratio = silver weaker relative to gold. Lower = silver stronger.
      </p>

      {/* Popover */}
      {open && (
        <>
          {/* Invisible backdrop to close on outside click */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />

          {/* Popover panel */}
          <div className="absolute top-full right-0 mt-2 z-30 w-full sm:w-72 bg-white border border-border/50 rounded-xl shadow-lg p-5">
            <div className="flex items-start justify-between mb-4">
              <p className="text-[13px] font-semibold text-foreground leading-snug">
                About This Ratio
              </p>
              <button
                onClick={() => setOpen(false)}
                className="text-foreground/30 hover:text-foreground/60 transition-colors ml-3 shrink-0 mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <p className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider mb-1">
                  What is the gold-to-silver ratio?
                </p>
                <p className="text-[12px] text-foreground/55 leading-relaxed">
                  The gold-to-silver ratio shows how many ounces of silver it takes to equal the value of 1 ounce of gold.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider mb-1">
                  What does {ratio ? `${ratio}:1` : "this"} mean?
                </p>
                <p className="text-[12px] text-foreground/55 leading-relaxed">
                  {ratio
                    ? `It means ${ratio} ounces of silver are worth about the same as 1 ounce of gold at current market prices.`
                    : "The ratio compares the current price of gold to the current price of silver."}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider mb-1">
                  Why does it matter?
                </p>
                <p className="text-[12px] text-foreground/55 leading-relaxed">
                  Some investors use the ratio to compare the relative pricing of gold and silver.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider mb-1">
                  What it does not tell you
                </p>
                <p className="text-[12px] text-foreground/55 leading-relaxed">
                  The ratio is not a guarantee, prediction, or timing signal. It is a comparison tool, not a decision by itself.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── LIVE PRICING PAGE ────────────────────────────────────────────────────────

function useSecondsSince(isoString: string | undefined) {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!isoString) { setSeconds(null); return; }
    const tick = () => setSeconds(Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isoString]);
  return seconds;
}

function formatAge(s: number | null): string {
  if (s === null) return "";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function LivePricing() {
  usePageMeta({
    title: "Live Precious Metals Pricing | West Hills Capital",
    description: "View real-time gold and silver spot prices, current product pricing, and buyback rates. Updated continuously so you always know exactly what you're paying.",
    ogImage: "https://westhillscapital.com/opengraph.jpg",
    canonical: "https://westhillscapital.com/pricing",
  });

  const { data: pricingData, isLoading: loadingProducts, refetch: refetchProducts } = useProductPrices();
  const { data: buybackData, isLoading: loadingBuybacks } = useBuybackPrices();
  const { data: spotData, refetch: refetchSpot, dataUpdatedAt: spotUpdatedAt } = useSpotPrices();
  const [zoomProduct, setZoomProduct] = useState<Product | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const ratio = spotData?.gold && spotData?.silver
    ? (spotData.gold / spotData.silver).toFixed(1)
    : null;

  // Use the earliest of the two update times for the display
  const updatedAt = spotData?.lastUpdated ?? (spotUpdatedAt ? new Date(spotUpdatedAt).toISOString() : undefined);
  const ageSeconds = useSecondsSince(updatedAt);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchSpot(), refetchProducts()]);
    setIsRefreshing(false);
  }, [refetchSpot, refetchProducts]);

  return (
    <div className="w-full bg-background min-h-screen pt-12 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* PAGE HEADER */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold mb-5">Live Market Pricing</h1>
          <p className="text-foreground/60 text-lg leading-relaxed mb-4">
            Pricing is based on live market conditions and updated regularly. We apply a consistent, transparent spread to market-based pricing across the products we offer.
          </p>
          {/* Refresh indicator */}
          <div className="inline-flex items-center gap-2.5 text-xs text-foreground/40">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"
              style={{ animation: "pulse 2s infinite" }}
            />
            {ageSeconds !== null ? (
              <span>Updated {formatAge(ageSeconds)}</span>
            ) : (
              <span>Loading prices…</span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="ml-1 inline-flex items-center gap-1 text-foreground/40 hover:text-primary transition-colors disabled:opacity-50"
              title="Refresh prices"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* MARKET DATA — spot stats + chart */}
        <div className="max-w-5xl mx-auto mb-14">

          {/* UNAVAILABILITY NOTICE — shown only when live spot data cannot be fetched */}
          {spotData === null && (
            <div className="rounded-xl border border-border/30 bg-muted/30 px-5 py-3 mb-5 text-center">
              <p className="text-sm text-foreground/50">
                Live spot pricing is temporarily unavailable. Please call us at{" "}
                <a href="tel:8008676768" className="text-foreground/70 font-medium hover:text-primary transition-colors">(800) 867-6768</a>
                {" "}for current pricing.
              </p>
            </div>
          )}

          {/* SPOT STATS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {/* Gold Spot */}
            <div className="bg-white rounded-2xl border border-border/40 p-5">
              <p className="text-xs text-foreground/40 font-medium uppercase tracking-widest mb-2">Gold Spot</p>
              <p className="text-2xl font-serif font-semibold">
                {spotData?.gold != null ? `$${spotData.gold.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
              </p>
              {spotData?.goldChange !== undefined && (
                <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${spotData.goldChange >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {spotData.goldChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {spotData.goldChange >= 0 ? "+" : ""}{spotData.goldChange.toFixed(2)} ({spotData.goldChangePercent?.toFixed(2)}%)
                </div>
              )}
            </div>

            {/* Silver Spot */}
            <div className="bg-white rounded-2xl border border-border/40 p-5">
              <p className="text-xs text-foreground/40 font-medium uppercase tracking-widest mb-2">Silver Spot</p>
              <p className="text-2xl font-serif font-semibold">
                {spotData?.silver != null ? `$${spotData.silver.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
              </p>
              {spotData?.silverChange !== undefined && (
                <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${spotData.silverChange >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {spotData.silverChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {spotData.silverChange >= 0 ? "+" : ""}{spotData.silverChange.toFixed(2)} ({spotData.silverChangePercent?.toFixed(2)}%)
                </div>
              )}
            </div>

            {/* Gold/Silver Ratio */}
            <RatioCard ratio={ratio} />
          </div>

          {/* CHART */}
          <div className="bg-white rounded-2xl border border-border/40 p-6">
            <h2 className="text-sm font-semibold text-foreground/60 uppercase tracking-widest mb-5">Spot Price History</h2>
            <SpotChart />
          </div>
        </div>

        {/* PRODUCTS GRID */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl font-serif font-semibold mb-3">Products We Offer</h2>
          <p className="text-foreground/55 leading-relaxed">Final trade pricing is confirmed at the time of execution.</p>
        </div>

        {loadingProducts ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {[1, 2, 3].map((i) => <Card key={i} className="h-[580px] animate-pulse bg-white/50" />)}
          </div>
        ) : pricingData === null ? (
          <div className="max-w-2xl mx-auto rounded-2xl border border-border/30 bg-muted/30 py-16 px-8 text-center mb-20">
            <p className="text-foreground/55 mb-2">Product pricing is temporarily unavailable.</p>
            <p className="text-sm text-foreground/40 mb-6">
              Please call us at{" "}
              <a href="tel:8008676768" className="font-medium text-foreground/60 hover:text-primary transition-colors">(800) 867-6768</a>
              {" "}or schedule a call for current pricing.
            </p>
            <Link href="/schedule">
              <Button size="lg" className="h-12 px-10 group">
                Schedule Your Call
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
              {pricingData.products.map((product) => (
                <ProductCard key={product.id} product={product} onZoom={setZoomProduct} />
              ))}
            </div>
            <div className="text-center mb-20">
              <p className="text-sm text-foreground/50 mb-4">
                Prices are updated based on live market conditions. Final pricing is confirmed at the time of execution.
              </p>
              <Link href="/schedule">
                <Button size="lg" className="h-12 px-10 group">
                  Discuss Your Purchase
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </>
        )}

        {/* BUYBACK SECTION */}
        <div className="max-w-4xl mx-auto mb-14">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif font-semibold mb-3">Buyback Indications</h2>
            <p className="text-foreground/60 leading-relaxed">
              We bid on the products we sell. The following are live indications based on current market conditions.
            </p>
          </div>
          <Card className="overflow-hidden border border-border/40">
            <div className="bg-foreground text-white p-5">
              <div className="grid grid-cols-12 gap-4 text-xs font-semibold tracking-widest uppercase opacity-60">
                <div className="col-span-6 md:col-span-5">Product</div>
                <div className="hidden md:block col-span-3 text-right">Indicative Spread</div>
                <div className="col-span-6 md:col-span-4 text-right">Est. Buyback Price</div>
              </div>
            </div>
            <div className="divide-y divide-border/40">
              {loadingBuybacks ? (
                <div className="p-8 text-center text-foreground/40">Loading buyback indications...</div>
              ) : buybackData === null ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-foreground/45">Buyback indications are temporarily unavailable.</p>
                  <p className="text-xs text-foreground/35 mt-1">
                    Call <a href="tel:8008676768" className="hover:text-primary transition-colors">(800) 867-6768</a> for current buyback pricing.
                  </p>
                </div>
              ) : (
                buybackData.prices.map((item) => (
                  <div key={item.productId} className="grid grid-cols-12 gap-4 p-5 items-center hover:bg-muted/20 transition-colors">
                    <div className="col-span-6 md:col-span-5 font-semibold text-sm">{item.productName}</div>
                    <div className="hidden md:block col-span-3 text-right text-foreground/50 text-sm">Market −{item.buybackSpreadPercent}%</div>
                    <div className="col-span-6 md:col-span-4 text-right font-serif text-xl font-semibold text-primary">
                      ${item.buybackPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))
              )}
            </div>
            {buybackData?.disclaimer && (
              <div className="bg-muted/40 p-4 text-xs text-foreground/45 text-center border-t border-border/30">
                {buybackData.disclaimer}
              </div>
            )}
          </Card>
        </div>

        {/* FUNDING & TRADE CONFIRMATION POLICY */}
        <div className="max-w-3xl mx-auto border border-border/40 rounded-2xl p-7 bg-white">
          <h3 className="text-lg font-serif font-semibold mb-4 text-center">Funding & Trade Confirmation Policy</h3>
          <div className="space-y-3 text-sm text-foreground/60 leading-relaxed">
            <p>Trades are confirmed directly with a representative prior to execution.</p>
            <p>Wire transfers must be received by the end of the next business day following trade confirmation. Personal and business checks are accepted. Execution and shipment occur only after funds are fully cleared and available without restriction.</p>
            <p>Final trade pricing is confirmed at the time of execution.</p>
          </div>
        </div>

      </div>

      {/* ZOOM LIGHTBOX */}
      <ZoomDialog product={zoomProduct} onClose={() => setZoomProduct(null)} />
    </div>
  );
}
