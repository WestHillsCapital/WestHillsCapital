import { PLAN_DATA, annualMonthlyPrice, type PlanKey } from "@workspace/plan-data";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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

export function BillingSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }
  const bc = useBrandColor();

  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isPortaling, setIsPortaling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "pro" | "developer" | "enterprise">("pro");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

  const planPrice = (key: "starter" | "pro" | "developer" | "enterprise") =>
    billingInterval === "annual" ? annualMonthlyPrice(key) : PLAN_DATA[key].priceMonthly;

  const planLabel = (key: "starter" | "pro" | "developer" | "enterprise") => {
    const p = PLAN_DATA[key];
    const price = planPrice(key);
    const suffix = billingInterval === "annual"
      ? `/mo (billed $${Math.round(price * 12)}/yr)`
      : "/mo";
    return `${p.name} — ${p.seatsLabel} · ${p.submissionsLabel} ($${price}${suffix})`;
  };

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/billing`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { billing?: BillingInfo; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load billing info"); return; }
        if (data.billing) setBilling(data.billing);
      })
      .catch(() => setLoadError("Failed to load billing info"))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleUpgrade() {
    setActionError(null);
    setIsUpgrading(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/billing/checkout`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ plan: selectedPlan, interval: billingInterval }),
      });
      const data = await res.json() as { url?: string; error?: string; setup_required?: boolean };
      if (!res.ok) {
        setActionError(data.error ?? "Failed to start checkout.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch { setActionError("Failed to start checkout."); }
    finally { setIsUpgrading(false); }
  }

  async function handlePortal() {
    setActionError(null);
    setIsPortaling(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/billing/portal`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "{}",
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) { setActionError(data.error ?? "Failed to open billing portal."); return; }
      if (data.url) window.open(data.url, "_blank");
    } catch { setActionError("Failed to open billing portal."); }
    finally { setIsPortaling(false); }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Billing</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage your subscription and plan limits.</p>
        </div>
        {!isLoading && billing && (
          <div className="flex items-center gap-2">
            {planBadge(billing.plan_tier)}
            {statusBadge(billing.subscription_status)}
          </div>
        )}
      </div>

      {loadError && (
        <div className="px-6 py-4 bg-red-50">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {actionError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{actionError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : billing ? (
        <>
          {/* Usage bars */}
          <div className="px-3 sm:px-6 py-5">
            <p className="text-sm font-medium text-gray-900 mb-4">Usage this billing period</p>
            <UsageBar
              label="Packages"
              used={billing.usage.packages}
              limit={billing.limits.max_packages}
            />
            <UsageBar
              label="Interview submissions"
              used={billing.usage.submissions}
              limit={billing.limits.max_submissions_per_month}
              unit="/mo"
            />
            <UsageBar
              label="Team seats"
              used={billing.usage.seats}
              limit={billing.limits.max_seats}
            />
          </div>

          {/* Trial banner */}
          {billing.subscription_status === "trialing" && (
            <div className="mx-3 sm:mx-6 my-3 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-800">
                  You&apos;re on a 14-day free trial
                  {billing.trial_end && (
                    <> &mdash; ends {formatDate(billing.trial_end)}</>
                  )}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  No charge until your trial ends. Add a payment method to continue without interruption after your trial.
                </p>
                <button
                  onClick={() => {
                    if (billing.has_stripe_customer) {
                      void handlePortal();
                    } else {
                      void handleUpgrade();
                    }
                  }}
                  disabled={isUpgrading || isPortaling}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-300 rounded-lg px-3 py-1.5 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 21Z" />
                  </svg>
                  {isUpgrading || isPortaling ? "Opening…" : "Add payment method"}
                </button>
              </div>
            </div>
          )}

          {/* Plan details */}
          <div className="px-3 sm:px-6 py-4 bg-gray-50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {PLAN_LABELS[billing.plan_tier] ?? billing.plan_tier} plan
                  {billing.subscription_status === "trialing" && (
                    <span className="ml-2 text-xs font-normal text-blue-600">(trial)</span>
                  )}
                </p>
                {billing.next_renewal_at && billing.subscription_status !== "trialing" && (
                  <div className="mt-0.5">
                    <p className="text-xs text-gray-500">
                      Renews {formatDate(billing.next_renewal_at)}
                      {billing.renewal_amount_cents != null && (
                        <> &mdash; <span className="font-medium text-gray-700">
                          {(() => {
                            const dollars = billing.renewal_amount_cents / 100;
                            const formatted = dollars % 1 === 0
                              ? `$${dollars.toLocaleString("en-US")}`
                              : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            return `${formatted}${billing.billing_interval === "year" ? "/yr" : "/mo"}`;
                          })()}
                        </span></>
                      )}
                    </p>
                    {(billing.line_items ?? []).length > 1 && (
                      <div className="mt-1.5 space-y-0.5">
                        {(billing.line_items ?? []).map((item, i) => {
                          const amt = item.amount_cents / 100;
                          const fmtAmt = amt % 1 === 0
                            ? `$${amt.toLocaleString("en-US")}`
                            : `$${amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          const interval = billing.billing_interval === "year" ? "/yr" : "/mo";
                          return (
                            <div key={i} className="flex items-center justify-between text-[11px] text-gray-500">
                              <span>
                                {item.description}
                                {item.quantity > 1 && (
                                  <span className="text-gray-400"> ×{item.quantity}</span>
                                )}
                              </span>
                              <span className="font-medium text-gray-600 ml-4">{fmtAmt}{interval}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {(billing.plan_tier === "free" || billing.plan_tier === "starter" || billing.plan_tier === "pro") && billing.subscription_status !== "trialing" && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Upgrade to unlock more packages, submissions, and seats.
                  </p>
                )}
              </div>

              {/* Upgrade CTA — free/starter/pro only, hidden during active trial */}
              {(billing.plan_tier === "free" || billing.plan_tier === "starter" || billing.plan_tier === "pro") && billing.subscription_status !== "trialing" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setBillingInterval("monthly")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${billingInterval === "monthly" ? "" : "text-gray-500"}`}
                      style={billingInterval === "monthly" ? { backgroundColor: bc, color: "white" } : {}}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingInterval("annual")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${billingInterval === "annual" ? "" : "text-gray-500"}`}
                      style={billingInterval === "annual" ? { backgroundColor: bc, color: "white" } : {}}
                    >
                      Annual
                      <span className={`text-[10px] font-semibold ${billingInterval === "annual" ? "text-green-300" : "text-green-700"}`}>–20%</span>
                    </button>
                  </div>
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value as "starter" | "pro" | "developer" | "enterprise")}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                  >
                    {(billing.plan_tier === "free" || billing.plan_tier === "starter") && (
                      <option value="pro">{planLabel("pro")}</option>
                    )}
                    <option value="developer">{planLabel("developer")}</option>
                    <option value="enterprise">{planLabel("enterprise")}</option>
                  </select>
                  <button
                    type="button"
                    disabled={isUpgrading}
                    onClick={() => { void handleUpgrade(); }}
                    className="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap brand-btn-hover"
                    style={{ backgroundColor: bc, color: "white" }}
                  >
                    {isUpgrading ? "Opening…" : "Upgrade"}
                  </button>
                </div>
              )}
            </div>

            {/* Manage Billing action row */}
            {billing.has_stripe_subscription && (
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between gap-4">
                <p className="text-xs text-gray-500">
                  {(billing.plan_tier === "free" || billing.plan_tier === "starter" || billing.plan_tier === "pro")
                    ? "View invoices, update payment methods, or cancel your subscription."
                    : "View invoices, update your payment method, or make changes to your subscription."}
                </p>
                <button
                  type="button"
                  disabled={isPortaling}
                  onClick={() => { void handlePortal(); }}
                  className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors brand-btn-hover disabled:opacity-60"
                  style={{ backgroundColor: bc, color: "white" }}
                >
                  {isPortaling ? "Opening…" : "Manage Billing"}
                </button>
              </div>
            )}
          </div>

          {/* Plan comparison table */}
          {(billing.plan_tier === "free" || billing.plan_tier === "starter" || billing.plan_tier === "pro") && (
            <div className="px-3 sm:px-6 py-4">
              <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Compare plans</p>
              <div className="rounded-lg border border-gray-100 overflow-x-auto text-xs">
                <table className="w-full min-w-[580px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-700 w-[30%]">Feature</th>
                      <th className="px-3 py-2.5 text-center font-medium text-gray-600">Starter</th>
                      <th className="px-3 py-2.5 text-center font-medium text-indigo-700">Pro</th>
                      <th className="px-3 py-2.5 text-center font-medium text-blue-700">Developer</th>
                      <th className="px-3 py-2.5 text-center font-medium text-amber-700">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const cols: { key: PlanKey; cls: string }[] = [
                        { key: "starter",    cls: "text-gray-600" },
                        { key: "pro",        cls: "text-indigo-700 font-medium" },
                        { key: "developer",  cls: "text-blue-700 font-medium" },
                        { key: "enterprise", cls: "text-amber-700 font-medium" },
                      ];
                      function Cell({ val, cls }: { val: string | boolean; cls: string }) {
                        if (typeof val === "boolean") {
                          return (
                            <td className={`px-3 py-2.5 text-center ${val ? cls.replace("font-medium", "") : "text-gray-400"}`}>
                              {val ? "✓" : "—"}
                            </td>
                          );
                        }
                        return <td className={`px-3 py-2.5 text-center ${cls}`}>{val}</td>;
                      }
                      const rows: { label: string; get: (k: PlanKey) => string | boolean }[] = [
                        {
                          label: billingInterval === "annual" ? "Price / mo (billed annually)" : "Price / mo",
                          get: (k) => `$${planPrice(k).toLocaleString()}`,
                        },
                        {
                          label: "Packages",
                          get: (k) => PLAN_DATA[k].maxPackages === null ? "Unlimited" : String(PLAN_DATA[k].maxPackages),
                        },
                        {
                          label: "Sessions or generations / mo",
                          get: (k) => PLAN_DATA[k].submissionsLabel,
                        },
                        {
                          label: "Team seats",
                          get: (k) => PLAN_DATA[k].seatsLabel,
                        },
                        { label: "eSign",                    get: (k) => PLAN_DATA[k].eSign },
                        { label: "Client links & branding",  get: (k) => PLAN_DATA[k].clientLinks },
                        { label: "CSV batch & integrations", get: (k) => PLAN_DATA[k].csvBatch },
                        { label: "REST API & Webhooks",      get: (k) => PLAN_DATA[k].apiAccess },
                        { label: "Programmatic PDF gen",     get: (k) => PLAN_DATA[k].apiAccess },
                        { label: "Custom domain",            get: (k) => PLAN_DATA[k].customDomain },
                        { label: "SSO / SAML",               get: (k) => PLAN_DATA[k].samlSso },
                      ];
                      return rows.map((row, i) => (
                        <tr key={row.label} className={i % 2 === 1 ? "bg-gray-50/50" : ""}>
                          <td className="px-3 py-2.5 text-gray-700">{row.label}</td>
                          {cols.map(({ key, cls }) => (
                            <Cell key={key} val={row.get(key)} cls={cls} />
                          ))}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-gray-400">* Additional seats available on all plans for $15/seat/mo.</p>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
