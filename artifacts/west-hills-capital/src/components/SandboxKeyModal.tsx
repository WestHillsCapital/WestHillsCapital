import { useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com","10minutemail.net","10minutemail.org","10minutemail.de",
  "10minutemail.co.uk","10minutemail.co.za","10minutemail.us",
  "tempmail.com","tempmail.net","temp-mail.org","temp-mail.io","tempinbox.com",
  "throwam.com","throwaway.email","throwaways.email",
  "guerrillamail.com","guerrillamail.net","guerrillamail.org","guerrillamail.de",
  "guerrillamail.info","guerrillamail.biz","guerrillamailblock.com","grr.la",
  "sharklasers.com","spam4.me",
  "yopmail.com","yopmail.fr","cool.fr.nf","jetable.fr.nf","nospam.ze.tc",
  "nomail.xl.cx","mega.zik.dj","speed.1s.fr","courriel.fr.nf",
  "moncourrier.fr.nf","monemail.fr.nf",
  "mailinator.com","mailinator2.com","notmailinator.com",
  "trashmail.at","trashmail.com","trashmail.io","trashmail.me",
  "trashmail.net","trashmail.org","trashmail.se",
  "discard.email","discardmail.com","discardmail.de",
  "fakeinbox.com","mailnull.com","mailnesia.com",
  "spamgourmet.com","spambox.us","spambox.info","spambox.me","spambox.org",
  "getonemail.com","getonemail.net",
  "mailexpire.com","filzmail.de","devnullmail.com",
  "mytrashmail.com","nobulk.com","nospamfor.us",
  "mt2015.com","trash2009.com","trash2010.com","trash2011.com",
  "spamspot.com","crazymailing.com","put2.net","rklips.com","rmqkr.net",
  "spam.la","spam.su","mailmetrash.com","mailin8r.com",
  "veryrealemail.com","chogmail.com",
  "getnada.com","maildrop.cc","spamgob.com",
  "mintemail.com","mailseal.de","pookmail.com",
  "sogetthis.com","shortmail.net",
  "klzlk.com","trbvm.com","vipxm.net","miucce.com",
  "pfui.ru","tafmail.com","uroid.com",
  "binkmail.com","bobmail.info","dacoolest.com",
  "dontreg.com","dontsendmespam.de",
  "safetymail.info","rejectmail.com","safe-mail.net",
  "spamoff.de","supergreatmail.com","uggsrock.com",
  "zippymail.info","anonmails.de","fakemails.net",
  "tempsky.com","haltospam.com",
]);

function isDisposable(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return !!domain && DISPOSABLE_DOMAINS.has(domain);
}

type Step = "email" | "code" | "keys";

interface Props {
  onClose: () => void;
}

const STEP_LABELS = ["Email", "Verify", "Keys"];

