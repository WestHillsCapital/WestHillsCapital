import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ShieldCheck, Scale, Banknote, History, CheckCircle2, Shield } from "lucide-react";
import { useProductPrices } from "@/hooks/use-pricing";

export default function Home() {
  const { data: pricingData, isLoading: loadingProducts } = useProductPrices();

  const principles = [
    "Transparent, market-based pricing with no hidden fees",
    "No leverage or margin accounts",
    "No speculative positioning",
    "Pricing confirmed at time of execution",
    "Clear documentation and confirmation on every trade",
    "Reliable buyback support",
  ];

  return (
    <div className="w-full flex flex-col min-h-screen">

      {/* HERO + PRODUCTS */}
      <section className="relative pt-16 pb-0 overflow-hidden bg-background">
        <div className="absolute inset-0 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/90 to-background" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

          {/* HERO TEXT */}
          <div className="text-center max-w-3xl mx-auto pt-10 pb-10">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif font-semibold text-foreground leading-[1.1] mb-6">
              Physical Gold and Silver{" "}
              <span className="text-primary italic">— As True as Time.</span>
            </h1>
            <p className="text-xl sm:text-2xl text-foreground/80 mb-2 font-medium">
              Buy physical gold and silver with transparent pricing for delivery or IRA accounts.
            </p>
            <p className="text-base sm:text-lg text-foreground/50 mb-0">
              Disciplined execution. No gimmicks. No short-term speculation.
            </p>
          </div>

          {/* FEATURED PRODUCT CARDS */}
          {loadingProducts ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[480px] rounded-2xl bg-white/50 animate-pulse border border-border/40" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {pricingData?.products.map((product) => (
                <Card
                  key={product.id}
                  className="overflow-hidden group border border-border/40 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white"
                >
                  {/*
                    PRODUCT IMAGE AREA
                    — clean white background for easy image replacement
                    — swap product.imageUrl for any higher-quality image path later
                    — consistent h-56 height, centered, object-contain, no clipping
                  */}
                  <div className="h-56 bg-white flex items-center justify-center relative border-b border-border/20 p-6">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                    {product.iraEligible && (
                      <div className="absolute top-3 right-3 bg-white px-2.5 py-1 rounded-full border border-primary/20 text-xs font-semibold text-primary flex items-center gap-1.5 shadow-sm">
                        <Shield className="w-3 h-3" /> IRA Eligible
                      </div>
                    )}
                  </div>

                  <CardContent className="p-5">
                    <div className="text-xs text-foreground/40 font-medium mb-1 uppercase tracking-widest">
                      {product.weight} · {product.metal}
                    </div>
                    <h3 className="text-base font-bold mb-4 leading-snug">{product.name}</h3>

                    {/* PRICING — final price dominant, spot reference secondary */}
                    <div className="mb-1">
                      <div className="text-3xl font-serif font-semibold text-foreground mb-1">
                        ${product.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="space-y-1 mb-4 text-xs text-foreground/50">
                      <div className="flex items-center justify-between">
                        <span>Spot Reference</span>
                        <span>${product.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <Link href="/schedule">
                      <Button variant="outline" className="w-full h-9 text-sm border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors">
                        Discuss Purchase
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ONE PRIMARY + ONE SECONDARY CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pb-16">
            <Link href="/schedule">
              <Button size="lg" className="h-12 px-8 text-base group">
                Schedule Allocation Call
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base bg-white/70 backdrop-blur-sm">
                View Full Live Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* A GROUNDED APPROACH */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl lg:text-4xl font-serif font-semibold mb-5">A Grounded Approach</h2>
            <p className="text-foreground/60 text-lg leading-relaxed">
              We help long-term investors buy physical gold and silver — for direct delivery to your home or vault, or through an IRA rollover or transfer. Transparent pricing. No pressure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            {[
              {
                icon: <Scale className="w-7 h-7 text-primary" />,
                title: "Transparent Pricing",
                desc: "Pricing is based on live market conditions with a consistent, disclosed spread. Final pricing is confirmed at the time of execution — no surprises.",
              },
              {
                icon: <Banknote className="w-7 h-7 text-primary" />,
                title: "Delivery or IRA",
                desc: "Buy for physical delivery to your home or vault, or allocate through a tax-advantaged IRA rollover or transfer.",
              },
              {
                icon: <History className="w-7 h-7 text-primary" />,
                title: "Long-Term Perspective",
                desc: "We approach gold and silver as foundational holdings for serious investors — not short-term trades or speculative positions.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-7 rounded-2xl bg-background border border-border/50 hover:shadow-md transition-shadow duration-300 group"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-foreground/60 leading-relaxed text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OPERATING PRINCIPLES */}
      <section className="py-20 bg-foreground text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl lg:text-5xl font-serif font-semibold mb-7 text-white">
                Our Operating Principles
              </h2>
              <p className="text-white/60 text-lg mb-8 leading-relaxed">
                Trust is built through consistent, transparent behavior. These principles guide every purchase discussion and every trade we execute on your behalf.
              </p>
              <ul className="space-y-3">
                {principles.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/80">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Link href="/about">
                  <Button
                    variant="outline"
                    className="text-white border-white/20 hover:bg-white/10 hover:text-white h-11 px-7"
                  >
                    Read Our Story
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl relative">
                <img
                  src={`${import.meta.env.BASE_URL}images/coins-hero.jpg`}
                  alt="Gold and silver coins"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: "28% center" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground to-transparent sm:opacity-60 opacity-30" />
                <div className="hidden sm:block absolute bottom-7 left-7 right-7">
                  <div className="p-5 rounded-xl bg-black/50 border border-white/10 backdrop-blur-sm">
                    <ShieldCheck className="w-9 h-9 text-primary mb-3" />
                    <h3 className="text-white font-serif text-lg mb-1">Commitment to Stewardship</h3>
                    <p className="text-white/60 text-sm">
                      We treat every purchase discussion with the gravity and respect your capital demands.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="py-20 bg-primary/5">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-serif font-semibold mb-5">
            Ready to discuss your purchase?
          </h2>
          <p className="text-foreground/60 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            Every purchase begins with a private call to review your objectives, confirm current pricing, and establish delivery or IRA logistics. No automated execution. No pressure.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/schedule">
              <Button size="lg" className="h-13 px-10 text-base shadow-md">
                Schedule Allocation Call
              </Button>
            </Link>
            <a href="tel:8008676768">
              <Button variant="outline" size="lg" className="h-13 px-10 text-base bg-white">
                Call 800-867-6768
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
