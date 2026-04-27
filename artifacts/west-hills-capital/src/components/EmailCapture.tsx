import { useState } from "react";
import { Mail } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const LS_KEY = "whc_subscribed";

interface Props {
  source?: string;
  heading?: string;
  subtext?: string;
}

export function EmailCapture({
  source = "article-subscribe",
  heading = "Stay informed",
  subtext = "We publish new guides on pricing, ownership, and how the market actually works. No spam — unsubscribe any time.",
}: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const alreadySubscribed =
    typeof window !== "undefined" && localStorage.getItem(LS_KEY) === "1";

  if (alreadySubscribed || state === "done") {
    return (
      <div className="my-12 border border-border/30 rounded-xl px-8 py-7 text-center bg-white">
        <p className="text-[14px] text-foreground/60 font-medium">
          You are on the list. We will be in touch when new guides go up.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/leads/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Something went wrong");
      }
      localStorage.setItem(LS_KEY, "1");
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("error");
    }
  };

  return (
    <div className="my-12 border border-border/30 rounded-xl px-8 py-8 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
              {heading}
            </span>
          </div>
          <p className="text-[13.5px] text-foreground/60 leading-relaxed">
            {subtext}
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-2 sm:shrink-0 w-full sm:w-auto"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
            placeholder="your@email.com"
            required
            className="border border-border/50 rounded-lg px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 w-full sm:w-56"
          />
          <button
            type="submit"
            disabled={state === "submitting"}
            className="bg-primary text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {state === "submitting" ? "Sending…" : "Send me guides"}
          </button>
        </form>
      </div>
      {state === "error" && errorMsg && (
        <p className="mt-3 text-xs text-red-500">{errorMsg}</p>
      )}
      <p className="mt-3 text-[11px] text-foreground/40 leading-relaxed">
        By submitting, you agree that we store your email address to send you
        the guides you requested. We never sell your data.{" "}
        <a href="/privacy" className="underline hover:text-foreground/60 transition-colors">
          Privacy Policy
        </a>
      </p>
    </div>
  );
}
