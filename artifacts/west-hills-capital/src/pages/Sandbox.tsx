import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function ArrowIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const BRAND = "#C49A38";

/** Features shown in the hero */
const FEATURES = [
  { icon: "✦", label: "8 questions", sub: "that's all you'll answer" },
  { icon: "⚡", label: "Instant PDF", sub: "generated in seconds" },
  { icon: "🔐", label: "SHA-256 sealed", sub: "cryptographic proof of integrity" },
  { icon: "{}", label: "View the API payload", sub: "see exactly what was sent" },
];

export default function Sandbox() {
  const [, setLocation] = useLocation();
  const [status, setStatus]     = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Parse URL params — auto-start if firstName is present
  const params      = new URLSearchParams(window.location.search);
  const autoStart   = params.get("firstName") !== null;

  async function start() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const q = new URLSearchParams();
      // Forward any prefill params the caller injected
      for (const key of ["firstName", "lastName", "email", "dateOfBirth", "addressLine1", "city", "state", "zip"]) {
        const v = params.get(key);
        if (v) q.set(key, v);
      }
      const res = await fetch(`${API_BASE}/api/v1/sandbox/start?${q.toString()}`);
      if (!res.ok) throw new Error("Server error — please try again");
      const data = await res.json() as { interviewUrl?: string; error?: string };
      if (!data.interviewUrl) throw new Error(data.error ?? "No interview URL returned");
      // Strip the origin portion (same origin), keep path + search
      const url = new URL(data.interviewUrl, window.location.origin);
      setLocation(`${url.pathname}${url.search}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  // If caller injected firstName, auto-start immediately
  useEffect(() => { if (autoStart) void start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "loading" || autoStart) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: BRAND }}>
            <SpinnerIcon />
          </div>
          <p className="text-sm text-[#6B7A99] font-medium">Spinning up your sandbox session…</p>
          <p className="text-xs text-[#8A9BB8] max-w-xs">
            Pre-filling your details and opening the interview. This takes about a second.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F6F0] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#DDD5C4] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: BRAND }}>D</div>
          <span className="text-sm font-semibold text-[#0F1C3F]">Docuplete</span>
          <span className="ml-2 text-[10px] rounded-full px-2 py-0.5 font-medium bg-amber-50 text-amber-700 border border-amber-200">SANDBOX</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-xl w-full text-center space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#8A9BB8]">Live Demo</p>
            <h1 className="text-3xl font-bold text-[#0F1C3F] leading-tight">
              See Docuplete in action
            </h1>
            <p className="text-[#6B7A99] text-base">
              Answer 8 questions. Get a signed, SHA-256 sealed PDF in under 2 minutes.
              Then inspect the raw API payload that generated it.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3 text-left">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-white rounded-xl border border-[#DDD5C4] px-4 py-3 flex items-start gap-3">
                <span className="text-lg mt-0.5 shrink-0">{f.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-[#0F1C3F]">{f.label}</div>
                  <div className="text-xs text-[#8A9BB8]">{f.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <button
              onClick={() => void start()}
              disabled={status === "loading"}
              className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              {status === "loading" ? <SpinnerIcon /> : null}
              Start the demo
              {status !== "loading" && <ArrowIcon />}
            </button>
            {status === "error" && (
              <p className="text-xs text-red-600">{errorMsg}</p>
            )}
            <p className="text-xs text-[#8A9BB8]">No sign-up. No credit card. Closes in one click.</p>
          </div>

          {/* Pre-fill tip */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-left space-y-1">
            <p className="text-xs font-semibold text-blue-700">Developer tip — URL prefill</p>
            <p className="text-xs text-blue-600">
              Add <code className="bg-blue-100 px-1 rounded">?firstName=Jane&amp;lastName=Smith</code> to this URL
              and the interview opens with those fields already filled — exactly how your API integration would work.
            </p>
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-[10px] text-[#8A9BB8]">
        Powered by Docuplete · This sandbox uses demo data only
      </footer>
    </div>
  );
}
