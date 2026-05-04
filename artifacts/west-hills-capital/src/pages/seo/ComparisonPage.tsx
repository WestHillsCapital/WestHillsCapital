import { useParams, Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { COMPARISONS, getComparisonBySlug } from "@/data/seo/comparisons";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";

export default function ComparisonPage() {
  const params = useParams<{ comparisonSlug: string }>();
  const slug = params.comparisonSlug ?? "";
  const comparison = getComparisonBySlug(slug);

  usePageMeta({
    title: comparison ? comparison.metaTitle : "Asset Comparison | West Hills Capital",
    description: comparison
      ? comparison.metaDescription
      : "Compare physical gold against other asset classes — plain-language analysis for long-term investors.",
    canonical: comparison
      ? `https://westhillscapital.com/learn/${comparison.slug}`
      : undefined,
  });

  const articleSchema = comparison
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": comparison.title,
        "description": comparison.metaDescription,
        "author": { "@type": "Organization", "name": "West Hills Capital" },
        "publisher": { "@type": "Organization", "name": "West Hills Capital", "url": "https://westhillscapital.com" },
        "url": `https://westhillscapital.com/learn/${comparison.slug}`,
      }
    : null;

  if (!comparison) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pb-24">
        <h1 className="text-4xl font-serif font-semibold mb-4">Comparison Not Found</h1>
        <p className="text-foreground/65 mb-8">Browse our available comparisons below.</p>
        <div className="flex flex-col gap-3 mb-8">
          {COMPARISONS.map((c) => (
            <Link key={c.slug} href={`/learn/${c.slug}`}>
              <span className="text-primary hover:underline text-sm font-medium">{c.title}</span>
            </Link>
          ))}
        </div>
        <Link href="/insights">
          <button className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to Insights
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-background min-h-screen">
      {articleSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        />
      )}
      <section className="bg-foreground text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/insights">
            <span className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mb-8 font-medium cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" />
              Insights
            </span>
          </Link>
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-4">
            Asset Comparison
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold text-white mb-5 leading-tight">
            {comparison.title}
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-2xl">{comparison.intro}</p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-10">
              {comparison.sections.map((section) => (
                <div key={section.heading}>
                  <h2 className="text-xl font-serif font-semibold mb-4">{section.heading}</h2>
                  <p className="text-foreground/70 leading-relaxed">{section.content}</p>
                </div>
              ))}

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-5">Side-by-Side Comparison</h2>
                <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
                  <div className="grid grid-cols-3 bg-foreground text-white text-sm font-semibold">
                    <div className="px-4 py-3 text-white/60 text-xs uppercase tracking-wider">Attribute</div>
                    <div className="px-4 py-3 text-primary">{comparison.goldLabel}</div>
                    <div className="px-4 py-3 text-white/80">{comparison.otherLabel}</div>
                  </div>
                  {comparison.comparisonTable.map((row, i) => (
                    <div
                      key={row.attribute}
                      className={`grid grid-cols-3 text-sm border-t border-border/30 ${i % 2 === 0 ? "bg-muted/20" : "bg-white"}`}
                    >
                      <div className="px-4 py-3 font-medium text-foreground/60">{row.attribute}</div>
                      <div className="px-4 py-3 font-semibold text-foreground">{row.gold}</div>
                      <div className="px-4 py-3 text-foreground/65">{row.other}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-primary/5 rounded-2xl border border-primary/15 p-6">
                <h2 className="text-lg font-serif font-semibold mb-3">The Bottom Line</h2>
                <p className="text-foreground/75 leading-relaxed">{comparison.bottomLine}</p>
              </div>

              <div>
                <h2 className="text-xl font-serif font-semibold mb-4">Related Comparisons</h2>
                <div className="space-y-3">
                  {COMPARISONS.filter((c) => c.slug !== comparison.slug)
                    .slice(0, 3)
                    .map((c) => (
                      <Link key={c.slug} href={`/learn/${c.slug}`}>
                        <div className="group flex items-center justify-between bg-white border border-border/40 rounded-xl p-4 hover:shadow-sm hover:border-primary/20 transition-all cursor-pointer">
                          <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                            {c.title}
                          </p>
                          <ArrowRight className="w-4 h-4 text-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-t-4 border-t-primary p-6 shadow-sm">
                <h3 className="font-serif text-lg font-semibold mb-3">
                  Want to Discuss?
                </h3>
                <p className="text-sm text-foreground/65 mb-5 leading-relaxed">
                  Every purchase conversation starts here. We walk through current pricing, your objectives, and what makes sense — without pressure.
                </p>
                <Link href="/schedule">
                  <Button className="w-full group">
                    Schedule Your Call
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
                <div className="mt-3 text-center">
                  <a href="tel:8008676768" className="text-xs text-foreground/45 hover:text-primary transition-colors">
                    Or call (800) 867-6768
                  </a>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-border/40 p-5">
                <h3 className="font-semibold text-sm mb-3">More Comparisons</h3>
                <ul className="space-y-2">
                  {COMPARISONS.filter((c) => c.slug !== comparison.slug).map((c) => (
                    <li key={c.slug}>
                      <Link href={`/learn/${c.slug}`}>
                        <span className="text-sm text-primary hover:underline cursor-pointer leading-relaxed">
                          {c.title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-2xl border border-border/40 p-5">
                <Link href="/insights">
                  <div className="group flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                        Insights Hub
                      </p>
                      <p className="text-xs text-foreground/50 mt-0.5">
                        More guides on gold and silver
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-foreground/30 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5 border-t border-border/20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Ready to take the next step?
          </h2>
          <p className="text-foreground/65 mb-8 max-w-xl mx-auto leading-relaxed">
            Whether you are comparing options or ready to move forward, every conversation with West Hills Capital starts from the same place — honest answers and transparent pricing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/schedule">
              <Button size="lg" className="h-12 px-10 group">
                Schedule a Call
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/insights">
              <Button variant="outline" size="lg" className="h-12 px-10 bg-white">
                Browse Insights
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
