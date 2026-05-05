import { useState } from "react";

const NAV_SIGNUP = "https://app.docuplete.com/signup";

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="7" fill={light ? "white" : "#1B4FD8"} />
        <path
          d="M8 8h8.5a3.5 3.5 0 0 1 0 7H8V8Z"
          fill={light ? "#1B4FD8" : "white"}
          opacity="0.9"
        />
        <path
          d="M8 15h9a3.5 3.5 0 0 1 0 7H8v-7Z"
          fill={light ? "#1B4FD8" : "white"}
        />
        <path d="M17.5 19.5 L21 19.5" stroke={light ? "white" : "#1B4FD8"} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className={`text-lg font-bold tracking-tight ${light ? "text-white" : "text-[#0B1220]"}`}>
        Docuplete
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-[#1B4FD8] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

const PLANS = [
  {
    name: "Starter",
    price: 49,
    description: "For solo practitioners getting started.",
    submissions: "50 submissions / seat / mo",
    seats: "2 seats included",
    overage: "$15 / extra seat",
    features: [
      "Upload any PDF template",
      "Shareable client link",
      "Submission tracking",
      "PDF export",
      "Email notifications",
    ],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Pro",
    price: 249,
    description: "For growing teams handling real volume.",
    submissions: "50 submissions / seat / mo",
    seats: "10 seats included",
    overage: "$15 / extra seat",
    features: [
      "Everything in Starter",
      "Team seats",
      "Batch CSV import",
      "Client links & custom branding",
      "Google Drive & HubSpot",
      "Priority support",
    ],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: 3000,
    description: "For firms that run high-volume intake.",
    submissions: "Unlimited submissions",
    seats: "25 seats included",
    overage: "$15 / extra seat",
    features: [
      "Everything in Pro",
      "Webhooks & API access",
      "Dedicated account manager",
      "SLA guarantee",
      "SSO / SAML",
      "Audit logs",
    ],
    cta: "Start free trial",
    highlight: false,
  },
];

const INDUSTRIES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
      </svg>
    ),
    label: "Financial Services",
    detail: "Advisors, brokers, retirement planners",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
    label: "Insurance",
    detail: "Life, health, P&C agents and agencies",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
    label: "Real Estate",
    detail: "Residential, commercial, property transactions",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 5.49Z" />
      </svg>
    ),
    label: "Legal",
    detail: "Law firms, estate planning, compliance",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    ),
    label: "Healthcare",
    detail: "Medical practices, clinics, providers",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Upload your PDF",
    body: "Drop in any intake form, application, or document template you already use. No reformatting needed.",
  },
  {
    number: "02",
    title: "Send a link",
    body: "Your client gets a clean, guided link — no login, no app, no confusion. They answer. You move on.",
  },
  {
    number: "03",
    title: "Get it back — complete",
    body: "Docuplete returns a filled, signed PDF. Every submission is logged, tracked, and ready to act on.",
  },
];

