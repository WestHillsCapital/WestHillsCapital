import { useState } from "react";
import type { UserResource } from "@clerk/shared/types";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const APP_NAME = "Docuplete";

interface Props {
  user: UserResource | null | undefined;
  token: string | null;
  /** Called after the account is created. Should update the parent's auth state. */
  onComplete: (token?: string) => Promise<void>;
}

export default function AppOnboard({ user, token, onComplete }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultName = user?.fullName ?? user?.firstName ?? "";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/product/auth/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyName: companyName.trim(), email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create account");
      // onComplete is AppPortal's refreshAccount — updates the parent's state
      // so AppPortal immediately transitions to the main app.
      await onComplete(token ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{APP_NAME}</p>
          <h1 className="text-2xl font-semibold text-gray-900">Set up your account</h1>
          <p className="text-gray-500 mt-1 text-sm">
            What's the name of your company or practice?
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
              Company name
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={defaultName ? `e.g. ${defaultName} Financial` : "e.g. Apex Wealth Group"}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              autoFocus
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || !companyName.trim()}
            className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Setting up…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
