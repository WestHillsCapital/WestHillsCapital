import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/react";
import { useProductAuth } from "@/hooks/useProductAuth";
import { useProductRole } from "@/hooks/useProductRole";
import { updateProductOrgCache, getCachedProductOrg, type ProductOrgSettings } from "@/hooks/useProductOrgSettings";
import { formatOrgDate, formatOrgRelative } from "@/lib/orgDateFormat";
import { BrandColorSection } from "@/components/settings/BrandColorSection";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SETTINGS_BASE = `${API_BASE}/api/v1/product/settings`;
const AUTH_BASE = `${API_BASE}/api/v1/product/auth`;

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  active: boolean;
}

interface NewKeyResult {
  id: number;
  name: string;
  key: string;
  keyPrefix: string;
  createdAt: string;
}

interface TeamMember {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
  role_label: string;
  status: string;
  last_seen_at: string | null;
  invited_at: string | null;
  invited_by: string | null;
  is_current_user: boolean;
}

const ROLE_OPTIONS = [
  { value: "admin",    label: "Admin" },
  { value: "member",   label: "Member" },
  { value: "readonly", label: "Read-only" },
];

function roleBadge(role: string) {
  if (role === "admin")    return <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">Admin</span>;
  if (role === "readonly") return <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Read-only</span>;
  return <span className="inline-flex items-center rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-semibold text-sky-700">Member</span>;
}

function formatRelative(iso: string | null): string {
  return formatOrgRelative(iso, getCachedProductOrg());
}

interface BillingInfo {
  plan_tier: string;
  subscription_status: string | null;
  billing_period_start: string | null;
  next_renewal_at: string | null;
  has_stripe_customer: boolean;
  has_stripe_subscription: boolean;
  limits: {
    max_packages: number | null;
    max_submissions_per_month: number | null;
    max_seats: number;
  };
  usage: {
    packages: number;
    submissions: number;
    seats: number;
  };
}

const PLAN_LABELS: Record<string, string> = { free: "Free", pro: "Pro", enterprise: "Enterprise" };

function planBadge(tier: string) {
  if (tier === "enterprise") return <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Enterprise</span>;
  if (tier === "pro")        return <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">Pro</span>;
  return <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600">Free</span>;
}

function statusBadge(status: string | null) {
  if (!status) return null;
  if (status === "active" || status === "trialing")
    return <span className="text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Active</span>;
  if (status === "past_due")
    return <span className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">Past due</span>;
  if (status === "canceled" || status === "cancelled")
    return <span className="text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">Cancelled</span>;
  return <span className="text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">{status}</span>;
}

