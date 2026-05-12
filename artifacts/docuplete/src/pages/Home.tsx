import { useEffect, useRef, useState } from "react";

function VideoSection() {
  const [open, setOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Once the modal is open, tell the iframe to start audio.
  // We wait for the iframe's load event so the listener is registered.
  useEffect(() => {
    if (!open) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const send = () =>
      iframe.contentWindow?.postMessage({ type: 'docuplete-play' }, '*');
    iframe.addEventListener('load', send);
    return () => iframe.removeEventListener('load', send);
  }, [open]);

  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-[#1B4FD8] text-sm font-semibold uppercase tracking-widest mb-3">See it in action</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#0B1220] mb-4">From chaos to done — in 60 seconds</h2>
        <p className="text-[#4B5A7A] max-w-xl mx-auto mb-10">
          Meet Sally and Tom. See how one questionnaire replaces six documents, fifty fields, and hours of back-and-forth.
        </p>

        {/* Thumbnail */}
        <button
          onClick={() => setOpen(true)}
          className="group relative w-full max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-[#E8EDF5] block focus:outline-none focus:ring-4 focus:ring-[#1B4FD8]/30"
          aria-label="Play explainer video"
        >
          {/* Dark gradient thumbnail */}
          <div className="relative w-full aspect-video bg-[#0B1220] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1B4FD8]/30 via-[#0B1220] to-[#C49A38]/20" />
            {/* Decorative floating elements */}
            <div className="absolute top-8 left-10 w-24 h-32 bg-white/5 rounded-lg border border-white/10 rotate-[-8deg]" />
            <div className="absolute top-6 left-20 w-24 h-32 bg-white/5 rounded-lg border border-white/10 rotate-[4deg]" />
            <div className="absolute bottom-10 right-12 w-20 h-28 bg-[#1B4FD8]/20 rounded-lg border border-[#1B4FD8]/30 rotate-[6deg]" />
            <div className="absolute bottom-8 right-20 w-20 h-28 bg-white/5 rounded-lg border border-white/10 rotate-[-3deg]" />
            {/* Center label */}
            <div className="relative z-10 flex flex-col items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-all duration-300 group-hover:scale-110">
                <svg className="w-8 h-8 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-xl">Sally &amp; Tom's Story</p>
              </div>
            </div>
            {/* Bottom bar */}
            <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/60 to-transparent flex items-end px-6 pb-3">
              <div className="flex gap-1.5">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="h-1 rounded-full bg-white/30 flex-1"
                    style={{ opacity: i === 0 ? 1 : 0.4 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Fullscreen modal */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] bg-black flex flex-col"
          onClick={() => setOpen(false)}
        >
          {/* Top bar with close button — sits above the video */}
          <div className="shrink-0 flex items-center justify-end px-6 py-3 z-10">
            <button
              className="text-white/60 hover:text-white text-4xl leading-none font-light"
              onClick={() => setOpen(false)}
              aria-label="Close video"
            >
              ×
            </button>
          </div>
          {/* Video fills remaining space */}
          <div
            className="flex-1 flex items-center justify-center px-4 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-7xl" style={{ aspectRatio: '16/9' }}>
              <iframe
                ref={iframeRef}
                src="/docuplete-explainer/"
                className="absolute inset-0 w-full h-full rounded-xl border border-white/10"
                allow="autoplay"
                title="Docuplete Explainer Video"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

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
    price: 69,
    description: "For solo practitioners getting started.",
    submissions: "150 sessions / mo included",
    seats: "2 seats included",
    overage: "Overage: $0.50 / additional session",
    features: [
      "Upload any PDF template",
      "Guided client interview",
      "E-signatures & initials",
      "RFC 3161 trusted timestamp",
      "Email OTP identity verification",
      "Shareable link — no client login needed",
      "Email notifications & reminders",
    ],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Pro",
    price: 249,
    description: "For growing teams handling real volume.",
    submissions: "400 sessions / mo included",
    seats: "10 seats included",
    overage: "Overage: $0.50 / additional session",
    features: [
      "Everything in Starter",
      "Team seats & shared templates",
      "Batch CSV import",
      "Custom branding & client links",
      "Google Drive, Dropbox & OneDrive",
      "HubSpot integration",
      "Priority support",
    ],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Developer",
    price: 499,
    description: "For teams embedding Docuplete in their product.",
    submissions: "500 PDF generations / mo included",
    seats: "Org-wide API access",
    overage: "Overage: $75 / block of 100 generations",
    features: [
      "Everything in Pro",
      "REST API + TypeScript & Python SDKs",
      "Webhooks (HMAC-SHA256 signed)",
      "Headless & embedded interview mode",
      "Bulk session creation (up to 100)",
      "Programmatic PDF generation",
      "OpenAPI spec + Sandbox (no key needed)",
    ],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Enterprise",
    price: 3000,
    description: "For firms running high-volume, regulated intake.",
    submissions: "Unlimited PDF generations",
    seats: "25 seats included",
    overage: "$15 / extra seat",
    features: [
      "Everything in Developer",
      "Dedicated account manager",
      "SLA guarantee",
      "SSO / SAML + SCIM provisioning",
      "IP allowlisting",
      "AES-256-GCM answer encryption",
      "Custom domain",
    ],
    cta: "Contact sales",
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

const PAIN_POINTS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
      </svg>
    ),
    label: "Manual re-entry",
    detail: "Typing the same data into five systems — by hand, every time.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    label: "Version confusion",
    detail: "Which form did they sign? Was it the updated one? Nobody knows.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-6 0h.008v.008H12V10.5Zm-3.75 0h.008v.008H8.25V10.5Z" />
      </svg>
    ),
    label: "Print → sign → scan",
    detail: "Asking clients to fax in 2025. It shouldn't still be this way.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    label: "Training overhead",
    detail: "Onboarding every new hire to your document process takes weeks.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
    label: "Audit risk",
    detail: "No trail. No timestamps. No idea who changed what — or when.",
  },
];

