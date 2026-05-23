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

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5 text-[#1B4FD8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    ),
    label: "8 questions",
    sub: "that's all you'll answer",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#1B4FD8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
      </svg>
    ),
    label: "Instant PDF",
    sub: "generated in seconds",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#1B4FD8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
    label: "SHA-256 sealed",
    sub: "cryptographic proof of integrity",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#1B4FD8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
      </svg>
    ),
    label: "View the API payload",
    sub: "see exactly what was sent",
  },
];

export default function Sandbox() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const params    = new URLSearchParams(window.location.search);
  const autoStart = params.get("firstName") !== null;

  async function start() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const q = new URLSearchParams();
      for (const key of ["firstName", "lastName", "email", "dateOfBirth", "addressLine1", "city", "state", "zip"]) {
        const v = params.get(key);
        if (v) q.set(key, v);
      }
      const res = await fetch(`${API_BASE}/api/v1/sandbox/start?${q.toString()}`);
      if (!res.ok) throw new Error("Server error — please try again");
      const data = await res.json() as { interviewUrl?: string; error?: string };
      if (!data.interviewUrl) throw new Error(data.error ?? "No interview URL returned");
      const url = new URL(data.interviewUrl, window.location.origin);
      setLocation(`${url.pathname}${url.search}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  useEffect(() => { if (autoStart) void start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "loading" || autoStart) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#1B4FD8] flex items-center justify-center shadow-lg shadow-[#1B4FD8]/30">
            <SpinnerIcon />
          </div>
          <p className="text-sm text-[#4B5A7A] font-medium">Setting up your sandbox session…</p>
          <p className="text-xs text-[#8A97B0] max-w-xs">Pre-filling your details and opening the interview. Takes about a second.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-[#E8EDF5] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="180" height="180" rx="38" fill="#0E1D4A"/>
            <g opacity="0.95">
              <path d="M57 36H107.5L130 59V148H57V36Z" fill="white"/>
              <path d="M107.5 36L130 59H107.5V36Z" fill="#C49A38"/>
            </g>
            <rect x="70" y="75" width="46" height="5" rx="2.5" fill="#0E1D4A" opacity="0.25"/>
            <rect x="70" y="89" width="46" height="5" rx="2.5" fill="#0E1D4A" opacity="0.25"/>
            <rect x="70" y="103" width="30" height="5" rx="2.5" fill="#0E1D4A" opacity="0.25"/>
            <circle cx="131" cy="131" r="26" fill="#C49A38"/>
            <path d="M120 131L128 139L143 124" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm font-semibold text-[#0E1D4A]">Docuplete</span>
          <span className="ml-1.5 text-[10px] rounded-full px-2 py-0.5 font-semibold bg-[#EEF2FF] text-[#1B4FD8] border border-[#C7D3F9] tracking-wide uppercase">Sandbox</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-xl w-full text-center space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#1B4FD8]">Live Demo</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0B1220] leading-tight">
              See Docuplete in action
            </h1>
            <p className="text-[#4B5A7A] text-base max-w-md mx-auto">
              Answer 8 questions. Get a signed, SHA-256 sealed PDF in under 2 minutes.
              Then inspect the raw API payload that generated it.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3 text-left">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-white rounded-xl border border-[#E8EDF5] px-4 py-3.5 flex items-start gap-3 shadow-sm">
                <div className="shrink-0 mt-0.5">{f.icon}</div>
                <div>
                  <div className="text-sm font-semibold text-[#0B1220]">{f.label}</div>
                  <div className="text-xs text-[#8A97B0] mt-0.5">{f.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <button
              onClick={() => void start()}
              className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white bg-[#1B4FD8] hover:bg-[#1740B8] shadow-lg shadow-[#1B4FD8]/25 transition-colors"
            >
              Start the demo
              <ArrowIcon />
            </button>
            {status === "error" && (
              <p className="text-xs text-red-600">{errorMsg}</p>
            )}
            <p className="text-xs text-[#8A97B0]">No sign-up. No credit card. Closes in one click.</p>
          </div>

          {/* Developer tip */}
          <div className="bg-[#F0F4FF] border border-[#C7D3F9] rounded-xl px-5 py-4 text-left space-y-2">
            <p className="text-xs font-semibold text-[#1B4FD8]">Developer tip — URL prefill</p>
            <p className="text-xs text-[#3D52A0]">
              Pass query params and those fields arrive pre-filled — exactly how your API integration would work.
              Click the link below to try it:
            </p>
            <a
              href={`${window.location.origin}${window.location.pathname}?firstName=Jane&lastName=Smith&email=jane%40example.com`}
              className="block text-[11px] font-mono text-[#1B4FD8] bg-[#E0E8FF] rounded-lg px-3 py-2 break-all hover:bg-[#C7D3F9] transition-colors"
            >
              {window.location.origin}{window.location.pathname}
              <span className="text-[#3D52A0]">?firstName=Jane&amp;lastName=Smith&amp;email=jane@example.com</span>
            </a>
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-[10px] text-[#8A97B0]">
        Powered by Docuplete · This sandbox uses demo data only
      </footer>
    </div>
  );
}
