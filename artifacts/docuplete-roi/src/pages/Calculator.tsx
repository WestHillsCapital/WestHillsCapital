import { useState, useEffect, useRef } from "react";

const BASE = import.meta.env.BASE_URL || "/docuplete-roi/";
const DOCUPLETE_URL = "https://docuplete.com";

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [displayed, setDisplayed] = useState(value);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const duration = 500;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    function step(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * ease;
      setDisplayed(current);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  const fmt = (n: number) =>
    decimals === 0
      ? Math.round(n).toLocaleString()
      : n.toFixed(decimals);

  return <span>{prefix}{fmt(displayed)}{suffix}</span>;
}

interface SliderRowProps {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  onChange: (v: number) => void;
}

function SliderRow({ label, hint, value, min, max, step = 1, prefix = "", suffix = "", onChange }: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>{label}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>{hint}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          {prefix && <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{prefix}</span>}
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={e => {
              const v = Number(e.target.value);
              if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
            }}
            style={{
              width: "80px",
              background: "var(--bg-muted)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text-primary)",
              fontWeight: 700,
              fontSize: "1rem",
              padding: "0.2rem 0.4rem",
              textAlign: "right",
              outline: "none",
            }}
          />
          {suffix && <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{suffix}</span>}
        </div>
      </div>
      <div style={{ position: "relative", height: "6px", borderRadius: "99px", background: "var(--bg-muted)", cursor: "pointer" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${pct}%`, background: "var(--blue)",
          borderRadius: "99px", transition: "width 0.1s"
        }} />
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            opacity: 0, cursor: "pointer", margin: 0,
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
        <span>{prefix}{min}{suffix}</span>
        <span>{prefix}{max}{suffix}</span>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  accent?: string;
  sublabel?: string;
}

function MetricCard({ label, value, prefix = "", suffix = "", decimals = 0, accent = "var(--red-loss)", sublabel }: MetricCardProps) {
  return (
    <div style={{
      background: "var(--bg-card)",
      border: `1px solid ${accent}40`,
      borderRadius: "12px",
      padding: "1.25rem 1.5rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.25rem",
    }}>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ fontSize: "2rem", fontWeight: 800, color: accent, lineHeight: 1.1, fontFamily: "'Space Grotesk', sans-serif" }}>
        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </span>
      {sublabel && <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{sublabel}</span>}
    </div>
  );
}

const PLANS = [
  { name: "Starter",    monthlyPrice: 69,   maxSessions: 150 },
  { name: "Pro",        monthlyPrice: 249,  maxSessions: 400 },
  { name: "Enterprise", monthlyPrice: 3000, maxSessions: Infinity },
];
const ANNUAL_DISCOUNT = 0.20;

function recommendPlan(sessionsPerMonth: number) {
  return PLANS.find(p => sessionsPerMonth <= p.maxSessions) ?? PLANS[PLANS.length - 1];
}

export default function Calculator() {
  const [hourlyRate, setHourlyRate] = useState(125);
  const [clientsPerMonth, setClientsPerMonth] = useState(12);
  const [docsPerClient, setDocsPerClient] = useState(5);
  const [minsPerDoc, setMinsPerDoc] = useState(40);
  const [followUpsPerDoc, setFollowUpsPerDoc] = useState(3);
  const [annual, setAnnual] = useState(true);

  const hoursPerMonth = (clientsPerMonth * docsPerClient * minsPerDoc) / 60;
  const costPerMonth  = hoursPerMonth * hourlyRate;
  const hoursPerYear  = hoursPerMonth * 12;
  const costPerYear   = costPerMonth * 12;
  const emailsPerYear = clientsPerMonth * docsPerClient * followUpsPerDoc * 12;

  const plan = recommendPlan(clientsPerMonth);
  const planMonthly = annual ? plan.monthlyPrice * (1 - ANNUAL_DISCOUNT) : plan.monthlyPrice;
  const planAnnual  = planMonthly * 12;
  const netSavings  = costPerYear - planAnnual;
  const roiMultiple = planAnnual > 0 ? costPerYear / planAnnual : 0;

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = document.getElementById("roi-root");
    if (!el) return;
    const handler = () => setScrolled(el.scrollTop > 10);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  return (
    <div id="roi-root" style={{ height: "100%", overflowY: "auto", background: "var(--bg-dark)" }}>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: scrolled ? "rgba(11,18,32,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
        transition: "all 0.2s",
        padding: "0 1.5rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "60px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <svg width="28" height="28" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4h18l6 6v22H6V4z" fill="white" opacity="0.15" />
            <path d="M24 4l6 6h-6V4z" fill="#C49A38" />
            <rect x="10" y="14" width="10" height="1.5" rx="0.75" fill="white" opacity="0.5" />
            <rect x="10" y="18" width="14" height="1.5" rx="0.75" fill="white" opacity="0.5" />
            <rect x="10" y="22" width="8" height="1.5" rx="0.75" fill="white" opacity="0.5" />
            <circle cx="26" cy="28" r="5" fill="#C49A38" />
            <path d="M23.5 28l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.01em" }}>Docuplete</span>
        </div>
        <a
          href={DOCUPLETE_URL}
          target="_blank" rel="noreferrer"
          style={{
            background: "var(--blue)", color: "white",
            padding: "0.4rem 1rem", borderRadius: "8px",
            fontSize: "0.8rem", fontWeight: 600,
            textDecoration: "none", letterSpacing: "0.01em",
          }}
        >
          Start Free
        </a>
      </nav>

      {/* Hero */}
      <header style={{ textAlign: "center", padding: "3.5rem 1.5rem 2.5rem" }}>
        <div style={{
          display: "inline-block",
          background: "var(--red-dim)",
          border: "1px solid var(--red-loss)40",
          color: "var(--red-loss)",
          borderRadius: "99px",
          fontSize: "0.72rem", fontWeight: 700,
          padding: "0.3rem 0.85rem",
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: "1.25rem",
        }}>
          Free Paperwork Cost Calculator
        </div>
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "clamp(2rem, 5vw, 3.2rem)",
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          marginBottom: "1rem",
          maxWidth: "680px",
          margin: "0 auto 1rem",
        }}>
          How much is document<br />
          <span style={{ color: "var(--red-loss)" }}>chaos costing you?</span>
        </h1>
        <p style={{
          color: "var(--text-muted)",
          maxWidth: "480px",
          margin: "0 auto",
          lineHeight: 1.65,
          fontSize: "1rem",
        }}>
          Adjust the sliders below to see exactly what chasing, correcting, and resending
          client paperwork costs your practice every month — and every year.
        </p>
      </header>

      {/* Main layout */}
      <div style={{
        maxWidth: "1040px",
        margin: "0 auto",
        padding: "0 1.5rem 4rem",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "1.75rem",
        alignItems: "start",
      }}>

        {/* Inputs panel */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "2rem",
        }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.75rem", color: "var(--text-primary)" }}>
            Your Practice
          </h2>

          <SliderRow
            label="Your hourly rate"
            hint="billed or salary equivalent"
            value={hourlyRate}
            min={50} max={500} step={5}
            prefix="$"
            suffix="/hr"
            onChange={setHourlyRate}
          />
          <SliderRow
            label="New clients per month"
            hint="average onboardings"
            value={clientsPerMonth}
            min={1} max={500}
            suffix=" clients"
            onChange={setClientsPerMonth}
          />
          <SliderRow
            label="Documents per client"
            hint="forms, agreements, ID uploads"
            value={docsPerClient}
            min={1} max={30}
            suffix=" docs"
            onChange={setDocsPerClient}
          />
          <SliderRow
            label="Minutes chasing each doc"
            hint="emails, calls, re-sends per week"
            value={minsPerDoc}
            min={5} max={180} step={5}
            suffix=" min"
            onChange={setMinsPerDoc}
          />
          <SliderRow
            label="Follow-up nudges per doc"
            hint="until received & completed"
            value={followUpsPerDoc}
            min={1} max={15}
            suffix=" nudges"
            onChange={setFollowUpsPerDoc}
          />
        </div>

        {/* Results panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Big loss number */}
          <div style={{
            background: "linear-gradient(135deg, #1a0f0f 0%, var(--bg-card) 100%)",
            border: "1px solid var(--red-loss)30",
            borderRadius: "16px",
            padding: "2rem",
            textAlign: "center",
          }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
              Wasted per year
            </p>
            <div style={{ fontSize: "clamp(2.8rem, 8vw, 4.5rem)", fontWeight: 900, color: "var(--red-loss)", lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>
              <AnimatedNumber value={costPerYear} prefix="$" />
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
              <AnimatedNumber value={hoursPerYear} decimals={1} suffix=" hrs" /> of your time lost to paperwork
            </p>
          </div>

          {/* Metric grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <MetricCard
              label="Cost / month"
              value={costPerMonth}
              prefix="$"
              accent="var(--red-loss)"
              sublabel="in wasted staff time"
            />
            <MetricCard
              label="Hours / month"
              value={hoursPerMonth}
              suffix=" hrs"
              decimals={1}
              accent="#F97316"
              sublabel="chasing documents"
            />
            <MetricCard
              label="Follow-up emails"
              value={emailsPerYear}
              suffix="/yr"
              accent="#A78BFA"
              sublabel="sent just to collect docs"
            />
            <MetricCard
              label="Docs to collect"
              value={clientsPerMonth * docsPerClient * 12}
              suffix="/yr"
              accent="var(--gold)"
              sublabel="every client, every onboarding"
            />
          </div>

          {/* Insight callout */}
          <div style={{
            background: "var(--blue-dim)",
            border: "1px solid var(--blue)40",
            borderRadius: "12px",
            padding: "1rem 1.25rem",
            fontSize: "0.82rem",
            color: "var(--text-primary)",
            lineHeight: 1.6,
          }}>
            <strong style={{ color: "var(--blue-light)" }}>What this really means:</strong>{" "}
            Every month you spend{" "}
            <strong><AnimatedNumber value={hoursPerMonth} decimals={1} /></strong> hours —
            work that generates zero revenue — just keeping paperwork moving.
            That's{" "}
            <strong><AnimatedNumber value={Math.round((hoursPerMonth / 160) * 100)} suffix="%" /></strong> of
            a full-time work month gone to follow-ups and chasing.
          </div>

          {/* Net savings / plan recommendation */}
          <div style={{
            background: "linear-gradient(135deg, #0a2010 0%, var(--bg-card) 100%)",
            border: "1px solid #22c55e40",
            borderRadius: "16px",
            padding: "1.75rem",
          }}>
            {/* billing toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#86efac", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Your net savings with Docuplete
              </span>
              <button
                onClick={() => setAnnual(a => !a)}
                style={{
                  background: annual ? "#166534" : "var(--bg-muted)",
                  border: "1px solid " + (annual ? "#22c55e60" : "var(--border)"),
                  borderRadius: "99px",
                  padding: "0.2rem 0.7rem",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: annual ? "#86efac" : "var(--text-muted)",
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {annual ? "Annual billing (20% off)" : "Monthly billing"}
              </button>
            </div>

            {/* plan badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Recommended plan:</span>
              <span style={{
                background: "#1e3a5f",
                border: "1px solid var(--blue)60",
                borderRadius: "6px",
                padding: "0.15rem 0.55rem",
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "var(--blue-light)",
              }}>
                {plan.name} — ${planMonthly.toFixed(0)}/mo
              </span>
            </div>

            {/* big net figure */}
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div style={{ fontSize: "clamp(2rem, 6vw, 3.2rem)", fontWeight: 900, lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif", color: netSavings >= 0 ? "#22c55e" : "var(--red-loss)" }}>
                <AnimatedNumber value={Math.abs(netSavings)} prefix={netSavings >= 0 ? "+$" : "-$"} />
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                net saved per year after Docuplete cost
              </p>
            </div>

            {/* breakdown row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.75rem" }}>
              <div style={{ background: "var(--bg-muted)", borderRadius: "8px", padding: "0.6rem 0.75rem" }}>
                <div style={{ color: "var(--text-muted)", marginBottom: "0.2rem" }}>Chaos cost / yr</div>
                <div style={{ fontWeight: 700, color: "var(--red-loss)" }}><AnimatedNumber value={costPerYear} prefix="$" /></div>
              </div>
              <div style={{ background: "var(--bg-muted)", borderRadius: "8px", padding: "0.6rem 0.75rem" }}>
                <div style={{ color: "var(--text-muted)", marginBottom: "0.2rem" }}>Docuplete / yr</div>
                <div style={{ fontWeight: 700, color: "var(--blue-light)" }}><AnimatedNumber value={planAnnual} prefix="$" /></div>
              </div>
            </div>
            {roiMultiple > 1 && (
              <p style={{ fontSize: "0.72rem", color: "#86efac", marginTop: "0.75rem", textAlign: "center" }}>
                That's a <strong style={{ color: "#4ade80" }}>{roiMultiple.toFixed(1)}× return</strong> on your Docuplete investment.
              </p>
            )}
          </div>

          {/* CTA */}
          <div style={{
            background: "linear-gradient(135deg, #0d1f4a 0%, var(--bg-card) 100%)",
            border: "1px solid var(--blue)50",
            borderRadius: "16px",
            padding: "1.75rem",
            textAlign: "center",
          }}>
            <div style={{
              width: 48, height: 48,
              background: "var(--blue-dim)",
              border: "1px solid var(--blue)50",
              borderRadius: "12px",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1rem",
            }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="3" y="2" width="11" height="14" rx="1.8" stroke="#3B6EF8" strokeWidth="1.6"/>
                <path d="M8 17h8a1.5 1.5 0 0 0 1.5-1.5V8" stroke="#3B6EF8" strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M7 6.5h5M7 9.5h5M7 12.5h3" stroke="#3B6EF8" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="16.5" cy="15.5" r="3.5" fill="#1B4FD8"/>
                <path d="M15.5 15.5l.8.8 1.7-1.7" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.5rem" }}>
              Cut this cost to zero
            </h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
              Docuplete automates every document request, reminder, and follow-up —
              so you collect paperwork without lifting a finger.
            </p>
            <a
              href={DOCUPLETE_URL}
              target="_blank" rel="noreferrer"
              style={{
                display: "block",
                background: "var(--blue)",
                color: "white",
                padding: "0.75rem 1.5rem",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "0.9rem",
                textDecoration: "none",
                letterSpacing: "0.01em",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--blue-light)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--blue)")}
            >
              Start free — no credit card needed →
            </a>
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.6rem" }}>
              Setup takes under 10 minutes. Cancel anytime.
            </p>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid var(--border)",
        padding: "1.5rem",
        textAlign: "center",
        fontSize: "0.75rem",
        color: "var(--text-muted)",
      }}>
        © {new Date().getFullYear()} Docuplete · Free tool · No data stored
      </footer>
    </div>
  );
}
