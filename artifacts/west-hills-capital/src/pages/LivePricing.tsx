import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useProductPrices, useBuybackPrices, useSpotPrices } from "@/hooks/use-pricing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Link } from "wouter";
import { Shield, ArrowRight, ZoomIn, RotateCcw, TrendingDown, TrendingUp, Info, X, RefreshCw } from "lucide-react";

import SpotChartSkeleton from "./SpotChartSkeleton";

const SpotChart = lazy(() => import("./SpotChart"));

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
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-3xl font-serif font-semibold text-foreground cursor-default w-fit">
                ${product.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">Ask — the price you pay to purchase this product. Includes dealer premium over spot.</TooltipContent>
          </Tooltip>
        </div>
        <div className="space-y-1.5 mb-5 pb-5 border-b border-border/30 text-sm text-foreground/55">
          <div className="flex items-center justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">{product.metal === "gold" ? "Gold Spot" : "Silver Spot"}</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">The spot price is the raw global market benchmark before any dealer premium or fabrication cost is added.</TooltipContent>
            </Tooltip>
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
    ogImage: "https://westhillscapital.com/og-pricing.jpg",
    canonical: "https://westhillscapital.com/pricing",
  });

  const { data: pricingData, isLoading: loadingProducts, refetch: refetchProducts } = useProductPrices();
  const { data: buybackData, isLoading: loadingBuybacks } = useBuybackPrices();
  const { data: spotData, refetch: refetchSpot, dataUpdatedAt: spotUpdatedAt } = useSpotPrices();
  const [zoomProduct, setZoomProduct] = useState<Product | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track when tiles should animate in — triggers on first load and on manual refresh.
  // spotData is `undefined` while loading and either an object or `null` once settled.
  const [tilesVisible, setTilesVisible] = useState(false);
  const [tilesAnimKey, setTilesAnimKey] = useState(0);
  const prevSpotDataRef = useRef<typeof spotData | "loading">("loading");
  useEffect(() => {
    if (spotData !== undefined && prevSpotDataRef.current === "loading") {
      setTilesVisible(true);
    }
    if (spotData !== undefined) {
      prevSpotDataRef.current = spotData;
    }
  }, [spotData]);

  const ratio = spotData?.gold && spotData?.silver
    ? (spotData.gold / spotData.silver).toFixed(1)
    : null;

  // Use the earliest of the two update times for the display
  const updatedAt = spotData?.lastUpdated ?? (spotUpdatedAt ? new Date(spotUpdatedAt).toISOString() : undefined);
  const ageSeconds = useSecondsSince(updatedAt);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Hide tiles so the entrance animation replays after fresh data arrives
    setTilesVisible(false);
    prevSpotDataRef.current = "loading";
    await Promise.all([refetchSpot(), refetchProducts()]);
    setIsRefreshing(false);
    // Bump key to remount tiles in their hidden state, then animate in
    setTilesAnimKey((k) => k + 1);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTilesVisible(true));
    });
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
            <div
              key={`gold-${tilesAnimKey}`}
              className="bg-white rounded-2xl border border-border/40 p-5"
              style={{
                opacity: tilesVisible ? 1 : 0,
                transform: tilesVisible ? "translateY(0)" : "translateY(10px)",
                transition: "opacity 350ms ease-out, transform 350ms ease-out",
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-foreground/40 font-medium uppercase tracking-widest mb-2 cursor-default w-fit">Gold Spot</p>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">The raw global market benchmark price for gold before any dealer premium or fabrication cost is added.</TooltipContent>
              </Tooltip>
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
            <div
              key={`silver-${tilesAnimKey}`}
              className="bg-white rounded-2xl border border-border/40 p-5"
              style={{
                opacity: tilesVisible ? 1 : 0,
                transform: tilesVisible ? "translateY(0)" : "translateY(10px)",
                transition: "opacity 350ms ease-out, transform 350ms ease-out",
                transitionDelay: tilesVisible ? "65ms" : "0ms",
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-foreground/40 font-medium uppercase tracking-widest mb-2 cursor-default w-fit">Silver Spot</p>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">The raw global market benchmark price for silver before any dealer premium or fabrication cost is added.</TooltipContent>
              </Tooltip>
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
            <div
              key={`ratio-${tilesAnimKey}`}
              style={{
                opacity: tilesVisible ? 1 : 0,
                transform: tilesVisible ? "translateY(0)" : "translateY(10px)",
                transition: "opacity 350ms ease-out, transform 350ms ease-out",
                transitionDelay: tilesVisible ? "130ms" : "0ms",
              }}
            >
              <RatioCard ratio={ratio} />
            </div>
          </div>

          {/* CHART */}
          <div className="bg-white rounded-2xl border border-border/40 p-6">
            <h2 className="text-sm font-semibold text-foreground/60 uppercase tracking-widest mb-5">Spot Price History</h2>
            <Suspense fallback={<SpotChartSkeleton />}>
              <SpotChart />
            </Suspense>
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
              {(pricingData?.products ?? []).map((product) => (
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

        {/* COIN PRODUCT PAGES */}
        <div className="max-w-5xl mx-auto mb-14">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-serif font-semibold mb-2">Coin Specifications & IRA Eligibility</h2>
            <p className="text-foreground/55 text-sm leading-relaxed">Learn more about each coin — specifications, year-by-year availability, and why sovereign bullion outperforms proof coins for long-term investors.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: "American Gold Eagle", slug: "american-gold-eagle", detail: ".9167 fine · 1 oz · IRA Eligible" },
              { name: "American Gold Buffalo", slug: "american-gold-buffalo", detail: ".9999 fine · 1 oz · IRA Eligible" },
              { name: "American Silver Eagle", slug: "american-silver-eagle", detail: ".999 fine · 1 oz · IRA Eligible" },
            ].map((coin) => (
              <Link key={coin.slug} href={`/products/${coin.slug}`}>
                <div className="group bg-white border border-border/40 rounded-xl p-5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm group-hover:text-primary transition-colors">{coin.name}</p>
                    <p className="text-xs text-foreground/45 mt-0.5">{coin.detail}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>

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
                <div className="col-span-6 md:col-span-4 text-right">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default">Est. Buyback Price</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-left">Bid — the price at which dealers buy metal back from you. Lower than the Ask (purchase) price; the difference is the dealer spread.</TooltipContent>
                  </Tooltip>
                </div>
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
                (buybackData?.prices ?? []).map((item) => (
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
