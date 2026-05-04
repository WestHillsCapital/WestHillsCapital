import { useParams, Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { COINS, RECOMMENDED_COINS, getCoinBySlug } from "@/data/seo/coins";
import { useSpotPrices } from "@/hooks/use-pricing";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, ArrowLeft, FileText, CheckCircle, AlertCircle } from "lucide-react";

export default function CoinYearPage() {
  const params = useParams<{ coinSlug: string; year?: string }>();
  const coinSlug = params.coinSlug ?? "";
  const year = params.year ? parseInt(params.year, 10) : undefined;

  const coin = getCoinBySlug(coinSlug);
  const { data: spotData } = useSpotPrices();

  const spotPrice =
    coin?.metal === "gold" ? spotData?.gold : coin?.metal === "silver" ? spotData?.silver : undefined;

  const pageTitle = coin
    ? year
      ? `${year} ${coin.name} | West Hills Capital`
      : `${coin.name} | Sovereign Bullion Coin | West Hills Capital`
    : "Coin Not Found | West Hills Capital";

  const pageDesc = coin
    ? year
      ? `Learn about the ${year} ${coin.name} — specifications, IRA eligibility, pricing, and why sovereign bullion is the preferred choice for long-term investors. Call (800) 867-6768.`
      : `${coin.name} specifications, IRA eligibility, live spot price, and why sovereign bullion outperforms proof coins for long-term investors. Call (800) 867-6768.`
    : "Coin information not found.";

  usePageMeta({
    title: pageTitle,
    description: pageDesc,
    canonical: coin
      ? year
        ? `https://westhillscapital.com/products/${coin.slug}/${year}`
        : `https://westhillscapital.com/products/${coin.slug}`
      : undefined,
  });

  if (!coin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pb-24">
        <h1 className="text-4xl font-serif font-semibold mb-4">Coin Not Found</h1>
        <p className="text-foreground/65 mb-8">View our available products below.</p>
        <div className="flex flex-col gap-3 mb-8">
          {COINS.map((c) => (
            <Link key={c.slug} href={`/products/${c.slug}`}>
              <span className="text-primary hover:underline text-sm font-medium">{c.name}</span>
            </Link>
          ))}
        </div>
        <Link href="/pricing">
          <button className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
            <ArrowLeft className="w-4 h-4" />
            View Live Pricing
          </button>
        </Link>
      </div>
    );
  }

  const yearObj = year ? coin.years.find((y) => y.year === year) : undefined;
  const isValidYear = !year || yearObj !== undefined;

  if (year && !isValidYear) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pb-24">
        <h1 className="text-4xl font-serif font-semibold mb-4">Year Not Available</h1>
        <p className="text-foreground/65 mb-8">
          We do not carry the {year} {coin.name}. Available years:
        </p>
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {coin.years.map((y) => (
            <Link key={y.year} href={`/products/${coin.slug}/${y.year}`}>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium hover:bg-primary/20 cursor-pointer">
                {y.year}
              </span>
            </Link>
          ))}
        </div>
        <Link href={`/products/${coin.slug}`}>
          <button className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
            <ArrowLeft className="w-4 h-4" />
            {coin.name} Overview
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-background min-h-screen">
      <section className="bg-foreground text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/pricing">
            <span className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mb-8 font-medium cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" />
              Live Pricing
            </span>
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-primary text-xs font-semibold uppercase tracking-widest">
              {coin.metal === "gold" ? "Gold" : "Silver"} Bullion
            </p>
            {coin.iraEligible && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-primary/20 text-primary px-2.5 py-1 rounded-full">
                <Shield className="w-3 h-3" /> IRA Eligible
              </span>
            )}
          </div>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold text-white mb-4 leading-tight">
            {year ? `${year} ` : ""}{coin.name}
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-2xl">
            {coin.description}
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12">
              {spotPrice != null && (
                <div className="bg-white rounded-2xl border border-border/40 p-6">
                  <h2 className="text-sm font-semibold text-foreground/50 uppercase tracking-widest mb-4">
                    Live {coin.metal === "gold" ? "Gold" : "Silver"} Spot Price
                  </h2>
                  <p className="text-4xl font-serif font-semibold text-foreground">
                    ${spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <span className="text-base font-normal text-foreground/40 ml-2">/ troy oz</span>
                  </p>
                  <p className="text-xs text-foreground/40 mt-2">
                    Spot price is the market reference — your purchase price includes a transparent dealer premium.{" "}
                    <Link href="/pricing">
                      <span className="text-primary hover:underline cursor-pointer">See current product pricing →</span>
                    </Link>
                  </p>
                </div>
              )}

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-5">Coin Specifications</h2>
                <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
                  {coin.specs.map((spec, i) => (
                    <div
                      key={spec.label}
                      className={`flex items-center justify-between px-5 py-3.5 text-sm ${i % 2 === 0 ? "bg-muted/20" : "bg-white"}`}
                    >
                      <span className="text-foreground/55 font-medium">{spec.label}</span>
                      <span className="text-foreground font-semibold">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-4">
                  Why Sovereign Bullion?
                </h2>
                <p className="text-foreground/70 leading-relaxed">{coin.whyBullion}</p>
              </div>

              {year && (
                <div>
                  <h2 className="text-2xl font-serif font-semibold mb-4">
                    Other Available Years
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {coin.years
                      .filter((y) => y.year !== year)
                      .map((y) => (
                        <Link key={y.year} href={`/products/${coin.slug}/${y.year}`}>
                          <span className="bg-primary/8 border border-primary/20 text-primary px-3 py-1.5 rounded-full text-sm font-medium hover:bg-primary/15 cursor-pointer transition-colors">
                            {y.year} {coin.shortName}
                          </span>
                        </Link>
                      ))}
                  </div>
                </div>
              )}

              {!year && (
                <div>
                  <h2 className="text-2xl font-serif font-semibold mb-4">Browse by Year</h2>
                  <div className="flex flex-wrap gap-2">
                    {coin.years.map((y) => (
                      <Link key={y.year} href={`/products/${coin.slug}/${y.year}`}>
                        <span className="bg-primary/8 border border-primary/20 text-primary px-3 py-1.5 rounded-full text-sm font-medium hover:bg-primary/15 cursor-pointer transition-colors">
                          {y.year}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-1">
                  IRS Reporting Requirements
                </h2>
                <p className="text-sm text-foreground/55 mb-4 leading-relaxed">
                  When selling precious metals back to a dealer, certain transactions trigger IRS Form 1099-B reporting obligations for the dealer. Understanding this before you buy is part of informed ownership.
                </p>
                <div className={`rounded-2xl border p-5 mb-3 ${coin.reporting.isReportable ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                  <div className="flex items-center gap-2.5 mb-3">
                    {coin.reporting.isReportable
                      ? <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      : <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                    }
                    <span className={`text-sm font-semibold ${coin.reporting.isReportable ? "text-amber-800" : "text-green-800"}`}>
                      {coin.reporting.isReportable
                        ? `Reportable — ${coin.reporting.threshold}`
                        : "Not subject to dealer reporting"}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/65 leading-relaxed">
                    {coin.reporting.notes}
                  </p>
                </div>
                <div className="flex items-start gap-2 bg-muted/30 rounded-xl p-4">
                  <FileText className="w-3.5 h-3.5 text-foreground/35 mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground/50 leading-relaxed">
                    Dealer reporting obligations and your personal capital gains reporting obligations are separate. You are always required to report gains on precious metals sales regardless of whether a 1099-B is issued. West Hills Capital does not provide tax advice — consult a CPA for your specific situation.
                  </p>
                </div>
              </div>

              {RECOMMENDED_COINS.filter((c) => c.slug !== coin.slug).length > 0 && (
                <div>
                  <h2 className="text-2xl font-serif font-semibold mb-1">
                    Our Recommended Coins
                  </h2>
                  <p className="text-sm text-foreground/55 mb-4 leading-relaxed">
                    West Hills Capital actively recommends three sovereign bullion coins for long-term investors and IRA accounts.
                  </p>
                  <div className="space-y-3">
                    {RECOMMENDED_COINS.filter((c) => c.slug !== coin.slug).map((c) => (
                      <Link key={c.slug} href={`/products/${c.slug}`}>
                        <div className="group flex items-center justify-between bg-white border border-border/40 rounded-xl p-4 hover:shadow-sm hover:border-primary/20 transition-all cursor-pointer">
                          <div>
                            <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                              {c.name}
                            </p>
                            <p className="text-xs text-foreground/50">
                              {c.purity} · {c.weight}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-t-4 border-t-primary p-6 shadow-sm">
                <h3 className="font-serif text-lg font-semibold mb-3">
                  Interested in Buying?
                </h3>
                <p className="text-sm text-foreground/65 mb-5 leading-relaxed">
                  All purchases begin with a conversation. We confirm current pricing on the call and walk through delivery or IRA logistics.
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

              {coin.iraEligible && (
                <div className="bg-primary/5 rounded-2xl border border-primary/15 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">IRA Eligible</span>
                  </div>
                  <p className="text-xs text-foreground/65 leading-relaxed">
                    The {coin.name} qualifies for inclusion in a self-directed Precious Metals IRA.{" "}
                    <Link href="/ira">
                      <span className="text-primary hover:underline cursor-pointer">Learn how the IRA process works →</span>
                    </Link>
                  </p>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-border/40 p-5">
                <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-3">
                  Minted by
                </p>
                <p className="font-semibold text-sm">{coin.issuer}</p>
                <p className="text-xs text-foreground/50 mt-1">
                  In continuous production since {coin.mintedSince}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5 border-t border-border/20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Questions about the {coin.shortName}?
          </h2>
          <p className="text-foreground/65 mb-8 max-w-xl mx-auto leading-relaxed">
            We source the {coin.name} and can walk you through pricing, delivery, and whether it fits your goals. A 15-minute call covers everything you need to know.
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
