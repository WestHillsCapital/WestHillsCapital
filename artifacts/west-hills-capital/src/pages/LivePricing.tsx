import { useProductPrices, useBuybackPrices } from "@/hooks/use-pricing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Shield, Info, Truck } from "lucide-react";

export default function LivePricing() {
  const { data: pricingData, isLoading: loadingProducts } = useProductPrices();
  const { data: buybackData, isLoading: loadingBuybacks } = useBuybackPrices();

  return (
    <div className="w-full bg-background min-h-screen pt-12 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center max-w-3xl mx-auto mb-14">
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold mb-5">Live Wholesale Pricing</h1>
          <p className="text-foreground/65 text-lg leading-relaxed">
            Transparent, competitive pricing on the most liquid sovereign bullion coins — for physical delivery and IRA allocation. Prices reflect current spot markets.
          </p>
        </div>

        {/* PRODUCTS GRID */}
        {loadingProducts ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-[520px] animate-pulse bg-white/50" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
            {pricingData?.products.map((product, idx) => (
              <Card
                key={product.id}
                className="overflow-hidden group bg-white border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="h-64 bg-[#F8F7F4] p-8 flex items-center justify-center relative border-b border-border/30">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-44 h-44 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-500"
                  />
                  {product.iraEligible && (
                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur px-3 py-1 rounded-full border border-border shadow-sm text-xs font-semibold text-primary flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> IRA Eligible
                    </div>
                  )}
                </div>
                <CardContent className="p-6">
                  <div className="text-xs text-foreground/45 font-medium mb-1.5 uppercase tracking-wider">
                    {product.weight} · {product.metal}
                  </div>
                  <h3 className="text-xl font-bold mb-4 leading-snug">{product.name}</h3>

                  <div className="flex justify-between items-end mb-5">
                    <div>
                      <div className="text-3xl font-serif font-semibold text-foreground">
                        ${product.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-foreground/55 mt-1">
                        Spot ${product.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} + {product.spreadPercent}% premium
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 mb-7 text-sm text-foreground/65 border-t border-border/40 pt-5">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary shrink-0" />
                      Estimated Delivery: {product.deliveryWindow}
                    </div>
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="leading-snug text-xs">{product.description}</span>
                    </div>
                  </div>

                  <Link href="/schedule">
                    <Button className="w-full h-11">Schedule Allocation Call</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* BUYBACK SECTION */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif font-semibold mb-3">Buyback Indications</h2>
            <p className="text-foreground/65 leading-relaxed">
              We bid on the products we sell. Buyback prices are live indications based on current spot markets.
            </p>
          </div>

          <Card className="overflow-hidden border border-border/50">
            <div className="bg-foreground text-white p-5">
              <div className="grid grid-cols-12 gap-4 text-xs font-semibold tracking-widest uppercase opacity-70">
                <div className="col-span-6 md:col-span-5">Product</div>
                <div className="hidden md:block col-span-3 text-right">Spread to Spot</div>
                <div className="col-span-6 md:col-span-4 text-right">Est. Buyback Price</div>
              </div>
            </div>
            <div className="divide-y divide-border/50">
              {loadingBuybacks ? (
                <div className="p-8 text-center text-foreground/45">Loading buyback indications...</div>
              ) : (
                buybackData?.prices.map((item) => (
                  <div
                    key={item.productId}
                    className="grid grid-cols-12 gap-4 p-5 items-center hover:bg-muted/30 transition-colors"
                  >
                    <div className="col-span-6 md:col-span-5 font-semibold text-sm">{item.productName}</div>
                    <div className="hidden md:block col-span-3 text-right text-foreground/60 text-sm">
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
              <div className="bg-muted/50 p-4 text-xs text-foreground/50 text-center border-t border-border/40">
                {buybackData.disclaimer}
              </div>
            )}
          </Card>
        </div>

        {/* FUNDING POLICY NOTE */}
        <div className="max-w-3xl mx-auto border border-border/50 rounded-2xl p-7 bg-white text-center">
          <h3 className="text-lg font-serif font-semibold mb-3">Funding & Trade Confirmation Policy</h3>
          <p className="text-sm text-foreground/60 leading-relaxed">
            All trades are executed only after verbal confirmation and receipt of cleared funds. There is no automated order execution. Every allocation is confirmed in a private call before any transaction is initiated.
          </p>
          <div className="mt-5">
            <Link href="/schedule">
              <Button size="sm" className="h-10 px-6">Schedule Allocation Call</Button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
