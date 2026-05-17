import { useEffect, useState } from "react";
import { useSignIn, useAuth } from "@clerk/react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Stage = "idle" | "checking" | "redirecting" | "completing" | "error";

export default function SsoLogin() {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const { signIn } = useSignIn();
  const { isLoaded } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  // ── Ticket completion path ───────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(search);
    const ticket = params.get("sso_ticket");
    if (!ticket || !isLoaded || !signIn) return;

    setStage("completing");
    (async () => {
      try {
        const { error } = await signIn.ticket({ ticket });
        if (error) {
          setErrorMsg(`SSO sign-in failed: ${error.message ?? "Unknown error"}`);
          setStage("error");
          return;
        }
        if (signIn.status === "complete") {
          const { error: finalizeError } = await signIn.finalize();
          if (finalizeError) {
            setErrorMsg(`Session activation failed: ${finalizeError.message ?? "Unknown error"}`);
            setStage("error");
            return;
          }
          navigate("/app");
        } else {
          setErrorMsg("Sign-in could not be completed. Please contact your administrator.");
          setStage("error");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setErrorMsg(`SSO completion failed: ${msg}`);
        setStage("error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, search]);

  // ── Email-based SSO initiation ───────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStage("checking");
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/v1/saml/check?email=${encodeURIComponent(email.trim())}`,
      );
      if (!res.ok) throw new Error("Check failed");
      const data: { hasSaml: boolean } = await res.json();
      if (!data.hasSaml) {
        setErrorMsg(
          "No SSO configuration found for that email domain. Contact your IT administrator.",
        );
        setStage("error");
        return;
      }
      setStage("redirecting");
      window.location.href = `/api/v1/saml/login?email=${encodeURIComponent(email.trim())}&relay=${encodeURIComponent("/sso")}`;
    } catch {
      setErrorMsg("Could not reach the server. Please try again.");
      setStage("error");
    }
  }

  // ── Ticket completion in progress ────────────────────────────────────────
  if (stage === "completing") {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#5B8DEF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Completing sign-in…</p>
        </div>
      </div>
    );
  }

  // ── Email form ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-[#5B8DEF] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="text-white font-semibold text-lg">Docuplete</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Single Sign-On</h1>
          <p className="text-white/50 text-sm">
            Enter your work email to sign in via your company&apos;s identity provider.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/70 text-sm">
              Work email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (stage === "error") setStage("idle");
              }}
              disabled={stage === "checking" || stage === "redirecting"}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#5B8DEF]"
              autoFocus
            />
          </div>

          {errorMsg && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {errorMsg}
            </p>
          )}

          <Button
            type="submit"
            className="w-full bg-[#5B8DEF] hover:bg-[#4a7de8] text-white"
            disabled={
              stage === "checking" || stage === "redirecting" || !email.trim()
            }
          >
            {stage === "checking"
              ? "Checking…"
              : stage === "redirecting"
              ? "Redirecting to IdP…"
              : "Continue with SSO"}
          </Button>
        </form>

        <p className="text-center text-white/30 text-xs mt-6">
          Not using SSO?{" "}
          <a href="/" className="text-[#5B8DEF] hover:underline">
            Return to sign-in
          </a>
        </p>
      </div>
    </div>
  );
}
