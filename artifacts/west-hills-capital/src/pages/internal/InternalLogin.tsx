import { useEffect, useRef, useState } from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useInternalAuth } from "@/hooks/useInternalAuth";

export default function InternalLogin() {
  const { signIn, error: authError } = useInternalAuth();
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);
  const hasClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clear errors whenever the page mounts fresh
  useEffect(() => { setLocalError(null); }, []);

  async function handleCredential(response: CredentialResponse) {
    if (!response.credential) {
      setLocalError("Sign-in was cancelled or returned no credential.");
      return;
    }
    setLoading(true);
    setLocalError(null);
    try {
      await signIn(response.credential);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  const displayError = localError ?? authError;

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-2xl font-bold tracking-widest text-[#C49A38] uppercase">WHC</span>
            <span className="text-lg text-[#6B7A99] font-medium">Internal</span>
          </div>
          <p className="text-sm text-[#8A9BB8]">
            Sign in with your authorized Google account to access the internal portal.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#DDD5C4] rounded-xl p-8 shadow-2xl">
          <h1 className="text-[#0F1C3F] text-lg font-semibold mb-6 text-center">
            Internal Portal Sign-In
          </h1>

          {!hasClientId ? (
            <div className="text-center text-[#C49A38] text-sm bg-[#C49A38]/10 border border-[#C49A38]/20 rounded-lg p-4">
              <p className="font-semibold mb-1">Configuration Required</p>
              <p>
                <code className="font-mono text-xs">VITE_GOOGLE_CLIENT_ID</code> is not set.
                Add it to your environment variables.
              </p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-6 h-6 border-2 border-[#C49A38] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#6B7A99]">Verifying your account…</p>
            </div>
          ) : (
            <div ref={containerRef} className="flex justify-center">
              <GoogleLogin
                onSuccess={handleCredential}
                onError={() => setLocalError("Google sign-in failed. Please try again.")}
                theme="filled_black"
                shape="rectangular"
                size="large"
                text="signin_with"
                logo_alignment="left"
              />
            </div>
          )}

          {displayError && (
            <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
              {displayError}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#9AAAC0]">
          Access restricted to authorized team members only.
        </p>
      </div>
    </div>
  );
}
