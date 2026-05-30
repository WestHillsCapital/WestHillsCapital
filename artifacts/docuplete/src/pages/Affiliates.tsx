import { useState } from "react";

const NAV_SIGNUP = "https://app.docuplete.com/signup";

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 shrink-0">
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M6 4h18l6 6v22H6V4z" fill="#0E1D4A" stroke={light ? "white" : "none"} strokeWidth={light ? "1.5" : "0"} strokeLinejoin="round" />
          <path d="M24 4l6 6h-6V4z" fill="#C49A38" />
          <rect x="10" y="14" width="10" height="1.5" rx="0.75" fill="rgba(255,255,255,0.5)" />
          <rect x="10" y="18" width="14" height="1.5" rx="0.75" fill="rgba(255,255,255,0.5)" />
          <rect x="10" y="22" width="8" height="1.5" rx="0.75" fill="rgba(255,255,255,0.5)" />
          <circle cx="26" cy="28" r="5" fill="#C49A38" />
          <path d="M23.5 28l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className={`text-xl font-bold tracking-tight ${light ? "text-white" : "text-[#0E1D4A]"}`}>
        Docuplete
      </span>
    </div>
  );
}

function CheckIcon({ gold = false }: { gold?: boolean }) {
  return (
    <svg className={`w-5 h-5 shrink-0 mt-0.5 ${gold ? "text-[#C49A38]" : "text-[#1B4FD8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function AffiliateApplyForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Name, email, and how you'll promote are required.");
      return;
    }
    if (!agreed) {
      setError("Please accept the affiliate program agreement to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || undefined,
          website: website.trim() || undefined,
          message: message.trim(),
          agreementAccepted: true,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12 px-8">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-white text-xl font-bold mb-2">Application received</h3>
        <p className="text-white/55 text-sm max-w-sm mx-auto">
          Thanks, {name.split(" ")[0]}! We review applications within 2 business days and will reach out to {email} with next steps.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-white/50 font-semibold uppercase tracking-wider mb-1.5">
            Full name <span className="text-[#C49A38]">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#1B4FD8]/70 focus:bg-white/8 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 font-semibold uppercase tracking-wider mb-1.5">
            Email <span className="text-[#C49A38]">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@yourfirm.com"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#1B4FD8]/70 transition-colors"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-white/50 font-semibold uppercase tracking-wider mb-1.5">Company / firm</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Acme Advisory"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#1B4FD8]/70 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 font-semibold uppercase tracking-wider mb-1.5">Website</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yourfirm.com"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#1B4FD8]/70 transition-colors"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-white/50 font-semibold uppercase tracking-wider mb-1.5">
          How will you promote Docuplete? <span className="text-[#C49A38]">*</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Tell us about your audience, community, or distribution channel — e.g. a newsletter, podcast, client base, or software integration."
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#1B4FD8]/70 transition-colors resize-none"
        />
      </div>
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="sr-only"
          />
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${agreed ? "bg-[#1B4FD8] border-[#1B4FD8]" : "bg-white/5 border-white/20 group-hover:border-white/40"}`}>
            {agreed && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-white/50 text-sm leading-relaxed">
          I agree to the{" "}
          <a href="/affiliates/agreement" className="text-[#1B4FD8] hover:underline" onClick={(e) => e.stopPropagation()}>
            Affiliate Program Agreement
          </a>
          , including the commission structure, referral tracking terms, and payment policies.
        </span>
      </label>
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="self-start inline-flex items-center gap-2 bg-[#C49A38] hover:bg-[#A07820] disabled:opacity-60 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-sm shadow-lg shadow-[#C49A38]/20"
      >
        {submitting ? (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        )}
        {submitting ? "Submitting…" : "Apply to become a partner"}
      </button>
      <p className="text-white/25 text-xs">We review all applications within 2 business days.</p>
    </form>
  );
}

export default function Affiliates() {
  return (
    <div className="min-h-screen bg-[#0B1220] font-sans">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-[#0B1220]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="no-underline">
            <Logo light />
          </a>
          <div className="flex items-center gap-4">
            <a href="/" className="text-white/50 hover:text-white text-sm transition-colors hidden sm:block">← Back to site</a>
            <a
              href={NAV_SIGNUP}
              className="inline-flex items-center gap-2 bg-[#1B4FD8] hover:bg-[#1740B8] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Sign up free
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1B4FD8]/10 via-transparent to-[#C49A38]/8 pointer-events-none" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-[#1B4FD8]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#C49A38]/10 border border-[#C49A38]/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C49A38]" />
            <span className="text-[#C49A38] text-xs font-semibold uppercase tracking-widest">Partner Program</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Earn recurring revenue<br className="hidden sm:block" />
            <span className="text-[#C49A38]"> recommending Docuplete</span>
          </h1>
          <p className="text-white/55 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Refer financial advisors, insurance agents, and professional services firms to Docuplete. Earn <strong className="text-white font-semibold">20% recurring commission</strong> for every month they stay a paying customer — for up to 12 months.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#apply"
              className="inline-flex items-center gap-2 bg-[#C49A38] hover:bg-[#A07820] text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base shadow-lg shadow-[#C49A38]/20"
            >
              Apply now — it's free
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
            <a href="#how-it-works" className="text-white/50 hover:text-white text-sm font-medium transition-colors">
              See how it works ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-white/8 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-3 gap-6 text-center">
          {[
            { value: "20%", label: "Recurring commission" },
            { value: "12 mo", label: "Per customer referred" },
            { value: "2 days", label: "Application review time" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl sm:text-4xl font-bold text-[#C49A38] mb-1">{s.value}</p>
              <p className="text-white/40 text-xs sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#1B4FD8] text-sm font-semibold uppercase tracking-widest mb-3">Simple process</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">How the partner program works</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Apply",
                desc: "Fill out the short application below. We review every partner personally and reply within 2 business days.",
              },
              {
                step: "02",
                title: "Get your referral link",
                desc: "Once approved you receive a unique referral code and tracking link. Share it anywhere — email, site, social, or directly.",
              },
              {
                step: "03",
                title: "Earn every month",
                desc: "For every paying customer you refer, you earn 20% of their monthly plan cost for up to 12 months, paid via Stripe.",
              },
            ].map((s) => (
              <div key={s.step} className="relative bg-white/[0.04] border border-white/10 rounded-2xl p-7 hover:border-[#1B4FD8]/30 transition-colors">
                <p className="text-[#1B4FD8]/40 text-4xl font-black mb-4 select-none">{s.step}</p>
                <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Commission example ── */}
      <section className="py-16 px-6 bg-white/[0.02] border-y border-white/8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[#1B4FD8] text-sm font-semibold uppercase tracking-widest mb-3">Real numbers</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">What you can earn</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { plan: "Starter", price: 79, monthly: 15.80, total: 189.60 },
              { plan: "Pro", price: 199, monthly: 39.80, total: 477.60, highlight: true },
              { plan: "Developer", price: 399, monthly: 79.80, total: 957.60 },
            ].map((p) => (
              <div key={p.plan} className={`rounded-2xl p-6 border ${p.highlight ? "bg-[#1B4FD8]/10 border-[#1B4FD8]/30" : "bg-white/[0.03] border-white/10"}`}>
                <p className={`text-sm font-semibold mb-1 ${p.highlight ? "text-[#1B4FD8]" : "text-white/50"}`}>{p.plan} plan</p>
                <p className="text-white/40 text-xs mb-4">${p.price}/mo customer</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-xs">Monthly commission</span>
                    <span className="text-white font-semibold">${p.monthly.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-white/10 pt-2">
                    <span className="text-white/50 text-xs">Total (12 months)</span>
                    <span className={`font-bold ${p.highlight ? "text-[#C49A38]" : "text-white"}`}>${p.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-white/25 text-xs text-center mt-6">
            Commissions are paid monthly via Stripe for active, paying customers. Trials and refunded accounts are excluded.
          </p>
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[#1B4FD8] text-sm font-semibold uppercase tracking-widest mb-3">Great fit</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Who thrives as a Docuplete partner?</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                icon: "💼",
                title: "Financial advisors & coaches",
                desc: "You already help clients with retirement accounts, rollovers, and planning. Docuplete removes the paperwork bottleneck for your peers.",
              },
              {
                icon: "🏦",
                title: "Insurance & annuity professionals",
                desc: "Your network is full of agents who drown in application forms. Refer them to Docuplete and get paid every month they use it.",
              },
              {
                icon: "🖥️",
                title: "Software & SaaS companies",
                desc: "Building for financial services, legal, or HR? Embed Docuplete or refer your customers to the platform.",
              },
              {
                icon: "📣",
                title: "Newsletter writers & educators",
                desc: "If you write, podcast, or teach for the professional services space, your audience is our ideal customer.",
              },
              {
                icon: "🤝",
                title: "Consultants & integrators",
                desc: "You implement CRMs, workflow tools, and back-office systems. Docuplete fits naturally into the stack you're already recommending.",
              },
              {
                icon: "🏢",
                title: "Associations & communities",
                desc: "Run a professional network, co-working space, or trade group? Become an affiliate partner and offer a benefit to your members.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 p-5 bg-white/[0.03] border border-white/8 rounded-2xl hover:border-white/15 transition-colors">
                <span className="text-2xl shrink-0 mt-0.5">{item.icon}</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits list ── */}
      <section className="py-16 px-6 bg-[#0E1D4A]/40 border-y border-white/8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Everything included in the program</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "Unique referral link + tracking dashboard",
              "20% commission for 12 months per customer",
              "Monthly payouts via Stripe",
              "Real-time referral and earnings visibility",
              "Marketing materials and product assets",
              "Priority support from our partnerships team",
              "Early access to new features",
              "Co-marketing opportunities for qualified partners",
            ].map((b) => (
              <div key={b} className="flex items-start gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3">
                <CheckIcon gold />
                <span className="text-white/70 text-sm">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Application form ── */}
      <section id="apply" className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-[#C49A38]/10 border border-[#C49A38]/20 rounded-full px-4 py-1.5 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C49A38]" />
              <span className="text-[#C49A38] text-xs font-semibold uppercase tracking-widest">Apply now</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Join the partner program</h2>
            <p className="text-white/45 text-base">Free to join. No minimums. Start earning once you're approved.</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8">
            <AffiliateApplyForm />
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 px-6 bg-white/[0.02] border-t border-white/8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Common questions</h2>
          <div className="space-y-4">
            {[
              {
                q: "When do I get paid?",
                a: "Commissions are calculated monthly and paid out on the 15th of the following month via Stripe. You'll need to complete a quick Stripe onboarding after you're approved.",
              },
              {
                q: "How long does my referral cookie last?",
                a: "Your referral link tracks new signups for 90 days after the first click. As long as they sign up within that window, the referral is attributed to you.",
              },
              {
                q: "Is there a minimum to withdraw?",
                a: "No minimum. Any earned commission will be paid out on the standard monthly cycle.",
              },
              {
                q: "Can I be an affiliate if I'm already a Docuplete customer?",
                a: "Yes — many of our best partners are also active customers. You can't earn commission on your own subscription, but every customer you refer is fully tracked.",
              },
              {
                q: "What if a customer upgrades their plan after signing up?",
                a: "Your commission is calculated on the actual amount charged each month, so if your referral upgrades, your earnings increase automatically.",
              },
            ].map((item) => (
              <details key={item.q} className="group bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none text-white font-medium text-sm hover:bg-white/[0.03] transition-colors">
                  {item.q}
                  <svg className="w-4 h-4 text-white/30 group-open:rotate-180 transition-transform shrink-0 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-5 pb-4 text-white/50 text-sm leading-relaxed border-t border-white/8 pt-3">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="py-20 px-6 bg-[#0E1D4A]/50 border-t border-white/8 text-center">
        <p className="text-[#C49A38] text-sm font-semibold uppercase tracking-widest mb-4">Ready to earn?</p>
        <h2 className="text-3xl font-bold text-white mb-4">Start referring. Start earning.</h2>
        <p className="text-white/45 mb-8 max-w-md mx-auto">Join hundreds of professionals who earn recurring income recommending Docuplete to their network.</p>
        <a
          href="#apply"
          className="inline-flex items-center gap-2 bg-[#C49A38] hover:bg-[#A07820] text-white font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-[#C49A38]/20"
        >
          Apply to become a partner
        </a>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo light />
          <p className="text-white/25 text-sm">© {new Date().getFullYear()} Docuplete, Inc.</p>
          <div className="flex items-center gap-5 text-white/35 text-sm">
            <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
            <a href="mailto:partners@docuplete.com" className="hover:text-white transition-colors">partners@docuplete.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
