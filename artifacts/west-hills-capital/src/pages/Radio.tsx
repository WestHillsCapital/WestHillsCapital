import { usePageMeta } from "@/hooks/use-page-meta";
import { Link } from "wouter";

const PHONE = "(800) 867-6768";
const PHONE_HREF = "tel:+18008676768";
const SCHEDULE_URL = "/schedule?src=radio";

// ---------------------------------------------------------------------------
// WHC wordmark — matches the brand treatment used in the navbar
// ---------------------------------------------------------------------------
function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif tracking-tight ${className}`}>
      <span className="text-[#0F1C3F]">West Hills </span>
      <span className="text-[#C49A38]">Capital</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sirius badge
// ---------------------------------------------------------------------------
function SiriusBadge() {
  return (
    <div className="inline-flex items-center gap-2 bg-white border border-[#DDD5C4] rounded-full px-4 py-1.5 shadow-sm">
      <span className="w-2 h-2 rounded-full bg-[#C49A38] shrink-0" aria-hidden="true" />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7A99]">
        As Heard on SiriusXM
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proof pillars
// ---------------------------------------------------------------------------
const PILLARS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    ),
    title: "Transparent, Market-Based Pricing",
    body: "You see exactly what we pay and exactly what we earn. Our spread is disclosed on every transaction — no hidden fees, no markup buried in delivery.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0v10l-8 4m-8-4V7m8 4v10" />
      </svg>
    ),
    title: "Physical Metal — Delivered or IRA-Held",
    body: "FedEx 2-Day, fully insured — to your door or to an IRS-approved depository in your name. Three sovereign bullion products. Nothing exotic, nothing you can't resell.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "A Private Call — Not a Sales Funnel",
    body: "45 minutes with a real person who knows the market. No scripts, no pressure, no follow-up harassment. If the timing isn't right for you, we'll tell you.",
  },
];

// ---------------------------------------------------------------------------
// What happens on the call
// ---------------------------------------------------------------------------
const STEPS = [
  {
    num: "01",
    heading: "You pick a time that works",
    body: "Morning, afternoon, or evening slots available most business days. Confirmed immediately — no back-and-forth.",
  },
  {
    num: "02",
    heading: "We call you — you don't chase us",
    body: "Your contact details come to us. We make the call at the scheduled time. One number: (800) 867-6768.",
  },
  {
    num: "03",
    heading: "We talk through your situation honestly",
    body: "How much, what form, delivery or IRA, timing. If you decide to move forward, pricing is locked verbally and confirmed in writing. If not, you leave with better information than you came in with.",
  },
];

// ---------------------------------------------------------------------------
// Testimonial
// ---------------------------------------------------------------------------
function Testimonial() {
  return (
    <figure className="max-w-2xl mx-auto text-center px-4">
      <blockquote className="font-serif text-2xl md:text-3xl text-[#0F1C3F] leading-snug mb-6">
        "There's this aura about touching gold and silver — something you can't explain until it's in your hands."
      </blockquote>
      <figcaption className="text-sm text-[#6B7A99] font-medium">
        West Hills Capital client · IRA rollover + home delivery
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Radio() {
  usePageMeta({
    title: "West Hills Capital — Schedule Your Call",
    description:
      "Physical gold and silver with transparent pricing, no hidden fees, and disciplined execution. Schedule a private 45-minute call.",
  });

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex flex-col">

      {/* ── Minimal header ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#DDD5C4] shadow-sm">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <Link href="/" aria-label="West Hills Capital home">
            <Wordmark className="text-xl" />
          </Link>
          <a
            href={PHONE_HREF}
            className="flex items-center gap-2 text-sm font-semibold text-[#0F1C3F] hover:text-[#C49A38] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 5.25v1.5z" />
            </svg>
            {PHONE}
          </a>
        </div>
      </header>

      <main id="main-content" className="flex-1">

        {/* ── Hero ── */}
        <section className="bg-[#0F1C3F] text-white pt-16 pb-20 px-5">
          <div className="max-w-3xl mx-auto text-center">
            <div className="mb-7 flex justify-center">
              <SiriusBadge />
            </div>

            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-tight mb-6">
              The dollar has lost 95% of its purchasing power since 1913.{" "}
              <em className="not-italic text-[#C49A38]">Gold has not.</em>
            </h1>

            <p className="text-lg md:text-xl text-[#B8C4D8] leading-relaxed max-w-2xl mx-auto mb-10">
              If you've already decided you want something real — physical gold and silver
              you actually own — we help you make that move the right way. Transparent pricing.
              No hidden fees. No pressure.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={SCHEDULE_URL}
                className="inline-flex items-center justify-center gap-2 bg-[#C49A38] hover:bg-[#B08A28] text-white font-semibold text-base px-9 py-4 rounded-lg transition-colors shadow-lg shadow-[#C49A38]/20"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 shrink-0" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                Schedule Your Call
              </Link>
              <a
                href={PHONE_HREF}
                className="inline-flex items-center justify-center gap-2 text-white/80 hover:text-white font-medium text-base transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 5.25v1.5z" />
                </svg>
                Or call us now &nbsp;·&nbsp; {PHONE}
              </a>
            </div>
          </div>
        </section>

        {/* ── Gold rule divider ── */}
        <div className="h-1 bg-gradient-to-r from-transparent via-[#C49A38] to-transparent opacity-60" aria-hidden="true" />

        {/* ── Proof pillars ── */}
        <section className="py-16 px-5 bg-white" aria-labelledby="pillars-heading">
          <div className="max-w-5xl mx-auto">
            <h2 id="pillars-heading" className="sr-only">Why West Hills Capital</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {PILLARS.map(({ icon, title, body }) => (
                <div key={title} className="flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#F5F0E8] border border-[#DDD5C4] flex items-center justify-center text-[#C49A38]" aria-hidden="true">
                    {icon}
                  </div>
                  <h3 className="font-serif text-lg text-[#0F1C3F] leading-snug">{title}</h3>
                  <p className="text-sm text-[#4A5568] leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonial ── */}
        <section className="py-16 px-5 bg-[#F5F0E8] border-y border-[#DDD5C4]" aria-label="Client testimonial">
          <Testimonial />
        </section>

        {/* ── What happens on the call ── */}
        <section className="py-16 px-5 bg-white" aria-labelledby="steps-heading">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 id="steps-heading" className="font-serif text-3xl md:text-4xl text-[#0F1C3F] mb-3">
                What to expect
              </h2>
              <p className="text-[#6B7A99] text-base">
                A 45-minute call. No script. No follow-up pressure.
              </p>
            </div>

            <ol className="space-y-8" aria-label="Steps for the consultation call">
              {STEPS.map(({ num, heading, body }) => (
                <li key={num} className="flex gap-6">
                  <div
                    className="shrink-0 w-12 h-12 rounded-full border-2 border-[#C49A38] flex items-center justify-center font-serif text-[#C49A38] text-sm font-bold"
                    aria-hidden="true"
                  >
                    {num}
                  </div>
                  <div className="pt-2">
                    <h3 className="font-semibold text-[#0F1C3F] mb-1">{heading}</h3>
                    <p className="text-sm text-[#4A5568] leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Positioning note ── */}
        <section className="py-16 px-5 bg-[#F5F0E8] border-t border-[#DDD5C4]" aria-labelledby="approach-heading">
          <div className="max-w-2xl mx-auto text-center">
            <h2 id="approach-heading" className="font-serif text-2xl md:text-3xl text-[#0F1C3F] mb-5">
              We're not trying to move every caller into metal.
            </h2>
            <p className="text-[#4A5568] leading-relaxed text-base mb-6">
              Most people who find their way to us have already done the research. They've
              looked at what's happened to purchasing power, they've watched the Fed, and
              they've decided they want something tangible. We don't make the case for you —
              you've made it yourself. We just help you execute correctly.
            </p>
            <p className="text-[#6B7A99] text-sm italic">
              "Trust is built through consistent, transparent behavior." — Our operating principle.
            </p>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-20 px-5 bg-[#0F1C3F] text-white text-center" aria-labelledby="cta-heading">
          <div className="max-w-2xl mx-auto">
            <h2 id="cta-heading" className="font-serif text-3xl md:text-4xl mb-4">
              Ready to talk?
            </h2>
            <p className="text-[#B8C4D8] text-base mb-10 leading-relaxed">
              Pick a time below. We'll call you. The call is free, the pricing is transparent,
              and the decision is entirely yours.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={SCHEDULE_URL}
                className="inline-flex items-center justify-center gap-2 bg-[#C49A38] hover:bg-[#B08A28] text-white font-semibold text-base px-10 py-4 rounded-lg transition-colors shadow-lg shadow-[#C49A38]/20"
              >
                Schedule Your Call
              </Link>
              <a
                href={PHONE_HREF}
                className="inline-flex items-center justify-center gap-2 border border-white/30 hover:border-white/60 text-white font-medium text-base px-8 py-4 rounded-lg transition-colors"
              >
                Call {PHONE}
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* ── Minimal footer ── */}
      <footer className="bg-[#0A1530] border-t border-white/10 px-5 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <Wordmark className="text-base text-white" />
          <p className="text-[10px] text-white/40 leading-relaxed max-w-xl">
            West Hills Capital provides physical precious-metals allocation and trade execution
            services. Precious metals markets carry inherent risk. Nothing on this page constitutes
            investment, legal, or tax advice. Past performance of any market or asset does not
            guarantee future results.{" "}
            <Link href="/disclosures" className="underline hover:text-white/60 transition-colors">
              Full disclosures
            </Link>
            {" "}·{" "}
            <Link href="/privacy" className="underline hover:text-white/60 transition-colors">
              Privacy
            </Link>
          </p>
        </div>
      </footer>

    </div>
  );
}
