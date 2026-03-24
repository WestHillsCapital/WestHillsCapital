import { useProductPrices, useBuybackPrices } from "@/hooks/use-pricing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Shield, Truck, ArrowRight } from "lucide-react";

export default function LivePricing() {
  const { data: pricingData, isLoading: loadingProducts } = useProductPrices();
  const { data: buybackData, isLoading: loadingBuybacks } = useBuybackPrices();

  return (
    <div className="w-full bg-background min-h-screen pt-12 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center max-w-3xl mx-auto mb-14">
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold mb-5">Live Wholesale Pricing</h1>
          <p className="text-foreground/60 text-lg leading-relaxed">
            Transparent, competitive pricing on the most liquid sovereign bullion coins — available for physical delivery or IRA allocation. All prices reflect current spot markets.
          </p>
        </div>

        {/* PRODUCTS GRID */}
        {loadingProducts ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-[540px] animate-pulse bg-white/50" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
              {pricingData?.products.map((product, idx) => (
                <Card
                  key={product.id}
                  className="overflow-hidden group bg-white border border-border/40 shadow-sm hover:shadow-md transition-shadow duration-300"
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  {/* PRODUCT IMAGE — larger, clean white bg */}
                  <div className="h-72 bg-white flex items-center justify-center relative border-b border-border/20 px-10 py-8">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                    {product.iraEligible && (
                      <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full border border-primary/20 shadow-sm text-xs font-semibold text-primary flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" /> IRA Eligible
                      </div>
                    )}
                  </div>

                  <CardContent className="p-6">
                    <div className="text-xs text-foreground/40 font-medium mb-1.5 uppercase tracking-widest">
                      {product.weight} · {product.metal}
                    </div>
                    <h3 className="text-xl font-bold mb-5 leading-snug">{product.name}</h3>

                    {/* PRICING TABLE — easy to scan */}
                    <div className="space-y-2 mb-5 pb-5 border-b border-border/30">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-foreground/50">Price</span>
                        <span className="text-3xl font-serif font-semibold text-foreground">
                          ${product.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-foreground/55">
                        <span>Spot</span>
                        <span>${product.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-foreground/55">
                        <span>Spread</span>
                        <span>+{product.spreadPercent}% over spot</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-foreground/55 mb-0">
                      <Truck className="w-4 h-4 text-primary/60 shrink-0" />
                      Estimated Delivery: {product.deliveryWindow}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* SINGLE SECTION-WIDE CTA — no heavy buttons per card */}
            <div className="text-center mb-20">
              <p className="text-sm text-foreground/55 mb-4">
                Pricing is updated live. All purchases require verbal confirmation.
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
              We bid on the products we sell. The following are live indications based on current spot prices.
            </p>
          </div>

          <Card className="overflow-hidden border border-border/40">
            <div className="bg-foreground text-white p-5">
              <div className="grid grid-cols-12 gap-4 text-xs font-semibold tracking-widest uppercase opacity-60">
                <div className="col-span-6 md:col-span-5">Product</div>
                <div className="hidden md:block col-span-3 text-right">Spread to Spot</div>
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
                    <div className="hidden md:block col-span-3 text-right text-foreground/55 text-sm">
                      Spot −{item.buybackSpreadPercent}%
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

        {/* FUNDING POLICY NOTE */}
        <div className="max-w-3xl mx-auto border border-border/40 rounded-2xl p-7 bg-white text-center">
          <h3 className="text-lg font-serif font-semibold mb-3">Funding & Trade Confirmation Policy</h3>
          <p className="text-sm text-foreground/55 leading-relaxed">
            All purchases are executed only after verbal confirmation and receipt of cleared funds. There is no automated order execution. Every transaction is confirmed in a private call before any trade is initiated.
          </p>
        </div>

      </div>
    </div>
  );
}
