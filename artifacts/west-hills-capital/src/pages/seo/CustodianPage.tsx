import { useParams, Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { CUSTODIANS, getCustodianBySlug } from "@/data/seo/custodians";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, ChevronDown, ArrowLeft } from "lucide-react";
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

export default function CustodianPage() {
  const params = useParams<{ custodianSlug: string }>();
  const slug = params.custodianSlug ?? "";
  const custodian = getCustodianBySlug(slug);

  usePageMeta({
    title: custodian
      ? `${custodian.name} Precious Metals IRA | West Hills Capital`
      : "Custodian Information | West Hills Capital",
    description: custodian
      ? `Learn how West Hills Capital coordinates with ${custodian.name} for Precious Metals IRA accounts — account setup, rollover process, and depository delivery. Call (800) 867-6768.`
      : "Precious Metals IRA custodian information and how West Hills Capital works alongside leading IRA custodians.",
    canonical: custodian
      ? `https://westhillscapital.com/ira/custodians/${custodian.slug}`
      : undefined,
  });

  const faqSchema = custodian
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": custodian.faqs.map((faq) => ({
          "@type": "Question",
          "name": faq.q,
          "acceptedAnswer": { "@type": "Answer", "text": faq.a },
        })),
      }
    : null;

  if (!custodian) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pb-24">
        <h1 className="text-4xl font-serif font-semibold mb-4">Custodian Not Found</h1>
        <p className="text-foreground/65 mb-8">View custodians we have worked with below.</p>
        <div className="flex flex-col gap-3 mb-8">
          {CUSTODIANS.map((c) => (
            <Link key={c.slug} href={`/ira/custodians/${c.slug}`}>
              <span className="text-primary hover:underline text-sm font-medium">{c.name}</span>
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
          <Link href="/ira">
            <span className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mb-8 font-medium cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" />
              Precious Metals IRA
            </span>
          </Link>
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-4">
            IRA Custodian · {custodian.location}
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold text-white mb-5 leading-tight">
            {custodian.name}
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-2xl">
            {custodian.description}
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12">
              <div>
                <h2 className="text-2xl font-serif font-semibold mb-5">
                  How We Work With {custodian.shortName}
                </h2>
                <p className="text-foreground/70 leading-relaxed">{custodian.howWeWork}</p>
              </div>

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-6">
                  Account Setup Process
                </h2>
                <div className="space-y-6">
                  {custodian.setupSteps.map((step) => (
                    <div key={step.step} className="flex gap-5">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                        {step.step}
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{step.title}</h3>
                        <p className="text-foreground/65 text-sm leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-4">
                  Supported Account Types
                </h2>
                <ul className="space-y-2">
                  {custodian.accountTypes.map((type) => (
                    <li key={type} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      <span className="text-foreground/75">{type}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-4">
                  Frequently Asked Questions
                </h2>
                <div className="bg-white rounded-2xl border border-border/40 px-6 divide-y divide-border/30">
                  {custodian.faqs.map((faq) => (
                    <FAQAccordion key={faq.q} q={faq.q} a={faq.a} />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-t-4 border-t-primary p-6 shadow-sm">
                <h3 className="font-serif text-lg font-semibold mb-3">
                  Ready to Start?
                </h3>
                <p className="text-sm text-foreground/65 mb-5 leading-relaxed">
                  Schedule a call and we will walk through the full process — custodian setup, rollover logistics, and current pricing.
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

              <div className="bg-muted/30 rounded-2xl border border-border/40 p-5">
                <h3 className="font-semibold text-sm mb-3">Other Custodians</h3>
                <ul className="space-y-2">
                  {CUSTODIANS.filter((c) => c.slug !== custodian.slug).map((c) => (
                    <li key={c.slug}>
                      <Link href={`/ira/custodians/${c.slug}`}>
                        <span className="text-sm text-primary hover:underline cursor-pointer">
                          {c.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {custodian.founded && (
                <div className="bg-white rounded-2xl border border-border/40 p-5">
                  <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-2">Founded</p>
                  <p className="font-semibold text-sm">{custodian.founded}</p>
                  <p className="text-xs text-foreground/50 mt-1">{custodian.location}</p>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-border/40 p-5">
                <p className="text-xs text-foreground/50 leading-relaxed">
                  <strong className="text-foreground">Transparency note:</strong> West Hills Capital does not receive referral fees from custodians. We work with any approved custodian our clients choose.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5 border-t border-border/20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Using {custodian.shortName} for your Precious Metals IRA?
          </h2>
          <p className="text-foreground/65 mb-8 max-w-xl mx-auto leading-relaxed">
            We have coordinated transactions through {custodian.shortName} and understand their process. A call with us gets you up to speed on everything.
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
