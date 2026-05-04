import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { IRA_ROLLOVERS } from "@/data/seo/ira-rollovers";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";

const ROLLOVER_ICONS: Record<string, string> = {
  "401k": "401(k)",
  "roth-ira": "Roth",
  "sep-ira": "SEP",
  "403b": "403(b)",
  "tsp": "TSP",
  "457b": "457(b)",
  "simple-ira": "SIMPLE",
  "pension": "Pension",
};

export default function IraRolloversHubPage() {
  usePageMeta({
    title: "IRA Rollover Guide | Precious Metals IRA Rollovers | West Hills Capital",
    description:
      "Complete guides for rolling over any retirement account — 401(k), Roth IRA, TSP, 403(b), SEP IRA, and more — into a Precious Metals IRA holding physical gold and silver. Call (800) 867-6768.",
    canonical: "https://westhillscapital.com/ira/rollovers",
  });

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Precious Metals IRA Rollover Types",
    "description": "Guides for rolling over common retirement accounts into a self-directed Precious Metals IRA.",
    "numberOfItems": IRA_ROLLOVERS.length,
    "itemListElement": IRA_ROLLOVERS.map((r, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": r.name,
      "url": `https://westhillscapital.com/ira/rollover/${r.slug}`,
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
          <Link href="/ira">
            <span className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mb-8 font-medium cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" />
              Precious Metals IRA
            </span>
          </Link>
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-4">
            IRA Rollover Guides
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold text-white mb-5 leading-tight">
            Roll Over Any Retirement Account into a Precious Metals IRA
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-3xl">
            Most tax-advantaged retirement accounts — 401(k), Roth IRA, SEP IRA, TSP, 403(b), pension lump sums, and others — can be rolled over into a self-directed IRA holding physical gold and silver. Select your account type below for a complete guide.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {IRA_ROLLOVERS.map((rollover) => (
              <Link key={rollover.slug} href={`/ira/rollover/${rollover.slug}`}>
                <div className="group bg-white border border-border/40 rounded-2xl p-6 hover:shadow-md hover:border-primary/25 transition-all cursor-pointer h-full flex flex-col">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 shrink-0">
                    <span className="text-primary font-bold text-xs leading-none text-center">
                      {ROLLOVER_ICONS[rollover.slug] ?? rollover.shortName}
                    </span>
                  </div>
                  <h2 className="font-serif text-lg font-semibold mb-2 group-hover:text-primary transition-colors leading-snug">
                    {rollover.name}
                  </h2>
                  <p className="text-sm text-foreground/60 leading-relaxed flex-1 line-clamp-3">
                    {rollover.description}
                  </p>
                  <div className="flex items-center gap-1 text-primary text-sm font-semibold mt-4">
                    Read guide
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-muted/30 rounded-2xl border border-border/40 p-8">
            <h2 className="text-xl font-serif font-semibold mb-3">How the Rollover Process Works</h2>
            <p className="text-foreground/70 text-sm leading-relaxed mb-5 max-w-2xl">
              Regardless of account type, every precious metals IRA rollover follows the same four-step process: establish a self-directed IRA, initiate the rollover with your current plan administrator, confirm the trade once funds clear, and take delivery to an IRS-approved depository.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { num: "1", title: "Open a Self-Directed IRA", desc: "With an IRS-approved custodian" },
                { num: "2", title: "Initiate the Rollover", desc: "Direct rollover avoids withholding" },
                { num: "3", title: "Confirm Your Trade", desc: "At current wholesale pricing" },
                { num: "4", title: "Delivery to Depository", desc: "Held in your name, insured" },
              ].map((step) => (
                <div key={step.num} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                    {step.num}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{step.title}</p>
                    <p className="text-xs text-foreground/55 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5 border-t border-border/20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Not sure which account type applies?
          </h2>
          <p className="text-foreground/65 mb-8 max-w-xl mx-auto leading-relaxed">
            Every rollover starts with a conversation. We will review your current account, walk through the rollover mechanics, and explain how the metal purchase works — with no pressure.
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
          <p className="mt-5 text-xs text-foreground/40">
            West Hills Capital does not provide tax or legal advice. Consult a qualified CPA or tax attorney before initiating a rollover.
          </p>
        </div>
      </section>
    </div>
  );
}