export default function Home() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-white text-[#0B1220] font-sans">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-[#E8EDF5]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="hidden sm:block text-sm text-[#4B5A7A] hover:text-[#0B1220] transition-colors">How it works</a>
            <a href="#pricing" className="hidden sm:block text-sm text-[#4B5A7A] hover:text-[#0B1220] transition-colors">Pricing</a>
            <a href="/docuplete-docs/" className="hidden sm:block text-sm text-[#4B5A7A] hover:text-[#0B1220] transition-colors">Docs</a>
            <a
              href={NAV_SIGNUP}
              className="inline-flex items-center gap-1.5 bg-[#1B4FD8] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1740B8] transition-colors"
            >
              Start free trial
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative bg-[#0B1220] text-white pt-40 pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#1B4FD8] opacity-[0.12] rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-[#1B4FD8] opacity-[0.06] rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white/80 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
            14-day free trial · No credit card required
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
            Upload your PDF.<br />
            Send a link.<br />
            <span className="text-[#5B8DEF]">Get it back — filled,<br className="hidden sm:block" /> signed, and tracked.</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10">
            Client paperwork, on autopilot. Stop chasing docs — start closing deals.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={NAV_SIGNUP}
              className="inline-flex items-center justify-center gap-2 bg-[#1B4FD8] hover:bg-[#1740B8] text-white font-semibold px-7 py-3.5 rounded-xl transition-colors text-base shadow-lg shadow-[#1B4FD8]/30"
            >
              Start your free trial
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 border border-white/25 text-white/80 hover:text-white hover:border-white/50 font-medium px-7 py-3.5 rounded-xl transition-colors text-base"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ── PROOF BAR ───────────────────────────────────────── */}
      <section className="bg-[#F5F7FC] border-y border-[#E8EDF5] py-5 px-6">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-[#4B5A7A]">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#1B4FD8]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292Z"/></svg>
            Used by an <strong className="text-[#0B1220] font-semibold">Inc. 500 #79</strong> firm
          </span>
          <span className="hidden sm:block text-[#D0D9EC]">|</span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#1B4FD8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" /></svg>
            <strong className="text-[#0B1220] font-semibold">$150 saved</strong> per client package
          </span>
          <span className="hidden sm:block text-[#D0D9EC]">|</span>
          <span>Built for Finance · Insurance · Real Estate · Legal · Healthcare</span>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#1B4FD8] text-sm font-semibold uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0B1220]">Three steps. Zero friction.</h2>
            <p className="mt-4 text-[#4B5A7A] max-w-lg mx-auto">
              From operations to sales, everyone gets better with Docuplete. Built for each.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div key={step.number} className="relative bg-[#F5F7FC] rounded-2xl p-8 border border-[#E8EDF5]">
                <div className="text-5xl font-black text-[#1B4FD8]/10 mb-4 leading-none select-none">{step.number}</div>
                <h3 className="text-lg font-bold text-[#0B1220] mb-3">{step.title}</h3>
                <p className="text-[#4B5A7A] text-sm leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES ──────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#0B1220] text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#5B8DEF] text-sm font-semibold uppercase tracking-widest mb-3">Industries</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Built for each.</h2>
            <p className="mt-4 text-white/60 max-w-lg mx-auto">
              Docuplete adapts to the way your industry collects information — not the other way around.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {INDUSTRIES.map((ind) => (
              <div
                key={ind.label}
                className="flex flex-col items-center text-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-6 transition-colors cursor-default"
              >
                <div className="text-white/70">{ind.icon}</div>
                <div>
                  <p className="text-sm font-semibold text-white">{ind.label}</p>
                  <p className="text-xs text-white/50 mt-1 leading-snug">{ind.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#F5F7FC] border-y border-[#E8EDF5]">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-[#1B4FD8] text-sm font-semibold uppercase tracking-widest mb-4">Proven results</p>
              <h2 className="text-3xl font-bold text-[#0B1220] mb-4">
                Real results from a real firm.
              </h2>
              <p className="text-[#4B5A7A] leading-relaxed">
                An early version of Docuplete helped power one of the fastest-growing financial services firms in the country — ranked <strong className="text-[#0B1220]">#79 on the Inc. 500</strong>. The intake automation it enabled is now available to every team on Docuplete.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-[#E8EDF5] rounded-2xl p-6">
                <div className="text-3xl font-black text-[#1B4FD8] mb-1">$150</div>
                <div className="text-sm text-[#4B5A7A]">saved per client package in labor, resources, and error handling</div>
              </div>
              <div className="bg-white border border-[#E8EDF5] rounded-2xl p-6">
                <div className="text-3xl font-black text-[#1B4FD8] mb-1">#79</div>
                <div className="text-sm text-[#4B5A7A]">Inc. 500 fastest-growing companies</div>
              </div>
              <div className="bg-white border border-[#E8EDF5] rounded-2xl p-6 col-span-2">
                <div className="text-2xl font-black text-[#1B4FD8] mb-1">Zero chasing.</div>
                <div className="text-sm text-[#4B5A7A]">Clients complete on their own time. You get a finished document.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-[#1B4FD8] text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0B1220]">Simple pricing. Early-adopter rates.</h2>
            <p className="mt-4 text-[#4B5A7A] max-w-lg mx-auto">
              All plans start with a 14-day free trial. These prices are introductory — they will increase as we grow.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={`text-sm font-medium ${!annual ? "text-[#0B1220]" : "text-[#4B5A7A]"}`}>Monthly</span>
            <button
              type="button"
              onClick={() => setAnnual(!annual)}
              className={`relative w-12 h-7 rounded-full overflow-hidden transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4FD8] focus-visible:ring-offset-2 ${annual ? "bg-[#1B4FD8]" : "bg-[#D0D9EC]"}`}
              aria-pressed={annual}
              aria-label="Toggle annual billing"
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${annual ? "left-6" : "left-1"}`}
              />
            </button>
            <span className={`text-sm font-medium ${annual ? "text-[#0B1220]" : "text-[#4B5A7A]"}`}>
              Annual{" "}
              <span className="inline-flex items-center bg-[#EEF3FF] text-[#1B4FD8] text-xs font-bold px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {PLANS.map((plan) => {
              const monthlyPrice = plan.price;
              const annualPerMo = Math.round(monthlyPrice * 0.8);
              const displayPrice = annual ? annualPerMo : monthlyPrice;
              const annualTotal = annualPerMo * 12;
              const annualSavings = (monthlyPrice - annualPerMo) * 12;
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl border p-6 sm:p-8 flex flex-col ${
                    plan.highlight
                      ? "bg-[#0B1220] text-white border-[#1B4FD8] shadow-xl shadow-[#1B4FD8]/10"
                      : "bg-white text-[#0B1220] border-[#E8EDF5]"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#1B4FD8] text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">
                      Most popular
                    </div>
                  )}
                  <div className="mb-6">
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${plan.highlight ? "text-[#5B8DEF]" : "text-[#1B4FD8]"}`}>
                      {plan.name}
                    </p>
                    <div className="flex items-end gap-1.5 mb-1">
                      {annual && (
                        <span className={`text-lg font-semibold line-through pb-1 ${plan.highlight ? "text-white/30" : "text-[#B0BCCE]"}`}>
                          ${monthlyPrice}
                        </span>
                      )}
                      <span className="text-4xl font-black">${displayPrice}</span>
                      <span className={`text-sm pb-1.5 ${plan.highlight ? "text-white/60" : "text-[#4B5A7A]"}`}>/mo</span>
                    </div>
                    {annual ? (
                      <p className={`text-xs mb-2 font-medium ${plan.highlight ? "text-[#5B8DEF]" : "text-[#1B4FD8]"}`}>
                        Billed ${annualTotal}/yr &mdash; you save ${annualSavings}
                      </p>
                    ) : (
                      <p className={`text-xs mb-2 ${plan.highlight ? "text-white/40" : "text-[#B0BCCE]"}`}>
                        or ${annualPerMo}/mo billed annually
                      </p>
                    )}
                    <p className={`text-sm ${plan.highlight ? "text-white/70" : "text-[#4B5A7A]"}`}>{plan.description}</p>
                  </div>

                  <div className={`rounded-xl px-4 py-3 mb-6 text-xs space-y-1 ${plan.highlight ? "bg-white/10" : "bg-[#F5F7FC]"}`}>
                    <p className={`font-semibold ${plan.highlight ? "text-white" : "text-[#0B1220]"}`}>{plan.submissions}</p>
                    <p className={plan.highlight ? "text-white/70" : "text-[#4B5A7A]"}>{plan.seats}</p>
                    <p className={plan.highlight ? "text-white/60" : "text-[#4B5A7A]"}>{plan.overage}</p>
                  </div>

                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <svg className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? "text-[#5B8DEF]" : "text-[#1B4FD8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className={plan.highlight ? "text-white/80" : "text-[#4B5A7A]"}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={NAV_SIGNUP}
                    className={`block text-center font-semibold py-3 rounded-xl transition-colors text-sm ${
                      plan.highlight
                        ? "bg-[#1B4FD8] text-white hover:bg-[#1740B8]"
                        : "bg-[#F5F7FC] text-[#0B1220] border border-[#E8EDF5] hover:bg-[#EDF0F7]"
                    }`}
                  >
                    {plan.cta}
                  </a>
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm text-[#4B5A7A] mt-8">
            Prices shown are introductory and <strong className="text-[#0B1220]">will increase</strong> as Docuplete grows. Lock in your rate today.
          </p>
        </div>
      </section>

      {/* ── FOOTER CTA ──────────────────────────────────────── */}
      <section className="bg-[#0B1220] text-white py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Stop chasing docs.<br />Start closing deals.
          </h2>
          <p className="text-white/60 mb-10 text-lg">
            14 days free. No credit card. Cancel anytime.
          </p>
          <a
            href={NAV_SIGNUP}
            className="inline-flex items-center gap-2 bg-[#1B4FD8] hover:bg-[#1740B8] text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base shadow-lg shadow-[#1B4FD8]/30"
          >
            Start your free trial
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="bg-[#080D16] text-white/40 py-10 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo light />
          <div className="flex items-center gap-6 text-sm">
            <a href="#" className="hover:text-white/70 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/70 transition-colors">Terms</a>
            <a href="mailto:hello@docuplete.com" className="hover:text-white/70 transition-colors">Contact</a>
          </div>
          <p className="text-xs">&copy; {new Date().getFullYear()} Docuplete. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
