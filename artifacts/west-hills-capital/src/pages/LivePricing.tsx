import { useProductPrices, useBuybackPrices } from "@/hooks/use-pricing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Check, Shield, Info } from "lucide-react";

export default function LivePricing() {
  const { data: pricingData, isLoading: loadingProducts } = useProductPrices();
  const { data: buybackData, isLoading: loadingBuybacks } = useBuybackPrices();

  return (
    <div className="w-full bg-background min-h-screen pt-12 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in">
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold mb-6">Live Wholesale Pricing</h1>
          <p className="text-foreground/70 text-lg">
            We offer transparent, highly competitive pricing on the most liquid sovereign bullion coins. Prices update dynamically with global spot markets.
          </p>
        </div>

        {/* PRODUCTS GRID */}
        {loadingProducts ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-[500px] animate-pulse bg-white/50" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {pricingData?.products.map((product, idx) => (
              <Card key={product.id} className="overflow-hidden group animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                <div className="h-64 bg-[#F8F9FA] p-8 flex items-center justify-center relative border-b border-border/50">
                  <img 
                    src={product.imageUrl} 
                    alt={product.name} 
                    className="w-48 h-48 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-500"
                  />
                  {product.iraEligible && (
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full border border-border shadow-sm text-xs font-semibold text-primary flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> IRA Eligible
                    </div>
                  )}
                </div>
                <CardContent className="p-6">
                  <div className="text-sm text-foreground/50 font-medium mb-2 uppercase tracking-wider">{product.weight} {product.metal}</div>
                  <h3 className="text-xl font-bold mb-4 h-14 line-clamp-2">{product.name}</h3>
                  
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <div className="text-3xl font-serif font-semibold text-foreground">
                        ${product.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-foreground/60 mt-1">
                        Spot + {product.spreadPercent}% premium
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-8 text-sm text-foreground/70 border-t border-border/50 pt-6">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      In Stock: {product.deliveryWindow}
                    </div>
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="leading-snug text-xs">{product.description}</span>
                    </div>
                  </div>

                  <Link href="/schedule">
                    <Button className="w-full h-12">Schedule Call to Execute</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* BUYBACK SECTION */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-serif font-semibold mb-4">Reliable Buyback Program</h2>
            <p className="text-foreground/70">
              A serious allocation requires a serious exit strategy. We bid aggressively on the products we sell.
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="bg-foreground text-white p-6">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium tracking-wide opacity-80">
                <div className="col-span-6 md:col-span-5">PRODUCT</div>
                <div className="hidden md:block col-span-3 text-right">SPREAD TO SPOT</div>
                <div className="col-span-6 md:col-span-4 text-right">EST. BUYBACK PRICE</div>
              </div>
            </div>
            <div className="divide-y divide-border">
              {loadingBuybacks ? (
                <div className="p-8 text-center text-foreground/50">Loading buyback indications...</div>
              ) : (
                buybackData?.prices.map((item) => (
                  <div key={item.productId} className="grid grid-cols-12 gap-4 p-6 items-center hover:bg-gray-50 transition-colors">
                    <div className="col-span-6 md:col-span-5 font-semibold">
                      {item.productName}
                    </div>
                    <div className="hidden md:block col-span-3 text-right text-foreground/70">
                      Spot {item.buybackSpreadPercent}%
                    </div>
                    <div className="col-span-6 md:col-span-4 text-right font-serif text-xl font-semibold text-primary">
                      ${item.buybackPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))
              )}
            </div>
            {buybackData?.disclaimer && (
              <div className="bg-muted p-4 text-xs text-foreground/60 text-center border-t border-border">
                {buybackData.disclaimer}
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
