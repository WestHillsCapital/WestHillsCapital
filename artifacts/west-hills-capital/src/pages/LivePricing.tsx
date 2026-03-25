import { useState } from "react";
import { useProductPrices, useBuybackPrices } from "@/hooks/use-pricing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Link } from "wouter";
import { Shield, ArrowRight, ZoomIn, RotateCcw } from "lucide-react";

type Product = NonNullable<ReturnType<typeof useProductPrices>["data"]>["products"][number];

function ProductCard({ product, onZoom }: { product: Product; onZoom: (p: Product) => void }) {
  const [showReverse, setShowReverse] = useState(false);
  const hasReverse = !!product.reverseImageUrl;

  return (
    <Card className="overflow-hidden group bg-white border border-border/40 shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* IMAGE AREA */}
      <div
        className="h-72 bg-white flex items-center justify-center relative border-b border-border/20 p-10 cursor-zoom-in select-none"
        onMouseEnter={() => hasReverse && setShowReverse(true)}
        onMouseLeave={() => setShowReverse(false)}
        onClick={() => onZoom(product)}
      >
        {/* Obverse */}
        <img
          src={product.imageUrl}
          alt={product.name}
          className={`absolute inset-0 w-full h-full object-contain p-10 transition-opacity duration-400 ${showReverse ? "opacity-0" : "opacity-100"}`}
        />
        {/* Reverse (only for Gold Eagle which has DG reverse image) */}
        {hasReverse && (
          <img
            src={product.reverseImageUrl}
            alt={`${product.name} reverse`}
            className={`absolute inset-0 w-full h-full object-contain p-10 transition-opacity duration-400 ${showReverse ? "opacity-100" : "opacity-0"}`}
          />
        )}

        {/* Zoom hint — visible on hover */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 bg-white/80 text-foreground/40 text-[10px] px-2 py-1 rounded-full border border-border/20 backdrop-blur-sm pointer-events-none transition-opacity hover:opacity-100">
          <ZoomIn className="w-3 h-3" />
          {hasReverse ? "Hover · Flip  Click · Zoom" : "Click to zoom"}
        </div>

        {/* IRA badge */}
        {product.iraEligible && (
          <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full border border-primary/20 shadow-sm text-xs font-semibold text-primary flex items-center gap-1.5 pointer-events-none">
            <Shield className="w-3.5 h-3.5" /> IRA Eligible
          </div>
        )}

        {/* Side label when showing reverse */}
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

        {/* PRICE */}
        <div className="mb-2">
          <div className="text-3xl font-serif font-semibold text-foreground">
            ${product.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* SPOT + DELIVERY */}
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

function ZoomDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [showReverse, setShowReverse] = useState(false);
  const hasReverse = !!product?.reverseImageUrl;

  if (!product) return null;

  return (
    <Dialog open={!!product} onOpenChange={(open) => { if (!open) { onClose(); setShowReverse(false); } }}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-white">
        <DialogTitle className="sr-only">{product.name} — Coin Image</DialogTitle>
        {/* Image area */}
        <div className="relative bg-white flex items-center justify-center" style={{ minHeight: 400 }}>
          <img
            src={showReverse ? (product.reverseImageUrl ?? product.imageUrl) : product.imageUrl}
            alt={`${product.name}${showReverse ? " reverse" : ""}`}
            className="w-full h-auto max-h-[500px] object-contain p-8"
          />
          {/* Side indicator */}
          {hasReverse && (
            <div className="absolute top-4 left-4 text-xs font-medium px-2.5 py-1 rounded-full bg-foreground/5 border border-foreground/15 text-foreground/50">
              {showReverse ? "Reverse" : "Obverse"}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-t border-border/20 bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{product.name}</p>
              <p className="text-xs text-foreground/50">{product.weight} · {product.metal}</p>
            </div>
            {hasReverse && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => setShowReverse((v) => !v)}
              >
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

export default function LivePricing() {
  const { data: pricingData, isLoading: loadingProducts } = useProductPrices();
  const { data: buybackData, isLoading: loadingBuybacks } = useBuybackPrices();
  const [zoomProduct, setZoomProduct] = useState<Product | null>(null);

  return (
    <div className="w-full bg-background min-h-screen pt-12 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* PAGE HEADER */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold mb-5">Live Market Pricing</h1>
          <p className="text-foreground/60 text-lg leading-relaxed">
            Pricing is based on live market conditions and updated regularly. We apply a consistent, transparent spread to market-based pricing across the products we offer.
          </p>
          <p className="text-sm text-foreground/45 mt-3">
            Final trade pricing is confirmed at the time of execution.
          </p>
        </div>

        {/* PRODUCTS GRID */}
        {loadingProducts ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-[580px] animate-pulse bg-white/50" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
              {pricingData?.products.map((product) => (
                <ProductCard key={product.id} product={product} onZoom={setZoomProduct} />
              ))}
            </div>

            {/* SINGLE SECTION-WIDE CTA */}
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
                  <div
                    key={item.productId}
                    className="grid grid-cols-12 gap-4 p-5 items-center hover:bg-muted/20 transition-colors"
                  >
                    <div className="col-span-6 md:col-span-5 font-semibold text-sm">{item.productName}</div>
                    <div className="hidden md:block col-span-3 text-right text-foreground/50 text-sm">
                      Market −{item.buybackSpreadPercent}%
                    </div>
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
            <p>
              Trades are confirmed directly with a representative prior to execution.
            </p>
            <p>
              Wire transfers must be received by the end of the next business day following trade confirmation. Personal and business checks are accepted. Execution and shipment occur only after funds are fully cleared and available without restriction.
            </p>
            <p>
              Final trade pricing is confirmed at the time of execution.
            </p>
          </div>
        </div>

      </div>

      {/* ZOOM LIGHTBOX */}
      <ZoomDialog product={zoomProduct} onClose={() => setZoomProduct(null)} />
    </div>
  );
}
