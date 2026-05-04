import { useParams, Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { US_STATES, getStateBySlug } from "@/data/seo/states";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Shield, ArrowLeft } from "lucide-react";

const PROCESS_STEPS = [
  {
    num: "1",
    title: "Open a Self-Directed IRA",
    desc: "Work with an IRS-approved self-directed IRA custodian to establish your account. We can refer you to custodians experienced with precious metals.",
  },
  {
    num: "2",
    title: "Fund via Rollover or Transfer",
    desc: "Roll over funds from a 401(k), 403(b), TSP, or other qualified retirement account — or transfer from an existing IRA. Direct transfers are not taxable events.",
  },
  {
    num: "3",
    title: "Confirm Your Purchase",
    desc: "Once funds clear, we confirm your trade verbally at current wholesale pricing. No metals are purchased before your funds settle.",
  },
  {
    num: "4",
    title: "Depository Storage",
    desc: "Your metals ship directly to an IRS-approved depository. They are held in your name and insured — not commingled with other accounts.",
  },
];

export default function StateGoldIraPage() {
  const params = useParams<{ stateSlug: string }>();
  const slug = params.stateSlug ?? "";
  const state = getStateBySlug(slug);

  usePageMeta({
    title: state
      ? `Gold IRA in ${state.name} | Precious Metals IRA | West Hills Capital`
      : "Gold IRA by State | West Hills Capital",
    description: state
      ? `Learn how to open a Precious Metals IRA in ${state.name}. Step-by-step rollover process, eligible account types, and state-specific context. Call (800) 867-6768.`
      : "Gold IRA information by state — rollover process, eligible accounts, and depository storage.",
    canonical: state
      ? `https://westhillscapital.com/gold-ira/${state.slug}`
      : undefined,
  });

  if (!state) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pb-24">
        <h1 className="text-4xl font-serif font-semibold mb-4">State Not Found</h1>
        <p className="text-foreground/65 mb-8">Select your state below to learn about Gold IRA options.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-8 w-full max-w-lg">
          {US_STATES.map((s) => (
            <Link key={s.slug} href={`/gold-ira/${s.slug}`}>
              <div className="text-primary hover:underline text-sm font-medium text-left">{s.name}</div>
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
      <section className="bg-foreground text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/ira">
            <span className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mb-8 font-medium cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" />
              Precious Metals IRA
            </span>
          </Link>
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-4">
            {state.region} · {state.abbr}
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold text-white mb-5 leading-tight">
            Gold IRA in {state.name}
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-2xl">
            {state.name} residents can open a self-directed Precious Metals IRA to hold physical gold and silver inside a tax-advantaged retirement account. The process is straightforward — and West Hills Capital guides you through every step.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12">
              <div>
                <h2 className="text-2xl font-serif font-semibold mb-5">
                  How a Precious Metals IRA Works in {state.name}
                </h2>
                <p className="text-foreground/70 leading-relaxed mb-6">
                  Federal IRS rules govern self-directed IRAs across all 50 states — the process is the same whether you live in {state.name} or anywhere else in the country. Metals must be held by an IRS-approved custodian at a registered depository; you cannot store them at home inside an IRA.
                </p>
                <div className="space-y-6">
                  {PROCESS_STEPS.map((step) => (
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

              {state.taxNote && (
                <div className="bg-primary/5 rounded-2xl border border-primary/15 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">{state.name} Tax Context</h2>
                  </div>
                  <p className="text-foreground/70 text-sm leading-relaxed">{state.taxNote}</p>
                  <p className="text-foreground/50 text-xs mt-3">
                    Tax laws change. Always consult a CPA or tax professional for current guidance specific to your situation.
                  </p>
                </div>
              )}

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-5">
                  What You Can Hold in a Precious Metals IRA
                </h2>
                <p className="text-foreground/70 leading-relaxed mb-5">
                  The IRS specifies which metals qualify. West Hills Capital sources all three of the most commonly held IRA-eligible sovereign bullion coins:
                </p>
                <ul className="space-y-3">
                  {[
                    { name: "American Gold Eagle", detail: ".9167 fine · 1 oz · IRA-eligible by statute", slug: "american-gold-eagle" },
                    { name: "American Gold Buffalo", detail: ".9999 fine · 1 oz · IRA-eligible", slug: "american-gold-buffalo" },
                    { name: "American Silver Eagle", detail: ".999 fine · 1 oz · IRA-eligible", slug: "american-silver-eagle" },
                  ].map((coin) => (
                    <li key={coin.slug} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <Link href={`/products/${coin.slug}`}>
                          <span className="font-semibold text-sm hover:text-primary cursor-pointer transition-colors">{coin.name}</span>
                        </Link>
                        <span className="text-foreground/50 text-xs ml-2">{coin.detail}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-serif font-semibold mb-4">
                  Eligible Account Types for Rollover
                </h2>
                <p className="text-foreground/70 leading-relaxed mb-4">
                  Most tax-advantaged retirement accounts are eligible to roll over into a self-directed Precious Metals IRA:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {["401(k)", "Roth IRA", "SEP IRA", "403(b)", "TSP", "457(b)", "SIMPLE IRA", "Pension (lump sum)"].map((type) => (
                    <div key={type} className="bg-white border border-border/40 rounded-xl p-3 text-center text-sm font-medium text-foreground/75">
                      {type}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-t-4 border-t-primary p-6 shadow-sm">
                <h3 className="font-serif text-lg font-semibold mb-3">
                  Start the Conversation
                </h3>
                <p className="text-sm text-foreground/65 mb-5 leading-relaxed">
                  Every IRA allocation begins with a call. We walk through your current accounts, the rollover process, and current pricing — with no pressure.
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
                <h3 className="font-semibold text-sm mb-3">Nearby States</h3>
                <ul className="space-y-1.5">
                  {US_STATES.filter((s) => s.region === state.region && s.slug !== state.slug)
                    .slice(0, 6)
                    .map((s) => (
                      <li key={s.slug}>
                        <Link href={`/gold-ira/${s.slug}`}>
                          <span className="text-sm text-primary hover:underline cursor-pointer">
                            Gold IRA in {s.name}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>

              <div className="bg-white rounded-2xl border border-border/40 p-5">
                <p className="text-xs text-foreground/50 leading-relaxed">
                  <strong className="text-foreground">Note:</strong> IRA rules are federal — West Hills Capital serves clients in all 50 states. Tax treatment of distributions varies by state; consult a CPA for state-specific guidance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary/5 border-t border-border/20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Ready to open a Gold IRA in {state.name}?
          </h2>
          <p className="text-foreground/65 mb-8 max-w-xl mx-auto leading-relaxed">
            The process is simpler than most people expect. A 30-minute call covers everything — rollover logistics, custodian setup, and current pricing.
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
