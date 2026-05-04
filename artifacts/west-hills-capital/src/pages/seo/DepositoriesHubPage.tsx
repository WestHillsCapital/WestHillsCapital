import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DEPOSITORIES } from "@/data/seo/depositories";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, MapPin } from "lucide-react";

export default function DepositoriesHubPage() {
  usePageMeta({
    title: "IRS-Approved Precious Metals Depositories | West Hills Capital",
    description:
      "IRS-approved depositories for Precious Metals IRA storage — Delaware Depository, Brinks, IDS, Texas Precious Metals Depository, and CNT. Learn how metal is stored, insured, and reported in a self-directed IRA.",
    canonical: "https://westhillscapital.com/ira/depositories",
  });

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "IRS-Approved Precious Metals Depositories",
    description: "Depositories approved by the IRS for storage of precious metals in self-directed IRAs.",
    numberOfItems: DEPOSITORIES.length,
    itemListElement: DEPOSITORIES.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: d.name,
      url: `https://westhillscapital.com/ira/depositories/${d.slug}`,
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
            IRA Depositories
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold text-white mb-5 leading-tight">
            Where Your IRA Metals Are Stored
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-3xl">
            IRS rules require that precious metals held in a self-directed IRA be stored at an approved depository — not at home or in a personal safe. The depository holds metal in your IRA's name, ensures proper insurance, and coordinates with your custodian for account reporting.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 mb-10 text-sm text-foreground/75 leading-relaxed">
            <strong className="text-foreground">How depositories fit into the process:</strong> Once your IRA custodian issues a buy direction and West Hills Capital executes your purchase, metal ships directly from our supplier to the IRS-approved depository — you never take personal possession. The depository holds the metal in your IRA's name and reports holdings to your custodian.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {DEPOSITORIES.map((depository) => (
              <Link key={depository.slug} href={`/ira/depositories/${depository.slug}`}>
                <div className="group bg-white border border-border/40 rounded-2xl p-6 hover:shadow-md hover:border-primary/25 transition-all cursor-pointer h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <h2 className="font-serif text-lg font-semibold group-hover:text-primary transition-colors leading-snug">
                      {depository.name}
                    </h2>
                    {depository.founded && (
                      <span className="text-xs text-foreground/40 font-medium shrink-0 ml-3 mt-0.5">
                        Est. {depository.founded}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-foreground/50 mb-3">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {depository.location}
                  </div>
                  <p className="text-sm text-foreground/60 leading-relaxed flex-1 line-clamp-3">
                    {depository.description}
                  </p>
                  <div className="mt-4">
                    <p className="text-xs text-foreground/40 font-semibold uppercase tracking-wider mb-2">
                      Storage options
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {depository.storageTypes.map((type) => (
                        <span key={type} className="text-xs bg-muted/40 text-foreground/60 px-2 py-0.5 rounded-full">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-primary text-sm font-semibold mt-4">
                    View depository details
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
          <h2 className="text-xl font-serif font-semibold mb-6">What Depositories Do (and Do Not Do)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-border/40 rounded-2xl p-6">
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-foreground/50">
                The Depository's Role
              </h3>
              <ul className="space-y-2 text-sm text-foreground/70 leading-relaxed">
                {[
                  "Receives and verifies metal from the dealer upon IRA purchase",
                  "Stores metal in a secure, IRS-approved vault facility",
                  "Maintains full insurance on all metals in storage",
                  "Reports holdings to your IRA custodian for account statements",
                  "Coordinates in-kind distributions or liquidation upon your request",
                  "Does not advise on purchases, pricing, or account management",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-primary mt-1">·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-border/40 rounded-2xl p-6">
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-foreground/50">
                Segregated vs. Commingled Storage
              </h3>
              <ul className="space-y-3 text-sm text-foreground/70 leading-relaxed">
                <li>
                  <strong className="text-foreground">Segregated:</strong> Your specific coins and bars are stored separately and identified as yours. You receive the exact items you purchased.
                </li>
                <li>
                  <strong className="text-foreground">Commingled:</strong> Metals of the same type and purity are pooled together. You own a share of the pool rather than specific bars. Typically less expensive.
                </li>
                <li className="text-foreground/50 text-xs mt-2">
                  West Hills Capital can deliver to either storage type — confirm your preference with your custodian during account setup.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5 border-t border-border/20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Questions about depository storage?
          </h2>
          <p className="text-foreground/65 mb-8 max-w-xl mx-auto leading-relaxed">
            Depository selection is usually determined by your custodian. A 30-minute call covers which depositories work with your account, what storage costs look like, and how the delivery process works.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/schedule">
              <Button size="lg" className="h-12 px-10 group">
                Schedule a Call
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/ira/custodians">
              <Button variant="outline" size="lg" className="h-12 px-10 bg-white">
                View Custodians
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
