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

type IndustryOption = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const INDUSTRIES: IndustryOption[] = [
  {
    key: "financial_services",
    label: "Financial Services",
    description: "Wealth management, brokerage, retirement",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    key: "insurance",
    label: "Insurance",
    description: "Life, health, property & casualty",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    key: "real_estate",
    label: "Real Estate",
    description: "Residential, commercial, property transactions",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    key: "legal",
    label: "Legal",
    description: "Law firms, estate planning, compliance",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
      </svg>
    ),
  },
  {
    key: "healthcare",
    label: "Healthcare",
    description: "Medical practices, clinics, providers",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    key: "general",
    label: "Other / General",
    description: "Any other business or use case",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
];

export default function AppOnboard({ user, token, onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultName = user?.fullName ?? user?.firstName ?? "";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!industry) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/product/auth/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyName: companyName.trim(), email, industry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create account");
      await onComplete(token ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 1 ? "bg-gray-900" : "bg-gray-200"}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-gray-900" : "bg-gray-200"}`} />
        </div>

        {step === 1 && (
          <>
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{APP_NAME}</p>
              <h1 className="text-2xl font-semibold text-gray-900">Set up your account</h1>
              <p className="text-gray-500 mt-1 text-sm">
                What's the name of your company or practice?
              </p>
            </div>

            <form onSubmit={handleStep1} className="space-y-4">
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

              <button
                type="submit"
                disabled={!companyName.trim()}
                className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{APP_NAME}</p>
              <h1 className="text-2xl font-semibold text-gray-900">What's your industry?</h1>
              <p className="text-gray-500 mt-1 text-sm">
                We'll pre-load relevant fields into your library so you can get started faster.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {INDUSTRIES.map((opt) => {
                const selected = industry === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setIndustry(opt.key)}
                    className={`flex flex-col items-start gap-2 rounded-xl border-2 p-3.5 text-left transition-all ${
                      selected
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <span className={selected ? "text-white" : "text-gray-500"}>
                      {opt.icon}
                    </span>
                    <div>
                      <p className={`text-sm font-medium leading-snug ${selected ? "text-white" : "text-gray-900"}`}>
                        {opt.label}
                      </p>
                      <p className={`text-xs mt-0.5 leading-snug ${selected ? "text-gray-300" : "text-gray-500"}`}>
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStep(1); setError(null); }}
                className="flex-none px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !industry}
                className="flex-1 bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Setting up your account…" : "Get started"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
