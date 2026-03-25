import { useState, useMemo } from "react";
import { useProductPrices, useBuybackPrices, useSpotPrices, useSpotHistory } from "@/hooks/use-pricing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Link } from "wouter";
import { Shield, ArrowRight, ZoomIn, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";

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

function SpotChart() {
  const [period, setPeriod] = useState<"1W" | "1M">("1W");
  const { data, isLoading } = useSpotHistory();

  const chartData = useMemo(() => {
    if (!data?.history?.length) return [];
    const cutoff = subDays(new Date(), period === "1W" ? 7 : 30);
    const filtered = data.history.filter((h) => new Date(h.timestamp) >= cutoff);
    // Sample to at most 200 points for smooth rendering
    const step = Math.max(1, Math.floor(filtered.length / 200));
    return filtered
      .filter((_, i) => i % step === 0 || i === filtered.length - 1)
      .map((h) => ({
        ...h,
        label: format(new Date(h.timestamp), period === "1W" ? "MM/dd HH:mm" : "MM/dd"),
      }));
  }, [data, period]);

  const goldRange = useMemo((): [number, number] => {
    if (!chartData.length) return [4000, 5000];
    const vals = chartData.map((d) => d.goldBid);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.15, 30);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [chartData]);

  const silverRange = useMemo((): [number, number] => {
    if (!chartData.length) return [60, 85];
    const vals = chartData.map((d) => d.silverBid);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.15, 1);
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  }, [chartData]);

  if (isLoading) {
    return <div className="h-[280px] rounded-xl bg-muted/30 animate-pulse" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 text-xs text-foreground/50">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-500 inline-block rounded" /> Gold (left axis)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-slate-400 inline-block rounded" /> Silver (right axis)
          </span>
        </div>
        <div className="flex gap-1">
          {(["1W", "1M"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${period === p ? "bg-foreground text-white" : "bg-muted text-foreground/50 hover:text-foreground"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
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
            tickFormatter={(v: number) => `$${v.toFixed(1)}`}
            width={44}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const gold = payload.find((p) => p.dataKey === "goldBid");
              const silver = payload.find((p) => p.dataKey === "silverBid");
              return (
                <div className="bg-white border border-border/40 rounded-lg p-3 shadow-md text-xs">
                  <p className="text-foreground/50 mb-1.5">{payload[0]?.payload?.label}</p>
                  {gold && <p className="font-semibold text-amber-600">Gold: ${Number(gold.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>}
                  {silver && <p className="font-semibold text-slate-500">Silver: ${Number(silver.value).toFixed(2)}</p>}
                </div>
              );
            }}
          />
          <Area yAxisId="gold" type="monotone" dataKey="goldBid" stroke="#B5934F" strokeWidth={1.5} fill="url(#goldGrad)" dot={false} />
          <Area yAxisId="silver" type="monotone" dataKey="silverBid" stroke="#94A3B8" strokeWidth={1.5} fill="url(#silverGrad)" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function LivePricing() {
  const { data: pricingData, isLoading: loadingProducts } = useProductPrices();
  const { data: buybackData, isLoading: loadingBuybacks } = useBuybackPrices();
  const { data: spotData } = useSpotPrices();
  const [zoomProduct, setZoomProduct] = useState<Product | null>(null);

  const ratio = spotData?.goldBid && spotData?.silverBid
    ? (spotData.goldBid / spotData.silverBid).toFixed(1)
    : null;

  return (
    <div className="w-full bg-background min-h-screen pt-12 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* PAGE HEADER */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold mb-5">Live Market Pricing</h1>
          <p className="text-foreground/60 text-lg leading-relaxed">
            Pricing is based on live market conditions and updated regularly. We apply a consistent, transparent spread to market-based pricing across the products we offer.
          </p>
        </div>

        {/* MARKET DATA — spot stats + chart */}
        <div className="max-w-5xl mx-auto mb-14">

          {/* SPOT STATS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {/* Gold Spot */}
            <div className="bg-white rounded-2xl border border-border/40 p-5">
              <p className="text-xs text-foreground/40 font-medium uppercase tracking-widest mb-2">Gold Spot</p>
              <p className="text-2xl font-serif font-semibold">
                {spotData ? `$${spotData.goldBid.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
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
                {spotData ? `$${spotData.silverBid.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
              </p>
              {spotData?.silverChange !== undefined && (
                <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${spotData.silverChange >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {spotData.silverChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {spotData.silverChange >= 0 ? "+" : ""}{spotData.silverChange.toFixed(3)} ({spotData.silverChangePercent?.toFixed(2)}%)
                </div>
              )}
            </div>

            {/* Gold/Silver Ratio */}
            <div className="bg-white rounded-2xl border border-border/40 p-5">
              <p className="text-xs text-foreground/40 font-medium uppercase tracking-widest mb-2">Gold / Silver Ratio</p>
              <p className="text-2xl font-serif font-semibold">
                {ratio ? `${ratio} : 1` : "—"}
              </p>
              <p className="text-xs text-foreground/40 mt-1.5 leading-relaxed">
                Ounces of silver to buy 1 oz gold. Historical avg ~55–75.
              </p>
            </div>
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
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
              {pricingData?.products.map((product) => (
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
              ) : (
                buybackData?.prices.map((item) => (
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
