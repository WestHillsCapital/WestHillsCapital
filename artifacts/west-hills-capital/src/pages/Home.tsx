import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BookOpen, ShieldCheck, Scale, Banknote, History, CheckCircle2, Shield, Star } from "lucide-react";
import { useProductPrices } from "@/hooks/use-pricing";
import { usePageMeta } from "@/hooks/use-page-meta";
import { EmailCapture } from "@/components/EmailCapture";

const TESTIMONIALS = [
  {
    quote:
      "I had spoken with some of the larger companies but always felt like I was dealing with used car salesmen. I also wondered why they kept pushing the higher-end proof products. When I landed on the West Hills Capital website I immediately found the information I needed. Joe spoke with me several times and took a personal interest in helping me find the right solution.",
    name: "David F.",
    detail: "Verified client",
  },
  {
    quote:
      "This market was very new to me, but they helped guide me into the best options. When investing large sums you definitely want someone you trust and who is very knowledgeable. I will personally use them again.",
    name: "Austin C.",
    detail: "Verified client",
  },
  {
    quote:
      "There's this aura about touching gold and silver — something you can't explain until it's in your hands. West Hills Capital knows what you want and they deliver it in a timely manner. I can't wait to purchase even more metal from them.",
    name: "Richie A.",
    detail: "Verified client",
  },
];

export default function Home() {
  usePageMeta({
    title: "West Hills Capital | Physical Gold & Silver Allocation",
    description: "Buy physical gold and silver with transparent pricing for delivery or IRA accounts. American Gold Eagles, Gold Buffalos, and Silver Eagles. Disciplined execution. No hidden fees. Call (800) 867-6768.",
    ogTitle: "West Hills Capital | Physical Gold & Silver Allocation",
    ogDescription: "Buy physical gold and silver with transparent pricing for delivery or IRA accounts. Disciplined execution. No gimmicks. Call (800) 867-6768.",
    ogImage: "https://westhillscapital.com/og-home.jpg",
    canonical: "https://westhillscapital.com/",
  });

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
          <div className="text-center max-w-3xl mx-auto pt-10 pb-6">
            <h1 className="text-5xl sm:text-6xl lg:text-6xl font-serif font-semibold text-foreground leading-[1.1] mb-6">
              Physical Gold and Silver{" "}
              <span className="text-primary italic">— Something you actually own.</span>
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
          ) : pricingData === null ? (
            <div className="rounded-2xl border border-border/30 bg-white/50 py-12 px-8 text-center mb-8">
              <p className="text-foreground/50 mb-1">Product pricing is temporarily unavailable.</p>
              <p className="text-sm text-foreground/35">
                Call{" "}
                <a href="tel:8008676768" className="font-medium hover:text-primary transition-colors">(800) 867-6768</a>
                {" "}for current pricing, or view our full pricing page when service is restored.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {(pricingData?.products ?? []).map((product) => (
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
                  <div className="h-56 bg-white flex items-center justify-center relative p-8">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-40 h-40 object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                    {product.iraEligible && (
                      <div className="absolute top-3 right-3 bg-white px-2.5 py-1 rounded-full border border-primary/20 text-xs font-semibold text-primary flex items-center gap-1.5 shadow-sm">
                        <Shield className="w-3 h-3" /> IRA Eligible
                      </div>
                    )}
                  </div>

                  <CardContent className="p-5 pt-4">
                    <div className="text-[10px] text-foreground/35 font-medium mb-1 uppercase tracking-widest">
                      {product.weight} · {product.metal}
                    </div>
                    <h3 className="text-lg font-bold mb-3 leading-snug">{product.name}</h3>

                    <div className="text-3xl font-serif font-semibold text-foreground mb-3">
                      ${product.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>

                    {product.deliveryWindow && (
                      <div className="flex justify-between text-xs text-foreground/45 border-t border-border/30 pt-3">
                        <span>Est. Delivery</span>
                        <span>{product.deliveryWindow}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* WHY THESE PRODUCTS LINK */}
          <div className="flex justify-center mb-6 -mt-2">
            <Link href="/insights/why-we-recommend-only-three-products">
              <span className="inline-flex items-center gap-1.5 text-sm text-foreground/50 hover:text-primary transition-colors cursor-pointer group">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                Why these products?
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          </div>

          {/* ONE PRIMARY + ONE SECONDARY CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pb-16">
            <Link href="/schedule">
              <Button size="lg" className="h-12 px-8 text-base group">
                Schedule Your Call
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

      {/* CLIENT TESTIMONIALS */}
      <section className="py-20 bg-background border-t border-border/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-1 mb-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-primary text-primary" />
              ))}
              <span className="ml-2 text-sm font-medium text-foreground/50">4.9 on Google</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-serif font-semibold text-foreground">
              What clients say
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-border/40 p-7 flex flex-col shadow-sm"
              >
                <div className="text-5xl font-serif leading-none text-primary/25 mb-3 select-none">"</div>
                <p className="text-[15px] text-foreground/72 leading-relaxed flex-1 mb-6 italic">
                  {t.quote}
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-foreground/45">{t.detail}</p>
                  </div>
                </div>
              </div>
            ))}
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

      {/* EMAIL CAPTURE */}
      <section className="py-12 bg-white border-t border-border/20">
        <div className="max-w-3xl mx-auto px-4">
          <EmailCapture
            source="home-subscribe"
            heading="Stay informed"
            subtext="We publish guides on pricing, ownership, and how the market actually works — written for buyers, not traders. No spam."
          />
        </div>
      </section>

      {/* ROLLOVER TYPES GRID */}
      <section className="py-20 bg-background border-t border-border/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl lg:text-4xl font-serif font-semibold mb-3">Common Rollover Types</h2>
            <p className="text-foreground/60 leading-relaxed max-w-xl mx-auto">
              Most tax-advantaged retirement accounts can be rolled into a self-directed Precious Metals IRA without a taxable event.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto mb-8">
            {[
              { label: "401(k) Rollover", slug: "401k" },
              { label: "Roth IRA Transfer", slug: "roth-ira" },
              { label: "SEP IRA Rollover", slug: "sep-ira" },
              { label: "403(b) Rollover", slug: "403b" },
              { label: "TSP Rollover", slug: "tsp" },
              { label: "457(b) Rollover", slug: "457b" },
              { label: "SIMPLE IRA", slug: "simple-ira" },
              { label: "Pension Rollover", slug: "pension" },
            ].map((item) => (
              <Link key={item.slug} href={`/ira/rollover/${item.slug}`}>
                <div className="group bg-white border border-border/40 rounded-xl p-4 text-center hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                  <ArrowRight className="w-4 h-4 text-primary/50 mx-auto mb-2 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  <p className="text-sm font-semibold text-foreground/75 group-hover:text-primary transition-colors leading-tight">
                    {item.label}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center">
            <Link href="/ira">
              <Button variant="outline" className="bg-white">
                How the IRA Process Works
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
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
              <Button size="lg" className="h-12 px-10 text-base shadow-md">
                Schedule Your Call
              </Button>
            </Link>
            <a href="tel:8008676768">
              <Button variant="outline" size="lg" className="h-12 px-10 text-base bg-white">
                Call (800) 867-6768
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
