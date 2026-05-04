import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { COINS } from "@/data/seo/coins";
import { useSpotPrices } from "@/hooks/use-pricing";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield } from "lucide-react";

export default function CoinsHubPage() {
  const iraCoins = COINS.filter((c) => c.iraEligible);

  usePageMeta({
    title: "Sovereign Bullion Coins | Physical Gold & Silver | West Hills Capital",
    description:
      "West Hills Capital sources the world's most recognized sovereign bullion coins — American Gold Eagles, Canadian Maple Leafs, Krugerrands, and more. IRA-eligible options available. View specs, live pricing, and year-by-year pages.",
    canonical: "https://westhillscapital.com/products",
  });

  const { data: spotData } = useSpotPrices();

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Sovereign Bullion Coins — Gold & Silver",
    "description": "Sovereign bullion coins available through West Hills Capital for direct purchase or Precious Metals IRA.",
    "numberOfItems": COINS.length,
    "itemListElement": COINS.map((c, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": c.name,
      "url": `https://westhillscapital.com/products/${c.slug}`,
    })),
  };

  return (
    <div className="w-full bg-background min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <section className="bg-foreground text-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-4">
            Products
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold text-white mb-5 leading-tight">
            Sovereign Bullion Coins
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-3xl">
            West Hills Capital sources the world's most recognized sovereign bullion coins — American Gold Eagles, Canadian Maple Leafs, Australian Kangaroos, Gold Buffalos, Krugerrands, and Silver Eagles. Government-minted, transparently priced, and most are IRA-eligible.
          </p>
          {(spotData?.gold || spotData?.silver) && (
            <div className="flex flex-wrap gap-4 mt-8">
              {spotData?.gold && (
                <div className="bg-white/10 rounded-xl px-4 py-2.5">
                  <p className="text-white/50 text-xs mb-0.5">Gold Spot</p>
                  <p className="text-white font-semibold">
                    ${spotData.gold.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <span className="text-white/40 font-normal text-xs ml-1">/ oz</span>
                  </p>
                </div>
              )}
              {spotData?.silver && (
                <div className="bg-white/10 rounded-xl px-4 py-2.5">
                  <p className="text-white/50 text-xs mb-0.5">Silver Spot</p>
                  <p className="text-white font-semibold">
                    ${spotData.silver.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <span className="text-white/40 font-normal text-xs ml-1">/ oz</span>
                  </p>
                </div>
              )}
              <Link href="/pricing">
                <div className="bg-primary/20 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-primary/30 transition-colors flex items-center gap-1.5">
                  <p className="text-primary text-sm font-semibold">See product pricing</p>
                  <ArrowRight className="w-3.5 h-3.5 text-primary" />
                </div>
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {COINS.map((coin) => {
              const spotPrice = coin.metal === "gold" ? spotData?.gold : spotData?.silver;
              return (
                <Link key={coin.slug} href={`/products/${coin.slug}`}>
                  <div className="group bg-white border border-border/40 rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/25 transition-all cursor-pointer h-full flex flex-col">
                    <div className={`h-2 ${coin.metal === "gold" ? "bg-amber-400" : "bg-slate-400"}`} />
                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-1">
                            {coin.metal === "gold" ? "Gold" : "Silver"} Bullion
                          </p>
                          <h2 className="font-serif text-xl font-semibold group-hover:text-primary transition-colors leading-snug">
                            {coin.name}
                          </h2>
                        </div>
                        {coin.iraEligible && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full shrink-0 ml-2">
                            <Shield className="w-3 h-3" /> IRA
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 mb-4">
                        {[
                          { label: "Purity", value: coin.purity },
                          { label: "Weight", value: coin.weight },
                          { label: "Issuer", value: coin.issuer },
                          { label: "Since", value: String(coin.mintedSince) },
                        ].map((spec) => (
                          <div key={spec.label} className="flex items-center justify-between text-sm">
                            <span className="text-foreground/45">{spec.label}</span>
                            <span className="font-medium text-foreground/80">{spec.value}</span>
                          </div>
                        ))}
                      </div>

                      {spotPrice != null && (
                        <div className="bg-muted/30 rounded-xl px-3 py-2 mb-4">
                          <p className="text-xs text-foreground/50">
                            Spot: <span className="font-semibold text-foreground/80">${spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}/oz</span>
                          </p>
                        </div>
                      )}

                      <p className="text-sm text-foreground/55 leading-relaxed flex-1 line-clamp-3">
                        {coin.description}
                      </p>

                      <div className="mt-4">
                        <p className="text-xs text-foreground/40 mb-2">
                          Years available: {coin.years[coin.years.length - 1].year}–{coin.years[0].year}
                        </p>
                        <div className="flex items-center gap-1 text-primary text-sm font-semibold">
                          View specifications
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-serif font-semibold mb-5">Why Sovereign Bullion?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                title: "Government Guaranteed",
                desc: "Every coin is backed by the U.S. government for its metal content and weight. No assay or verification required — dealers worldwide recognize them instantly.",
              },
              {
                title: "Fair Premiums",
                desc: "Bullion coins carry modest, transparent premiums over the spot price — unlike proof or collector editions, which can command 50–200% premiums that rarely survive resale.",
              },
              {
                title: "IRA Eligible Options",
                desc: `${iraCoins.length} of our ${COINS.length} coins qualify for inclusion in a self-directed Precious Metals IRA, meeting IRS purity and form requirements. The Krugerrand is available for direct purchase only.`,
              },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-border/40 rounded-2xl p-5">
                <h3 className="font-semibold mb-2 text-sm">{item.title}</h3>
                <p className="text-sm text-foreground/60 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5 border-t border-border/20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Ready to discuss a purchase?
          </h2>
          <p className="text-foreground/65 mb-8 max-w-xl mx-auto leading-relaxed">
            All purchases begin with a conversation. We confirm current pricing on the call and walk through delivery options — home delivery or IRA depository storage.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/schedule">
              <Button size="lg" className="h-12 px-10 group">
                Schedule a Call
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="h-12 px-10 bg-white">
                View Live Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
