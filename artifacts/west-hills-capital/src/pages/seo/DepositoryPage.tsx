import { useParams, Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DEPOSITORIES, getDepositoryBySlug } from "@/data/seo/depositories";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, ChevronDown, ArrowLeft, MapPin } from "lucide-react";
import { useState } from "react";

function FAQAccordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left flex items-start gap-4 py-5 group"
        aria-expanded={open}
      >
        <ChevronDown
          className={`w-4 h-4 mt-1 shrink-0 text-primary/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
        <span className="font-medium text-foreground group-hover:text-primary transition-colors text-[15px] leading-snug">
          {q}
        </span>
      </button>
      {open && (
        <div className="pl-8 pb-5 pr-2 text-[15px] text-foreground/70 leading-relaxed">{a}</div>
      )}
    </div>
  );
}

export default function DepositoryPage() {
  const params = useParams<{ depositorySlug: string }>();
  const slug = params.depositorySlug ?? "";
  const depository = getDepositoryBySlug(slug);

  usePageMeta({
    title: depository
      ? `${depository.name} | Precious Metals IRA Storage | West Hills Capital`
      : "Depository Information | West Hills Capital",
    description: depository
      ? `${depository.name} — IRS-approved precious metals depository for self-directed IRA accounts. Learn about storage types, insurance, and how West Hills Capital delivers metals to ${depository.shortName}. Call (800) 867-6768.`
      : "IRS-approved precious metals depository information for self-directed IRA accounts.",
    canonical: depository
      ? `https://westhillscapital.com/ira/depositories/${depository.slug}`
      : undefined,
  });

  const faqSchema = depository
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: depository.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      }
    : null;

  if (!depository) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pb-24">
        <h1 className="text-4xl font-serif font-semibold mb-4">Depository Not Found</h1>
        <p className="text-foreground/65 mb-8">View IRS-approved depositories we work with below.</p>
        <div className="flex flex-col gap-3 mb-8">
          {DEPOSITORIES.map((d) => (
            <Link key={d.slug} href={`/ira/depositories/${d.slug}`}>
              <span className="text-primary hover:underline text-sm font-medium">{d.name}</span>
            </Link>
          ))}
        </div>
        <Link href="/ira">
          <button className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to IRA Overview
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-background min-h-screen">
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <section className="bg-foreground text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/ira/depositories">
            <span className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mb-8 font-medium cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" />
              IRA Depositories
            </span>
          </Link>
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-4">
            IRA Depository · {depository.location}
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold text-white mb-5 leading-tight">
            {depository.name}
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-2xl">
            {depository.description}
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12">

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-5">
                  How We Work With {depository.shortName}
                </h2>
                <p className="text-foreground/70 leading-relaxed">{depository.howWeWork}</p>
              </div>

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-5">
                  Storage Features
                </h2>
                <ul className="space-y-3">
                  {depository.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-foreground/75">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-4">
                  Storage Types Available
                </h2>
                <div className="space-y-4">
                  {depository.storageTypes.includes("Segregated storage") && (
                    <div className="bg-white border border-border/40 rounded-2xl p-5">
                      <h3 className="font-semibold mb-2">Segregated Storage</h3>
                      <p className="text-sm text-foreground/65 leading-relaxed">
                        Your specific coins and bars are stored separately and identified as yours. You receive the exact items you purchased when you take an in-kind distribution. Segregated storage typically carries a higher annual fee.
                      </p>
                    </div>
                  )}
                  {depository.storageTypes.includes("Commingled (non-segregated) storage") && (
                    <div className="bg-white border border-border/40 rounded-2xl p-5">
                      <h3 className="font-semibold mb-2">Commingled (Non-Segregated) Storage</h3>
                      <p className="text-sm text-foreground/65 leading-relaxed">
                        Metals of the same type and purity are pooled together in a shared vault. You own a share of the pool rather than specific identified bars. Commingled storage is generally less expensive and is fully IRS-compliant for precious metals IRAs.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-4">
                  Frequently Asked Questions
                </h2>
                <div className="bg-white rounded-2xl border border-border/40 px-6 divide-y divide-border/30">
                  {depository.faqs.map((faq) => (
                    <FAQAccordion key={faq.q} q={faq.q} a={faq.a} />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-t-4 border-t-primary p-6 shadow-sm">
                <h3 className="font-serif text-lg font-semibold mb-3">
                  Ready to Set Up Storage?
                </h3>
                <p className="text-sm text-foreground/65 mb-5 leading-relaxed">
                  Depository setup happens automatically as part of the IRA process. A call with us covers all the logistics — including which depository your custodian uses.
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

              {depository.founded && (
                <div className="bg-white rounded-2xl border border-border/40 p-5">
                  <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-2">Founded</p>
                  <p className="font-semibold text-sm">{depository.founded}</p>
                  <div className="flex items-center gap-1.5 text-xs text-foreground/50 mt-1">
                    <MapPin className="w-3 h-3" />
                    {depository.location}
                  </div>
                </div>
              )}

              <div className="bg-muted/30 rounded-2xl border border-border/40 p-5">
                <h3 className="font-semibold text-sm mb-3">Other Depositories</h3>
                <ul className="space-y-2">
                  {DEPOSITORIES.filter((d) => d.slug !== depository.slug).map((d) => (
                    <li key={d.slug}>
                      <Link href={`/ira/depositories/${d.slug}`}>
                        <span className="text-sm text-primary hover:underline cursor-pointer">
                          {d.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-2xl border border-border/40 p-5">
                <p className="text-xs text-foreground/50 leading-relaxed">
                  <strong className="text-foreground">Note:</strong> The depository used for your IRA account is typically selected in coordination with your custodian. West Hills Capital ships to any IRS-approved depository.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5 border-t border-border/20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Storing metals at {depository.shortName}?
          </h2>
          <p className="text-foreground/65 mb-8 max-w-xl mx-auto leading-relaxed">
            We coordinate deliveries to {depository.shortName} and understand their process. A 30-minute call covers everything — custodian setup, depository delivery, and current pricing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/schedule">
              <Button size="lg" className="h-12 px-10 group">
                Schedule a Call
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/ira/depositories">
              <Button variant="outline" size="lg" className="h-12 px-10 bg-white">
                All Depositories
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
