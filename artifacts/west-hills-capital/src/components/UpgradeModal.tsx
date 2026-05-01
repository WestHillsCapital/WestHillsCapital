import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SETTINGS_BASE = `${API_BASE}/api/v1/product/settings`;

const PLAN_INFO = {
  pro: {
    label:       "Pro",
    monthly:     100,
    annual:      960,
    annualPerMo: 80,
    packages:    "Unlimited packages",
    subs:        "500 submissions / mo",
    seats:       "Up to 10 seats",
    color:       "indigo",
  },
  enterprise: {
    label:       "Enterprise",
    monthly:     3000,
    annual:      28800,
    annualPerMo: 2400,
    packages:    "Unlimited packages",
    subs:        "Unlimited submissions",
    seats:       "25 seats included",
    color:       "amber",
  },
} as const;

const EXTRA_SEAT = { monthly: 15, annual: 144, annualPerMo: 12 };
const EXTRA_PACK = { monthly: 25, annual: 240, annualPerMo: 20 };

const FEATURE_LABELS: Record<string, string> = {
  clientLinks:         "Client-facing links",
  csvBatch:            "CSV batch sessions",
  googleDrive:         "Google Drive integration",
  hubspot:             "HubSpot integration",
  eSign:               "E-signature (OTP)",
  emailBranding:       "Custom email branding",
  webhooks:            "Webhooks",
  apiAccess:           "API key access",
  embeddedInterviews:  "Embedded interviews",
  customDomain:        "Custom domain",
  packages:            "More packages",
  submissions:         "More submissions",
  seats:               "More team seats",
};

type BillingInterval = "monthly" | "annual";

function Counter({
  value,
  onChange,
  min = 0,
  max = 50,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
      >
        –
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums text-gray-900">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
      >
        +
      </button>
    </div>
  );
}

export function UpgradeModal() {
  const { isOpen, state, hide } = useUpgradeModal();
  const { getToken } = useAuth();

  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [extraSeats, setExtraSeats] = useState(0);
  const [extraPacks, setExtraPacks] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetPlan: "pro" | "enterprise" = state.requiredPlan ?? "pro";
  const plan = PLAN_INFO[targetPlan];
  const isAnnual = interval === "annual";

  const planPrice = isAnnual ? plan.annualPerMo : plan.monthly;
  const seatPrice = isAnnual ? EXTRA_SEAT.annualPerMo : EXTRA_SEAT.monthly;
  const packPrice = isAnnual ? EXTRA_PACK.annualPerMo : EXTRA_PACK.monthly;
  const totalPerMo = planPrice + extraSeats * seatPrice + extraPacks * packPrice;
  const totalCharge = isAnnual
    ? (plan.annual + extraSeats * EXTRA_SEAT.annual + extraPacks * EXTRA_PACK.annual)
    : totalPerMo;

  const featureKey = state.feature ?? state.limitType ?? "";
  const featureLabel = state.featureLabel ?? FEATURE_LABELS[featureKey] ?? "this feature";

  const showSeatAddon = true;
  const showPackAddon = targetPlan === "pro";

  async function handleUpgrade(planChoice: "pro" | "enterprise") {
    setError(null);
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setError("You must be signed in to upgrade. Please sign in and try again.");
        return;
      }
      const res = await fetch(`${SETTINGS_BASE}/billing/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan:                 planChoice,
          interval,
          extraSeats:           extraSeats,
          extraSubmissionPacks: planChoice === "pro" ? extraPacks : 0,
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to start checkout.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        hide();
      }
    } catch {
      setError("Failed to start checkout. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const planColorCls =
    plan.color === "indigo"
      ? { bg: "bg-indigo-600", border: "border-indigo-600", text: "text-indigo-700", light: "bg-indigo-50 border-indigo-100 text-indigo-700" }
      : { bg: "bg-amber-600", border: "border-amber-600", text: "text-amber-700", light: "bg-amber-50 border-amber-100 text-amber-700" };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className={`px-6 pt-6 pb-5 border-b border-gray-100`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Upgrade required</p>
              <h2 className="text-lg font-semibold text-gray-900">
                Unlock {featureLabel}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Available on <span className={`font-medium ${planColorCls.text}`}>{plan.label}</span> and above.
              </p>
            </div>
            <button
              type="button"
              onClick={hide}
              className="shrink-0 mt-0.5 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Billing interval toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setInterval("monthly")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${interval === "monthly" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setInterval("annual")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${interval === "annual" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              Annual
              <span className="rounded-full bg-green-100 text-green-700 text-[10px] font-semibold px-1.5 py-0.5 leading-none">–20%</span>
            </button>
          </div>

          {/* Target plan card */}
          <div className={`rounded-xl border-2 ${planColorCls.border} p-4`}>
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <span className={`text-sm font-semibold ${planColorCls.text}`}>{plan.label}</span>
              <div className="text-right">
                <span className="text-xl font-bold text-gray-900">
                  ${isAnnual ? plan.annualPerMo : plan.monthly}
                </span>
                <span className="text-xs text-gray-500">/mo</span>
                {isAnnual && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    billed ${plan.annual}/yr
                  </p>
                )}
              </div>
            </div>
            <ul className="space-y-1">
              {[plan.packages, plan.subs, plan.seats].map((feat) => (
                <li key={feat} className="flex items-center gap-2 text-xs text-gray-600">
                  <svg className={`w-3.5 h-3.5 shrink-0 ${planColorCls.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {feat}
                </li>
              ))}
            </ul>
          </div>

          {/* Extra seats */}
          {showSeatAddon && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-gray-700">Extra seats</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  ${seatPrice}/seat/mo{isAnnual ? " (billed annually)" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Counter value={extraSeats} onChange={setExtraSeats} />
                {extraSeats > 0 && (
                  <span className="text-xs text-gray-500 tabular-nums w-16 text-right">
                    +${(extraSeats * seatPrice).toLocaleString()}/mo
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Extra submission packs */}
          {showPackAddon && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-gray-700">Extra submission packs</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  +100 submissions · ${packPrice}/pack/mo{isAnnual ? " (billed annually)" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Counter value={extraPacks} onChange={setExtraPacks} />
                {extraPacks > 0 && (
                  <span className="text-xs text-gray-500 tabular-nums w-16 text-right">
                    +${(extraPacks * packPrice).toLocaleString()}/mo
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {isAnnual ? `Total billed today` : "Total per month"}
            </p>
            <p className="text-sm font-semibold text-gray-900 tabular-nums">
              ${isAnnual ? totalCharge.toLocaleString() + "/yr" : totalPerMo.toLocaleString() + "/mo"}
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-600 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
              {error}
            </p>
          )}

          {/* Primary CTA */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleUpgrade(targetPlan)}
            className={`w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60 ${planColorCls.bg} hover:opacity-90`}
          >
            {isLoading ? "Opening…" : `Start ${plan.label} — 14-day free trial`}
          </button>

          {/* Enterprise alt CTA (only shown when target is pro) */}
          {targetPlan === "pro" && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleUpgrade("enterprise")}
              className="w-full py-2.5 rounded-xl text-xs font-medium text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-60"
            >
              Or upgrade to Enterprise — 25 seats · unlimited everything ($3,000/mo)
            </button>
          )}

          <p className="text-center text-[11px] text-gray-400">
            No commitment. Cancel anytime. Upgrade in seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
