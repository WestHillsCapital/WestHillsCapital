import { Select } from "@/components/ui/select";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  API_BASE, SETTINGS_BASE, AUTH_BASE,
  useBrandColor, formatDate, formatRelative, getTextForBg,
  CopyBadge, CopySnippet, StyledSelect,
  roleBadge, planBadge, statusBadge, UsageBar,
  type ApiKey, type NewKeyResult, type TeamMember,
  type BillingInfo, type BillingLineItem, type BankEntry, type PackTier,
  ROLE_OPTIONS, PLAN_LABELS,
  type IntegrationsStatus,
  type AuditLogEntry, ACTION_LABELS, ACTION_FILTER_OPTIONS,
  actionBadgeColor, formatTimestamp,
  NOTIFICATION_CATEGORIES, type NotifPref,
  RETENTION_OPTIONS, DATE_FORMAT_OPTIONS, ALL_TIMEZONES,
  type FeedbackType, FEEDBACK_FIELDS,
  type UserProfile, type TwoFAStatus, type TrustedDevice,
  type ActiveSession, type LoginEntry,
  type PendingRename, RenameConfirmModal, UsageBadge,
  type SkField, type SkGroup, type SkMappings, type SkPkg,
} from "./settingsUtils";

export function SubmissionBankSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const brandColor = useBrandColor();
  const textColor  = getTextForBg(brandColor);

  const [bank,       setBank]       = useState<{ total: number; entries: BankEntry[] } | null>(null);
  const [packs,      setPacks]      = useState<PackTier[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [selectedSize, setSelectedSize] = useState<number>(100);
  const [packType,   setPackType]   = useState<"one_off" | "monthly" | "annual">("monthly");
  const [isBuying,   setIsBuying]   = useState(false);
  const [buyError,   setBuyError]   = useState<string | null>(null);
  const [justSuccess, setJustSuccess] = useState(() =>
    new URLSearchParams(window.location.search).get("pack_success") === "1"
  );

  useEffect(() => {
    fetch(`${SETTINGS_BASE}/billing/bank`, { headers: authHeaders() })
      .then(async (r) => {
        const d = await r.json() as { bank?: { total: number; entries: BankEntry[] }; packs?: PackTier[] };
        if (r.ok && d.bank) { setBank(d.bank); setPacks(d.packs ?? []); }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBuy() {
    setBuyError(null);
    setIsBuying(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/billing/pack/checkout`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ packSize: selectedSize, packType }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) { setBuyError(data.error ?? "Failed to start checkout."); return; }
      if (data.url) window.location.href = data.url;
    } catch { setBuyError("Failed to start checkout."); }
    finally { setIsBuying(false); }
  }

  const selectedPack = packs.find((p) => p.size === selectedSize);
  const displayPrice = selectedPack
    ? packType === "annual"   ? `$${selectedPack.annualPerMo}/mo billed $${selectedPack.annual}/yr`
    : packType === "monthly"  ? `$${selectedPack.monthly}/mo`
    : `$${selectedPack.monthly} one-time`
    : null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Submission Bank</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Purchase extra submissions — banked, front-loaded, and valid for 1 year. Used automatically when your plan pool runs out.
        </p>
      </div>

      {justSuccess && (
        <div className="px-6 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between gap-3">
          <p className="text-xs text-green-700 font-medium">Pack purchased — submissions have been added to your bank.</p>
          <button type="button" onClick={() => setJustSuccess(false)} className="text-green-600 hover:text-green-800 text-xs">Dismiss</button>
        </div>
      )}

      {/* Bank balance */}
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
            Loading bank…
          </div>
        ) : bank && bank.total > 0 ? (
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">
              {bank.total.toLocaleString()} submission{bank.total !== 1 ? "s" : ""} banked
            </p>
            <div className="space-y-1">
              {bank.entries.map((e) => {
                const expiry = new Date(e.expires_at);
                const monthsLeft = Math.max(0, Math.round(
                  (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
                ));
                const srcLabel = e.source === "annual_pack" ? "Annual" : e.source === "monthly_pack" ? "Monthly" : "One-time";
                return (
                  <div key={e.id} className="flex items-center justify-between text-xs text-gray-600 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                    <span>
                      <span className="font-medium text-gray-800">{e.remaining.toLocaleString()}</span>
                      {" "}remaining · {e.pack_size}-pack · {srcLabel}
                    </span>
                    <span className={`font-medium ${monthsLeft <= 2 ? "text-amber-600" : "text-gray-500"}`}>
                      Expires {expiry.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No banked submissions. Purchase a pack below.</p>
        )}
      </div>

      {/* Pack purchase */}
      <div className="px-6 py-4 space-y-3">
        <p className="text-xs font-medium text-gray-700">Buy a submission pack</p>
        <div className="flex flex-wrap items-end gap-3">
          {/* Size picker */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-500">Pack size</label>
            <Select
              value={String(selectedSize)}
              onChange={(e) => setSelectedSize(Number(e.target.value))}
              className="h-auto appearance-none rounded-md border-gray-200 bg-white pl-2.5 pr-7 py-1.5 text-xs text-gray-700"
            >
              {packs.map((p) => (
                <option key={p.size} value={p.size}>{p.size} submissions</option>
              ))}
            </Select>
          </div>

          {/* Type picker */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-500">Purchase type</label>
            <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg">
              {(["monthly", "one_off", "annual"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPackType(t)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    packType === t
                      ? ""
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  style={packType === t ? { backgroundColor: brandColor, color: "white" } : {}}
                >
                  {t === "one_off" ? "One-time" : t === "annual" ? "Annual −20%" : "Monthly"}
                </button>
              ))}
            </div>
          </div>

          {/* Price + buy button */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-500 invisible">Buy</label>
            <button
              type="button"
              disabled={isBuying || !selectedPack}
              onClick={() => void handleBuy()}
              style={{ backgroundColor: brandColor, color: "white" }}
              className="rounded-lg px-4 py-1.5 text-xs font-medium disabled:opacity-60 transition-opacity whitespace-nowrap"
            >
              {isBuying ? "Opening…" : `Buy — ${displayPrice ?? "…"}`}
            </button>
          </div>
        </div>

        {/* Per-submission rate helper */}
        {selectedPack && (
          <p className="text-[11px] text-gray-400">
            {packType === "annual"
              ? `$${(selectedPack.annual / (selectedPack.size * 12)).toFixed(2)}/submission · all ${(selectedPack.size * 12).toLocaleString()} deposited upfront`
              : packType === "monthly"
              ? `$${(selectedPack.monthly / selectedPack.size).toFixed(2)}/submission · ${selectedPack.size} deposited each month · builds up over time`
              : `$${(selectedPack.monthly / selectedPack.size).toFixed(2)}/submission · ${selectedPack.size} deposited immediately · expires 1 year from today`}
          </p>
        )}

        {buyError && (
          <p className="text-xs text-red-600 rounded-lg bg-red-50 border border-red-100 px-3 py-2">{buyError}</p>
        )}
      </div>

      {/* Volume table */}
      {packs.length > 0 && (
        <div className="px-6 py-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-2">Volume pricing</p>
          <div className="rounded-lg border border-gray-100 overflow-hidden text-xs">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/4" />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Pack</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">Monthly</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">Annual/yr</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">Per sub</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {packs.map((p, i) => (
                  <tr key={p.size} className={selectedSize === p.size ? "bg-blue-50/40" : i % 2 === 1 ? "bg-slate-50/50" : ""}>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{p.size}</td>
                    <td className="px-3 py-2.5 text-center text-gray-600">${p.monthly}</td>
                    <td className="px-3 py-2.5 text-center text-gray-600">${p.annual}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">${(p.monthly / p.size).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

