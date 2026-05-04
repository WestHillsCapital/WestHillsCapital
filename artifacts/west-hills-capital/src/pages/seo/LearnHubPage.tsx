import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { COMPARISONS } from "@/data/seo/comparisons";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function LearnHubPage() {
  usePageMeta({
    title: "Learn — Gold & Silver Investment Guides | West Hills Capital",
    description:
      "Plain-language comparisons of physical gold against ETFs, silver, bonds, real estate, cash, futures, and Roth IRAs. Research before you invest.",
    canonical: "https://westhillscapital.com/learn",
  });

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Precious Metals Investment Comparison Guides",
    description: "Plain-language comparisons of physical gold and silver against common investment alternatives.",
    numberOfItems: COMPARISONS.length,
    itemListElement: COMPARISONS.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.title,
      url: `https://westhillscapital.com/learn/${c.slug}`,
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
            Education &amp; Research
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold text-white mb-5 leading-tight">
            Compare Physical Gold to Other Assets
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-3xl">
            Before investing in any asset, understand how it compares to the alternatives. These plain-language guides cover the key differences between physical gold and the most common competing investments — so you can make a genuinely informed decision.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {COMPARISONS.map((comparison) => (
              <Link key={comparison.slug} href={`/learn/${comparison.slug}`}>
                <div className="group bg-white border border-border/40 rounded-2xl p-6 hover:shadow-md hover:border-primary/25 transition-all cursor-pointer h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold text-xs leading-none">vs</span>
                    </div>
                    <h2 className="font-serif text-lg font-semibold group-hover:text-primary transition-colors leading-snug">
                      {comparison.title}
                    </h2>
                  </div>
                  <p className="text-sm text-foreground/60 leading-relaxed flex-1">
                    {comparison.metaDescription}
                  </p>
                  <div className="flex items-center gap-1 text-primary text-sm font-semibold mt-4">
                    Read comparison
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
            <h2 className="text-xl font-serif font-semibold mb-3">
              Why these comparisons matter
            </h2>
            <p className="text-foreground/70 text-sm leading-relaxed max-w-2xl">
              Most investors arrive having heard that gold is a safe haven — but without a clear picture of how it behaves compared to the assets they already hold. These guides are written to give you that picture, without sales language. Physical gold is not the right vehicle for every dollar in every portfolio. Understanding its trade-offs against ETFs, bonds, real estate, and cash is the starting point for any serious allocation decision.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5 border-t border-border/20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Ready to discuss your allocation?
          </h2>
          <p className="text-foreground/65 mb-8 max-w-xl mx-auto leading-relaxed">
            Once you have read through the comparisons, a 30-minute call with our team covers current pricing, IRA logistics, and how physical gold fits your specific situation.
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