export function SandboxKeyModal({ onClose }: Props) {
  const [step, setStep]             = useState<Step>("email");
  const [email, setEmail]           = useState("");
  const [code, setCode]             = useState("");
  const [sandboxKey, setSandboxKey] = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [copied, setCopied]         = useState(false);

  const stepIndex = { email: 0, code: 1, keys: 2 }[step];

  function nodeSnippet(key: string) {
    return `import { Docuplete } from "@docuplete/sdk";

const client = new Docuplete({ apiKey: "${key}" });

// Sandbox sessions don't count toward production quotas
const { sessionToken, interviewUrl } = await client.sessions.create({
  packageId: 42,   // ← replace with your actual package ID
  prefill: {
    firstName: "Jane",
    lastName:  "Smith",
    email:     "jane@example.com",
  },
});

console.log("Interview link:", interviewUrl);`;
  }

  function pythonSnippet(key: string) {
    return `from docuplete import Docuplete

client = Docuplete(api_key="${key}")

# Sandbox sessions don't count toward production quotas
session = client.sessions.create(
    package_id=42,   # ← replace with your actual package ID
    prefill={
        "firstName": "Jane",
        "email":     "jane@example.com",
    }
)

print(f"Interview link: {session.interview_url}")`;
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = email.trim().toLowerCase();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (isDisposable(trimmed)) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/sandbox/request-key`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: trimmed }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong. Please try again.");
        return;
      }
      setStep("code");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = code.trim();

    if (trimmed.length !== 6) {
      setError("Please enter the full 6-digit code from your email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/sandbox/verify-key`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), code: trimmed }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Invalid code. Please try again.");
        return;
      }
      setSandboxKey(data.sandboxKey as string);
      setStep("keys");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/sandbox/request-key`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), resend: true }),
      });
      if (!res.ok) {
        const data = await res.json() as Record<string, unknown>;
        setError(typeof data.error === "string" ? data.error : "Could not resend code.");
      } else {
        setCode("");
        setError("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function copyKey() {
    navigator.clipboard.writeText(sandboxKey).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg bg-[#0D1629] border border-white/10 rounded-2xl shadow-2xl">

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors p-1 rounded"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Step indicators */}
        <div className="flex items-center gap-0 px-6 pt-6 pb-0">
          {STEP_LABELS.map((label, i) => {
            const active = i === stepIndex;
            const done   = i < stepIndex;
            return (
              <div key={label} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    active ? "bg-[#1B4FD8] text-white" :
                    done   ? "bg-[#1B4FD8]/30 text-[#5B8DEF]" :
                             "bg-white/8 text-white/25"
                  }`}>
                    {done
                      ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      : i + 1}
                  </div>
                  <span className={`text-xs ${active ? "text-white/70" : done ? "text-white/35" : "text-white/20"}`}>{label}</span>
                </div>
                {i < 2 && (
                  <div className={`w-8 h-px mx-2 ${done ? "bg-[#1B4FD8]/40" : "bg-white/10"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 pt-5 pb-6">

          {/* ── Step 1: Email ───────────────────────────────────────────── */}
          {step === "email" && (
            <>
              <h2 className="text-[17px] font-semibold text-white mb-1">Get sandbox API keys</h2>
              <p className="text-sm text-white/50 mb-5 leading-relaxed">
                Enter your email to receive a 6-digit code. We'll hand you test keys for both
                Node.js and Python — no account or credit card needed.
              </p>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/45 mb-1.5" htmlFor="sbx-email">
                    Work or personal email
                  </label>
                  <input
                    id="sbx-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="you@company.com"
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-white/25 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#1B4FD8] focus:bg-white/8 transition-all"
                  />
                  {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-[#1B4FD8] hover:bg-[#1740B8] disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  {loading ? "Sending…" : "Send verification code →"}
                </button>
              </form>
            </>
          )}

          {/* ── Step 2: Code ────────────────────────────────────────────── */}
          {step === "code" && (
            <>
              <h2 className="text-[17px] font-semibold text-white mb-1">Check your inbox</h2>
              <p className="text-sm text-white/50 mb-5 leading-relaxed">
                We sent a 6-digit code to{" "}
                <span className="text-white/75 font-medium">{email}</span>.
                {" "}It expires in 15 minutes.
              </p>

              <form onSubmit={handleCodeSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/45 mb-1.5" htmlFor="sbx-code">
                    Verification code
                  </label>
                  <input
                    id="sbx-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
                    placeholder="123456"
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-white/25 text-2xl font-mono tracking-[0.35em] text-center rounded-lg px-3 py-3 focus:outline-none focus:border-[#1B4FD8] focus:bg-white/8 transition-all"
                  />
                  {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full bg-[#1B4FD8] hover:bg-[#1740B8] disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  {loading ? "Verifying…" : "Verify code →"}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-50"
                >
                  Didn't receive it? Resend code
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Keys ────────────────────────────────────────────── */}
          {step === "keys" && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <h2 className="text-[17px] font-semibold text-white">Your sandbox keys are ready</h2>
              </div>
              <p className="text-sm text-white/50 mb-4 leading-relaxed">
                Use these keys to explore the API. Sandbox sessions don't count toward production
                quotas and generated PDFs are watermarked.
              </p>

              {/* Key display */}
              <div className="bg-[#0a1628] border border-[#1B4FD8]/30 rounded-xl p-3 mb-5 flex items-center justify-between gap-3">
                <code className="text-[#5B8DEF] text-sm font-mono break-all leading-relaxed">{sandboxKey}</code>
                <button
                  onClick={copyKey}
                  className="shrink-0 text-white/40 hover:text-white/80 transition-colors text-xs border border-white/10 hover:border-white/25 px-2.5 py-1 rounded-md font-medium"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>

              {/* Node.js */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-1.5">Node.js</p>
                <div className="bg-[#050a14] border border-white/7 rounded-lg p-3 overflow-x-auto">
                  <pre className="text-[11px] text-white/65 font-mono leading-relaxed whitespace-pre">{nodeSnippet(sandboxKey)}</pre>
                </div>
              </div>

              {/* Python */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-1.5">Python</p>
                <div className="bg-[#050a14] border border-white/7 rounded-lg p-3 overflow-x-auto">
                  <pre className="text-[11px] text-white/65 font-mono leading-relaxed whitespace-pre">{pythonSnippet(sandboxKey)}</pre>
                </div>
              </div>

              <div className="bg-[#1B4FD8]/10 border border-[#1B4FD8]/20 rounded-lg px-3.5 py-2.5">
                <p className="text-xs text-[#5B8DEF] leading-relaxed">
                  We also emailed these keys to <strong>{email}</strong> so you can reference them any time.
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