const PERSONAS = [
  {
    tab: "Solo & Small",
    plan: "Starter",
    headline: "You're the expert. Stop being the document processor.",
    empathy: "You wear every hat. The last thing you need is paperwork slowing down the work that actually pays.",
    pains: [
      "I'm re-typing client info from emails into PDFs by hand",
      "Clients ghost me waiting for forms — I chase, they delay",
      "I'm spending an hour on intake for every new client",
      "One signature missing can push a closing back days",
    ],
    resolutions: [
      "Send one link — clients fill it themselves, no printing needed",
      "Automated reminders keep clients moving without you lifting a finger",
      "Intake takes minutes, not hours — your PDF comes back complete",
      "Every submission is timestamped and logged the moment it lands",
    ],
  },
  {
    tab: "Growing Teams",
    plan: "Pro",
    headline: "Your team is growing. Your document chaos shouldn't be.",
    empathy: "More clients, more staff, more moving parts — and the same broken intake process holding everything up.",
    pains: [
      "Different team members use different versions of the same form",
      "There's no visibility into which clients have actually submitted",
      "We're manually splitting CSV exports every time we need batch data",
      "New hires take weeks to learn our intake process",
    ],
    resolutions: [
      "One master template — every team member sends the exact same form",
      "A live dashboard shows every submission status at a glance",
      "Batch CSV import fills hundreds of documents in one click",
      "Branded client links anyone can send from day one",
    ],
  },
  {
    tab: "Enterprise",
    plan: "Enterprise",
    headline: "High volume demands a system — not a workaround.",
    empathy: "At your scale, a broken document process isn't just slow — it's a liability. Every gap is a compliance risk.",
    pains: [
      "We process hundreds of packages a month with zero automation",
      "Auditors ask for a paper trail we don't have",
      "Our current tool doesn't integrate with our CRM or internal systems",
      "We have no SLA for document delivery — turnaround is unpredictable",
    ],
    resolutions: [
      "Webhooks and API access connect Docuplete to any system you run",
      "Full audit logs with timestamps satisfy compliance requirements",
      "Native HubSpot, Google Drive, Dropbox Business, and OneDrive sync keeps every record in place",
      "Dedicated account manager and SLA guarantee predictable delivery",
    ],
  },
];

