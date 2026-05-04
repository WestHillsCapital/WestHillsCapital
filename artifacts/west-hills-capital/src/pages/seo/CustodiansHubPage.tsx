import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { CUSTODIANS } from "@/data/seo/custodians";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, MapPin } from "lucide-react";

export default function CustodiansHubPage() {
  usePageMeta({
    title: "Self-Directed IRA Custodians | Precious Metals IRA | West Hills Capital",
    description:
      "West Hills Capital works with leading self-directed IRA custodians — Equity Trust, Strata Trust, Kingdom Trust, GoldStar Trust, Midland IRA, and New Direction Trust. Learn how each custodian fits into the precious metals IRA process.",
    canonical: "https://westhillscapital.com/ira/custodians",
  });

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Self-Directed IRA Custodians for Precious Metals",
    "description": "IRS-approved self-directed IRA custodians that West Hills Capital works with for precious metals IRA accounts.",
    "numberOfItems": CUSTODIANS.length,
    "itemListElement": CUSTODIANS.map((c, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": c.name,
      "url": `https://westhillscapital.com/ira/custodians/${c.slug}`,
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
            IRA Custodians
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold text-white mb-5 leading-tight">
            Self-Directed IRA Custodians We Work With
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-3xl">
            A precious metals IRA requires an IRS-approved self-directed IRA custodian to hold the account. West Hills Capital coordinates with any custodian our clients choose — below are the firms we have worked with most frequently.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 mb-10 text-sm text-foreground/75 leading-relaxed">
            <strong className="text-foreground">Transparency note:</strong> West Hills Capital does not receive referral fees from any custodian. We mention these firms by name because our clients ask, and we want to be transparent about the custodians we have experience coordinating with. You are free to use any IRS-approved self-directed IRA custodian.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {CUSTODIANS.map((custodian) => (
              <Link key={custodian.slug} href={`/ira/custodians/${custodian.slug}`}>
                <div className="group bg-white border border-border/40 rounded-2xl p-6 hover:shadow-md hover:border-primary/25 transition-all cursor-pointer h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <h2 className="font-serif text-lg font-semibold group-hover:text-primary transition-colors leading-snug">
                      {custodian.name}
                    </h2>
                    {custodian.founded && (
                      <span className="text-xs text-foreground/40 font-medium shrink-0 ml-3 mt-0.5">
                        Est. {custodian.founded}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-foreground/50 mb-3">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {custodian.location}
                  </div>
                  <p className="text-sm text-foreground/60 leading-relaxed flex-1 line-clamp-3">
                    {custodian.description}
                  </p>
                  <div className="mt-4">
                    <p className="text-xs text-foreground/40 font-semibold uppercase tracking-wider mb-2">Account types</p>
                    <div className="flex flex-wrap gap-1.5">
                      {custodian.accountTypes.slice(0, 3).map((type) => (
                        <span key={type} className="text-xs bg-muted/40 text-foreground/60 px-2 py-0.5 rounded-full">
                          {type.replace("Self-Directed ", "SD ").replace(" (Precious Metals)", "")}
                        </span>
                      ))}
                      {custodian.accountTypes.length > 3 && (
                        <span className="text-xs text-foreground/40 px-2 py-0.5">
                          +{custodian.accountTypes.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-primary text-sm font-semibold mt-4">
                    View custodian details
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
          <h2 className="text-xl font-serif font-semibold mb-6">What a Custodian Does (and Does Not Do)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-border/40 rounded-2xl p-6">
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-foreground/50">The Custodian's Role</h3>
              <ul className="space-y-2 text-sm text-foreground/70 leading-relaxed">
                {[
                  "Holds the IRA account and administers tax-reporting",
                  "Accepts rollovers and transfers from other retirement accounts",
                  "Issues a 'buy direction' authorizing West Hills Capital to execute your purchase",
                  "Coordinates with the depository to confirm metal receipt",
                  "Sends annual account statements and IRS reporting forms",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-primary mt-1">·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-border/40 rounded-2xl p-6">
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-foreground/50">West Hills Capital's Role</h3>
              <ul className="space-y-2 text-sm text-foreground/70 leading-relaxed">
                {[
                  "Sources IRA-eligible precious metals at transparent wholesale pricing",
                  "Confirms the trade verbally once funds clear at the custodian",
                  "Coordinates direct shipment to the IRS-approved depository",
                  "Does not hold or administer your IRA account",
                  "Does not receive referral fees from custodians",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-primary mt-1">·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5 border-t border-border/20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Not sure which custodian to use?
          </h2>
          <p className="text-foreground/65 mb-8 max-w-xl mx-auto leading-relaxed">
            We can walk you through the options. Most clients choose based on account type, fee structure, and responsiveness — a 30-minute call covers all of it.
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
