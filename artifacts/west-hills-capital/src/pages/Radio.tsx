import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Phone, Star, ShieldCheck } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import logoSrc from "@/assets/logo.webp";

const TESTIMONIALS = [
  {
    quote:
      "I had spoken with some of the larger companies but always felt like I was dealing with used car salesmen. When I landed on the West Hills Capital website I immediately found the information I needed. Joe spoke with me several times and took a personal interest in helping me find the right solution.",
    name: "David F.",
    detail: "Verified client",
  },
  {
    quote:
      "This market was very new to me, but they helped guide me into the best options. When investing large sums you definitely want someone you trust and who is very knowledgeable. I will personally use them again.",
    name: "Austin C.",
    detail: "Verified client",
  },
  {
    quote:
      "There's this aura about touching gold and silver — something you can't explain until it's in your hands. West Hills Capital knows what you want and they deliver it in a timely manner. I can't wait to purchase even more metal from them.",
    name: "Richie A.",
    detail: "Verified client",
  },
];

const PRINCIPLES = [
  "Transparent, market-based pricing with no hidden fees",
  "No leverage or margin accounts",
  "No speculative positioning",
  "Pricing confirmed at time of execution",
  "Clear documentation and confirmation on every trade",
  "Reliable buyback support",
];

const STEPS = [
  {
    num: "01",
    title: "Pick a time",
    desc: "Morning, afternoon, or evening slots available most business days. Confirmed immediately.",
  },
  {
    num: "02",
    title: "We call you",
    desc: "You give us your number — we make the call at the scheduled time. No chasing, no hold music.",
  },
  {
    num: "03",
    title: "We talk through your situation",
    desc: "How much, what form, delivery or IRA, timing. Pricing is locked verbally and confirmed in writing if you move forward. If you don't, you leave better informed than you came in.",
  },
];