const COMPARISON_FEATURES = [
  {
    label: "Monthly price (2 users)",
    docuplete: { value: "$69 / mo", note: "eSign + PDF filling included" },
    docusign: { value: "$50 / mo", note: "eSign only — filling not included" },
    pandadoc: { value: "$38 / mo", note: "eSign only — filling not included" },
    type: "price" as const,
  },
  {
    label: "Separate filling tool needed",
    docuplete: { value: false, note: "" },
    docusign: { value: true, note: "adds $30–$80 / mo" },
    pandadoc: { value: true, note: "adds $30–$80 / mo" },
    type: "extra_cost" as const,
  },
  {
    label: "eSignatures",
    docuplete: true,
    docusign: true,
    pandadoc: true,
    type: "bool" as const,
  },
  {
    label: "Fills your PDF from client answers — no re-entry",
    docuplete: true,
    docusign: false,
    pandadoc: false,
    type: "bool" as const,
  },
  {
    label: "No login required for recipients",
    docuplete: true,
    docusign: false,
    pandadoc: false,
    type: "bool" as const,
  },
  {
    label: "Know the moment it's submitted",
    docuplete: true,
    docusign: false,
    pandadoc: false,
    type: "bool" as const,
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
  const [activePersona, setActivePersona] = useState(0);

  return (
    <div className="min-h-screen bg-white text-[#0B1220] font-sans">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-[#E8EDF5]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="hidden sm:block text-sm text-[#4B5A7A] hover:text-[#0B1220] transition-colors">How it works</a>
            <a href="#security" className="hidden sm:block text-sm text-[#4B5A7A] hover:text-[#0B1220] transition-colors">Security</a>
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
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-3">
            Client paperwork, on autopilot. Stop chasing docs — start closing deals.
          </p>
          <p className="text-base text-white/45 max-w-xl mx-auto mb-10">
            No follow-ups. No confusion. No delays.
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

      {/* ── EXPLAINER VIDEO ─────────────────────────────────── */}
      <VideoSection />

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

      {/* ── COST OF DOING IT MANUALLY ───────────────────────── */}
      <section className="py-20 px-6 bg-[#0B1220] text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[#5B8DEF] text-sm font-semibold uppercase tracking-widest mb-3">The problem</p>
            <h2 className="text-3xl sm:text-4xl font-bold">The cost of doing it manually.</h2>
            <p className="mt-4 text-white/60 max-w-lg mx-auto">
              Every team thinks their document process is "fine." Until they add it up.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
            {PAIN_POINTS.map((point) => (
              <div
                key={point.label}
                className="flex flex-col gap-3 bg-white/5 border border-white/10 rounded-2xl p-6"
              >
                <div className="w-9 h-9 rounded-xl bg-[#1B4FD8]/20 flex items-center justify-center text-[#5B8DEF] shrink-0">
                  {point.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">{point.label}</p>
                  <p className="text-xs text-white/50 leading-relaxed">{point.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-white/40 text-sm">
            Sound familiar? There's a better way — and it works with the PDFs you already have.
          </p>
        </div>
      </section>

      {/* ── WHO IT'S FOR ────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#F5F7FC]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[#1B4FD8] text-sm font-semibold uppercase tracking-widest mb-3">Who it's for</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0B1220]">Built around the work you're already doing.</h2>
            <p className="mt-4 text-[#4B5A7A] max-w-lg mx-auto">
              Every unsigned document delays money, decisions, and momentum. Docuplete stops the delay.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-8 justify-center">
            {PERSONAS.map((persona, i) => (
              <button
                key={persona.tab}
                type="button"
                onClick={() => setActivePersona(i)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  activePersona === i
                    ? "bg-[#0B1220] text-white shadow-md"
                    : "bg-white text-[#4B5A7A] border border-[#E8EDF5] hover:border-[#1B4FD8]/40 hover:text-[#0B1220]"
                }`}
              >
                {persona.tab}
              </button>
            ))}
          </div>

          {/* Active persona card */}
          {PERSONAS.map((persona, i) => (
            <div
              key={persona.tab}
              className={`${activePersona === i ? "block" : "hidden"}`}
            >
              <div className="bg-white border border-[#E8EDF5] rounded-2xl overflow-hidden shadow-sm">
                {/* Card header */}
                <div className="bg-[#0B1220] px-8 py-6">
                  <div className="flex items-center gap-3 mb-3">
                    <a
                      href="#pricing"
                      className="inline-flex items-center bg-[#1B4FD8]/20 border border-[#1B4FD8]/30 text-[#5B8DEF] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest hover:bg-[#1B4FD8]/30 transition-colors"
                    >
                      {persona.plan} plan
                    </a>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{persona.headline}</h3>
                  <p className="text-white/60 text-sm">{persona.empathy}</p>
                </div>

                {/* Card body: two columns */}
                <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#E8EDF5]">
                  {/* Before column */}
                  <div className="px-8 py-7">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#4B5A7A] mb-5">Without Docuplete</p>
                    <ul className="space-y-4">
                      {persona.pains.map((pain) => (
                        <li key={pain} className="flex items-start gap-3 text-sm text-[#4B5A7A]">
                          <span className="mt-0.5 w-5 h-5 rounded-full bg-[#F5F7FC] border border-[#E8EDF5] flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3 text-[#B0BCCE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </span>
                          <span className="leading-relaxed">{pain}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* After column */}
                  <div className="px-8 py-7">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#1B4FD8] mb-5">With Docuplete</p>
                    <ul className="space-y-4">
                      {persona.resolutions.map((res) => (
                        <li key={res} className="flex items-start gap-3 text-sm text-[#0B1220]">
                          <span className="mt-0.5 w-5 h-5 rounded-full bg-[#EEF3FF] flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3 text-[#1B4FD8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
                          <span className="leading-relaxed">{res}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card footer CTA */}
                <div className="px-8 py-5 bg-[#F5F7FC] border-t border-[#E8EDF5] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-[#4B5A7A]">
                    Ready to see it live?{" "}
                    <a href="#pricing" className="text-[#1B4FD8] font-semibold hover:underline">
                      View {persona.plan} pricing →
                    </a>
                  </p>
                  <a
                    href={NAV_SIGNUP}
                    className="inline-flex items-center gap-1.5 bg-[#1B4FD8] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1740B8] transition-colors whitespace-nowrap"
                  >
                    Start free trial
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
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
              <p className="text-[#1B4FD8] text-sm font-semibold uppercase tracking-widest mb-4">Where it started</p>
              <h2 className="text-3xl font-bold text-[#0B1220] mb-4">
                Born inside one of America's fastest-growing firms.
              </h2>
              <p className="text-[#4B5A7A] leading-relaxed">
                Docuplete was built out of necessity at the <strong className="text-[#0B1220]">7th fastest-growing financial services firm in America</strong>. It eliminated the busy work, streamlined document processes, and freed the team to serve more clients. That same capability is now available to you — so you can stop organizing, chasing, and managing paperwork, and get back to the work that actually matters.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-[#E8EDF5] rounded-2xl p-6">
                <div className="text-3xl font-black text-[#1B4FD8] mb-1">$150</div>
                <div className="text-sm text-[#4B5A7A]">saved per client package in labor, resources, and error handling</div>
              </div>
              <div className="bg-[#1B4FD8] rounded-2xl p-6">
                <div className="text-xl font-black text-white">Reduced resistance. Repeatable wins.</div>
              </div>
              <div className="bg-white border border-[#E8EDF5] rounded-2xl p-6 col-span-2">
                <div className="text-2xl font-black text-[#1B4FD8] mb-1">Zero chasing.</div>
                <div className="text-sm text-[#4B5A7A]">Clients complete on their own time. You get a finished document.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPETITOR COMPARISON ───────────────────────────── */}
      <section className="py-24 px-6 bg-[#F5F7FC]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[#1B4FD8] text-sm font-semibold uppercase tracking-widest mb-3">Why Docuplete</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0B1220]">
              Everything DocuSign does —<br className="hidden sm:block" /> plus the part they don't.
            </h2>
            <p className="mt-4 text-[#4B5A7A] max-w-xl mx-auto text-lg">
              DocuSign charges $50/mo and still can't fill your forms. Docuplete does both for $69.
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-[#E8EDF5] shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left bg-white px-6 py-4 text-[#4B5A7A] font-semibold text-xs uppercase tracking-widest border-b border-[#E8EDF5] w-[38%]">
                    Feature
                  </th>
                  {/* Docuplete — highlighted */}
                  <th className="bg-[#1B4FD8] px-6 py-4 text-center border-b border-[#1740B8] w-[20%]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-white font-bold text-sm">Docuplete</span>
                      <span className="text-[#A8C4FF] text-xs font-medium">Starter Professional</span>
                    </div>
                  </th>
                  <th className="bg-white px-6 py-4 text-center border-b border-[#E8EDF5] w-[21%]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[#0B1220] font-bold text-sm">DocuSign</span>
                      <span className="text-[#4B5A7A] text-xs font-medium">Standard</span>
                    </div>
                  </th>
                  <th className="bg-white px-6 py-4 text-center border-b border-[#E8EDF5] w-[21%]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[#0B1220] font-bold text-sm">PandaDoc</span>
                      <span className="text-[#4B5A7A] text-xs font-medium">Starter</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((row, i) => {
                  const isLast = i === COMPARISON_FEATURES.length - 1;
                  const rowBg = i % 2 === 0 ? "bg-white" : "bg-[#F5F7FC]";
                  const docupleteRowBg = i % 2 === 0 ? "bg-[#1740B8]" : "bg-[#1B4FD8]";
                  const borderClass = isLast ? "" : "border-b border-[#E8EDF5]";
                  const docupleteBorderClass = isLast ? "" : "border-b border-[#1533A0]";

                  const CheckSvg = ({ className }: { className?: string }) => (
                    <svg className={`w-5 h-5 mx-auto ${className ?? ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  );
                  const CrossSvg = ({ className }: { className?: string }) => (
                    <svg className={`w-5 h-5 mx-auto ${className ?? "text-[#B0BCCE]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  );

                  const renderDocuSign = () => {
                    if (row.type === "price") {
                      const p = row.docusign as { value: string; note: string };
                      return <div><span className="font-semibold text-[#0B1220]">{p.value}</span><p className="text-xs text-[#B0BCCE] mt-0.5">{p.note}</p></div>;
                    }
                    if (row.type === "extra_cost") {
                      const p = row.docusign as { value: boolean; note: string };
                      return <div><CrossSvg />{p.note && <p className="text-xs text-[#E57373] mt-1">{p.note}</p>}</div>;
                    }
                    return (row.docusign as boolean) ? <CheckSvg className="text-[#4B5A7A]" /> : <CrossSvg />;
                  };

                  const renderPandaDoc = () => {
                    if (row.type === "price") {
                      const p = row.pandadoc as { value: string; note: string };
                      return <div><span className="font-semibold text-[#0B1220]">{p.value}</span><p className="text-xs text-[#B0BCCE] mt-0.5">{p.note}</p></div>;
                    }
                    if (row.type === "extra_cost") {
                      const p = row.pandadoc as { value: boolean; note: string };
                      return <div><CrossSvg />{p.note && <p className="text-xs text-[#E57373] mt-1">{p.note}</p>}</div>;
                    }
                    return (row.pandadoc as boolean) ? <CheckSvg className="text-[#4B5A7A]" /> : <CrossSvg />;
                  };

                  const renderDocuplete = () => {
                    if (row.type === "price") {
                      const p = row.docuplete as { value: string; note: string };
                      return <div><span className="font-bold text-white">{p.value}</span><p className="text-xs text-[#A8C4FF] mt-0.5">{p.note}</p></div>;
                    }
                    if (row.type === "extra_cost") {
                      const p = row.docuplete as { value: boolean; note: string };
                      return <div><CheckSvg className="text-[#4ADE80]" /><p className="text-xs text-[#A8C4FF] mt-1">not needed</p></div>;
                    }
                    return (row.docuplete as boolean) ? <CheckSvg /> : <CrossSvg className="text-[#B0BCCE]" />;
                  };

                  return (
                    <tr key={row.label}>
                      <td className={`px-6 py-4 font-medium text-[#0B1220] ${rowBg} ${borderClass}`}>
                        {row.label}
                      </td>
                      <td className={`px-6 py-4 text-center ${docupleteRowBg} ${docupleteBorderClass}`}>
                        {renderDocuplete()}
                      </td>
                      <td className={`px-6 py-4 text-center text-[#4B5A7A] ${rowBg} ${borderClass}`}>
                        {renderDocuSign()}
                      </td>
                      <td className={`px-6 py-4 text-center text-[#4B5A7A] ${rowBg} ${borderClass}`}>
                        {renderPandaDoc()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-center text-xs text-[#B0BCCE] mt-4">
            Prices as published. DocuSign Standard $25/user/mo · PandaDoc Starter $19/seat/mo · Docuplete Starter $69 flat for 2 seats.
          </p>

          {/* CTA */}
          <div className="mt-10 text-center">
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 bg-[#1B4FD8] hover:bg-[#1740B8] text-white font-semibold px-7 py-3.5 rounded-xl transition-colors text-base shadow-lg shadow-[#1B4FD8]/25"
            >
              See Docuplete pricing
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── ANVIL COMPARISON ────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[#1B4FD8] text-sm font-semibold uppercase tracking-widest mb-3">Docuplete vs. Anvil</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0B1220]">
              Both built for developers.<br className="hidden sm:block" /> Not built the same.
            </h2>
            <p className="mt-4 text-[#4B5A7A] max-w-2xl mx-auto">
              Anvil is fast to set up. Docuplete is built for industries where a missed field or a misread timestamp is a liability — not a bug to fix later.
            </p>
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto rounded-2xl border border-[#E8EDF5] shadow-sm mb-12">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left bg-white px-6 py-4 text-[#4B5A7A] font-semibold text-xs uppercase tracking-widest border-b border-[#E8EDF5] w-[34%]">
                    Feature
                  </th>
                  <th className="bg-[#1B4FD8] px-6 py-4 text-center border-b border-[#1740B8] w-[33%]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-white font-bold text-sm">Docuplete</span>
                      <span className="text-[#A8C4FF] text-xs font-medium">Developer — $499/mo</span>
                    </div>
                  </th>
                  <th className="bg-white px-6 py-4 text-center border-b border-[#E8EDF5] w-[33%]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[#0B1220] font-bold text-sm">Anvil</span>
                      <span className="text-[#4B5A7A] text-xs font-medium">Growth — $425–$499/mo</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    feature: "Primary focus",
                    docuplete: "High-stakes legal & financial infrastructure",
                    anvil: "General data-to-PDF workflows",
                    docupleteStrong: true,
                  },
                  {
                    feature: "Field mapping",
                    docuplete: "AcroForm detection + human-confirmed review — zero silent guessing",
                    anvil: "Document AI autodetects & maps fields automatically",
                    docupleteStrong: true,
                  },
                  {
                    feature: "Trust signal",
                    docuplete: "RFC 3161 trusted timestamps — standard on all plans",
                    anvil: "Standard e-signature",
                    docupleteStrong: true,
                  },
                  {
                    feature: "Field library",
                    docuplete: "Shared global field library — change once, update all",
                    anvil: "Per-document field mapping",
                    docupleteStrong: true,
                  },
                  {
                    feature: "Audit depth",
                    docuplete: "Immutable per-session audit trail with IP & timestamps",
                    anvil: "Standard completion logs",
                    docupleteStrong: true,
                  },
                  {
                    feature: "i18n support",
                    docuplete: "Full i18n interview infrastructure — 9 locales",
                    anvil: "Webform translation",
                    docupleteStrong: false,
                  },
                  {
                    feature: "SDK",
                    docuplete: "TypeScript & Python SDKs + OpenAPI spec",
                    anvil: "REST API + multiple clients",
                    docupleteStrong: false,
                  },
                ].map((row, i) => {
                  const isLast = i === 6;
                  const rowBg = i % 2 === 0 ? "bg-white" : "bg-[#F5F7FC]";
                  const docBg = i % 2 === 0 ? "bg-[#1740B8]" : "bg-[#1B4FD8]";
                  const border = isLast ? "" : "border-b border-[#E8EDF5]";
                  const docBorder = isLast ? "" : "border-b border-[#1533A0]";
                  return (
                    <tr key={row.feature}>
                      <td className={`px-6 py-4 font-medium text-[#0B1220] ${rowBg} ${border}`}>{row.feature}</td>
                      <td className={`px-6 py-4 text-center ${docBg} ${docBorder}`}>
                        <span className="text-white text-xs leading-snug">{row.docuplete}</span>
                      </td>
                      <td className={`px-6 py-4 text-center ${rowBg} ${border}`}>
                        <span className="text-[#4B5A7A] text-xs leading-snug">{row.anvil}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Three strategic callouts */}
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                label: "The Killer Feature",
                title: "One change. Every document.",
                body: "Anvil's AI saves you 5 minutes mapping your first PDF. Docuplete's shared global field library saves you 5 months of compliance updates — change one field definition and every document in your organisation updates instantly.",
              },
              {
                label: "Deterministic vs. AI",
                title: "We don't guess where your fields go.",
                body: "Anvil leans on Document AI for field detection. For a mortgage application or a medical intake form, \"close enough\" isn't good enough. Docuplete's Snap-to-Field mapping ensures your high-stakes documents are 100% correct, 100% of the time — no hallucinations in your legal filings.",
              },
              {
                label: "Legal Admissibility",
                title: "We don't just sign — we certify.",
                body: "Anvil provides solid e-signatures. Docuplete includes an RFC 3161 trusted timestamp from a qualified TSA on every signed document — standard, not an add-on. Your agreements are court-defensible worldwide, independent of our servers.",
              },
            ].map((card) => (
              <div key={card.title} className="bg-[#F5F7FC] rounded-2xl p-6 border border-[#E8EDF5]">
                <p className="text-[#1B4FD8] text-xs font-bold uppercase tracking-widest mb-2">{card.label}</p>
                <h3 className="text-[#0B1220] font-bold text-base mb-3">{card.title}</h3>
                <p className="text-[#4B5A7A] text-sm leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-[#B0BCCE] mt-6">
            Anvil Growth pricing as published ($425–$499/mo). Docuplete Developer $499/mo or $399/mo billed annually.
          </p>
        </div>
      </section>

      {/* ── SECURITY & TRUST ────────────────────────────────── */}
      <section id="security" className="py-24 px-6 bg-[#0B1220] text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#5B8DEF] text-sm font-semibold uppercase tracking-widest mb-3">Security & Trust</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Easy to start. Built for grown-ups.</h2>
            <p className="mt-4 text-white/60 max-w-xl mx-auto">
              Docuplete is the only document platform engineered from the ground up for regulated industries — where predictability, legal admissibility, and a full audit trail are non-negotiable.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-10">

            {/* Card 1 — RFC 3161 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <div className="w-10 h-10 rounded-xl bg-[#1B4FD8]/20 flex items-center justify-center text-[#5B8DEF] mb-5 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Legally Defensible E-Signatures</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                RFC 3161 cryptographic timestamps from a qualified Timestamping Authority are embedded in every signed PDF — proving the document existed in its exact form at that exact moment. Your e-signatures survive court scrutiny because the proof is independent of our servers.
              </p>
              <p className="text-[#5B8DEF] text-xs font-semibold mt-4 uppercase tracking-widest">ESIGN · UETA · eIDAS AdES compliant</p>
            </div>

            {/* Card 2 — Deterministic */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <div className="w-10 h-10 rounded-xl bg-[#1B4FD8]/20 flex items-center justify-center text-[#5B8DEF] mb-5 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Reliable Logic. Zero AI Hallucinations.</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Docuplete doesn't use a black-box AI to interpret or transform your data. Every field maps deterministically to exactly where it lands in the PDF — always. 100% predictable document output for high-compliance industries where surprises are liabilities.
              </p>
              <p className="text-[#5B8DEF] text-xs font-semibold mt-4 uppercase tracking-widest">Deterministic · Auditable · Repeatable</p>
            </div>

            {/* Card 3 — 5 min API + enterprise controls */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <div className="w-10 h-10 rounded-xl bg-[#1B4FD8]/20 flex items-center justify-center text-[#5B8DEF] mb-5 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-3">5-Minute API. Enterprise-Grade Controls.</h3>
              <pre className="text-xs text-[#A8C4FF] bg-black/30 rounded-xl px-4 py-3 mb-4 overflow-x-auto leading-relaxed">{`const { interviewUrl } = await docuplete
  .sessions.create({ packageId: 42,
    prefill: { firstName: "Jane" } });
// → send link, done.`}</pre>
              <p className="text-white/60 text-sm leading-relaxed">
                Then lock it down: IP allowlisting, SAML SSO, SCIM provisioning, AES-256-GCM answer encryption. Start simple. Scale to your most demanding security review.
              </p>
            </div>

            {/* Card 4 — Audit Trail */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <div className="w-10 h-10 rounded-xl bg-[#1B4FD8]/20 flex items-center justify-center text-[#5B8DEF] mb-5 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Immutable Session Audit Trail</h3>
              <div className="space-y-2 mb-4">
                {[
                  ["session.created", "2026-05-09 14:02:11 UTC"],
                  ["interview.opened", "2026-05-09 14:18:44 UTC"],
                  ["interview.submitted", "2026-05-09 14:31:09 UTC"],
                  ["pdf.generated", "2026-05-09 14:31:12 UTC"],
                ].map(([event, ts]) => (
                  <div key={event} className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 text-xs">
                    <span className="text-[#5B8DEF] font-mono">{event}</span>
                    <span className="text-white/40 font-mono">{ts}</span>
                  </div>
                ))}
              </div>
              <p className="text-white/60 text-sm leading-relaxed">
                Every action on every session is permanently logged with actor, IP address, and UTC timestamp. Your auditors will always have a clean paper trail.
              </p>
            </div>
          </div>

          {/* Two-step funnel */}
          <div className="border border-white/10 bg-white/5 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="font-bold text-white text-lg">Ready to go deeper?</p>
              <p className="text-white/55 text-sm mt-1 max-w-sm">
                Try the API instantly with no account — or request our full security & compliance packet for your procurement or legal team.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a
                href="/docuplete-docs/developer/sandbox"
                className="inline-flex items-center justify-center gap-2 border border-white/25 text-white/80 hover:text-white hover:border-white/50 font-medium px-5 py-2.5 rounded-xl transition-colors text-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                </svg>
                Try API Sandbox — No Key Needed
              </a>
              <a
                href="/docuplete-docs/enterprise/compliance-sheet"
                className="inline-flex items-center justify-center gap-2 bg-[#1B4FD8] hover:bg-[#1740B8] text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm shadow-lg shadow-[#1B4FD8]/30 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                Request Security & Compliance Packet
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
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
              className={`relative w-12 h-7 rounded-full overflow-hidden transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4FD8] focus-visible:ring-offset-2 ${annual ? "bg-[#1B4FD8]" : "bg-[#64748B]"}`}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
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
          <p className="mt-5 text-white/30 text-sm">Most teams send their first document in under 3 minutes.</p>
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
