import { useState, useRef, type FormEvent } from "react";

interface TwoFAGateProps {
  verify2FA: (code: string, trustDevice?: boolean) => Promise<{ success: boolean; error?: string }>;
  onVerified: () => void;
  onSignOut: () => void;
}

export function TwoFAGate({ verify2FA, onVerified, onSignOut }: TwoFAGateProps) {
  const [code, setCode]             = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Please enter your authentication code.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await verify2FA(trimmed, trustDevice);
    setLoading(false);
    if (result.success) {
      onVerified();
    } else {
      setError(result.error ?? "Invalid code. Please try again.");
      setCode("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-900 text-white mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Two-factor authentication</h1>
          <p className="text-sm text-gray-500">
            Enter the 6-digit code from your authenticator app, or a backup code.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              maxLength={32}
              disabled={loading}
              className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              disabled={loading}
              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer disabled:opacity-50"
            />
            <span className="text-sm text-gray-600">Remember this device for 30 days</span>
          </label>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={onSignOut}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