function UsageBar({ label, used, limit, unit = "" }: { label: string; used: number; limit: number | null; unit?: string }) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const isOver = limit !== null && used >= limit;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        {limit === null ? (
          <span className="text-xs font-medium text-gray-500 italic">Unlimited</span>
        ) : (
          <span className={`text-xs font-medium ${isOver ? "text-red-600" : "text-gray-700"}`}>
            {`${used.toLocaleString()} / ${limit.toLocaleString()}${unit}`}
          </span>
        )}
      </div>
      {limit !== null && (
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-gray-900"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string | null): string {
  return formatOrgDate(iso, getCachedProductOrg());
}

function BillingSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isPortaling, setIsPortaling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "enterprise">("pro");

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
        body: JSON.stringify({ plan: selectedPlan }),
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
          <div className="px-6 py-5">
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

          {/* Plan details */}
          <div className="px-6 py-4 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {PLAN_LABELS[billing.plan_tier] ?? billing.plan_tier} plan
                </p>
                {billing.next_renewal_at && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Renews {formatDate(billing.next_renewal_at)}
                  </p>
                )}
                {billing.plan_tier === "free" && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Upgrade to unlock more packages, submissions, and seats.
                  </p>
                )}
              </div>

              {/* CTA */}
              {billing.plan_tier === "free" ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value as "pro" | "enterprise")}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                  >
                    <option value="pro">Pro — 5 seats · 500 submissions/mo</option>
                    <option value="enterprise">Enterprise — unlimited</option>
                  </select>
                  <button
                    type="button"
                    disabled={isUpgrading}
                    onClick={() => { void handleUpgrade(); }}
                    className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    {isUpgrading ? "Opening…" : "Upgrade"}
                  </button>
                </div>
              ) : billing.has_stripe_subscription ? (
                <button
                  type="button"
                  disabled={isPortaling}
                  onClick={() => { void handlePortal(); }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                >
                  {isPortaling ? "Opening…" : "Manage billing"}
                </button>
              ) : null}
            </div>
          </div>

          {/* Plan comparison table */}
          {billing.plan_tier === "free" && (
            <div className="px-6 py-4">
              <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Compare plans</p>
              <div className="rounded-lg border border-gray-100 overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-700 w-1/2">Feature</th>
                      <th className="px-4 py-2.5 text-center font-medium text-gray-700">Free</th>
                      <th className="px-4 py-2.5 text-center font-medium text-indigo-700">Pro</th>
                      <th className="px-4 py-2.5 text-center font-medium text-amber-700">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-4 py-2.5 text-gray-700">Packages</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">3</td>
                      <td className="px-4 py-2.5 text-center text-indigo-700 font-medium">Unlimited</td>
                      <td className="px-4 py-2.5 text-center text-amber-700 font-medium">Unlimited</td>
                    </tr>
                    <tr className="bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-700">Submissions / month</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">50</td>
                      <td className="px-4 py-2.5 text-center text-indigo-700 font-medium">500</td>
                      <td className="px-4 py-2.5 text-center text-amber-700 font-medium">Unlimited</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-gray-700">Team seats</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">1</td>
                      <td className="px-4 py-2.5 text-center text-indigo-700 font-medium">5</td>
                      <td className="px-4 py-2.5 text-center text-amber-700 font-medium">Unlimited</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

type DomainStatus = "unverified" | "verifying" | "active" | "error" | null;

interface CustomDomainInfo {
  plan_tier: string;
  custom_domain: string | null;
  status: DomainStatus;
  verified_at: string | null;
  cname_target: string;
}

function domainStatusBadge(status: DomainStatus) {
  if (!status) return null;
  if (status === "active")      return <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">Active</span>;
  if (status === "verifying")   return <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Verifying…</span>;
  if (status === "error")       return <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-700">Error</span>;
  return <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Unverified</span>;
}

function CustomDomainSection({ getAuthHeaders, isAdmin }: { getAuthHeaders: () => HeadersInit; isAdmin: boolean }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [info, setInfo] = useState<CustomDomainInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; cnames_found: string[] } | null>(null);

  function loadInfo() {
    setIsLoading(true);
    setLoadError(null);
    fetch(`${SETTINGS_BASE}/custom-domain`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as CustomDomainInfo & { error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load custom domain info"); return; }
        setInfo(data);
        setDomainInput(data.custom_domain ?? "");
      })
      .catch(() => setLoadError("Failed to load custom domain info"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { loadInfo(); }, []);

  async function handleSave() {
    setSaveError(null);
    setVerifyResult(null);
    setIsSaving(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/custom-domain`, {
        method: "PUT",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ domain: domainInput.trim() }),
      });
      const data = await res.json() as { custom_domain?: string | null; status?: string; error?: string };
      if (!res.ok) { setSaveError(data.error ?? "Failed to save domain."); return; }
      setInfo((prev) => prev ? { ...prev, custom_domain: data.custom_domain ?? null, status: (data.status as DomainStatus) ?? null } : prev);
      setDomainInput(data.custom_domain ?? "");
    } catch { setSaveError("Failed to save domain."); }
    finally { setIsSaving(false); }
  }

  async function handleVerify() {
    setVerifyResult(null);
    setSaveError(null);
    setIsVerifying(true);
    if (info) setInfo({ ...info, status: "verifying" });
    try {
      const res = await fetch(`${SETTINGS_BASE}/custom-domain/verify`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "{}",
      });
      const data = await res.json() as { verified?: boolean; status?: string; cnames_found?: string[]; error?: string };
      if (!res.ok) { setSaveError(data.error ?? "Verification failed."); loadInfo(); return; }
      setVerifyResult({ verified: data.verified ?? false, cnames_found: data.cnames_found ?? [] });
      setInfo((prev) => prev ? { ...prev, status: (data.status as DomainStatus) ?? prev.status } : prev);
    } catch { setSaveError("Verification failed. Please try again."); loadInfo(); }
    finally { setIsVerifying(false); }
  }

  async function handleRemove() {
    setSaveError(null);
    setVerifyResult(null);
    setIsSaving(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/custom-domain`, {
        method: "PUT",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ domain: "" }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; setSaveError(d.error ?? "Failed to remove domain."); return; }
      setInfo((prev) => prev ? { ...prev, custom_domain: null, status: null } : prev);
      setDomainInput("");
    } catch { setSaveError("Failed to remove domain."); }
    finally { setIsSaving(false); }
  }

  const isFree = info?.plan_tier === "free";
  const hasDomain = !!info?.custom_domain;
  const status = info?.status ?? null;
  const cnameTarget = info?.cname_target ?? "interview.docuplete.com";
  const domainDirty = domainInput.trim().toLowerCase() !== (info?.custom_domain ?? "");

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Custom domain</h2>
          <p className="text-xs text-gray-500 mt-0.5">Serve interview links from your own subdomain for a fully white-labeled experience.</p>
        </div>
        {!isLoading && hasDomain && domainStatusBadge(status)}
      </div>

      {loadError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {saveError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{saveError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : isFree ? (
        /* Upgrade prompt for free plan */
        <div className="px-6 py-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Available on Pro &amp; Enterprise</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Upgrade your plan to use a custom subdomain like{" "}
                <span className="font-mono font-medium">forms.yourcompany.com</span> for all interview links.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors whitespace-nowrap"
              onClick={() => document.getElementById("billing-section")?.scrollIntoView({ behavior: "smooth" })}
            >
              Upgrade plan
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Domain input */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Custom subdomain</label>
              {isAdmin ? (
                <>
                  <div className="flex gap-2 items-center flex-wrap">
                    <input
                      type="text"
                      value={domainInput}
                      onChange={(e) => { setDomainInput(e.target.value); setSaveError(null); setVerifyResult(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && domainDirty) void handleSave(); }}
                      placeholder="forms.yourcompany.com"
                      className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 font-mono placeholder:text-gray-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                    />
                    <button
                      type="button"
                      disabled={isSaving || !domainDirty}
                      onClick={() => { void handleSave(); }}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {isSaving ? "Saving…" : "Save"}
                    </button>
                    {hasDomain && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => { void handleRemove(); }}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">Enter the full subdomain where interviews will be served, e.g. <span className="font-mono">forms.acme.com</span>.</p>
                </>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 font-mono">
                  {hasDomain ? info?.custom_domain : <span className="text-gray-400 font-sans italic">Not configured</span>}
                </div>
              )}
            </div>

            {/* DNS instructions */}
            {hasDomain && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 space-y-3">
                <p className="text-xs font-semibold text-gray-800">DNS configuration required</p>
                <p className="text-xs text-gray-600">
                  At your domain registrar or DNS provider, add the following CNAME record for{" "}
                  <span className="font-mono font-medium">{info?.custom_domain}</span>:
                </p>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="text-gray-500 text-left">
                        <th className="pr-6 pb-1.5 font-medium">Type</th>
                        <th className="pr-6 pb-1.5 font-medium">Name&nbsp;/&nbsp;Host</th>
                        <th className="pb-1.5 font-medium">Value&nbsp;/&nbsp;Points to</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="pr-6 py-1 font-mono text-gray-700">CNAME</td>
                        <td className="pr-6 py-1 font-mono text-gray-700">{info?.custom_domain ?? "@"}</td>
                        <td className="py-1 font-mono text-gray-700">{cnameTarget}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500">DNS changes can take up to 48 hours to propagate globally, though most complete within minutes.</p>
              </div>
            )}

            {/* Status guidance */}
            {hasDomain && (
              <div className="space-y-3">
                {status === "active" && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">
                    <span className="font-semibold">Domain is active.</span> New interview links will use{" "}
                    <span className="font-mono">{info?.custom_domain}</span> as their host.
                  </div>
                )}
                {status === "error" && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                    <span className="font-semibold">DNS verification failed.</span> Make sure the CNAME record above is saved at your DNS provider, then click Verify again. Changes can take a few minutes to propagate.
                  </div>
                )}
                {status === "unverified" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <span className="font-semibold">Domain saved but not yet verified.</span> Add the CNAME record above, then click Verify.
                  </div>
                )}
                {verifyResult && verifyResult.verified && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">
                    <span className="font-semibold">Verified successfully!</span> Your custom domain is now active.
                  </div>
                )}
                {verifyResult && !verifyResult.verified && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                    <span className="font-semibold">Could not verify DNS.</span>{" "}
                    {verifyResult.cnames_found.length > 0
                      ? <>Found CNAME pointing to <span className="font-mono">{verifyResult.cnames_found[0]}</span> — expected <span className="font-mono">{cnameTarget}</span>.</>
                      : <>No CNAME record found for this domain. Check your DNS settings and try again after a few minutes.</>
                    }
                  </div>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    disabled={isVerifying || !hasDomain}
                    onClick={() => { void handleVerify(); }}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {isVerifying ? "Checking DNS…" : status === "active" ? "Re-verify" : "Verify"}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function TeamSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [seatCount, setSeatCount] = useState(0);
  const [seatLimit, setSeatLimit] = useState(10);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [seatLimitReached, setSeatLimitReached] = useState(false);

  const [changingRoleId, setChangingRoleId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function loadTeam() {
    setIsLoading(true);
    setLoadError(null);
    fetch(`${SETTINGS_BASE}/team`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { members?: TeamMember[]; seat_count?: number; seat_limit?: number; is_admin?: boolean; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load team"); return; }
        setMembers(data.members ?? []);
        setSeatCount(data.seat_count ?? 0);
        setSeatLimit(data.seat_limit ?? 10);
        setIsAdmin(data.is_admin ?? false);
      })
      .catch(() => setLoadError("Failed to load team"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { loadTeam(); }, []);

  async function handleInvite() {
    if (!inviteEmail.trim()) { setInviteError("Email is required."); return; }
    setInviteError(null);
    setInviteSuccess(null);
    setSeatLimitReached(false);
    setIsInviting(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/team/invite`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json() as { member?: TeamMember; emailSent?: boolean; error?: string; upgrade_required?: boolean };
      if (res.status === 402 && data.upgrade_required) { setSeatLimitReached(true); return; }
      if (!res.ok) { setInviteError(data.error ?? "Failed to send invitation."); return; }
      setInviteEmail("");
      setInviteSuccess(
        data.emailSent === false
          ? `${inviteEmail.trim()} was added as a pending member. No email was sent — ask them to sign up at the app URL.`
          : `Invitation email sent to ${inviteEmail.trim()}.`,
      );
      loadTeam();
    } catch { setInviteError("Failed to send invitation."); }
    finally { setIsInviting(false); }
  }

  async function handleChangeRole(memberId: number, newRole: string) {
    setChangingRoleId(memberId);
    setActionError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/team/${memberId}/role`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json() as { member?: TeamMember; error?: string };
      if (!res.ok) { setActionError(data.error ?? "Failed to update role."); return; }
      loadTeam();
    } catch { setActionError("Failed to update role."); }
    finally { setChangingRoleId(null); }
  }

  async function handleRemove(memberId: number) {
    setRemovingId(memberId);
    setConfirmRemoveId(null);
    setActionError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/team/${memberId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { setActionError(data.error ?? "Failed to remove member."); return; }
      loadTeam();
    } catch { setActionError("Failed to remove member."); }
    finally { setRemovingId(null); }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Team</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isLoading ? "Loading…" : `${seatCount} of ${seatLimit} seat${seatLimit !== 1 ? "s" : ""} used`}
          </p>
        </div>
      </div>

      {loadError && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-100">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {actionError && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-100">
          <p className="text-xs text-red-700">{actionError}</p>
        </div>
      )}

      {/* Invite form — admins only */}
      {isAdmin && (
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-gray-900 mb-3">Invite a team member</p>
          {seatLimitReached && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start justify-between gap-2">
              <span>
                Your plan&apos;s seat limit has been reached.{" "}
                <button
                  type="button"
                  className="underline font-semibold hover:text-amber-900"
                  onClick={() => document.getElementById("billing-section")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Upgrade your plan
                </button>{" "}
                to invite more team members.
              </span>
              <button type="button" onClick={() => setSeatLimitReached(false)} className="text-amber-500 hover:text-amber-800 shrink-0 leading-none">&times;</button>
            </div>
          )}
          {inviteError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{inviteError}</div>
          )}
          {inviteSuccess && (
            <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{inviteSuccess}</div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); setInviteSuccess(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); }}
              placeholder="colleague@company.com"
              className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
            >
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button
              type="button"
              disabled={isInviting}
              onClick={() => { void handleInvite(); }}
              className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
            >
              {isInviting ? "Sending…" : "Send invite"}
            </button>
          </div>
        </div>
      )}

      {/* Member list */}
      <div className="px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No team members yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 -mx-6">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-6 py-3">
                {/* Avatar placeholder */}
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-xs font-semibold text-gray-500 uppercase">
                  {(member.display_name ?? member.email).charAt(0)}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.display_name ?? member.email}
                    </p>
                    {member.display_name && (
                      <span className="text-xs text-gray-400 truncate">{member.email}</span>
                    )}
                    {member.is_current_user && (
                      <span className="text-[10px] text-gray-400 font-medium">(you)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {roleBadge(member.role)}
                    {member.status === "pending" ? (
                      <>
                        <span className="text-[10px] text-amber-600 font-medium">Pending invitation</span>
                        {member.invited_at && (
                          <span className="text-[10px] text-gray-400">&middot; {formatDate(member.invited_at)}</span>
                        )}
                        {member.invited_by && (
                          <span className="text-[10px] text-gray-400">&middot; Invited by {member.invited_by}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] text-gray-400">
                          {member.invited_at
                            ? `Joined ${formatDate(member.invited_at)}`
                            : `Last seen ${formatRelative(member.last_seen_at)}`}
                        </span>
                        {isAdmin && member.invited_by && (
                          <span className="text-[10px] text-gray-400">&middot; Invited by {member.invited_by}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Admin controls */}
                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={member.role}
                      disabled={changingRoleId === member.id}
                      onChange={(e) => { void handleChangeRole(member.id, e.target.value); }}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:opacity-50"
                    >
                      {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>

                    {confirmRemoveId === member.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-600 whitespace-nowrap">Remove?</span>
                        <button
                          type="button"
                          disabled={removingId === member.id}
                          onClick={() => { void handleRemove(member.id); }}
                          className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                        >
                          {removingId === member.id ? "…" : "Yes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setConfirmRemoveId(member.id); setActionError(null); }}
                        className="text-xs text-gray-400 hover:text-red-600 transition-colors px-1"
                        title="Remove member"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="px-6 py-3 bg-gray-50">
          <p className="text-xs text-gray-400 leading-relaxed">
            <strong>Admin</strong> — full access including settings and team management.{" "}
            <strong>Member</strong> — can run interviews and view results.{" "}
            <strong>Read-only</strong> — view access only.
          </p>
        </div>
      )}
    </section>
  );
}

interface IntegrationsStatus {
  zapier: { api_key_count: number; first_key_prefix: string | null; available: boolean };
  slack: { connected: boolean; channel_name: string | null; connected_at: string | null; available: boolean };
  gdrive: { connected: boolean; email: string | null; folder_name: string | null; connected_at: string | null; available: boolean };
  hubspot: { connected: boolean; hub_domain: string | null; connected_at: string | null; available: boolean };
}

function DeveloperSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  const [zapier, setZapier] = useState<{ api_key_count: number; first_key_prefix: string | null } | null>(null);

  useEffect(() => {
    fetch(`${SETTINGS_BASE}/integrations`, { headers: getAuthHeaders() })
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json() as { integrations?: IntegrationsStatus };
        if (data.integrations) {
          setZapier({
            api_key_count:   data.integrations.zapier.api_key_count,
            first_key_prefix: data.integrations.zapier.first_key_prefix,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Developer</h2>
        <p className="text-xs text-gray-500 mt-0.5">API keys, SDK, and automation tools for building on Docuplete.</p>
      </div>
      <div className="px-6 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* ── SDK & API card ────────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">SDK &amp; API</p>
                <p className="text-[10px] text-gray-400">Node.js · TypeScript</p>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <p className="text-[10px] text-gray-400 mb-1">Install</p>
              <code className="text-xs font-mono text-gray-700 select-all">npm install @docuplete/sdk</code>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Create sessions, fill answers, generate PDF packets, and verify webhook signatures — all from your own code.
            </p>
            <div className="flex items-center gap-2 mt-auto pt-1">
              <a
                href="https://github.com/WestHillsCapital/WestHillsCapital/tree/main/packages/sdk#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Docs ↗
              </a>
              <button
                type="button"
                onClick={() => document.getElementById("api-keys-section")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
              >
                Get API key
              </button>
            </div>
          </div>

          {/* ── Zapier card ───────────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#FF4A00] flex items-center justify-center shrink-0 text-white font-bold text-sm">Z</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Zapier</p>
                <p className="text-[10px] text-gray-400">Automate with 5,000+ apps</p>
              </div>
              {(zapier?.api_key_count ?? 0) > 0
                ? <span className="ml-auto inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-medium text-green-700">Connected</span>
                : <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">Not connected</span>
              }
            </div>
            {(zapier?.api_key_count ?? 0) > 0 && zapier?.first_key_prefix ? (
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                <p className="text-[10px] text-gray-400 mb-1">API key in use</p>
                <code className="text-xs font-mono text-gray-700">{zapier.first_key_prefix}…</code>
                {zapier.api_key_count > 1 && (
                  <span className="ml-2 text-[10px] text-gray-400">+{zapier.api_key_count - 1} more</span>
                )}
              </div>
            ) : null}
            <p className="text-xs text-gray-500 leading-relaxed">
              {(zapier?.api_key_count ?? 0) === 0
                ? "Create an API key below to connect with Zapier. Use it as your authentication credential in any Zapier Docuplete action."
                : "Use your API key as the authentication credential in any Zapier Docuplete action or trigger."}
            </p>
            <div className="flex items-center gap-2 mt-auto pt-1">
              <a
                href="https://zapier.com/apps/docuplete/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                View on Zapier ↗
              </a>
              <button
                type="button"
                onClick={() => document.getElementById("api-keys-section")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
              >
                {(zapier?.api_key_count ?? 0) === 0 ? "Create API key" : "Manage keys"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

function IntegrationsSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slackConnecting, setSlackConnecting] = useState(false);
  const [slackDisconnecting, setSlackDisconnecting] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackSuccess, setSlackSuccess] = useState<string | null>(null);

  const [gdriveConnecting, setGdriveConnecting] = useState(false);
  const [gdriveDisconnecting, setGdriveDisconnecting] = useState(false);
  const [gdriveError, setGdriveError] = useState<string | null>(null);
  const [gdriveSuccess, setGdriveSuccess] = useState<string | null>(null);
  const [gdriveFolderInput, setGdriveFolderInput] = useState("");
  const [gdriveUpdatingFolder, setGdriveUpdatingFolder] = useState(false);

  const [hubspotConnecting, setHubspotConnecting] = useState(false);
  const [hubspotDisconnecting, setHubspotDisconnecting] = useState(false);
  const [hubspotError, setHubspotError] = useState<string | null>(null);
  const [hubspotSuccess, setHubspotSuccess] = useState<string | null>(null);

  function loadStatus() {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/integrations`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { integrations?: IntegrationsStatus; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load integrations"); return; }
        if (data.integrations) setStatus(data.integrations);
      })
      .catch(() => setLoadError("Failed to load integrations"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadStatus();

    // Handle OAuth callbacks — providers redirect back to this page with ?code=&state=
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");
    const isGdrive   = params.get("gdrive")   === "1";
    const isHubSpot  = params.get("hubspot")  === "1";

    // Clean the URL immediately so params don't linger on refresh
    if (code || state || oauthError || isGdrive || isHubSpot) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (isGdrive) {
      // Google Drive OAuth callback
      if (oauthError === "access_denied") {
        setGdriveError("Google Drive connection was cancelled.");
        return;
      }
      if (code && state) {
        const redirectUri = window.location.origin + window.location.pathname + "?gdrive=1";
        setGdriveConnecting(true);
        const headers = new Headers(getAuthHeaders());
        headers.set("Content-Type", "application/json");
        fetch(`${SETTINGS_BASE}/integrations/gdrive/exchange`, {
          method: "POST",
          headers,
          body: JSON.stringify({ code, state, redirectUri }),
        })
          .then(async (r) => {
            const data = await r.json() as { success?: boolean; email?: string; folder_name?: string; error?: string };
            if (!r.ok) { setGdriveError(data.error ?? "Failed to connect Google Drive."); return; }
            setGdriveSuccess(`Connected as ${data.email ?? "your Google account"}. Files will be saved to "${data.folder_name ?? "Docuplete Submissions"}".`);
            loadStatus();
          })
          .catch(() => setGdriveError("Failed to connect Google Drive."))
          .finally(() => setGdriveConnecting(false));
      }
      return;
    }

    if (isHubSpot) {
      // HubSpot OAuth callback
      if (oauthError === "access_denied") {
        setHubspotError("HubSpot connection was cancelled.");
        return;
      }
      if (code && state) {
        const redirectUri = window.location.origin + window.location.pathname + "?hubspot=1";
        setHubspotConnecting(true);
        const headers = new Headers(getAuthHeaders());
        headers.set("Content-Type", "application/json");
        fetch(`${SETTINGS_BASE}/integrations/hubspot/exchange`, {
          method: "POST",
          headers,
          body: JSON.stringify({ code, state, redirectUri }),
        })
          .then(async (r) => {
            const data = await r.json() as { success?: boolean; hub_domain?: string; error?: string };
            if (!r.ok) { setHubspotError(data.error ?? "Failed to connect HubSpot."); return; }
            setHubspotSuccess(`Connected to HubSpot portal${data.hub_domain ? ` (${data.hub_domain})` : ""}.`);
            loadStatus();
          })
          .catch(() => setHubspotError("Failed to connect HubSpot."))
          .finally(() => setHubspotConnecting(false));
      }
      return;
    }

    // Slack OAuth callback
    if (oauthError === "access_denied") {
      setSlackError("Slack connection was cancelled.");
      return;
    }

    if (code && state) {
      const redirectUri = window.location.origin + window.location.pathname;
      setSlackConnecting(true);
      const headers = new Headers(getAuthHeaders());
      headers.set("Content-Type", "application/json");
      fetch(`${SETTINGS_BASE}/integrations/slack/exchange`, {
        method: "POST",
        headers,
        body: JSON.stringify({ code, state, redirectUri }),
      })
        .then(async (r) => {
          const data = await r.json() as { success?: boolean; channel_name?: string; error?: string };
          if (!r.ok) { setSlackError(data.error ?? "Failed to connect Slack."); return; }
          setSlackSuccess(`Connected to ${data.channel_name ?? "Slack"} successfully. You'll now receive submission notifications there.`);
          loadStatus();
        })
        .catch(() => setSlackError("Failed to connect Slack."))
        .finally(() => setSlackConnecting(false));
    }
  }, []);

  async function handleSlackConnect() {
    setSlackError(null);
    setSlackConnecting(true);
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const res = await fetch(`${SETTINGS_BASE}/integrations/slack/connect`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ redirectUri }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) { setSlackError(data.error ?? "Failed to initiate Slack connection."); setSlackConnecting(false); return; }
      if (data.url) window.location.href = data.url;
    } catch {
      setSlackError("Failed to initiate Slack connection.");
      setSlackConnecting(false);
    }
  }

  async function handleSlackDisconnect() {
    setSlackDisconnecting(true);
    setSlackError(null);
    setSlackSuccess(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/integrations/slack`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) { setSlackError("Failed to disconnect Slack."); return; }
      loadStatus();
    } catch {
      setSlackError("Failed to disconnect Slack.");
    } finally {
      setSlackDisconnecting(false);
    }
  }

  async function handleGdriveConnect() {
    setGdriveError(null);
    setGdriveConnecting(true);
    try {
      const redirectUri = window.location.origin + window.location.pathname + "?gdrive=1";
      const res = await fetch(`${SETTINGS_BASE}/integrations/gdrive/connect`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ redirectUri }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) { setGdriveError(data.error ?? "Failed to initiate Google Drive connection."); setGdriveConnecting(false); return; }
      window.location.href = data.url;
    } catch {
      setGdriveError("Failed to initiate Google Drive connection.");
      setGdriveConnecting(false);
    }
  }

  async function handleGdriveDisconnect() {
    setGdriveDisconnecting(true);
    setGdriveError(null);
    setGdriveSuccess(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/integrations/gdrive`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) { setGdriveError("Failed to disconnect Google Drive."); return; }
      loadStatus();
    } catch {
      setGdriveError("Failed to disconnect Google Drive.");
    } finally {
      setGdriveDisconnecting(false);
    }
  }

  async function handleHubSpotConnect() {
    setHubspotError(null);
    setHubspotSuccess(null);
    setHubspotConnecting(true);
    try {
      const redirectUri = window.location.origin + window.location.pathname + "?hubspot=1";
      const res = await fetch(`${SETTINGS_BASE}/integrations/hubspot/connect`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ redirectUri }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) { setHubspotError(data.error ?? "Failed to initiate HubSpot connection."); setHubspotConnecting(false); return; }
      window.location.href = data.url;
    } catch {
      setHubspotError("Failed to initiate HubSpot connection.");
      setHubspotConnecting(false);
    }
  }

  async function handleHubSpotDisconnect() {
    setHubspotDisconnecting(true);
    setHubspotError(null);
    setHubspotSuccess(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/integrations/hubspot`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) { setHubspotError("Failed to disconnect HubSpot."); return; }
      loadStatus();
    } catch {
      setHubspotError("Failed to disconnect HubSpot.");
    } finally {
      setHubspotDisconnecting(false);
    }
  }

  async function handleGdriveUpdateFolder() {
    if (!gdriveFolderInput.trim()) return;
    setGdriveUpdatingFolder(true);
    setGdriveError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/integrations/gdrive/folder`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ folderInput: gdriveFolderInput }),
      });
      const data = await res.json() as { success?: boolean; folder_name?: string; error?: string };
      if (!res.ok) { setGdriveError(data.error ?? "Could not update folder."); return; }
      setGdriveFolderInput("");
      setGdriveSuccess(`Folder updated to "${data.folder_name ?? gdriveFolderInput}".`);
      loadStatus();
    } catch {
      setGdriveError("Failed to update folder.");
    } finally {
      setGdriveUpdatingFolder(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Integrations</h2>
        <p className="text-xs text-gray-500 mt-0.5">Connect Docuplete to services your team already uses — Drive, Slack, and CRMs.</p>
      </div>

      {loadError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* ── Slack card ──────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#4A154B] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Slack</p>
                  <p className="text-[10px] text-gray-400">Submission notifications</p>
                </div>
                {status?.slack.connected
                  ? <span className="ml-auto inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-medium text-green-700">Connected</span>
                  : <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">Not connected</span>
                }
              </div>

              {slackConnecting && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin shrink-0" />
                  Connecting to Slack…
                </div>
              )}
              {slackError && <p className="text-xs text-red-600">{slackError}</p>}
              {slackSuccess && <p className="text-xs text-green-700">{slackSuccess}</p>}

              {status?.slack.connected ? (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Posting to <span className="font-medium text-gray-700">{status.slack.channel_name ?? "your channel"}</span>.
                    You'll receive a notification whenever a client completes a document submission.
                  </p>
                  <button
                    type="button"
                    disabled={slackDisconnecting}
                    onClick={() => { void handleSlackDisconnect(); }}
                    className="mt-auto pt-1 text-xs text-gray-400 hover:text-red-600 transition-colors text-left disabled:opacity-60"
                  >
                    {slackDisconnecting ? "Disconnecting…" : "Disconnect Slack"}
                  </button>
                </>
              ) : !status?.slack.available ? (
                <p className="text-xs text-gray-400 leading-relaxed">
                  Slack integration is not enabled on this server. Contact your administrator to configure <code className="font-mono">SLACK_CLIENT_ID</code>.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Get notified in Slack whenever a client completes a document submission interview.
                  </p>
                  <div className="mt-auto pt-1">
                    <button
                      type="button"
                      disabled={slackConnecting}
                      onClick={() => { void handleSlackConnect(); }}
                      className="rounded-lg bg-[#4A154B] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#611565] disabled:opacity-60 transition-colors"
                    >
                      Add to Slack
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ── Google Drive card ───────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1AA260] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M6.18 17.01a5.09 5.09 0 01-3.6-1.49A5.12 5.12 0 011.1 12a5.07 5.07 0 011.49-3.6A5.07 5.07 0 016.18 6.9h2.18V9H6.18a3.01 3.01 0 000 6.02h2.18v2.09H6.18zm11.64 0h-2.18v-2.09h2.18a3.01 3.01 0 000-6.02h-2.18V6.9h2.18a5.07 5.07 0 013.6 1.49A5.09 5.09 0 0122.91 12a5.12 5.12 0 01-1.49 3.52 5.07 5.07 0 01-3.6 1.49zM8.09 13.09v-2.18h7.82v2.18H8.09z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Google Drive</p>
                  <p className="text-[10px] text-gray-400">Auto-save submitted packets</p>
                </div>
                {status?.gdrive?.connected
                  ? <span className="ml-auto inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-medium text-green-700">Connected</span>
                  : <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">Not connected</span>
                }
              </div>

              {gdriveConnecting && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin shrink-0" />
                  Connecting to Google Drive…
                </div>
              )}
              {gdriveError && <p className="text-xs text-red-600">{gdriveError}</p>}
              {gdriveSuccess && <p className="text-xs text-green-700">{gdriveSuccess}</p>}

              {status?.gdrive?.connected ? (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Connected as <span className="font-medium text-gray-700">{status.gdrive?.email ?? "your Google account"}</span>.
                    Submitted packets are saved to <span className="font-medium text-gray-700">"{status.gdrive?.folder_name ?? "Docuplete Submissions"}"</span>.
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Paste a different folder URL to change"
                      value={gdriveFolderInput}
                      onChange={(e) => setGdriveFolderInput(e.target.value)}
                      className="flex-1 min-w-0 text-xs rounded-lg border border-gray-200 px-3 py-1.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                    <button
                      type="button"
                      disabled={gdriveUpdatingFolder || !gdriveFolderInput.trim()}
                      onClick={() => { void handleGdriveUpdateFolder(); }}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors shrink-0"
                    >
                      {gdriveUpdatingFolder ? "Updating…" : "Update"}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={gdriveDisconnecting}
                    onClick={() => { void handleGdriveDisconnect(); }}
                    className="mt-auto pt-1 text-xs text-gray-400 hover:text-red-600 transition-colors text-left disabled:opacity-60"
                  >
                    {gdriveDisconnecting ? "Disconnecting…" : "Disconnect Google Drive"}
                  </button>
                </>
              ) : !status?.gdrive?.available ? (
                <p className="text-xs text-gray-400 leading-relaxed">
                  Google Drive integration is not enabled on this server. Contact your administrator to configure <code className="font-mono">GOOGLE_OAUTH_CLIENT_ID</code>.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Automatically save a copy of every completed PDF packet to a folder in your Google Drive.
                    Enable the Google Drive channel on any DocuFill package to activate.
                  </p>
                  <div className="mt-auto pt-1">
                    <button
                      type="button"
                      disabled={gdriveConnecting}
                      onClick={() => { void handleGdriveConnect(); }}
                      className="rounded-lg bg-[#1AA260] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#158a51] disabled:opacity-60 transition-colors"
                    >
                      Connect Google Drive
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ── HubSpot card ─────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#FF7A59] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 8.25V5.87A2.25 2.25 0 0 0 15 3.75H15a2.25 2.25 0 0 0-2.25 2.25v2.37a4.5 4.5 0 0 0-1.31.73L8.1 7.2A3.75 3.75 0 1 0 6.75 9.9l3.26 1.9a4.47 4.47 0 0 0 0 2.44L6.75 16.1A3.75 3.75 0 1 0 8.1 18.8l3.34-1.85a4.5 4.5 0 1 0 5.06-8.7ZM6.75 11.25a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm9-5.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">HubSpot CRM</p>
                  <p className="text-[10px] text-gray-400">Create contacts on submission</p>
                </div>
                {status?.hubspot?.connected
                  ? <span className="ml-auto inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-medium text-green-700">Connected</span>
                  : <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">Not connected</span>
                }
              </div>

              {hubspotConnecting && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin shrink-0" />
                  Connecting to HubSpot…
                </div>
              )}
              {hubspotError   && <p className="text-xs text-red-600">{hubspotError}</p>}
              {hubspotSuccess && <p className="text-xs text-green-700">{hubspotSuccess}</p>}

              {status?.hubspot?.connected ? (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Connected to HubSpot portal
                    {status.hubspot.hub_domain ? <> — <span className="font-medium text-gray-700">{status.hubspot.hub_domain}</span></> : ""}.
                    Submitting a DocuFill packet with HubSpot enabled will create or update a contact.
                  </p>
                  <button
                    type="button"
                    disabled={hubspotDisconnecting}
                    onClick={() => { void handleHubSpotDisconnect(); }}
                    className="mt-auto pt-1 text-xs text-gray-400 hover:text-red-600 transition-colors text-left disabled:opacity-60"
                  >
                    {hubspotDisconnecting ? "Disconnecting…" : "Disconnect HubSpot"}
                  </button>
                </>
              ) : !status?.hubspot?.available ? (
                <p className="text-xs text-gray-400 leading-relaxed">
                  HubSpot integration is not enabled on this server. Contact your administrator to configure <code className="font-mono">HUBSPOT_CLIENT_ID</code>.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Automatically create or update a HubSpot CRM contact whenever a DocuFill packet is submitted.
                    Enable the HubSpot channel on any DocuFill package to activate.
                  </p>
                  <div className="mt-auto pt-1">
                    <button
                      type="button"
                      disabled={hubspotConnecting}
                      onClick={() => { void handleHubSpotConnect(); }}
                      className="rounded-lg bg-[#FF7A59] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#e8603f] disabled:opacity-60 transition-colors"
                    >
                      Connect HubSpot
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ── Coming soon placeholder ─────────────────────────────────── */}
            <div className="rounded-xl border border-dashed border-gray-200 p-5 flex flex-col gap-3 opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">More coming soon</p>
                  <p className="text-[10px] text-gray-300">Salesforce and more</p>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">More CRM integrations are on the roadmap.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface AuditLogMetadataMap {
  "team.invite":               { role: string };
  "team.remove":               { role: string };
  "team.role_change":          { from_role: string; to_role: string };
  "apikey.create":             Record<string, never>;
  "apikey.revoke":             Record<string, never>;
  "apikey.rename":             Record<string, never>;
  "branding.update_name":      { from: string; to: string };
  "branding.update_color":     { from: string; to: string };
  "branding.upload_logo":      Record<string, never>;
  "branding.remove_logo":      Record<string, never>;
  "plan.checkout_initiated":   { plan: string };
  "plan.change":               { from_plan: string; to_plan: string; status: string; event_type: string };
}

type KnownAuditAction = keyof AuditLogMetadataMap;

interface AuditLogEntryBase {
  id: number;
  actor_email: string | null;
  resource_type: string | null;
  resource_label: string | null;
  ip_address: string | null;
  location: string | null;
  created_at: string;
}

type AuditLogEntry = {
  [A in KnownAuditAction]: AuditLogEntryBase & { action: A; metadata: AuditLogMetadataMap[A] };
}[KnownAuditAction];

const ACTION_LABELS: Record<string, string> = {
  "team.invite":               "Invited team member",
  "team.remove":               "Removed team member",
  "team.role_change":          "Changed member role",
  "apikey.create":             "Created API key",
  "apikey.revoke":             "Revoked API key",
  "apikey.rename":             "Renamed API key",
  "branding.update_name":      "Updated organization name",
  "branding.update_color":     "Updated brand color",
  "branding.upload_logo":      "Uploaded logo",
  "branding.remove_logo":      "Removed logo",
  "plan.checkout_initiated":   "Initiated plan upgrade",
  "plan.change":               "Plan changed",
};

const ACTION_FILTER_OPTIONS = [
  { value: "",                      label: "All activity" },
  { value: "team.invite",           label: "Team invites" },
  { value: "team.remove",           label: "Member removals" },
  { value: "team.role_change",      label: "Role changes" },
  { value: "apikey.create",         label: "API key created" },
  { value: "apikey.revoke",         label: "API key revoked" },
  { value: "apikey.rename",         label: "API key renamed" },
  { value: "branding.update_name",  label: "Org name change" },
  { value: "branding.update_color", label: "Brand color change" },
  { value: "branding.upload_logo",  label: "Logo uploaded" },
  { value: "branding.remove_logo",  label: "Logo removed" },
  { value: "plan.checkout_initiated", label: "Plan upgrade initiated" },
  { value: "plan.change",           label: "Plan changed" },
];

function actionBadgeColor(action: string): string {
  if (action.startsWith("team."))     return "bg-sky-50 border-sky-200 text-sky-700";
  if (action.startsWith("apikey."))   return "bg-amber-50 border-amber-200 text-amber-700";
  if (action.startsWith("branding.")) return "bg-purple-50 border-purple-200 text-purple-700";
  if (action.startsWith("plan."))     return "bg-green-50 border-green-200 text-green-700";
  return "bg-gray-100 border-gray-200 text-gray-600";
}

function formatTimestamp(iso: string): string {
  return formatOrgDate(iso, getCachedProductOrg(), true);
}

// ── Notifications Section ────────────────────────────────────────────────────

const NOTIFICATION_CATEGORIES = [
  {
    label: "Interviews",
    events: [
      { key: "submission_received",   label: "New submission received", description: "When a client completes an interview form" },
    ],
  },
  {
    label: "Team",
    events: [
      { key: "team_member_joined",  label: "Team member joined",  description: "When a team member accepts their invitation" },
      { key: "team_member_removed", label: "Team member removed", description: "When a team member is removed from your organization" },
    ],
  },
  {
    label: "Billing",
    events: [
      { key: "billing_plan_change",    label: "Plan changed",       description: "When your subscription plan changes" },
      { key: "billing_payment_failed", label: "Payment failed",     description: "When a billing payment attempt fails" },
      { key: "plan_limit_warning",     label: "Plan limit warning", description: "When you're approaching a plan usage limit" },
    ],
  },
  {
    label: "Security",
    events: [
      { key: "api_key_created", label: "API key created", description: "When a new API key is generated in your organization" },
      { key: "api_key_revoked", label: "API key revoked", description: "When an API key is revoked" },
    ],
  },
] as const;

interface NotifPref {
  event_key: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
}

function NotificationsSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [prefs, setPrefs] = useState<Map<string, NotifPref>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/notifications`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { prefs?: NotifPref[]; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load notification preferences"); return; }
        setPrefs(new Map((data.prefs ?? []).map(p => [p.event_key, p])));
      })
      .catch(() => setLoadError("Failed to load notification preferences"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
      if (savedTimerRef.current)  clearTimeout(savedTimerRef.current);
    };
  }, []);

  function getPref(key: string): NotifPref {
    return prefs.get(key) ?? { event_key: key, email_enabled: true, in_app_enabled: true };
  }

  function handleToggle(key: string, field: "email_enabled" | "in_app_enabled", value: boolean) {
    const updated = new Map(prefs);
    const current = getPref(key);
    updated.set(key, { ...current, [field]: value });
    setPrefs(updated);

    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    pendingSaveRef.current = setTimeout(() => {
      const allKeys = NOTIFICATION_CATEGORIES.flatMap(c => c.events.map(e => e.key));
      const fullPrefs = allKeys.map(k => updated.get(k) ?? { event_key: k, email_enabled: true, in_app_enabled: true });
      setSaveError(null);
      fetch(`${SETTINGS_BASE}/notifications`, {
        method: "PUT",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ prefs: fullPrefs }),
      }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json() as { error?: string };
          setSaveError(data.error ?? "Failed to save preferences");
          return;
        }
        setSaved(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaved(false), 2500);
      }).catch(() => setSaveError("Failed to save preferences"));
    }, 150);
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Choose which events send you email alerts or appear as in-app notifications. These preferences are personal — each team member controls their own.
          </p>
        </div>
        {saved && (
          <span className="text-[11px] font-medium text-green-600 shrink-0">&#10003; Saved</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        <div className="px-6 py-8 text-center text-sm text-red-500">{loadError}</div>
      ) : (
        <div>
          {/* Column headers */}
          <div className="flex items-center px-6 py-2 border-b border-gray-100 bg-gray-50/80">
            <div className="flex-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Event</div>
            <div className="w-20 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Email</div>
            <div className="w-20 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">In-app</div>
          </div>

          {NOTIFICATION_CATEGORIES.map((category) => (
            <div key={category.label}>
              <div className="px-6 py-2 bg-gray-50/50 border-b border-gray-100">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{category.label}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {category.events.map((event) => {
                  const pref = getPref(event.key);
                  return (
                    <div key={event.key} className="flex items-center px-6 py-3.5">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-medium text-gray-800">{event.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{event.description}</p>
                      </div>
                      <div className="w-20 flex justify-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={pref.email_enabled}
                          onClick={() => handleToggle(event.key, "email_enabled", !pref.email_enabled)}
                          className={[
                            "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2",
                            pref.email_enabled ? "bg-gray-900" : "bg-gray-200",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200",
                              pref.email_enabled ? "translate-x-4" : "translate-x-0",
                            ].join(" ")}
                          />
                        </button>
                      </div>
                      <div className="w-20 flex justify-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={pref.in_app_enabled}
                          onClick={() => handleToggle(event.key, "in_app_enabled", !pref.in_app_enabled)}
                          className={[
                            "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2",
                            pref.in_app_enabled ? "bg-gray-900" : "bg-gray-200",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200",
                              pref.in_app_enabled ? "translate-x-4" : "translate-x-0",
                            ].join(" ")}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {saveError && (
            <div className="px-6 py-3 border-t border-gray-100 bg-red-50">
              <p className="text-xs text-red-600">{saveError}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Audit Log Section ─────────────────────────────────────────────────────────

function AuditLogSection({ getAuthHeaders, isAdmin }: { getAuthHeaders: () => HeadersInit; isAdmin: boolean }) {
  function authHeaders(): HeadersInit {
    return getAuthHeaders();
  }

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const LIMIT = 25;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function loadEntries(p: number, action: string, s: string) {
    setIsLoading(true);
    setLoadError(null);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (action) params.set("action", action);
    if (s.trim()) params.set("search", s.trim());
    fetch(`${SETTINGS_BASE}/audit-log?${params.toString()}`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { entries?: AuditLogEntry[]; total?: number; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load audit log"); return; }
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => setLoadError("Failed to load audit log"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadEntries(page, actionFilter, search);
  }, [page, actionFilter, search, isAdmin]);

  function handleSearchChange(v: string) {
    setSearchInput(v);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(v);
      setPage(1);
    }, 350);
  }

  function handleActionFilterChange(v: string) {
    setActionFilter(v);
    setPage(1);
  }

  if (!isAdmin) return null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Audit log</h2>
          <p className="text-xs text-gray-500 mt-0.5">A record of actions taken by admins and team members in your organization.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by user or resource…"
          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
        />
        <select
          value={actionFilter}
          onChange={(e) => handleActionFilterChange(e.target.value)}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          {ACTION_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="min-h-[120px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="px-6 py-8 text-center text-sm text-red-500">{loadError}</div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            {search || actionFilter ? "No entries match your filters." : "No activity recorded yet. Actions you and your team take will appear here."}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 px-6 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${actionBadgeColor(entry.action)}`}>
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                    {entry.resource_label && (
                      <span className="text-xs text-gray-600 truncate font-medium">{entry.resource_label}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-[11px] text-gray-400 mt-0.5">
                    {entry.actor_email && (
                      <span>by <span className="text-gray-600">{entry.actor_email}</span></span>
                    )}
                    {entry.action === "team.role_change" && entry.metadata.from_role && (
                      <span>{entry.metadata.from_role} → {entry.metadata.to_role}</span>
                    )}
                    {entry.action === "branding.update_name" && entry.metadata.from && (
                      <span>was &ldquo;{entry.metadata.from}&rdquo;</span>
                    )}
                    {(entry.location ?? entry.ip_address) && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        {entry.location && entry.ip_address
                          ? `${entry.location} · ${entry.ip_address}`
                          : (entry.location ?? entry.ip_address)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-gray-400 tabular-nums mt-0.5">
                  {formatTimestamp(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !loadError && totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {total} {total === 1 ? "entry" : "entries"} · page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ApiKeysSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<NewKeyResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isSavingRename, setIsSavingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  function loadKeys() {
    setIsLoadingKeys(true);
    setKeysError(null);
    setRenameError(null);
    fetch(`${AUTH_BASE}/api-keys`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { keys?: ApiKey[]; error?: string };
        if (!r.ok) { setKeysError(data.error ?? "Failed to load API keys"); return; }
        if (data.keys) setKeys(data.keys);
        else setKeysError("Failed to load API keys");
      })
      .catch(() => setKeysError("Failed to load API keys"))
      .finally(() => setIsLoadingKeys(false));
  }

  useEffect(() => {
    loadKeys();
  }, []);

  async function handleCreate() {
    if (!newKeyName.trim()) { setCreateError("Key name is required."); return; }
    setCreateError(null);
    setIsCreating(true);
    try {
      const res = await fetch(`${AUTH_BASE}/api-keys`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json() as { id?: number; name?: string; key?: string; keyPrefix?: string; createdAt?: string; error?: string };
      if (!res.ok) { setCreateError(data.error ?? "Failed to create API key."); return; }
      if (!data.id || !data.name || !data.key || !data.keyPrefix || !data.createdAt) {
        setCreateError("Unexpected response from server. Please try again.");
        return;
      }
      setNewKey({ id: data.id, name: data.name, key: data.key, keyPrefix: data.keyPrefix, createdAt: data.createdAt });
      setNewKeyName("");
      loadKeys();
    } catch {
      setCreateError("Failed to create API key.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(id: number) {
    setRevokingId(id);
    setConfirmRevokeId(null);
    try {
      const res = await fetch(`${AUTH_BASE}/api-keys/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) {
        setKeysError(data.error ?? "Failed to revoke key.");
      } else {
        loadKeys();
      }
    } catch {
      setKeysError("Failed to revoke key.");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleCopy() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function startRename(key: ApiKey) {
    setRenamingId(key.id);
    setRenameValue(key.name);
    setRenameError(null);
    setConfirmRevokeId(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
    setRenameError(null);
  }

  async function handleRename(id: number) {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenameError("Name is required."); return; }
    if (trimmed.length > 100) { setRenameError("Name must be 100 characters or fewer."); return; }
    setRenameError(null);
    setIsSavingRename(true);
    try {
      const res = await fetch(`${AUTH_BASE}/api-keys/${id}`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json() as { success?: boolean; id?: number; name?: string; error?: string };
      if (!res.ok) { setRenameError(data.error ?? "Failed to rename key."); return; }
      setRenamingId(null);
      setRenameValue("");
      loadKeys();
    } catch {
      setRenameError("Failed to rename key.");
    } finally {
      setIsSavingRename(false);
    }
  }

  function formatDate(iso: string) {
    return formatOrgDate(iso, getCachedProductOrg());
  }

  const activeKeys = keys.filter((k) => k.active);
  const revokedKeys = keys.filter((k) => !k.active);

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">API Keys</h2>
        <p className="text-xs text-gray-500 mt-0.5">Create and manage API keys for programmatic access.</p>
      </div>

      {/* New key banner — shown once after creation */}
      {newKey && (
        <div className="px-6 py-4 bg-green-50 border-b border-green-100">
          <p className="text-sm font-medium text-green-800 mb-1">API key created — copy it now</p>
          <p className="text-xs text-green-700 mb-3">This is the only time the full key will be shown. Store it securely.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white border border-green-200 px-3 py-2 text-xs font-mono text-gray-800 break-all select-all">
              {newKey.key}
            </code>
            <button
              type="button"
              onClick={() => { void handleCopy(); }}
              className="shrink-0 rounded-lg border border-green-200 bg-white px-3 py-2 text-xs font-medium text-green-800 hover:bg-green-50 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setNewKey(null); setCopied(false); }}
            className="mt-3 text-xs text-green-700 underline underline-offset-2"
          >
            I've saved the key, dismiss this
          </button>
        </div>
      )}

      {/* Create new key form */}
      <div className="px-6 py-5">
        <p className="text-sm font-medium text-gray-900 mb-3">Create new key</p>
        {createError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{createError}</div>
        )}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
            placeholder="Key name (e.g. Production server)"
            maxLength={100}
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
          />
          <button
            type="button"
            disabled={isCreating}
            onClick={() => { void handleCreate(); }}
            className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
          >
            {isCreating ? "Creating…" : "Create"}
          </button>
        </div>
      </div>

      {/* Key list */}
      <div className="px-6 py-5">
        <p className="text-sm font-medium text-gray-900 mb-3">Active keys</p>

        {keysError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{keysError}</div>
        )}

        {isLoadingKeys ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : activeKeys.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No active API keys. Create one above.</p>
        ) : (
          <div className="divide-y divide-gray-100 -mx-6">
            {activeKeys.map((key) => (
              <div key={key.id} className="px-6 py-3">
                {renamingId === key.id ? (
                  /* ── Inline rename mode ── */
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(key.id);
                          if (e.key === "Escape") cancelRename();
                        }}
                        maxLength={100}
                        autoFocus
                        className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                      />
                      <button
                        type="button"
                        disabled={isSavingRename}
                        onClick={() => { void handleRename(key.id); }}
                        className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
                      >
                        {isSavingRename ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {renameError && (
                      <p className="text-xs text-red-600">{renameError}</p>
                    )}
                  </div>
                ) : (
                  /* ── Normal display mode ── */
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">{key.name}</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="shrink-0 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700 cursor-default">Full Access</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">Grants full API access: read live pricing data, submit interview sessions, and manage DocuFill packages programmatically.</TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <code className="font-mono">{key.keyPrefix}…</code>
                        {" · "}
                        Created {formatDate(key.createdAt)}
                        {" · "}
                        Last used: {key.lastUsedAt ? formatRelative(key.lastUsedAt) : "Never"}
                      </p>
                    </div>
                    {confirmRevokeId === key.id ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-600">Revoke this key?</span>
                        <button
                          type="button"
                          disabled={revokingId === key.id}
                          onClick={() => { void handleRevoke(key.id); }}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                        >
                          {revokingId === key.id ? "Revoking…" : "Yes, revoke"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRevokeId(null)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => startRename(key)}
                          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRevokeId(key.id)}
                          className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked keys */}
      {!isLoadingKeys && revokedKeys.length > 0 && (
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-gray-500 mb-3">Revoked keys</p>
          <div className="divide-y divide-gray-100 -mx-6">
            {revokedKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between gap-4 px-6 py-3 opacity-60">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{key.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <code className="font-mono">{key.keyPrefix}…</code>
                    {" · "}
                    Created {formatDate(key.createdAt)}
                    {key.revokedAt ? ` · Revoked ${formatDate(key.revokedAt)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                  Revoked
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Interview Defaults Section ────────────────────────────────────────────────

interface InterviewDefaults {
  linkExpiryDays:  number | null;
  reminderEnabled: boolean;
  reminderDays:    number;
  defaultLocale:   string;
}

const LOCALE_OPTIONS: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish (Español)" },
  { value: "fr", label: "French (Français)" },
  { value: "de", label: "German (Deutsch)" },
  { value: "pt", label: "Portuguese (Português)" },
  { value: "zh", label: "Chinese (中文)" },
  { value: "ja", label: "Japanese (日本語)" },
  { value: "ko", label: "Korean (한국어)" },
  { value: "ar", label: "Arabic (العربية)" },
];

const EXPIRY_PRESETS: { value: string; label: string }[] = [
  { value: "never",  label: "Never expires" },
  { value: "7",      label: "7 days" },
  { value: "14",     label: "14 days" },
  { value: "30",     label: "30 days" },
  { value: "90",     label: "90 days" },
  { value: "custom", label: "Custom…" },
];

function expiryToPreset(days: number | null): string {
  if (days === null) return "never";
  if ([7, 14, 30, 90].includes(days)) return String(days);
  return "custom";
}

function InterviewDefaultsSection({ getAuthHeaders, isAdmin }: { getAuthHeaders: () => HeadersInit; isAdmin: boolean }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [linkExpiryDays, setLinkExpiryDays] = useState<number | null>(null);
  const [expiryPreset, setExpiryPreset] = useState<string>("never");
  const [customExpiry, setCustomExpiry] = useState<string>("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDays, setReminderDays] = useState(2);
  const [defaultLocale, setDefaultLocale] = useState("en");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/interview-defaults`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { interviewDefaults?: InterviewDefaults; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load interview defaults"); return; }
        if (data.interviewDefaults) {
          const d = data.interviewDefaults;
          setLinkExpiryDays(d.linkExpiryDays);
          setExpiryPreset(expiryToPreset(d.linkExpiryDays));
          setCustomExpiry(d.linkExpiryDays !== null && ![7, 14, 30, 90].includes(d.linkExpiryDays) ? String(d.linkExpiryDays) : "");
          setReminderEnabled(d.reminderEnabled);
          setReminderDays(d.reminderDays);
          setDefaultLocale(d.defaultLocale);
        }
      })
      .catch(() => setLoadError("Failed to load interview defaults"))
      .finally(() => setIsLoading(false));
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  function handleExpiryPresetChange(preset: string) {
    setExpiryPreset(preset);
    if (preset === "never") { setLinkExpiryDays(null); setCustomExpiry(""); }
    else if (preset === "custom") { /* keep current custom */ }
    else { setLinkExpiryDays(Number(preset)); setCustomExpiry(""); }
  }

  function handleCustomExpiryChange(val: string) {
    setCustomExpiry(val);
    const n = parseInt(val, 10);
    if (Number.isInteger(n) && n >= 1 && n <= 3650) setLinkExpiryDays(n);
  }

  function effectiveLinkExpiryDays(): number | null {
    if (expiryPreset === "never") return null;
    if (expiryPreset === "custom") {
      const n = parseInt(customExpiry, 10);
      return Number.isInteger(n) && n >= 1 && n <= 3650 ? n : null;
    }
    return linkExpiryDays;
  }

  async function handleSave() {
    setSaveError(null);

    // Validate custom expiry before sending — an invalid/empty value would
    // silently become null (= "never expires") which is not the user's intent.
    if (expiryPreset === "custom") {
      const n = parseInt(customExpiry, 10);
      if (!Number.isInteger(n) || n < 1 || n > 3650) {
        setSaveError("Please enter a valid expiry between 1 and 3650 days.");
        return;
      }
    }

    setIsSaving(true);
    const payload: Record<string, unknown> = {
      linkExpiryDays: effectiveLinkExpiryDays(),
      reminderEnabled,
      reminderDays,
      defaultLocale,
    };
    try {
      const res = await fetch(`${SETTINGS_BASE}/interview-defaults`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { interviewDefaults?: InterviewDefaults; error?: string };
      if (!res.ok) { setSaveError(data.error ?? "Failed to save settings"); return; }
      if (data.interviewDefaults) {
        setLinkExpiryDays(data.interviewDefaults.linkExpiryDays);
        setExpiryPreset(expiryToPreset(data.interviewDefaults.linkExpiryDays));
        setReminderEnabled(data.interviewDefaults.reminderEnabled);
        setReminderDays(data.interviewDefaults.reminderDays);
        setDefaultLocale(data.interviewDefaults.defaultLocale);
      }
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  const expiryLabel = expiryPreset === "never"
    ? "Never expires"
    : expiryPreset === "custom"
    ? customExpiry ? `${customExpiry} days` : "—"
    : `${expiryPreset} days`;

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {/* Header */}
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Interview defaults</h2>
        <p className="text-xs text-gray-500 mt-0.5">Org-wide defaults applied to all new interview sessions. Individual interviews can still override these.</p>
      </div>

      {loadError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {saveError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{saveError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Link expiry */}
          <div className="px-6 py-5">
            <label className="text-sm font-medium text-gray-800 block mb-1">Default link expiry</label>
            <p className="text-xs text-gray-500 mb-3">How long interview links stay active after creation.</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={expiryPreset}
                onChange={(e) => handleExpiryPresetChange(e.target.value)}
                disabled={!isAdmin}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:opacity-60"
              >
                {EXPIRY_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              {expiryPreset === "custom" && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={customExpiry}
                    onChange={(e) => handleCustomExpiryChange(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="days"
                    className="w-20 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:opacity-60"
                  />
                  <span className="text-xs text-gray-500">days (1–3650)</span>
                </div>
              )}
            </div>
          </div>

          {/* Reminder emails */}
          <div className="px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-800 block mb-1">Reminder emails</label>
                <p className="text-xs text-gray-500">
                  Automatically remind recipients who haven&apos;t completed their interview.
                  {!reminderEnabled && <span className="italic"> Currently disabled.</span>}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={reminderEnabled}
                  onClick={() => setReminderEnabled((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:ring-offset-1 ${reminderEnabled ? "bg-gray-900" : "bg-gray-200"}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${reminderEnabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              )}
              {!isAdmin && (
                <div className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent opacity-60 ${reminderEnabled ? "bg-gray-900" : "bg-gray-200"}`}>
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${reminderEnabled ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              )}
            </div>
            {reminderEnabled && (
              <div className="mt-4 flex items-center gap-2">
                <label className="text-xs text-gray-600 shrink-0">Send reminder after</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={reminderDays}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (Number.isInteger(n) && n >= 1 && n <= 90) setReminderDays(n);
                  }}
                  disabled={!isAdmin}
                  className="w-16 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:opacity-60"
                />
                <span className="text-xs text-gray-500">days of inactivity</span>
              </div>
            )}
          </div>

          {/* Default locale */}
          <div className="px-6 py-5">
            <label className="text-sm font-medium text-gray-800 block mb-1">Default language</label>
            <p className="text-xs text-gray-500 mb-3">Language used for interview UI copy shown to recipients.</p>
            <select
              value={defaultLocale}
              onChange={(e) => setDefaultLocale(e.target.value)}
              disabled={!isAdmin}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:opacity-60"
            >
              {LOCALE_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Summary card */}
          <div className="px-6 py-5 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Current defaults</p>
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden text-xs divide-y divide-gray-100">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-gray-500">Link expiry</span>
                <span className="font-medium text-gray-800">{expiryLabel}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-gray-500">Reminders</span>
                <span className="font-medium text-gray-800">
                  {reminderEnabled ? `After ${reminderDays} day${reminderDays !== 1 ? "s" : ""}` : "Disabled"}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-gray-500">Language</span>
                <span className="font-medium text-gray-800">
                  {LOCALE_OPTIONS.find((l) => l.value === defaultLocale)?.label ?? defaultLocale}
                </span>
              </div>
            </div>
          </div>

          {/* Save */}
          {isAdmin && (
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                {saved && <span className="text-xs text-green-700 font-medium">Saved</span>}
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => { void handleSave(); }}
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
              >
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Email Customization Section ───────────────────────────────────────────────

interface EmailSettings {
  senderName:  string | null;
  replyTo:     string | null;
  footer:      string | null;
  senderEmail: string | null;
}

function EmailCustomizationSection({ getAuthHeaders, isAdmin }: { getAuthHeaders: () => HeadersInit; isAdmin: boolean }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [senderName, setSenderName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [footer, setFooter] = useState("");
  const [senderEmail, setSenderEmail] = useState("noreply@westhillscapital.com");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/email`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { email?: EmailSettings; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load email settings"); return; }
        if (data.email) {
          setSenderName(data.email.senderName ?? "");
          setReplyTo(data.email.replyTo ?? "");
          setFooter(data.email.footer ?? "");
          if (data.email.senderEmail) setSenderEmail(data.email.senderEmail);
        }
      })
      .catch(() => setLoadError("Failed to load email settings"))
      .finally(() => setIsLoading(false));
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/email`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({
          senderName: senderName.trim() || null,
          replyTo:    replyTo.trim()    || null,
          footer:     footer.trim()     || null,
        }),
      });
      const data = await res.json() as { email?: EmailSettings; error?: string };
      if (!res.ok) { setSaveError(data.error ?? "Failed to save email settings"); return; }
      if (data.email) {
        setSenderName(data.email.senderName ?? "");
        setReplyTo(data.email.replyTo ?? "");
        setFooter(data.email.footer ?? "");
      }
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch { setSaveError("Failed to save email settings."); }
    finally { setIsSaving(false); }
  }

  const previewFrom   = senderName.trim() || "Docuplete";
  const previewReplyTo = replyTo.trim() || null;
  const previewFooter  = footer.trim() || null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Email</h2>
        <p className="text-xs text-gray-500 mt-0.5">Customize how outbound emails appear to recipients.</p>
      </div>

      {loadError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className={`px-6 py-5 space-y-5 ${!isAdmin ? "pointer-events-none opacity-60" : ""}`}>
            {/* Sender display name */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Sender display name</label>
              <p className="text-xs text-gray-500 mb-2">Shown in the "From" field of all outbound emails. Leave blank to use the default.</p>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value.slice(0, 100))}
                placeholder="e.g. Acme Legal Team"
                maxLength={100}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900/20"
              />
              <p className="text-right text-[10px] text-gray-400 mt-1">{senderName.length}/100</p>
            </div>

            {/* Reply-to address */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Reply-to address</label>
              <p className="text-xs text-gray-500 mb-2">Where replies from clients are directed. Leave blank to use the default sender address.</p>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="e.g. team@acmelegal.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900/20"
              />
            </div>

            {/* Email footer */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Email footer</label>
              <p className="text-xs text-gray-500 mb-2">Plain-text message appended to all outbound emails. Max 500 characters.</p>
              <textarea
                rows={3}
                value={footer}
                onChange={(e) => setFooter(e.target.value.slice(0, 500))}
                placeholder="e.g. Questions? Reach us at support@acmelegal.com · 123 Main St, City, State"
                maxLength={500}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900/20 resize-none"
              />
              <p className="text-right text-[10px] text-gray-400 mt-1">{footer.length}/500</p>
            </div>

            {/* Custom sender domain note */}
            <div className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
              <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path d="M12 16v-4M12 8h.01" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-xs text-gray-500">
                Emails are sent via Docuplete&apos;s sending domain. Custom sender domains (e.g.{" "}
                <code className="font-mono text-gray-600">@yourdomain.com</code>) are available on the{" "}
                <span className="font-semibold text-amber-700">Enterprise</span> plan.
              </p>
            </div>
          </div>

          {/* Preview */}
          <div className="px-6 py-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Preview</p>
            <div className="rounded-lg border border-gray-200 overflow-hidden text-xs font-mono">
              <div className="bg-gray-50 px-4 py-3 space-y-1.5 border-b border-gray-200 font-sans">
                <div className="flex gap-2">
                  <span className="text-gray-400 w-16 shrink-0 text-right">From</span>
                  <span className="text-gray-900">{previewFrom} &lt;{senderEmail}&gt;</span>
                </div>
                {previewReplyTo && (
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-16 shrink-0 text-right">Reply-To</span>
                    <span className="text-gray-700">{previewReplyTo}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-gray-400 w-16 shrink-0 text-right">Subject</span>
                  <span className="text-gray-600 italic">Your document interview is ready</span>
                </div>
              </div>
              <div className="bg-white px-4 py-4 space-y-2">
                <div className="h-2 w-36 bg-gray-200 rounded" />
                <div className="h-2 w-full bg-gray-100 rounded" />
                <div className="h-2 w-5/6 bg-gray-100 rounded" />
                <div className="h-2 w-3/4 bg-gray-100 rounded" />
              </div>
              {previewFooter ? (
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-2.5 font-sans">
                  <p className="text-[11px] text-gray-500 leading-relaxed whitespace-pre-wrap">{previewFooter}</p>
                </div>
              ) : (
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-2.5 font-sans">
                  <p className="text-[11px] text-gray-400 italic">No footer set — add one above to see it here.</p>
                </div>
              )}
            </div>
          </div>

          {/* Save row */}
          {isAdmin && (
            <div className="px-6 py-4 flex items-center justify-between gap-4 bg-gray-50">
              <div className="flex-1">
                {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                {saved && !saveError && <p className="text-xs text-green-600">✓ Email settings saved</p>}
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => { void handleSave(); }}
                className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const RETENTION_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Keep forever", value: null },
  { label: "30 days",      value: 30 },
  { label: "90 days",      value: 90 },
  { label: "180 days",     value: 180 },
  { label: "1 year",       value: 365 },
  { label: "2 years",      value: 730 },
];

const DATE_FORMAT_OPTIONS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY  (e.g. 04/28/2026)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY  (e.g. 28/04/2026)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD  (e.g. 2026-04-28)" },
];

const ALL_TIMEZONES: string[] = (() => {
  try { return Intl.supportedValuesOf("timeZone"); }
  catch { return ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"]; }
})();

function TimezoneLocaleSection({
  getAuthHeaders,
  isAdmin,
}: {
  getAuthHeaders: () => HeadersInit;
  isAdmin: boolean;
}) {
  const [timezone,   setTimezone]   = useState("America/New_York");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [tzSearch,   setTzSearch]   = useState("");
  const [isSaving,   setIsSaving]   = useState(false);
  const [saveMsg,    setSaveMsg]    = useState<string | null>(null);
  const [loadErr,    setLoadErr]    = useState<string | null>(null);
  const [dirty,      setDirty]      = useState(false);

  useEffect(() => {
    const h = new Headers(getAuthHeaders());
    fetch(`${SETTINGS_BASE}/locale`, { headers: h })
      .then((r) => r.json())
      .then((d: { timezone?: string; dateFormat?: string; error?: string }) => {
        if (d.error) { setLoadErr(d.error); return; }
        if (d.timezone)   setTimezone(d.timezone);
        if (d.dateFormat) setDateFormat(d.dateFormat);
      })
      .catch(() => setLoadErr("Failed to load locale settings."));
  }, []);

  const filteredTz = tzSearch.trim()
    ? ALL_TIMEZONES.filter((tz) => tz.toLowerCase().includes(tzSearch.toLowerCase()))
    : ALL_TIMEZONES;


  const previewNow = new Date().toISOString();
  const previewDate = formatOrgDate(previewNow, { timezone, date_format: dateFormat });
  const previewDateTime = formatOrgDate(previewNow, { timezone, date_format: dateFormat }, true);

  async function handleSave() {
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const h = new Headers(getAuthHeaders());
      h.set("Content-Type", "application/json");
      const r = await fetch(`${SETTINGS_BASE}/locale`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ timezone, dateFormat: dateFormat }),
      });
      const d = await r.json() as { timezone?: string; dateFormat?: string; error?: string };
      if (!r.ok) { setSaveMsg(d.error ?? "Failed to save."); return; }
      const cached = getCachedProductOrg();
      if (cached) updateProductOrgCache({ ...cached, timezone, date_format: dateFormat });
      setSaveMsg("Saved!");
      setDirty(false);
    } catch {
      setSaveMsg("Failed to save.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Timezone &amp; Locale</h2>
      <p className="text-sm text-gray-500 mb-5">
        Set the timezone and date format used for all timestamps in this workspace.
      </p>

      {loadErr && (
        <p className="text-sm text-red-600 mb-4">{loadErr}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Timezone selector */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Timezone</label>
          <input
            type="text"
            placeholder="Search timezones…"
            value={tzSearch}
            onChange={(e) => setTzSearch(e.target.value)}
            disabled={!isAdmin}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 mb-1.5 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <div
            role="listbox"
            aria-label="Timezone"
            className={`h-36 overflow-y-auto rounded-lg border border-gray-300 bg-white focus:outline-none ${!isAdmin ? "opacity-60 pointer-events-none" : ""}`}
          >
            {filteredTz.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 italic">No timezones match.</p>
            ) : filteredTz.map((tz) => (
              <button
                key={tz}
                type="button"
                role="option"
                aria-selected={timezone === tz}
                disabled={!isAdmin}
                onClick={() => { setTimezone(tz); setDirty(true); setSaveMsg(null); }}
                className={`w-full text-left px-3 py-1 text-sm transition-colors ${timezone === tz ? "bg-gray-900 text-white font-medium" : "text-gray-800 hover:bg-gray-100"}`}
              >
                {tz.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Selected: <span className="font-mono font-medium text-gray-600">{timezone}</span></p>
        </div>

        {/* Date format selector */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Date Format</label>
          <div className="flex flex-col gap-2">
            {DATE_FORMAT_OPTIONS.map((opt) => (
              <label key={opt.value} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${dateFormat === opt.value ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white hover:bg-gray-50"} ${!isAdmin ? "pointer-events-none opacity-60" : ""}`}>
                <input
                  type="radio"
                  name="dateFormat"
                  value={opt.value}
                  checked={dateFormat === opt.value}
                  disabled={!isAdmin}
                  onChange={() => { setDateFormat(opt.value); setDirty(true); setSaveMsg(null); }}
                  className="accent-gray-900"
                />
                <span className="text-sm text-gray-700 font-mono">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-4 mb-5">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">Preview</p>
        <div className="flex flex-wrap gap-x-8 gap-y-1.5 text-sm text-gray-800">
          <span><span className="text-gray-500 mr-1.5">Date:</span><span className="font-mono">{previewDate}</span></span>
          <span><span className="text-gray-500 mr-1.5">Date &amp; Time:</span><span className="font-mono">{previewDateTime}</span></span>
          <span><span className="text-gray-500 mr-1.5">Timezone:</span><span className="font-mono">{timezone}</span></span>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSaving || !dirty}
            onClick={() => { void handleSave(); }}
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
          {saveMsg && (
            <span className={`text-sm font-medium ${saveMsg === "Saved!" ? "text-green-600" : "text-red-600"}`}>
              {saveMsg}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DataPrivacySection({
  getAuthHeaders,
  isAdmin,
  orgName,
}: {
  getAuthHeaders: () => HeadersInit;
  isAdmin: boolean;
  orgName: string;
}) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [isLoading,           setIsLoading]           = useState(true);
  const [loadError,           setLoadError]           = useState<string | null>(null);
  const [retentionDays,       setRetentionDays]       = useState<number | null>(null);
  const [pendingRetention,    setPendingRetention]    = useState<number | null>(null);
  const [retentionInitialised, setRetentionInitialised] = useState(false);
  const [deletionRequestedAt, setDeletionRequestedAt] = useState<string | null>(null);
  const [deletionRequestedBy, setDeletionRequestedBy] = useState<string | null>(null);

  const [isExporting,    setIsExporting]    = useState(false);
  const [exportSuccess,  setExportSuccess]  = useState(false);
  const [exportError,    setExportError]    = useState<string | null>(null);

  const [isSavingRetention, setIsSavingRetention] = useState(false);
  const [retentionSaved,    setRetentionSaved]    = useState(false);
  const [retentionError,    setRetentionError]    = useState<string | null>(null);

  const [showDeleteDialog, setShowDeleteDialog]   = useState(false);
  const [confirmNameInput, setConfirmNameInput]   = useState("");
  const [isDeleting,       setIsDeleting]         = useState(false);
  const [deleteError,      setDeleteError]        = useState<string | null>(null);
  const [isCancelling,     setIsCancelling]       = useState(false);

  function loadSettings() {
    setIsLoading(true);
    setLoadError(null);
    fetch(`${SETTINGS_BASE}/data-privacy`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as {
          submissionRetentionDays?: number | null;
          deletionRequestedAt?: string | null;
          deletionRequestedBy?: string | null;
          error?: string;
        };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load data & privacy settings"); return; }
        setRetentionDays(data.submissionRetentionDays ?? null);
        setPendingRetention(data.submissionRetentionDays ?? null);
        setRetentionInitialised(true);
        setDeletionRequestedAt(data.deletionRequestedAt ?? null);
        setDeletionRequestedBy(data.deletionRequestedBy ?? null);
      })
      .catch(() => setLoadError("Failed to load data & privacy settings"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { loadSettings(); }, []);

  async function handleRequestExport() {
    setIsExporting(true);
    setExportSuccess(false);
    setExportError(null);
    try {
      const res  = await fetch(`${SETTINGS_BASE}/data/request-export`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "{}",
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { setExportError(data.error ?? "Failed to request export."); return; }
      setExportSuccess(true);
    } catch { setExportError("Failed to request export."); }
    finally   { setIsExporting(false); }
  }

  async function handleSaveRetention() {
    setIsSavingRetention(true);
    setRetentionSaved(false);
    setRetentionError(null);
    try {
      const res  = await fetch(`${SETTINGS_BASE}/data-privacy`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ submissionRetentionDays: pendingRetention }),
      });
      const data = await res.json() as { submissionRetentionDays?: number | null; error?: string };
      if (!res.ok) { setRetentionError(data.error ?? "Failed to save retention setting."); return; }
      setRetentionDays(data.submissionRetentionDays ?? null);
      setRetentionSaved(true);
      setTimeout(() => setRetentionSaved(false), 3000);
    } catch { setRetentionError("Failed to save retention setting."); }
    finally   { setIsSavingRetention(false); }
  }

  async function handleRequestDeletion() {
    if (confirmNameInput.trim() !== orgName.trim()) {
      setDeleteError(`Type your organization name exactly: "${orgName}"`);
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res  = await fetch(`${SETTINGS_BASE}/data/request-deletion`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ confirmName: confirmNameInput.trim() }),
      });
      const data = await res.json() as { deletionRequestedAt?: string; deletionRequestedBy?: string; error?: string };
      if (!res.ok) { setDeleteError(data.error ?? "Failed to request account deletion."); return; }
      setDeletionRequestedAt(data.deletionRequestedAt ?? new Date().toISOString());
      setDeletionRequestedBy(data.deletionRequestedBy ?? null);
      setShowDeleteDialog(false);
      setConfirmNameInput("");
    } catch { setDeleteError("Failed to request account deletion."); }
    finally   { setIsDeleting(false); }
  }

  async function handleCancelDeletion() {
    setIsCancelling(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/data/cancel-deletion`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        setDeletionRequestedAt(null);
        setDeletionRequestedBy(null);
      }
    } catch { /* ignore */ }
    finally { setIsCancelling(false); }
  }

  const retentionChanged = retentionInitialised && pendingRetention !== retentionDays;
  const graceEnd = deletionRequestedAt
    ? new Date(new Date(deletionRequestedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <>
      <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {/* Header */}
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Data &amp; Privacy</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage your organization&apos;s data, retention, and account lifecycle.
          </p>
        </div>

        {/* Privacy summary */}
        <div className="px-6 py-4">
          <p className="text-sm font-medium text-gray-900 mb-1">Privacy</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Docuplete processes document interview responses on your behalf. Your data is stored securely,
            never sold, and only accessed by Docuplete staff to provide support or comply with legal obligations.{" "}
            <a
              href="https://docuplete.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              Read our Privacy Policy →
            </a>
          </p>
        </div>

        {isLoading ? (
          <div className="px-6 py-6 flex justify-center">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="px-6 py-4">
            <p className="text-xs text-red-700">{loadError}</p>
          </div>
        ) : (
          <>
            {/* Data export */}
            <div className="px-6 py-4">
              <p className="text-sm font-medium text-gray-900 mb-1">Data export</p>
              <p className="text-xs text-gray-500 mb-3">
                Export all your organization&apos;s data — packages, submissions, team members, and settings — as a
                ZIP archive. You&apos;ll receive the download link by email within a few minutes.
              </p>
              {exportError   && <p className="mb-2 text-xs text-red-700">{exportError}</p>}
              {exportSuccess && (
                <p className="mb-2 text-xs text-green-700">
                  Export requested! Check your email — your data file will arrive shortly.
                </p>
              )}
              {isAdmin ? (
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => { void handleRequestExport(); }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                >
                  {isExporting ? "Requesting…" : "Request data export"}
                </button>
              ) : (
                <p className="text-xs text-gray-400 italic">Only admins can request a data export.</p>
              )}
            </div>

            {/* Submission retention */}
            <div className="px-6 py-4">
              <p className="text-sm font-medium text-gray-900 mb-1">Submission retention</p>
              <p className="text-xs text-gray-500 mb-3">
                Automatically delete submission records after a set period. Deleted submissions cannot be recovered.
              </p>
              {retentionError && <p className="mb-2 text-xs text-red-700">{retentionError}</p>}
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={pendingRetention === null ? "null" : String(pendingRetention)}
                  disabled={!isAdmin}
                  onChange={(e) => setPendingRetention(e.target.value === "null" ? null : Number(e.target.value))}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:opacity-60"
                >
                  {RETENTION_OPTIONS.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </select>
                {isAdmin && retentionChanged && (
                  <button
                    type="button"
                    disabled={isSavingRetention}
                    onClick={() => { void handleSaveRetention(); }}
                    className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
                  >
                    {isSavingRetention ? "Saving…" : "Save"}
                  </button>
                )}
                {retentionSaved && <span className="text-xs text-green-700">Saved</span>}
              </div>
              {!isAdmin && <p className="mt-2 text-xs text-gray-400 italic">Only admins can change the retention period.</p>}
            </div>

            {/* Account deletion — admin only */}
            {isAdmin && (
              <div className="px-6 py-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Delete account</p>
                {deletionRequestedAt ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-semibold text-red-800 mb-1">Account deletion scheduled</p>
                    <p className="text-xs text-red-700 mb-3 leading-relaxed">
                      Deletion was requested by{" "}
                      <span className="font-medium">{deletionRequestedBy ?? "an admin"}</span>{" "}
                      on {formatDate(deletionRequestedAt)}.
                      {graceEnd && (
                        <>
                          {" "}Your account and all its data will be permanently deleted on{" "}
                          <span className="font-medium">{formatDate(graceEnd.toISOString())}</span>{" "}
                          unless you cancel.
                        </>
                      )}
                    </p>
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={() => { void handleCancelDeletion(); }}
                      className="rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors"
                    >
                      {isCancelling ? "Cancelling…" : "Cancel deletion"}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                      Permanently delete your organization account, including all packages, submissions, team members,
                      and settings. You have a 7-day grace period to cancel before the deletion is irreversible.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowDeleteDialog(true)}
                      className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete account…
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Deletion confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Delete account</h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              This will permanently delete your organization including all packages, submissions, and team members.
              You will have a <strong>7-day window</strong> to cancel before deletion is irreversible.
            </p>
            <p className="text-xs font-medium text-gray-700 mb-1">
              Type your organization name to confirm:{" "}
              <span className="font-mono text-gray-900">{orgName}</span>
            </p>
            <input
              type="text"
              value={confirmNameInput}
              onChange={(e) => { setConfirmNameInput(e.target.value); setDeleteError(null); }}
              placeholder={orgName}
              autoFocus
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-red-400 mb-2"
            />
            {deleteError && <p className="text-xs text-red-700 mb-2">{deleteError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setShowDeleteDialog(false); setConfirmNameInput(""); setDeleteError(null); }}
                className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || confirmNameInput.trim() !== orgName.trim()}
                onClick={() => { void handleRequestDeletion(); }}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? "Requesting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface UserProfile {
  id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  pending_email: string | null;
}

interface TwoFAStatus {
  enabled: boolean;
  backupCodesRemaining: number;
}

interface TrustedDevice {
  id: number;
  label: string;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

interface ActiveSession {
  id: number;
  isCurrent: boolean;
  browser: string;
  os: string;
  device: string;
  ipAddress: string | null;
  location: string | null;
  lastActiveAt: string;
  createdAt: string;
}

interface LoginEntry {
  id: number;
  browser: string;
  os: string;
  device: string;
  ipAddress: string | null;
  location: string | null;
  createdAt: string;
}

function SecuritySection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const { user } = useUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signOutOtherDevices, setSignOutOtherDevices] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const passwordSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [spNew, setSpNew] = useState("");
  const [spConfirm, setSpConfirm] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [spError, setSpError] = useState<string | null>(null);
  const [spSaved, setSpSaved] = useState(false);
  const spSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (passwordSavedTimer.current) clearTimeout(passwordSavedTimer.current);
      if (spSavedTimer.current) clearTimeout(spSavedTimer.current);
    };
  }, []);

  async function handleSetPassword() {
    if (!user) return;
    if (spNew !== spConfirm) {
      setSpError("Passwords do not match.");
      return;
    }
    if (spNew.length < 8) {
      setSpError("Password must be at least 8 characters.");
      return;
    }
    setIsSettingPassword(true);
    setSpError(null);
    setSpSaved(false);
    try {
      await user.updatePassword({ newPassword: spNew });
      await user.reload();
      setSpNew("");
      setSpConfirm("");
      setSpSaved(true);
      if (spSavedTimer.current) clearTimeout(spSavedTimer.current);
      spSavedTimer.current = setTimeout(() => setSpSaved(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to set password.";
      setSpError(msg);
    } finally {
      setIsSettingPassword(false);
    }
  }

  async function handlePasswordChange() {
    if (!user) return;
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await user.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: signOutOtherDevices });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSignOutOtherDevices(false);
      setPasswordSaved(true);
      if (passwordSavedTimer.current) clearTimeout(passwordSavedTimer.current);
      passwordSavedTimer.current = setTimeout(() => setPasswordSaved(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      setPasswordError(msg);
    } finally {
      setIsSavingPassword(false);
    }
  }

  const [twoFA, setTwoFA] = useState<TwoFAStatus | null>(null);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [revokingDeviceId, setRevokingDeviceId] = useState<number | null>(null);
  const [revokeDeviceError, setRevokeDeviceError] = useState<string | null>(null);

  const [setupStep, setSetupStep] = useState<"idle" | "scan" | "verify" | "codes">("idle");
  const [setupQr, setSetupQr] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [disableStep, setDisableStep] = useState<"idle" | "confirm">("idle");
  const [disableCode, setDisableCode] = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableBusy, setDisableBusy] = useState(false);

  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      fetch(`${SETTINGS_BASE}/security/2fa/status`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${SETTINGS_BASE}/security/sessions`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${SETTINGS_BASE}/security/login-history`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${SETTINGS_BASE}/security/trusted-devices`, { headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([fa, sess, hist, devices]) => {
        const faData      = fa as { enabled?: boolean; backupCodesRemaining?: number; error?: string };
        const sessData    = sess as { sessions?: ActiveSession[]; error?: string };
        const histData    = hist as { history?: LoginEntry[]; error?: string };
        const devicesData = devices as { trustedDevices?: TrustedDevice[]; error?: string };
        const firstError = faData.error ?? sessData.error ?? histData.error ?? devicesData.error;
        if (firstError) { setLoadError(firstError); return; }
        setTwoFA({ enabled: faData.enabled ?? false, backupCodesRemaining: faData.backupCodesRemaining ?? 0 });
        setSessions(sessData.sessions ?? []);
        setLoginHistory(histData.history ?? []);
        setTrustedDevices(devicesData.trustedDevices ?? []);
      })
      .catch(() => setLoadError("Failed to load security info"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleStartSetup() {
    setSetupBusy(true);
    setSetupError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/security/2fa/setup`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "{}",
      });
      const data = await res.json() as { qrCode?: string; secret?: string; error?: string };
      if (!res.ok) { setSetupError(data.error ?? "Failed to start 2FA setup"); return; }
      setSetupQr(data.qrCode ?? null);
      setSetupSecret(data.secret ?? null);
      setSetupStep("scan");
    } catch { setSetupError("Failed to start 2FA setup"); }
    finally { setSetupBusy(false); }
  }

  async function handleVerifyEnable() {
    if (!setupCode.trim()) { setSetupError("Enter the 6-digit code from your authenticator app."); return; }
    setSetupBusy(true);
    setSetupError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/security/2fa/enable`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ code: setupCode }),
      });
      const data = await res.json() as { success?: boolean; backupCodes?: string[]; error?: string };
      if (!res.ok) { setSetupError(data.error ?? "Invalid code"); return; }
      setBackupCodes(data.backupCodes ?? []);
      setSetupStep("codes");
      setTwoFA({ enabled: true, backupCodesRemaining: data.backupCodes?.length ?? 8 });
    } catch { setSetupError("Failed to enable 2FA"); }
    finally { setSetupBusy(false); }
  }

  async function handleDisable() {
    if (!disableCode.trim()) { setDisableError("Enter a 6-digit code or backup code to confirm."); return; }
    setDisableBusy(true);
    setDisableError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/security/2fa`, {
        method: "DELETE",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { setDisableError(data.error ?? "Failed to disable 2FA"); return; }
      setTwoFA({ enabled: false, backupCodesRemaining: 0 });
      setDisableStep("idle");
      setDisableCode("");
    } catch { setDisableError("Failed to disable 2FA"); }
    finally { setDisableBusy(false); }
  }

  async function handleRevokeSession(sessionId: number) {
    setRevokingId(sessionId);
    setRevokeError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/security/sessions/${sessionId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { setRevokeError(data.error ?? "Failed to revoke session"); return; }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch { setRevokeError("Failed to revoke session"); }
    finally { setRevokingId(null); }
  }

  async function handleRevokeTrustedDevice(deviceId: number) {
    setRevokingDeviceId(deviceId);
    setRevokeDeviceError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/security/trusted-devices/${deviceId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { setRevokeDeviceError(data.error ?? "Failed to revoke trusted device"); return; }
      setTrustedDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch { setRevokeDeviceError("Failed to revoke trusted device"); }
    finally { setRevokingDeviceId(null); }
  }

  function deviceIcon(device: string) {
    if (device === "Mobile") {
      return (
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
      </svg>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Security</h2>
        <p className="text-xs text-gray-500 mt-0.5">Manage two-factor authentication, active sessions, and login history.</p>
      </div>

      {loadError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Two-Factor Authentication ─────────────────────────────────────── */}
          <div className="px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Two-factor authentication</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add a second layer of security using an authenticator app like Google Authenticator or Authy.
                </p>
                {twoFA?.enabled && (
                  <p className="text-xs text-green-700 mt-1 font-medium">
                    ✓ Enabled — {twoFA.backupCodesRemaining} backup code{twoFA.backupCodesRemaining !== 1 ? "s" : ""} remaining
                  </p>
                )}
              </div>
              {twoFA?.enabled ? (
                <button
                  type="button"
                  onClick={() => { setDisableStep("confirm"); setDisableCode(""); setDisableError(null); }}
                  className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                >
                  Disable 2FA
                </button>
              ) : (
                <button
                  type="button"
                  disabled={setupBusy || setupStep !== "idle"}
                  onClick={() => { void handleStartSetup(); }}
                  className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
                >
                  {setupBusy ? "Loading…" : "Enable 2FA"}
                </button>
              )}
            </div>

            {/* Setup flow — scan QR */}
            {setupStep === "scan" && setupQr && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-900">Step 1 — Scan this QR code</p>
                <p className="text-xs text-gray-500">Open your authenticator app and scan the code below, or enter the setup key manually.</p>
                <div className="flex justify-center">
                  <img src={setupQr} alt="TOTP QR code" className="w-40 h-40 rounded-lg border border-gray-200" />
                </div>
                {setupSecret && (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-1">Setup key (manual entry)</p>
                    <p className="text-xs font-mono text-gray-700 select-all break-all">{setupSecret}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSetupStep("verify")}
                    className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
                  >
                    Next — Enter code
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSetupStep("idle"); setSetupQr(null); setSetupSecret(null); setSetupError(null); }}
                    className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Setup flow — verify code */}
            {setupStep === "verify" && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-900">Step 2 — Verify the code</p>
                <p className="text-xs text-gray-500">Enter the 6-digit code from your authenticator app to confirm setup.</p>
                {setupError && <p className="text-xs text-red-600">{setupError}</p>}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleVerifyEnable(); }}
                    placeholder="123456"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 w-32"
                  />
                  <button
                    type="button"
                    disabled={setupBusy}
                    onClick={() => { void handleVerifyEnable(); }}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
                  >
                    {setupBusy ? "Verifying…" : "Enable 2FA"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSetupStep("scan"); setSetupCode(""); setSetupError(null); }}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Setup flow — backup codes */}
            {setupStep === "codes" && backupCodes.length > 0 && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-green-900">2FA is now enabled</p>
                <p className="text-xs text-green-700">Save these backup codes in a safe place. Each code can be used once if you lose access to your authenticator app.</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {backupCodes.map((code) => (
                    <span key={code} className="rounded bg-white border border-green-200 px-2 py-1 text-xs font-mono text-gray-800 text-center">{code}</span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setSetupStep("idle"); setSetupCode(""); setSetupQr(null); setSetupSecret(null); setBackupCodes([]); }}
                  className="rounded-lg bg-green-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-900 transition-colors"
                >
                  Done — I've saved my codes
                </button>
              </div>
            )}

            {/* Disable flow */}
            {disableStep === "confirm" && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-sm font-medium text-red-900">Disable two-factor authentication</p>
                <p className="text-xs text-red-700">Enter a 6-digit code from your authenticator app, or one of your backup codes, to confirm.</p>
                {disableError && <p className="text-xs text-red-600 font-medium">{disableError}</p>}
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleDisable(); }}
                    placeholder="123456 or backup code"
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400/20 w-48"
                  />
                  <button
                    type="button"
                    disabled={disableBusy}
                    onClick={() => { void handleDisable(); }}
                    className="rounded-lg bg-red-700 px-4 py-2 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60 transition-colors"
                  >
                    {disableBusy ? "Disabling…" : "Confirm disable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDisableStep("idle"); setDisableCode(""); setDisableError(null); }}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Trusted Devices ───────────────────────────────────────────────── */}
          {twoFA?.enabled && (
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-900">Trusted devices</p>
                <span className="text-xs text-gray-400">{trustedDevices.length === 0 ? "None" : `${trustedDevices.length} active`}</span>
              </div>
              {revokeDeviceError && (
                <p className="text-xs text-red-600 mb-2">{revokeDeviceError}</p>
              )}
              {trustedDevices.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No trusted devices. Check "Remember this device for 30 days" when verifying 2FA to skip the prompt on trusted machines.</p>
              ) : (
                <ul className="space-y-2">
                  {trustedDevices.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{d.label || "Unknown device"}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {d.ipAddress ?? "Unknown IP"} · Trusted {formatRelative(d.createdAt)} · Expires {formatRelative(d.expiresAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={revokingDeviceId === d.id}
                        onClick={() => { void handleRevokeTrustedDevice(d.id); }}
                        className="shrink-0 text-[11px] font-medium text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                      >
                        {revokingDeviceId === d.id ? "Revoking…" : "Revoke"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── Active Sessions ───────────────────────────────────────────────── */}
          <div className="px-6 py-5">
            <p className="text-sm font-medium text-gray-900 mb-3">Active sessions</p>
            {revokeError && (
              <p className="text-xs text-red-600 mb-2">{revokeError}</p>
            )}
            {sessions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No active sessions recorded yet. Sessions appear here after your next page load.</p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${s.isCurrent ? "border-gray-900 bg-gray-50" : "border-gray-100 bg-white"}`}>
                    {deviceIcon(s.device)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {s.browser} on {s.os}
                        {s.isCurrent && <span className="ml-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Current</span>}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {s.ipAddress ?? "Unknown IP"}{s.location ? ` · ${s.location}` : ""} · Last active {formatRelative(s.lastActiveAt)}
                      </p>
                    </div>
                    {!s.isCurrent && (
                      <button
                        type="button"
                        disabled={revokingId === s.id}
                        onClick={() => { void handleRevokeSession(s.id); }}
                        className="shrink-0 text-[11px] font-medium text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                      >
                        {revokingId === s.id ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Login History ─────────────────────────────────────────────────── */}
          <div className="px-6 py-5">
            <p className="text-sm font-medium text-gray-900 mb-3">Recent login history</p>
            {loginHistory.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No login history recorded yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {loginHistory.slice(0, 10).map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5">
                    {deviceIcon(entry.device)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{entry.browser} on {entry.os}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {entry.ipAddress ?? "Unknown IP"}{entry.location ? ` · ${entry.location}` : ""} · {formatRelative(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Change Password ───────────────────────────────────────────────── */}
          <div className="px-6 py-5">
            <p className="text-sm font-medium text-gray-900 mb-0.5">{user?.passwordEnabled === false ? "Set a password" : "Change password"}</p>
            {user?.passwordEnabled === false ? (
              <div className="mt-3 space-y-3 max-w-sm">
                <p className="text-xs text-gray-500">
                  Your account uses social sign-in. You can add a password to also sign in with your email.
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="sp-new-pw">New password</label>
                  <input
                    id="sp-new-pw"
                    type="password"
                    autoComplete="new-password"
                    value={spNew}
                    onChange={(e) => { setSpNew(e.target.value); setSpError(null); setSpSaved(false); }}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="sp-confirm-pw">Confirm password</label>
                  <input
                    id="sp-confirm-pw"
                    type="password"
                    autoComplete="new-password"
                    value={spConfirm}
                    onChange={(e) => { setSpConfirm(e.target.value); setSpError(null); setSpSaved(false); }}
                    placeholder="••••••••"
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSetPassword(); }}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                  />
                </div>
                {spError && <p className="text-xs text-red-600">{spError}</p>}
                {spSaved && <p className="text-xs text-green-600">Password set successfully.</p>}
                <button
                  type="button"
                  disabled={isSettingPassword || !spNew || !spConfirm}
                  onClick={() => { void handleSetPassword(); }}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {isSettingPassword ? "Setting…" : "Set password"}
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3 max-w-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="sec-cur-pw">Current password</label>
                  <input
                    id="sec-cur-pw"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(null); setPasswordSaved(false); }}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="sec-new-pw">New password</label>
                  <input
                    id="sec-new-pw"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); setPasswordSaved(false); }}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="sec-confirm-pw">Confirm new password</label>
                  <input
                    id="sec-confirm-pw"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null); setPasswordSaved(false); }}
                    placeholder="••••••••"
                    onKeyDown={(e) => { if (e.key === "Enter") void handlePasswordChange(); }}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                  />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={signOutOtherDevices}
                    onChange={(e) => setSignOutOtherDevices(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20"
                  />
                  <span className="text-xs text-gray-600">Sign out all other devices</span>
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword}
                    onClick={() => { void handlePasswordChange(); }}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
                  >
                    {isSavingPassword ? "Updating…" : "Update password"}
                  </button>
                  {passwordSaved && <span className="text-xs text-green-600 font-medium">✓ Password updated</span>}
                  {passwordError && <span className="text-xs text-red-600">{passwordError}</span>}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ProfileSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [emailDeliveryFailed, setEmailDeliveryFailed] = useState(false);

  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSaved, setAvatarSaved] = useState(false);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const nameSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nameEdited = useRef(false);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameSaveSeq = useRef(0);

  function applyProfile(p: UserProfile) {
    setProfile(p);
    if (!nameEdited.current) setDisplayName(p.display_name ?? "");
    setEmail(p.email);
  }

  function flashSaved(field: "name" | "email" | "avatar") {
    if (field === "name") {
      setNameSaved(true);
      if (nameSavedTimer.current) clearTimeout(nameSavedTimer.current);
      nameSavedTimer.current = setTimeout(() => setNameSaved(false), 3000);
    } else if (field === "email") {
      setEmailSaved(true);
      if (emailSavedTimer.current) clearTimeout(emailSavedTimer.current);
      emailSavedTimer.current = setTimeout(() => setEmailSaved(false), 3000);
    } else {
      setAvatarSaved(true);
      if (avatarSavedTimer.current) clearTimeout(avatarSavedTimer.current);
      avatarSavedTimer.current = setTimeout(() => setAvatarSaved(false), 3000);
    }
  }

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/profile`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { profile?: UserProfile; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load profile"); return; }
        if (data.profile) applyProfile(data.profile);
      })
      .catch(() => setLoadError("Failed to load profile"))
      .finally(() => setIsLoading(false));

    return () => {
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
      if (nameSavedTimer.current) clearTimeout(nameSavedTimer.current);
      if (emailSavedTimer.current) clearTimeout(emailSavedTimer.current);
      if (avatarSavedTimer.current) clearTimeout(avatarSavedTimer.current);
    };
  }, []);

  async function handleDisplayNameSave() {
    if (!nameEdited.current || !profile) return;
    setNameError(null);
    const seq = ++nameSaveSeq.current;
    setIsSavingName(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/profile`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ display_name: displayName }),
      });
      const data = await res.json() as { profile?: UserProfile; error?: string };
      if (seq !== nameSaveSeq.current) return;
      if (!res.ok) { setNameError(data.error ?? "Failed to save name"); return; }
      if (data.profile) { nameEdited.current = false; applyProfile(data.profile); }
      flashSaved("name");
    } catch { if (seq === nameSaveSeq.current) setNameError("Failed to save name."); }
    finally { if (seq === nameSaveSeq.current) setIsSavingName(false); }
  }

  async function handleEmailSave() {
    if (!profile) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    // If the typed value equals the current confirmed email and no pending change
    // is active, there is nothing to do. If a pending change is active but the typed
    // value still equals the confirmed email, also bail — the user hasn't typed a
    // new address, so submitting would just re-trigger state unnecessarily.
    if (trimmed === profile.email.toLowerCase()) {
      setEmailError(null);
      return;
    }
    setEmailError(null);
    setEmailVerificationSent(false);
    setEmailDeliveryFailed(false);
    setIsSavingEmail(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/profile`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json() as { profile?: UserProfile; email_verification_sent?: boolean; error?: string };
      if (!res.ok) { setEmailError(data.error ?? "Failed to request email change."); return; }
      if (data.profile) applyProfile(data.profile);
      if (data.email_verification_sent) {
        setEmailVerificationSent(true);
      } else if (data.profile?.pending_email) {
        // Email change staged in DB but delivery failed (e.g. email service not configured).
        setEmailDeliveryFailed(true);
      } else {
        flashSaved("email");
      }
    } catch { setEmailError("Failed to request email change."); }
    finally { setIsSavingEmail(false); }
  }

  async function uploadAvatarFile(file: File) {
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setAvatarError("Please upload a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Avatar must be under 5 MB.");
      return;
    }
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/profile/avatar`, {
        method: "POST",
        headers: { "Content-Type": file.type, ...getAuthHeaders() },
        body: file,
      });
      const data = await res.json() as { profile?: UserProfile; error?: string };
      if (!res.ok) { setAvatarError(data.error ?? "Avatar upload failed."); return; }
      if (data.profile) applyProfile(data.profile);
      flashSaved("avatar");
      window.dispatchEvent(new CustomEvent("docuplete:profile-updated"));
    } catch { setAvatarError("Avatar upload failed. Please try again."); }
    finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/profile/avatar`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json() as { profile?: UserProfile; error?: string };
      if (!res.ok) { setAvatarError(data.error ?? "Failed to remove avatar."); return; }
      if (data.profile) applyProfile(data.profile);
      flashSaved("avatar");
      window.dispatchEvent(new CustomEvent("docuplete:profile-updated"));
    } catch { setAvatarError("Failed to remove avatar."); }
    finally { setIsUploadingAvatar(false); }
  }

  async function handleCancelPendingEmail() {
    if (!profile) return;
    setIsSavingEmail(true);
    setEmailVerificationSent(false);
    setEmailDeliveryFailed(false);
    try {
      const res = await fetch(`${SETTINGS_BASE}/profile`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ cancel_pending_email: true }),
      });
      const data = await res.json() as { profile?: UserProfile; error?: string };
      if (!res.ok) return;
      if (data.profile) applyProfile(data.profile);
    } catch { /* noop */ }
    finally { setIsSavingEmail(false); }
  }

  const avatarUrl = profile?.avatar_url ? `${API_BASE}${profile.avatar_url}` : null;
  const initials = ((profile?.display_name ?? profile?.email) || "?").charAt(0).toUpperCase();

  // Handle email verification token from URL (user clicked link in verification email).
  // Lives here so applyProfile() is in scope.
  const [emailVerifiedMsg, setEmailVerifiedMsg] = useState<string | null>(null);
  const [emailVerifyError, setEmailVerifyError] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("verify_email");
    if (!token) return;
    // Don't strip the token from the URL until we get a terminal result, so the user
    // can retry by refreshing if auth isn't ready yet or the network request fails.
    fetch(`${SETTINGS_BASE}/profile/verify-email?token=${encodeURIComponent(token)}`, {
      headers: { ...getAuthHeaders() },
    })
      .then(async (r) => {
        window.history.replaceState({}, "", window.location.pathname);
        const data = await r.json() as { success?: boolean; profile?: UserProfile; error?: string };
        if (!r.ok) { setEmailVerifyError(data.error ?? "Email verification failed."); return; }
        if (data.profile) applyProfile(data.profile);
        setEmailVerifiedMsg(`Your email has been updated to ${data.profile?.email ?? "your new address"}.`);
      })
      .catch(() => {
        setEmailVerifyError("Email verification failed. Please try again.");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="profile-section" className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Profile</h2>
        <p className="text-xs text-gray-500 mt-0.5">Your personal display name, email, and avatar.</p>
      </div>

      {emailVerifiedMsg && (
        <div className="px-6 py-3 rounded-lg border border-green-200 bg-green-50 mx-4 mt-3 flex items-start gap-2 text-sm text-green-700">
          <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {emailVerifiedMsg}
        </div>
      )}

      {emailVerifyError && (
        <div className="px-6 py-3 mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{emailVerifyError}</div>
      )}

      {loadError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : profile ? (
        <>
          {/* Avatar */}
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-44 shrink-0 pt-0.5">
              <label className="text-sm font-medium text-gray-900">Photo</label>
              <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, or WebP · max 5 MB</p>
              {avatarSaved && <span className="text-[11px] text-green-600 font-medium mt-1 block">✓ Saved</span>}
              {avatarError && <span className="text-[11px] text-red-600 mt-1 block">{avatarError}</span>}
            </div>
            <div className="flex items-center gap-4">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatarFile(f); }}
              />
              {/* Avatar circle */}
              <div
                role="button"
                tabIndex={0}
                aria-label={avatarUrl ? "Click to replace photo" : "Click to upload photo"}
                onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !isUploadingAvatar) avatarInputRef.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingAvatar(true); }}
                onDragLeave={() => setIsDraggingAvatar(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingAvatar(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void uploadAvatarFile(f);
                }}
                className={[
                  "relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center cursor-pointer select-none border-2 transition-colors",
                  isDraggingAvatar ? "border-gray-900" : "border-gray-200 hover:border-gray-400",
                  "bg-gray-100",
                ].join(" ")}
              >
                {isUploadingAvatar ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-gray-500">{initials}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  disabled={isUploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                >
                  {avatarUrl ? "Replace" : "Upload photo"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    disabled={isUploadingAvatar}
                    onClick={() => { void handleRemoveAvatar(); }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Display name */}
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-44 shrink-0 pt-0.5">
              <label className="text-sm font-medium text-gray-900" htmlFor="profile-display-name">Display name</label>
              <p className="text-xs text-gray-400 mt-0.5">Shown to teammates</p>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  id="profile-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => { nameEdited.current = true; setDisplayName(e.target.value); setNameError(null); setNameSaved(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleDisplayNameSave(); }}
                  placeholder="Your name"
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                />
                <button
                  type="button"
                  disabled={isSavingName || !nameEdited.current}
                  onClick={() => { void handleDisplayNameSave(); }}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  {isSavingName ? "Saving…" : "Save"}
                </button>
              </div>
              {nameError ? (
                <span className="text-[11px] text-red-600">{nameError}</span>
              ) : nameSaved ? (
                <span className="text-[11px] text-green-600 font-medium">✓ Saved</span>
              ) : null}
            </div>
          </div>

          {/* Email */}
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-44 shrink-0 pt-0.5">
              <label className="text-sm font-medium text-gray-900" htmlFor="profile-email">Email address</label>
              <p className="text-xs text-gray-400 mt-0.5">Used to sign in</p>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null); setEmailSaved(false); setEmailVerificationSent(false); setEmailDeliveryFailed(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleEmailSave(); }}
                  placeholder="you@company.com"
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                />
                <button
                  type="button"
                  disabled={isSavingEmail || email.trim().toLowerCase() === profile.email.toLowerCase()}
                  onClick={() => { void handleEmailSave(); }}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  {isSavingEmail ? "Saving…" : "Save"}
                </button>
              </div>

              {emailError && <span className="text-[11px] text-red-600">{emailError}</span>}
              {emailSaved && <span className="text-[11px] text-green-600 font-medium">✓ Email updated</span>}

              {/* Pending email verification notice */}
              {profile.pending_email && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-amber-800 font-medium">Verification pending</p>
                    {emailDeliveryFailed ? (
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Change staged for <strong>{profile.pending_email}</strong>, but the verification email could not be delivered.
                        Please try again or contact your team admin.
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Click the link in the verification email sent to <strong>{profile.pending_email}</strong> to confirm the change.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { void handleCancelPendingEmail(); }}
                    className="text-amber-500 hover:text-amber-700 shrink-0 text-xs leading-none"
                    title="Cancel pending change"
                  >
                    ✕
                  </button>
                </div>
              )}

              {emailVerificationSent && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[11px] text-green-700">
                  ✓ Verification email sent. Check your inbox to confirm the change.
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

// ── Settings page navigation ──────────────────────────────────────────────────
// Add entries here whenever a new section is added. Items with adminOnly=true
// are only shown to admins. Items whose DOM element doesn't exist yet (e.g. a
// section from an in-progress task) are filtered out automatically.
const ALL_SETTINGS_NAV: Array<{ id: string; label: string; adminOnly?: boolean; group?: string }> = [
  // Account — personal to the logged-in user
  { id: "profile-section",            label: "Profile",        group: "Account" },
  { id: "security-section",           label: "Security" },
  { id: "notifications-section",      label: "Notifications" },
  { id: "timezone-locale-section",    label: "Timezone" },
  // Workspace — organisation-wide settings
  { id: "organization-section",       label: "Organization",   group: "Workspace" },
  { id: "billing-section",            label: "Billing" },
  { id: "custom-domain-section",      label: "Custom domain",  adminOnly: true },
  { id: "team-section",               label: "Team" },
  // DocuFill — how the interview product behaves
  { id: "interview-defaults-section", label: "Interview",      group: "DocuFill" },
  { id: "email-section",              label: "Email" },
  // Connect — external tools and developer APIs
  { id: "integrations-section",       label: "Integrations",   group: "Connect" },
  { id: "developer-section",          label: "Developer" },
  // Admin — governance and data controls
  { id: "data-privacy-section",       label: "Data & Privacy", group: "Admin" },
  { id: "audit-log-section",          label: "Audit log",      adminOnly: true },
];

export default function AppSettings() {
  const { getAuthHeaders } = useProductAuth();
  const { isAdmin, role } = useProductRole(getAuthHeaders);

  const [org, setOrg] = useState<ProductOrgSettings | null>(null);
  const [name, setName] = useState("");
  const [brandColor, setBrandColor] = useState("#C49A38");
  const [displayLogoUrl, setDisplayLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameFieldError, setNameFieldError] = useState<string | null>(null);
  const [logoSaved, setLogoSaved] = useState(false);
  const [colorSaved, setColorSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameEdited = useRef(false);
  const nameSaveSeq = useRef(0);
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorEdited = useRef(false);
  const colorSaveSeq = useRef(0);
  const nameSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Section quick-nav: track which section is visible and which nav items exist
  const [activeSection, setActiveSection] = useState<string>("profile-section");
  const [presentSections, setPresentSections] = useState<Set<string>>(new Set());

  // After the org finishes loading, find which section elements exist in the DOM.
  // Must depend on isLoading: during loading the component returns early (spinner),
  // so sections are not in the DOM yet and all getElementById calls return null.
  useEffect(() => {
    if (isLoading) return;
    const present = new Set<string>();
    for (const item of ALL_SETTINGS_NAV) {
      if (document.getElementById(item.id)) present.add(item.id);
    }
    setPresentSections(present);
  }, [isLoading]);

  // Highlight the nav item for the section nearest the top of the viewport
  useEffect(() => {
    const ids = ALL_SETTINGS_NAV
      .filter(item => !(item.adminOnly && !isAdmin))
      .map(item => item.id);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
          // Scroll the active nav pill into view
          const btn = navRef.current?.querySelector<HTMLButtonElement>(`[data-nav="${visible[0].target.id}"]`);
          btn?.scrollIntoView({ block: "nearest", inline: "center" });
        }
      },
      { rootMargin: "-10% 0px -75% 0px", threshold: 0 },
    );

    const timer = setTimeout(() => {
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 200);

    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [isAdmin, presentSections]);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    // App header is h-14 (56px) and is NOT sticky — it scrolls away.
    // After the smooth scroll completes the header is gone, so we only need
    // a small breathing-room gap at the top of the viewport.
    const OFFSET = 72; // 56px header + 16px gap
    const top = el.getBoundingClientRect().top + window.scrollY - OFFSET;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveSection(id);
  }

  function flashFieldSaved(field: "name" | "logo" | "color") {
    if (field === "name") {
      setNameSaved(true);
      if (nameSavedTimer.current) clearTimeout(nameSavedTimer.current);
      nameSavedTimer.current = setTimeout(() => setNameSaved(false), 3000);
    } else if (field === "logo") {
      setLogoSaved(true);
      if (logoSavedTimer.current) clearTimeout(logoSavedTimer.current);
      logoSavedTimer.current = setTimeout(() => setLogoSaved(false), 3000);
    } else {
      setColorSaved(true);
      if (colorSavedTimer.current) clearTimeout(colorSavedTimer.current);
      colorSavedTimer.current = setTimeout(() => setColorSaved(false), 3000);
    }
  }

  function applyOrg(data: ProductOrgSettings) {
    setOrg(data);
    setName(data.name);
    setBrandColor(data.brand_color);
    // Append a timestamp so the browser re-fetches the logo after every upload
    // rather than serving the stale cached version (same URL, new content).
    setDisplayLogoUrl(data.logo_url ? `${API_BASE}${data.logo_url}?t=${Date.now()}` : null);
    updateProductOrgCache(data);
  }

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/org`, { headers: { ...getAuthHeaders() } })
      .then((r) => r.json())
      .then((data: { org?: ProductOrgSettings; error?: string }) => {
        if (data.org) applyOrg(data.org);
        else setErrorMsg(data.error ?? "Failed to load settings");
      })
      .catch(() => setErrorMsg("Failed to load settings"))
      .finally(() => setIsLoading(false));

    return () => {
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
      if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
      if (nameSavedTimer.current) clearTimeout(nameSavedTimer.current);
      if (logoSavedTimer.current) clearTimeout(logoSavedTimer.current);
      if (colorSavedTimer.current) clearTimeout(colorSavedTimer.current);
    };
  }, []);

  // Auto-save name with 700ms debounce — only fires when user has edited the field
  useEffect(() => {
    if (!nameEdited.current || !org) return;
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    nameDebounceRef.current = setTimeout(async () => {
      nameDebounceRef.current = null;
      const trimmed = name.trim();
      if (!trimmed) {
        setNameFieldError("Organization name cannot be empty.");
        return;
      }
      setNameFieldError(null);
      const seq = ++nameSaveSeq.current;
      try {
        const res = await fetch(`${SETTINGS_BASE}/org`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ name: trimmed }),
        });
        const data = await res.json() as { org?: ProductOrgSettings; error?: string };
        if (seq !== nameSaveSeq.current) return; // stale response — a newer request is in flight
        if (!res.ok) { setNameFieldError(data.error ?? "Failed to save name"); return; }
        if (data.org) {
          nameEdited.current = false; // prevent the applyOrg name-state change from re-triggering
          applyOrg(data.org);
        }
        flashFieldSaved("name");
      } catch { if (seq === nameSaveSeq.current) setNameFieldError("Failed to save name. Please try again."); }
    }, 700);
    return () => {
      if (nameDebounceRef.current) { clearTimeout(nameDebounceRef.current); nameDebounceRef.current = null; }
    };
  }, [name]);

  // Auto-save brand color with 700ms debounce — only fires when user has changed the color
  // (colorEdited is set in the onChange wrapper; cleared immediately in handleAutoSaveColor
  //  so extracted-swatch clicks don't double-save via this path)
  useEffect(() => {
    if (!colorEdited.current || !org) return;
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(async () => {
      colorDebounceRef.current = null;
      if (!/^#[0-9a-fA-F]{6}$/.test(brandColor)) return; // wait for a complete hex value
      const seq = ++colorSaveSeq.current;
      try {
        const res = await fetch(`${SETTINGS_BASE}/org`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ brandColor }),
        });
        const data = await res.json() as { org?: ProductOrgSettings; error?: string };
        if (seq !== colorSaveSeq.current) return;
        if (!res.ok) { setErrorMsg(data.error ?? "Failed to save color"); return; }
        if (data.org) applyOrg(data.org);
        flashFieldSaved("color");
      } catch { if (seq === colorSaveSeq.current) setErrorMsg("Failed to save brand color."); }
    }, 700);
    return () => {
      if (colorDebounceRef.current) { clearTimeout(colorDebounceRef.current); colorDebounceRef.current = null; }
    };
  }, [brandColor]);

  async function uploadLogoFile(file: File) {
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setErrorMsg("Please upload a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Logo must be under 5 MB.");
      return;
    }
    setErrorMsg(null);
    setIsUploadingLogo(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/org/logo`, {
        method: "POST",
        headers: { "Content-Type": file.type, ...getAuthHeaders() },
        body: file,
      });
      const data = await res.json() as { org?: ProductOrgSettings; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Logo upload failed."); return; }
      if (data.org) applyOrg(data.org);
      flashFieldSaved("logo");
    } catch {
      setErrorMsg("Logo upload failed. Please try again.");
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadLogoFile(file);
  }

  function handleLogoDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingLogo(true);
  }

  function handleLogoDragLeave() {
    setIsDraggingLogo(false);
  }

  async function handleLogoDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadLogoFile(file);
  }

  async function handleRemoveLogo() {
    setErrorMsg(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ clearLogo: true }),
      });
      const data = await res.json() as { org?: ProductOrgSettings; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to remove logo"); return; }
      if (data.org) applyOrg(data.org);
      flashFieldSaved("logo");
    } catch {
      setErrorMsg("Failed to remove logo.");
    }
  }

  async function handleAutoSaveColor(newColor: string) {
    if (!org) return;
    // Clear the flag immediately so the debounced color effect skips this save
    // (extracted-swatch clicks call both onChange + onAutoSave; without this guard
    //  the debounce would fire a redundant second PATCH 700ms later)
    colorEdited.current = false;
    if (colorDebounceRef.current) { clearTimeout(colorDebounceRef.current); colorDebounceRef.current = null; }
    const seq = ++colorSaveSeq.current;
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ brandColor: newColor }),
      });
      const data = await res.json() as { org?: ProductOrgSettings; error?: string };
      if (seq !== colorSaveSeq.current) return;
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to save color"); return; }
      if (data.org) applyOrg(data.org);
      flashFieldSaved("color");
    } catch {
      if (seq === colorSaveSeq.current) setErrorMsg("Failed to save brand color.");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const roleLabel = role === "readonly" ? "Read-only" : role === "member" ? "Member" : role ?? "Member";

  const visibleNavItems = ALL_SETTINGS_NAV.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    return presentSections.has(item.id);
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="lg:flex lg:gap-10 lg:items-start">

        {/* ── Left sidebar nav — desktop only ────────────────────────── */}
        <aside className="hidden lg:block w-44 shrink-0 sticky top-[72px] self-start">
          <div className="mb-5">
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            <p className="text-xs text-gray-400 mt-0.5">Account &amp; workspace</p>
          </div>
          <nav ref={navRef} className="space-y-0.5">
            {(() => {
              let lastGroup: string | undefined;
              return visibleNavItems.map(item => {
                const showHeader = item.group && item.group !== lastGroup;
                if (showHeader) lastGroup = item.group;
                return (
                  <div key={item.id}>
                    {showHeader && (
                      <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 first:pt-1">
                        {item.group}
                      </p>
                    )}
                    <button
                      data-nav={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={[
                        "w-full text-left rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                        activeSection === item.id
                          ? "bg-gray-900 text-white"
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
                      ].join(" ")}
                    >
                      {item.label}
                    </button>
                  </div>
                );
              });
            })()}
          </nav>
        </aside>

        {/* ── Main content column ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* Page header — shown on mobile; desktop header lives in the sidebar */}
          <div className="lg:hidden">
            <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your organization's branding and preferences.</p>
          </div>

          {/* Mobile horizontal pill nav — hidden on desktop */}
          {visibleNavItems.length > 1 && (
            <div className="lg:hidden sticky top-0 z-20 -mx-4 px-4 bg-white/95 backdrop-blur-sm border-b border-gray-100 py-2">
              <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {visibleNavItems.map(item => (
                  <button
                    key={item.id}
                    data-nav={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={[
                      "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                      activeSection === item.id
                        ? "bg-gray-900 text-white"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Read-only banner for non-admins */}
          {!isAdmin && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-sky-900">You have {roleLabel} access</p>
                <p className="text-xs text-sky-700 mt-0.5">
                  You can view these settings but cannot make changes. Contact your admin to update the organization's branding or configuration.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
          )}

      {/* Profile section — per-user settings, visible to all roles */}
      <div id="profile-section">
        <ProfileSection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Security section — per-user 2FA, sessions, and login history */}
      <div id="security-section">
        <SecuritySection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Notifications section — per-user email prefs */}
      <div id="notifications-section">
        <NotificationsSection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Timezone & Locale section */}
      <div id="timezone-locale-section">
        <TimezoneLocaleSection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} />
      </div>

      {/* Org branding setup prompt — shown until logo or custom color is set */}
      {org && !org.logo_url && org.brand_color === "#C49A38" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-900">Set up your brand</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Upload your logo and choose a brand color below so every client interview link is white-labeled with your identity.
            </p>
          </div>
        </div>
      )}

      {/* Organization section */}
      <section id="organization-section" className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Organization</h2>
          <p className="text-xs text-gray-500 mt-0.5">This name and logo appear on customer-facing forms.</p>
        </div>

        {/* Name */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-44 shrink-0 pt-0.5">
            <label className="text-sm font-medium text-gray-900" htmlFor="org-name">Organization name</label>
            <p className="text-xs text-gray-400 mt-0.5">Shown on customer forms and emails</p>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <input
              id="org-name"
              type="text"
              value={name}
              readOnly={!isAdmin}
              onChange={(e) => { if (isAdmin) { nameEdited.current = true; setName(e.target.value); } }}
              placeholder="Your organization name"
              className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 w-full${!isAdmin ? " opacity-60 cursor-not-allowed" : ""}`}
            />
            {nameFieldError ? (
              <span className="text-[11px] text-red-600">{nameFieldError}</span>
            ) : nameSaved ? (
              <span className="text-[11px] text-green-600 font-medium">✓ Saved</span>
            ) : null}
          </div>
        </div>

        {/* Logo */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-44 shrink-0 pt-0.5">
            <label className="text-sm font-medium text-gray-900">Logo</label>
            <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, or WebP — max 5 MB</p>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleLogoChange}
            />
            {/* Drop / click zone */}
            <div
              role={isAdmin ? "button" : undefined}
              tabIndex={isAdmin ? 0 : undefined}
              aria-label={isAdmin ? (displayLogoUrl ? "Click or drop to replace logo" : "Click or drop to upload logo") : undefined}
              onClick={() => isAdmin && !isUploadingLogo && logoInputRef.current?.click()}
              onKeyDown={(e) => { if (isAdmin && (e.key === "Enter" || e.key === " ") && !isUploadingLogo) logoInputRef.current?.click(); }}
              onDragOver={isAdmin ? handleLogoDragOver : undefined}
              onDragLeave={isAdmin ? handleLogoDragLeave : undefined}
              onDrop={isAdmin ? (e) => { void handleLogoDrop(e); } : undefined}
              className={[
                "relative flex items-center justify-center rounded-xl border-2 transition-colors overflow-hidden",
                isAdmin ? "cursor-pointer select-none" : "cursor-default opacity-60",
                "bg-white",
                isDraggingLogo
                  ? "border-gray-900 bg-gray-50"
                  : displayLogoUrl
                    ? "border-gray-200 hover:border-gray-300"
                    : "border-dashed border-gray-200 hover:border-gray-400",
              ].join(" ")}
              style={{ minHeight: "80px", minWidth: "160px" }}
            >
              {isUploadingLogo ? (
                <div className="flex items-center gap-2 px-4 py-4">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin shrink-0" />
                  <span className="text-xs text-gray-500">Uploading…</span>
                </div>
              ) : displayLogoUrl ? (
                <img
                  src={displayLogoUrl}
                  alt="Logo"
                  className="object-contain p-3"
                  style={{ maxHeight: "80px", maxWidth: "220px" }}
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 px-4 py-4 text-center pointer-events-none">
                  <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-xs font-medium text-gray-500">Click or drag to upload</span>
                  <span className="text-[10px] text-gray-400">PNG, JPG, WebP · max 5 MB</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isAdmin ? (
                <>
                  {displayLogoUrl && (
                    <button
                      type="button"
                      disabled={isUploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                      className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                    >
                      Replace
                    </button>
                  )}
                  {displayLogoUrl && (
                    <button
                      type="button"
                      onClick={() => { void handleRemoveLogo(); }}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400 italic">Contact your admin to change the logo.</p>
              )}
              {logoSaved && (
                <span className="text-[11px] text-green-600 font-medium">✓ Saved</span>
              )}
            </div>
          </div>
        </div>

        {/* Brand color */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-44 shrink-0 pt-0.5">
            <label className="text-sm font-medium text-gray-900" htmlFor="brand-color">Brand color</label>
            <p className="text-xs text-gray-400 mt-0.5">Used in buttons and highlights</p>
            {colorSaved && (
              <span className="text-[11px] text-green-600 font-medium mt-1 block">✓ Saved</span>
            )}
          </div>
          <div className={`flex-1 ${!isAdmin ? "pointer-events-none opacity-60" : ""}`}>
            <BrandColorSection
              brandColor={brandColor}
              onChange={(c) => { colorEdited.current = true; setBrandColor(c); }}
              onAutoSave={handleAutoSaveColor}
              extractEndpoint={`${SETTINGS_BASE}/extract-brand-colors`}
              getAuthHeaders={getAuthHeaders}
              colorScheme="product"
            />
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Customer form preview</h2>
            <p className="text-xs text-gray-500 mt-0.5">How your branding appears to customers on document collection forms.</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-500 shrink-0">Preview</span>
        </div>
        {/* Simulated browser chrome */}
        <div className="bg-gray-100 px-4 py-2 flex items-center gap-2 border-b border-gray-200">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
          </div>
          <div className="flex-1 bg-white rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400 font-mono truncate">
            docuplete.com/collect/…
          </div>
        </div>
        {/* Mocked interview page */}
        <div className="bg-[#F8F6F0] px-6 py-6">
          <div className="max-w-sm mx-auto overflow-hidden rounded-xl shadow-sm border border-[#DDD5C4]">
            {/* Form header — matches the actual customer interview header exactly */}
            <header className="bg-white border-b border-[#DDD5C4] px-4 py-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#C49A38" }}
                >
                  {displayLogoUrl ? (
                    <img src={displayLogoUrl} alt={name || "Logo"} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-white text-xs font-bold">{(name || "?").charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0F1C3F]">{name || "Your company name"}</div>
                  <div className="text-[11px] text-[#6B7A99]">Secure document collection</div>
                </div>
              </div>
            </header>
            {/* Form body */}
            <div className="bg-[#F8F6F0] px-4 py-6 space-y-5">
              {/* Package title */}
              <div>
                <h2 className="text-lg font-semibold text-[#0F1C3F]">Client Intake Form</h2>
                <p className="text-xs text-[#6B7A99] mt-1">Please complete the form below. Your answers are saved automatically as you type.</p>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full bg-[#EFE8D8] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full w-1/3"
                  style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#C49A38" }}
                />
              </div>
              {/* Sample field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#0F1C3F]">Full name <span className="text-red-500">*</span></label>
                <div className="rounded-lg border border-[#DDD5C4] bg-white px-3 py-2 text-sm text-[#6B7A99] italic">
                  Jane Smith
                </div>
              </div>
              {/* Branded submit button */}
              <button
                type="button"
                className="w-full rounded-lg py-2.5 text-sm font-semibold text-white pointer-events-none"
                style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#C49A38" }}
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Billing section */}
      <div id="billing-section">
        <BillingSection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Custom domain section */}
      <div id="custom-domain-section">
        <CustomDomainSection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} />
      </div>

      {/* Team section */}
      <div id="team-section">
        <TeamSection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Interview defaults section — admin writes, all can view */}
      <div id="interview-defaults-section">
        <InterviewDefaultsSection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} />
      </div>

      {/* Email customization section — admin writes, all can view */}
      <div id="email-section">
        <EmailCustomizationSection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} />
      </div>

      {/* Integrations section */}
      <div id="integrations-section">
        <IntegrationsSection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Developer section — SDK, Zapier, API Keys */}
      <div id="developer-section" className="flex flex-col gap-6">
        <DeveloperSection getAuthHeaders={getAuthHeaders} />
        <div id="api-keys-section">
          <ApiKeysSection getAuthHeaders={getAuthHeaders} />
        </div>
      </div>

      {/* Data & Privacy section */}
      <div id="data-privacy-section">
        <DataPrivacySection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} orgName={name} />
      </div>

          {/* Audit log section — admin only */}
          {isAdmin && (
            <div id="audit-log-section">
              <AuditLogSection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} />
            </div>
          )}

        </div>{/* end content column */}
      </div>{/* end lg:flex container */}
    </div>
  );
}
