import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { US_STATES } from "@/data/seo/states";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const REGIONS = ["Northeast", "Southeast", "Midwest", "Southwest", "West"] as const;

export default function StatesHubPage() {
  usePageMeta({
    title: "Gold IRA by State | Precious Metals IRA | West Hills Capital",
    description:
      "State-specific guides for opening a Precious Metals IRA — rollover process, eligible account types, and state sales tax context for all 50 states. West Hills Capital serves clients nationwide. Call (800) 867-6768.",
    canonical: "https://westhillscapital.com/gold-ira",
  });

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Gold IRA by State",
    "description": "State-specific Gold IRA guides for all 50 US states.",
    "numberOfItems": US_STATES.length,
    "itemListElement": US_STATES.map((s, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": `Gold IRA in ${s.name}`,
      "url": `https://westhillscapital.com/gold-ira/${s.slug}`,
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
            Precious Metals IRA · All 50 States
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold text-white mb-5 leading-tight">
            Gold IRA by State
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-3xl">
            IRA rules for precious metals are federal — they apply equally in every state. However, state sales tax treatment of bullion purchases outside an IRA varies. Select your state for a complete guide including rollover process, eligible accounts, and state-specific context.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 mb-10 text-sm text-foreground/75 leading-relaxed">
            <strong className="text-foreground">Federal rules, nationwide service.</strong> West Hills Capital serves clients in all 50 states. The Precious Metals IRA process — rollover, custodian setup, depository delivery — is the same regardless of where you live. State differences primarily affect sales tax on direct (non-IRA) bullion purchases.
          </div>

          <div className="space-y-10">
            {REGIONS.map((region) => {
              const states = US_STATES.filter((s) => s.region === region);
              return (
                <div key={region}>
                  <h2 className="text-sm font-semibold text-foreground/40 uppercase tracking-widest mb-4">
                    {region}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                    {states.map((state) => (
                      <Link key={state.slug} href={`/gold-ira/${state.slug}`}>
                        <div className="group bg-white border border-border/40 rounded-xl px-3.5 py-3 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-foreground/40 font-medium">{state.abbr}</p>
                              <p className="text-sm font-semibold group-hover:text-primary transition-colors leading-snug">
                                {state.name}
                              </p>
                            </div>
                            {state.salesTaxOnGold === false && (
                              <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-semibold shrink-0 ml-1">
                                No tax
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 bg-muted/30 rounded-2xl border border-border/40 p-5">
            <p className="text-xs text-foreground/50 leading-relaxed">
              <strong className="text-foreground">Sales tax note:</strong> "No tax" indicators reflect state-level bullion exemptions for direct purchases. Local (county/city) taxes may still apply in some jurisdictions, and exemption rules vary by purchase amount and coin type. Always confirm current rules with your state's revenue department or a tax professional. Tax laws change.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-serif font-semibold mb-5">
            How a Gold IRA Works (Regardless of State)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { num: "1", title: "Open a Self-Directed IRA", desc: "With an IRS-approved custodian anywhere in the U.S." },
              { num: "2", title: "Roll Over or Transfer", desc: "From 401(k), traditional IRA, TSP, 403(b), or other qualified account" },
              { num: "3", title: "Confirm Your Purchase", desc: "At current wholesale pricing — no purchase before funds clear" },
              { num: "4", title: "Storage at Depository", desc: "IRS-approved depository holds your metals, insured and in your name" },
            ].map((step) => (
              <div key={step.num} className="bg-white border border-border/40 rounded-2xl p-5">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center mb-3">
                  {step.num}
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{step.title}</h3>
                <p className="text-xs text-foreground/55 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5 border-t border-border/20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            West Hills Capital serves all 50 states
          </h2>
          <p className="text-foreground/65 mb-8 max-w-xl mx-auto leading-relaxed">
            Whether you are in California or Florida, New York or Texas — the Precious Metals IRA process is the same. A 30-minute call covers everything: rollover logistics, custodian options, and current pricing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/schedule">
              <Button size="lg" className="h-12 px-10 group">
                Schedule a Call
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/ira">
              <Button variant="outline" size="lg" className="h-12 px-10 bg-white">
                IRA Overview
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
