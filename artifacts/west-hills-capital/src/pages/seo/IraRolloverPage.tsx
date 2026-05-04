import { useParams, Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { IRA_ROLLOVERS, getRolloverBySlug } from "@/data/seo/ira-rollovers";
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

export default function IraRolloverPage() {
  const params = useParams<{ accountType: string }>();
  const slug = params.accountType ?? "";
  const rollover = getRolloverBySlug(slug);

  usePageMeta({
    title: rollover
      ? `${rollover.name} | Precious Metals IRA Rollover | West Hills Capital`
      : "IRA Rollover | West Hills Capital",
    description: rollover
      ? `Learn how to roll over your ${rollover.shortName} into a Precious Metals IRA holding physical gold and silver. Step-by-step process, key rules, and FAQs. Call (800) 867-6768.`
      : "Roll over your retirement account into a Precious Metals IRA. West Hills Capital guides you through every step.",
    canonical: rollover
      ? `https://westhillscapital.com/ira/rollover/${rollover.slug}`
      : undefined,
  });

  const faqSchema = rollover
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": rollover.faqs.map((faq) => ({
          "@type": "Question",
          "name": faq.q,
          "acceptedAnswer": { "@type": "Answer", "text": faq.a },
        })),
      }
    : null;

  if (!rollover) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pb-24">
        <h1 className="text-4xl font-serif font-semibold mb-4">Rollover Type Not Found</h1>
        <p className="text-foreground/65 mb-8">
          We could not find that rollover type. View all supported rollover types below.
        </p>
        <div className="flex flex-col gap-3 mb-8 w-full max-w-sm">
          {IRA_ROLLOVERS.map((r) => (
            <Link key={r.slug} href={`/ira/rollover/${r.slug}`}>
              <div className="text-primary hover:underline text-sm font-medium">{r.name}</div>
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
            IRA Rollover Guide
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold text-white mb-5 leading-tight">
            {rollover.name}
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-2xl">
            {rollover.description}
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12">
              <div>
                <h2 className="text-2xl font-serif font-semibold mb-6">
                  Key Facts for {rollover.shortName} Rollovers
                </h2>
                <ul className="space-y-3">
                  {rollover.keyFacts.map((fact, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-foreground/75 leading-relaxed">{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-6">
                  How the Rollover Process Works
                </h2>
                <div className="space-y-6">
                  {[
                    {
                      num: "1",
                      title: "Establish a Self-Directed IRA",
                      desc: "Open an account with an IRS-approved self-directed IRA custodian. We can refer you to custodians experienced with precious metals if you do not have one.",
                    },
                    {
                      num: "2",
                      title: `Initiate the ${rollover.shortName} Rollover or Transfer`,
                      desc: `Contact your current ${rollover.shortName} plan administrator and request a direct rollover to the new custodian. Direct rollovers avoid mandatory withholding and are not taxable events.`,
                    },
                    {
                      num: "3",
                      title: "Confirm Your Trade",
                      desc: "Once funds clear at the custodian, we confirm the trade verbally at current wholesale pricing. No metal is purchased before funds are settled.",
                    },
                    {
                      num: "4",
                      title: "Delivery to Depository",
                      desc: "Your metals ship directly to the IRS-approved depository designated by your custodian. They are held in your name, not commingled.",
                    },
                  ].map((step) => (
                    <div key={step.num} className="flex gap-5">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                        {step.num}
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{step.title}</h3>
                        <p className="text-foreground/65 text-sm leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-4">
                  Frequently Asked Questions
                </h2>
                <div className="bg-white rounded-2xl border border-border/40 px-6 divide-y divide-border/30">
                  {rollover.faqs.map((faq) => (
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
                  Every IRA rollover begins with a conversation. We walk through your current account, the rollover process, and how we source metals — with no pressure and no obligation.
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

              <div className="bg-muted/30 rounded-2xl border border-border/40 p-6">
                <h3 className="font-semibold text-sm mb-3">Other Rollover Types</h3>
                <ul className="space-y-2">
                  {IRA_ROLLOVERS.filter((r) => r.slug !== rollover.slug).map((r) => (
                    <li key={r.slug}>
                      <Link href={`/ira/rollover/${r.slug}`}>
                        <span className="text-sm text-primary hover:underline cursor-pointer">
                          {r.shortName} Rollover
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-2xl border border-border/40 p-6">
                <p className="text-xs text-foreground/50 leading-relaxed">
                  <strong className="text-foreground">Note:</strong> West Hills Capital does not provide tax or legal advice. Always consult a qualified CPA or tax attorney before initiating a rollover.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5 border-t border-border/20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Have questions about your {rollover.shortName}?
          </h2>
          <p className="text-foreground/65 mb-8 max-w-xl mx-auto leading-relaxed">
            We have helped clients navigate rollovers from every major account type. The process is more straightforward than most people expect.
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