export default function Radio() {
  usePageMeta({
    title: "West Hills Capital | Schedule Your Call",
    description:
      "Physical gold and silver with transparent pricing, no hidden fees, and disciplined execution. Schedule a private 45-minute call.",
  });

  return (
    <div className="w-full flex flex-col min-h-screen bg-background">

      {/* ── Minimal header — logo + phone only, no nav ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" aria-label="West Hills Capital home">
            <img src={logoSrc} alt="West Hills Capital" className="h-9 w-auto" />
          </Link>
          <a
            href="tel:+18008676768"
            className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            <Phone className="w-4 h-4 text-primary" aria-hidden="true" />
            (800) 867-6768
          </a>
        </div>
      </header>

      <main id="main-content" className="flex-1">

        {/* ── Hero ── */}
        <section className="relative pt-16 pb-20 overflow-hidden bg-background">
          {/* Same background treatment as homepage */}
          <div className="absolute inset-0 z-0">
            <img
              src={`${import.meta.env.BASE_URL}images/hero-bg.webp`}
              alt=""
              fetchPriority="high"
              className="w-full h-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/90 to-background" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* SiriusXM listener acknowledgment */}
            <div className="flex justify-center mb-8">
              <span className="inline-flex items-center gap-2 border border-border/50 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-foreground/50 bg-white/70">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
                As Heard on SiriusXM
              </span>
            </div>

            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-5xl sm:text-6xl font-serif font-semibold text-foreground leading-[1.1] mb-6">
                The dollar has lost 95% of its purchasing power since 1913.{" "}
                <span className="text-primary italic">Gold has not.</span>
              </h1>
              <p className="text-xl sm:text-2xl text-foreground/70 mb-2 font-medium">
                Physical gold and silver — something you actually own.
              </p>
              <p className="text-base sm:text-lg text-foreground/50 mb-10">
                Transparent pricing. No hidden fees. Disciplined execution.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/schedule?src=radio">
                  <Button size="lg" className="h-12 px-8 text-base group">
                    Schedule Your Call
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <a href="tel:+18008676768">
                  <Button variant="outline" size="lg" className="h-12 px-8 text-base bg-white/70 backdrop-blur-sm">
                    Call (800) 867-6768
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── A Grounded Approach ── */}
        <section className="py-20 bg-white border-t border-border/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-3xl lg:text-4xl font-serif font-semibold mb-5">A Grounded Approach</h2>
              <p className="text-foreground/60 text-lg leading-relaxed">
                We help long-term investors buy physical gold and silver — for direct delivery to your home or vault, or through an IRA rollover or transfer. Transparent pricing. No pressure.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
              {[
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-7 h-7 text-primary">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                    </svg>
                  ),
                  title: "Transparent Pricing",
                  desc: "Pricing is based on live market conditions with a consistent, disclosed spread. Final pricing is confirmed at the time of execution — no surprises.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-7 h-7 text-primary">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0v10l-8 4m-8-4V7m8 4v10" />
                    </svg>
                  ),
                  title: "Delivery or IRA",
                  desc: "Buy for physical delivery to your home or vault, or allocate through a tax-advantaged IRA rollover or transfer.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-7 h-7 text-primary">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
                    </svg>
                  ),
                  title: "Long-Term Perspective",
                  desc: "We approach gold and silver as foundational holdings for serious investors — not short-term trades or speculative positions.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="p-7 rounded-2xl bg-background border border-border/50 hover:shadow-md transition-shadow duration-300 group"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                  <p className="text-foreground/60 leading-relaxed text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="py-20 bg-background border-t border-border/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" aria-hidden="true" />
                ))}
                <span className="ml-2 text-sm font-medium text-foreground/50">4.9 on Google</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-serif font-semibold text-foreground">
                What clients say
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-border/40 p-7 flex flex-col shadow-sm"
                >
                  <div className="text-5xl font-serif leading-none text-primary/25 mb-3 select-none" aria-hidden="true">"</div>
                  <p className="text-[15px] text-foreground/72 leading-relaxed flex-1 mb-6 italic">
                    {t.quote}
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0" aria-hidden="true">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-foreground/45">{t.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Operating Principles (dark section) ── */}
        <section className="py-20 bg-foreground text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" aria-hidden="true" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl lg:text-5xl font-serif font-semibold mb-7 text-white">
                  Our Operating Principles
                </h2>
                <p className="text-white/60 text-lg mb-8 leading-relaxed">
                  Trust is built through consistent, transparent behavior. These principles guide every purchase discussion and every trade we execute on your behalf.
                </p>
                <ul className="space-y-3">
                  {PRINCIPLES.map((p) => (
                    <li key={p} className="flex items-center gap-3 text-white/80">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl relative">
                  <img
                    src={`${import.meta.env.BASE_URL}images/coins-hero.webp`}
                    alt="Gold and silver coins"
                    loading="lazy"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: "28% center" }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground to-transparent sm:opacity-60 opacity-30" />
                  <div className="hidden sm:block absolute bottom-7 left-7 right-7">
                    <div className="p-5 rounded-xl bg-black/50 border border-white/10 backdrop-blur-sm">
                      <ShieldCheck className="w-9 h-9 text-primary mb-3" aria-hidden="true" />
                      <h3 className="text-white font-serif text-lg mb-1">Commitment to Stewardship</h3>
                      <p className="text-white/60 text-sm">
                        We treat every purchase discussion with the gravity and respect your capital demands.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── What to expect on your call ── */}
        <section className="py-20 bg-white border-t border-border/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-serif font-semibold mb-4">
                What to expect
              </h2>
              <p className="text-foreground/60 text-lg leading-relaxed">
                A private 45-minute call. No script, no sales funnel, no follow-up pressure.
              </p>
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-7" aria-label="Consultation call steps">
              {STEPS.map(({ num, title, desc }) => (
                <li key={num} className="p-7 rounded-2xl bg-background border border-border/50 flex flex-col gap-4">
                  <div className="font-serif text-4xl text-primary/30 font-semibold leading-none" aria-hidden="true">
                    {num}
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{title}</h3>
                  <p className="text-sm text-foreground/60 leading-relaxed">{desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="py-20 bg-primary/5 border-t border-border/20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl lg:text-4xl font-serif font-semibold mb-5">
              Ready to discuss your purchase?
            </h2>
            <p className="text-foreground/60 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
              Every purchase begins with a private call to review your objectives, confirm current pricing, and establish delivery or IRA logistics. No automated execution. No pressure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/schedule?src=radio">
                <Button size="lg" className="h-12 px-10 text-base shadow-md group">
                  Schedule Your Call
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="tel:+18008676768">
                <Button variant="outline" size="lg" className="h-12 px-10 text-base bg-white">
                  Call (800) 867-6768
                </Button>
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer (matches site footer exactly) ── */}
      <footer className="bg-foreground text-white/75 border-t border-white/10 pt-14 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-14">
            <div>
              <h3 className="font-serif text-xl text-white mb-5">West Hills Capital</h3>
              <p className="text-sm leading-relaxed text-white/55 mb-5">
                Physical gold and silver allocation — transparent pricing, disciplined execution, and guided support for long-term investors.
              </p>
              <p className="text-sm font-medium text-white bg-white/5 inline-block px-4 py-2 rounded-lg border border-white/10">
                We will call you from{" "}
                <strong className="text-primary tracking-wide ml-1">(800) 867-6768</strong>
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-5 uppercase tracking-widest text-xs">Legal</h4>
              <ul className="space-y-3">
                <li><Link href="/disclosures" className="hover:text-primary transition-colors text-sm">Disclosures</Link></li>
                <li><Link href="/privacy" className="hover:text-primary transition-colors text-sm">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-primary transition-colors text-sm">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-5 uppercase tracking-widest text-xs">Contact</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                  <a href="tel:+18008676768" className="text-white hover:text-primary transition-colors text-sm">(800) 867-6768</a>
                </li>
                <li className="flex items-start gap-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <a href="mailto:info@westhillscapital.com" className="hover:text-primary transition-colors text-sm">info@westhillscapital.com</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs text-white/35">
            <p>© {new Date().getFullYear()} West Hills Capital. All rights reserved.</p>
            <p className="text-left md:text-right max-w-xl leading-relaxed">
              Precious metals markets carry inherent risk. West Hills Capital provides physical precious metals allocation and execution services. We do not provide investment, legal, or tax advice.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
