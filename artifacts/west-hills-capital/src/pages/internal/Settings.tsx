import { useEffect, useRef, useState } from "react";
import { useInternalAuth } from "@/hooks/useInternalAuth";
import { updateOrgCache, getCachedOrg, type OrgSettings } from "@/hooks/useOrgSettings";
import { formatOrgDate } from "@/lib/orgDateFormat";
import { BrandColorSection } from "@/components/settings/BrandColorSection";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SETTINGS_BASE = `${API_BASE}/api/internal/settings`;

interface AccountRow {
  id: number;
  name: string;
  slug: string;
  plan_tier: string;
  subscription_status: string | null;
  billing_period_start: string | null;
  seat_limit: number;
  seat_count: number;
  submission_count: number;
  package_count: number;
  last_activity_at: string | null;
  created_at: string;
  stripe_customer_id: string | null;
}

interface MonthlyUsage {
  month: string;
  count: number;
}

interface TeamMember {
  id: number;
  email: string;
  role: string;
  status: string;
  display_name: string | null;
  last_seen_at: string | null;
  invited_at: string | null;
}

interface StripeSubscription {
  plan_name: string;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  current_period_end: string | null;
  status: string | null;
}

interface AccountDetail {
  monthly_usage: MonthlyUsage[];
  team_members: TeamMember[];
  stripe_subscription: StripeSubscription | null;
}

type SortCol = "name" | "plan_tier" | "seat_count" | "package_count" | "submission_count" | "subscription_status" | "last_activity_at" | "created_at";

function planBadge(tier: string) {
  if (tier === "enterprise") return <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Enterprise</span>;
  if (tier === "pro") return <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">Pro</span>;
  return <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">Free</span>;
}

function statusBadge(status: string | null) {
  if (!status) return <span className="text-[10px] text-gray-400">—</span>;
  if (status === "active" || status === "trialing")
    return <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-medium text-green-700">Active</span>;
  if (status === "past_due")
    return <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-medium text-red-700">Past due</span>;
  if (status === "canceled" || status === "cancelled")
    return <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">Cancelled</span>;
  return <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">{status}</span>;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function formatDate(iso: string | null): string {
  return formatOrgDate(iso, getCachedOrg());
}

function formatPeriodStart(iso: string | null): string {
  if (!iso) return "month start";
  return new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol | null; sortDir: "asc" | "desc" }) {
  if (sortCol !== col) return <span className="ml-0.5 text-[#C4B89A] opacity-50">↕</span>;
  return <span className="ml-0.5 text-[#0F1C3F]">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function formatMonthLabel(yyyyMm: string): string {
  const [year, mon] = yyyyMm.split("-");
  const date = new Date(parseInt(year ?? "0", 10), parseInt(mon ?? "1", 10) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function formatCurrency(amount: number | null, currency: string | null): string {
  if (amount === null || !currency) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

function AdminAccountsSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol | null>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<AccountRow | null>(null);
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/admin/accounts`, { headers: { ...getAuthHeaders() } })
      .then(async (r) => {
        const data = await r.json() as { accounts?: AccountRow[]; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load accounts"); return; }
        setAccounts(data.accounts ?? []);
      })
      .catch(() => setLoadError("Failed to load accounts"))
      .finally(() => setIsLoading(false));
  }, []);

  function openDetail(acct: AccountRow) {
    // Cancel any in-flight detail request before starting a new one
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;

    setSelected(acct);
    setDetail(null);
    setDetailLoading(true);
    fetch(`${SETTINGS_BASE}/admin/accounts/${acct.id}`, {
      headers: { ...getAuthHeaders() },
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json() as AccountDetail & { error?: string };
        if (!r.ok) { setDetailLoading(false); return; }
        setDetail(data);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
      })
      .finally(() => setDetailLoading(false));
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const filtered = accounts.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0;
    let av: string | number | null = a[sortCol] as string | number | null;
    let bv: string | number | null = b[sortCol] as string | number | null;
    if (av === null || av === undefined) av = "";
    if (bv === null || bv === undefined) bv = "";
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const thClass = "px-4 py-2.5 text-left font-semibold text-[#6B7A99] whitespace-nowrap cursor-pointer select-none hover:text-[#0F1C3F] transition-colors";
  const thCenterClass = "px-4 py-2.5 text-center font-semibold text-[#6B7A99] whitespace-nowrap cursor-pointer select-none hover:text-[#0F1C3F] transition-colors";

  return (
    <>
      <section className="bg-white rounded-xl border border-[#DDD5C4] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EFE8D8] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#0F1C3F]">All accounts</h2>
            <p className="text-xs text-[#6B7A99] mt-0.5">
              Submission counts run from each account's billing period start. Click a row for details.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or slug…"
              className="text-xs rounded-lg border border-[#DDD5C4] bg-[#FAFAF8] px-3 py-1.5 text-[#0F1C3F] placeholder:text-[#B0A898] focus:outline-none focus:ring-2 focus:ring-[#0F1C3F]/20 focus:border-[#0F1C3F] w-52"
            />
            <span className="text-xs font-medium text-[#6B7A99] bg-[#F8F6F0] border border-[#DDD5C4] rounded-full px-2.5 py-1 shrink-0">
              {isLoading ? "…" : `${sorted.length}${sorted.length !== accounts.length ? ` / ${accounts.length}` : ""} account${sorted.length !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>

        {loadError && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-100">
            <p className="text-xs text-red-700">{loadError}</p>
          </div>
        )}

        {isLoading ? (
          <div className="px-6 py-10 flex justify-center">
            <div className="w-5 h-5 border-2 border-[#DDD5C4] border-t-[#C49A38] rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-[#8A9BB8]">
            {search ? "No accounts match your search." : "No accounts found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#F8F6F0] border-b border-[#EFE8D8]">
                <tr>
                  <th className={thClass} onClick={() => handleSort("name")}>
                    Account <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => handleSort("plan_tier")}>
                    Plan <SortIcon col="plan_tier" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th className={thCenterClass} onClick={() => handleSort("seat_count")}>
                    Seats <SortIcon col="seat_count" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th className={thCenterClass} onClick={() => handleSort("package_count")}>
                    Packages <SortIcon col="package_count" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th className={thCenterClass} onClick={() => handleSort("submission_count")}>
                    Submissions <SortIcon col="submission_count" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => handleSort("subscription_status")}>
                    Subscription <SortIcon col="subscription_status" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => handleSort("last_activity_at")}>
                    Last activity <SortIcon col="last_activity_at" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => handleSort("created_at")}>
                    Created <SortIcon col="created_at" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE8D8]">
                {sorted.map((acct) => {
                  const seatPct = acct.seat_limit > 0 ? acct.seat_count / acct.seat_limit : 0;
                  const seatColor = seatPct >= 1 ? "text-red-600" : seatPct >= 0.8 ? "text-amber-600" : "text-[#0F1C3F]";
                  return (
                    <tr
                      key={acct.id}
                      onClick={() => openDetail(acct)}
                      className="hover:bg-[#FAFAF8] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-medium text-[#0F1C3F] leading-tight">{acct.name}</p>
                        <p className="text-[10px] text-[#8A9BB8] mt-0.5 font-mono">{acct.slug}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {planBadge(acct.plan_tier)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`font-medium ${seatColor}`}>{acct.seat_count}</span>
                        <span className="text-[#8A9BB8]"> / {acct.seat_limit}</span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="font-medium text-[#0F1C3F]">{acct.package_count}</span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="font-medium text-[#0F1C3F]">{acct.submission_count}</span>
                        <p className="text-[10px] text-[#8A9BB8] mt-0.5">since {formatPeriodStart(acct.billing_period_start)}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {statusBadge(acct.subscription_status)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-[#6B7A99]">{formatRelative(acct.last_activity_at)}</p>
                        {acct.last_activity_at && (
                          <p className="text-[10px] text-[#B0A898] mt-0.5">{formatDate(acct.last_activity_at)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-[#6B7A99]">{formatDate(acct.created_at)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => { setSelected(null); setDetail(null); }}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
          <div
            className="relative bg-white w-full max-w-lg shadow-2xl flex flex-col overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#EFE8D8] flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base font-semibold text-[#0F1C3F] leading-tight">{selected.name}</h3>
                <p className="text-xs text-[#8A9BB8] mt-0.5 font-mono">{selected.slug}</p>
              </div>
              <button
                onClick={() => { setSelected(null); setDetail(null); }}
                className="text-[#8A9BB8] hover:text-[#0F1C3F] transition-colors mt-0.5"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-6 flex-1">
              {/* Summary metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F8F6F0] rounded-lg px-4 py-3">
                  <p className="text-[10px] text-[#8A9BB8] uppercase tracking-wide font-medium">Plan</p>
                  <div className="mt-1">{planBadge(selected.plan_tier)}</div>
                </div>
                <div className="bg-[#F8F6F0] rounded-lg px-4 py-3">
                  <p className="text-[10px] text-[#8A9BB8] uppercase tracking-wide font-medium">Subscription</p>
                  <div className="mt-1">{statusBadge(selected.subscription_status)}</div>
                </div>
                <div className="bg-[#F8F6F0] rounded-lg px-4 py-3">
                  <p className="text-[10px] text-[#8A9BB8] uppercase tracking-wide font-medium">Seats</p>
                  <p className="mt-1 text-sm font-medium text-[#0F1C3F]">
                    {selected.seat_count} <span className="text-[#8A9BB8] font-normal">/ {selected.seat_limit}</span>
                  </p>
                </div>
                <div className="bg-[#F8F6F0] rounded-lg px-4 py-3">
                  <p className="text-[10px] text-[#8A9BB8] uppercase tracking-wide font-medium">Packages</p>
                  <p className="mt-1 text-sm font-medium text-[#0F1C3F]">{selected.package_count}</p>
                </div>
                <div className="bg-[#F8F6F0] rounded-lg px-4 py-3 col-span-2">
                  <p className="text-[10px] text-[#8A9BB8] uppercase tracking-wide font-medium">Submissions this period</p>
                  <p className="mt-1 text-sm font-medium text-[#0F1C3F]">
                    {selected.submission_count}
                    <span className="text-[10px] text-[#8A9BB8] font-normal ml-1">since {formatPeriodStart(selected.billing_period_start)}</span>
                  </p>
                </div>
              </div>

              {/* Usage history chart */}
              <div>
                <p className="text-xs font-semibold text-[#0F1C3F] mb-3">Submissions — last 6 months</p>
                {detailLoading ? (
                  <div className="h-32 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-[#DDD5C4] border-t-[#C49A38] rounded-full animate-spin" />
                  </div>
                ) : detail ? (
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={detail.monthly_usage} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={20}>
                        <XAxis
                          dataKey="month"
                          tickFormatter={formatMonthLabel}
                          tick={{ fontSize: 10, fill: "#8A9BB8" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 10, fill: "#8A9BB8" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(v) => [v, "Submissions"]}
                          labelFormatter={formatMonthLabel}
                          contentStyle={{ fontSize: 11, borderColor: "#DDD5C4", borderRadius: 6 }}
                        />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                          {detail.monthly_usage.map((entry, idx) => (
                            <Cell
                              key={entry.month}
                              fill={idx === detail.monthly_usage.length - 1 ? "#C49A38" : "#0F1C3F"}
                              opacity={idx === detail.monthly_usage.length - 1 ? 1 : 0.55}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-[#8A9BB8] text-center py-6">Could not load usage history.</p>
                )}
              </div>

              {/* Timeline */}
              <div className="space-y-0 text-xs border border-[#EFE8D8] rounded-lg overflow-hidden">
                <div className="flex justify-between px-4 py-2.5 border-b border-[#EFE8D8]">
                  <span className="text-[#6B7A99]">Account created</span>
                  <span className="text-[#0F1C3F] font-medium">{formatDate(selected.created_at)}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 border-b border-[#EFE8D8]">
                  <span className="text-[#6B7A99]">Last activity</span>
                  <span className="text-[#0F1C3F] font-medium text-right">
                    {selected.last_activity_at ? (
                      <>
                        {formatRelative(selected.last_activity_at)}
                        <span className="block text-[10px] text-[#B0A898] font-normal">{formatDate(selected.last_activity_at)}</span>
                      </>
                    ) : "Never"}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-[#6B7A99]">Account ID</span>
                  <span className="text-[#0F1C3F] font-mono">{selected.id}</span>
                </div>
              </div>

              {/* Stripe subscription details */}
              {detail?.stripe_subscription && (
                <div>
                  <p className="text-xs font-semibold text-[#0F1C3F] mb-2">Stripe plan</p>
                  <div className="border border-[#EFE8D8] rounded-lg overflow-hidden text-xs">
                    <div className="flex justify-between px-4 py-2.5 border-b border-[#EFE8D8]">
                      <span className="text-[#6B7A99]">Plan</span>
                      <span className="text-[#0F1C3F] font-medium">{detail.stripe_subscription.plan_name}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5 border-b border-[#EFE8D8]">
                      <span className="text-[#6B7A99]">Price</span>
                      <span className="text-[#0F1C3F] font-medium">
                        {formatCurrency(detail.stripe_subscription.amount, detail.stripe_subscription.currency)}
                        {detail.stripe_subscription.interval && (
                          <span className="text-[#8A9BB8] font-normal"> / {detail.stripe_subscription.interval}</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5 border-b border-[#EFE8D8]">
                      <span className="text-[#6B7A99]">Status</span>
                      <span className="text-[#0F1C3F] font-medium capitalize">{detail.stripe_subscription.status ?? "—"}</span>
                    </div>
                    {detail.stripe_subscription.current_period_end && (
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-[#6B7A99]">Renews / ends</span>
                        <span className="text-[#0F1C3F] font-medium">{formatDate(detail.stripe_subscription.current_period_end)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selected.stripe_customer_id && (
                <a
                  href={`https://dashboard.stripe.com/customers/${selected.stripe_customer_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View in Stripe Dashboard
                </a>
              )}

              {/* Team members */}
              <div>
                <p className="text-xs font-semibold text-[#0F1C3F] mb-2">
                  Team members
                  {detail && (
                    <span className="ml-1.5 text-[10px] font-normal text-[#8A9BB8]">({detail.team_members.length})</span>
                  )}
                </p>
                {detailLoading ? (
                  <div className="h-10 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-[#DDD5C4] border-t-[#C49A38] rounded-full animate-spin" />
                  </div>
                ) : detail?.team_members && detail.team_members.length > 0 ? (
                  <div className="border border-[#EFE8D8] rounded-lg overflow-hidden divide-y divide-[#EFE8D8]">
                    {detail.team_members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                        <div className="min-w-0">
                          {m.display_name && (
                            <p className="font-medium text-[#0F1C3F] truncate leading-tight">{m.display_name}</p>
                          )}
                          <p className={`truncate ${m.display_name ? "text-[10px] text-[#8A9BB8]" : "font-medium text-[#0F1C3F]"}`}>
                            {m.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {m.status === "pending" ? (
                            <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">Pending</span>
                          ) : m.role === "admin" ? (
                            <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">Admin</span>
                          ) : m.role === "readonly" ? (
                            <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">Read-only</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">Member</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : detail ? (
                  <p className="text-xs text-[#8A9BB8] text-center py-4">No team members.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Settings() {
  const { getAuthHeaders } = useInternalAuth();

  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [name, setName] = useState("");
  const [brandColor, setBrandColor] = useState("#C49A38");
  const [displayLogoUrl, setDisplayLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashStatus(msg: string) {
    setStatusMsg(msg);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatusMsg(""), 3000);
  }

  function applyOrg(data: OrgSettings) {
    setOrg(data);
    setName(data.name);
    setBrandColor(data.brand_color);
    setDisplayLogoUrl(data.logo_url ? `${API_BASE}${data.logo_url}` : null);
    updateOrgCache(data);
  }

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/org`, { headers: { ...getAuthHeaders() } })
      .then((r) => r.json())
      .then((data: { org?: OrgSettings; error?: string }) => {
        if (data.org) {
          applyOrg(data.org);
        } else {
          setErrorMsg(data.error ?? "Failed to load settings");
        }
      })
      .catch(() => setErrorMsg("Failed to load settings"))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
      const data = await res.json() as { org?: OrgSettings; error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Logo upload failed. Please try again.");
        return;
      }
      if (data.org) applyOrg(data.org);
      flashStatus("Logo saved.");
    } catch {
      setErrorMsg("Logo upload failed. Please try again.");
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleRemoveLogo() {
    setErrorMsg(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ clearLogo: true }),
      });
      const data = await res.json() as { org?: OrgSettings; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to remove logo"); return; }
      if (data.org) applyOrg(data.org);
      flashStatus("Logo removed.");
    } catch {
      setErrorMsg("Failed to remove logo.");
    }
  }

  async function handleSave() {
    if (!org) return;
    if (!name.trim()) { setErrorMsg("Organization name is required."); return; }
    setErrorMsg(null);
    setIsSaving(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: name.trim(), brandColor }),
      });
      const data = await res.json() as { org?: OrgSettings; error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to save settings");
        return;
      }
      if (data.org) applyOrg(data.org);
      flashStatus("Settings saved.");
    } catch {
      setErrorMsg("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAutoSaveColor(newColor: string) {
    if (!org) return;
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ brandColor: newColor }),
      });
      const data = await res.json() as { org?: OrgSettings; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to save color"); return; }
      if (data.org) applyOrg(data.org);
      flashStatus("Brand color saved.");
    } catch {
      setErrorMsg("Failed to save brand color.");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C49A38] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F6F0]">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F1C3F]">Settings</h1>
            <p className="text-sm text-[#6B7A99] mt-0.5">Manage your organization's branding and preferences.</p>
          </div>
          <div className="flex items-center gap-2">
            {statusMsg && <span className="text-xs text-green-700 font-medium">{statusMsg}</span>}
            <button
              type="button"
              onClick={() => { void handleSave(); }}
              disabled={isSaving}
              className="shrink-0 text-sm font-medium bg-[#0F1C3F] text-white hover:bg-[#182B5F] disabled:opacity-60 rounded-lg px-4 py-2 transition-colors"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
        )}

        {/* Organization section */}
        <section className="bg-white rounded-xl border border-[#DDD5C4] divide-y divide-[#EFE8D8]">
          <div className="px-6 py-4">
            <h2 className="text-base font-semibold text-[#0F1C3F]">Organization</h2>
            <p className="text-xs text-[#6B7A99] mt-0.5">This name and logo will appear on customer-facing forms.</p>
          </div>

          {/* Organization name */}
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-44 shrink-0">
              <label className="text-sm font-medium text-[#0F1C3F]" htmlFor="org-name">Company name</label>
              <p className="text-xs text-[#8A9BB8] mt-0.5">Shown in form headers</p>
            </div>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your company name"
              className="flex-1 rounded-lg border border-[#DDD5C4] bg-[#FAFAF8] px-3 py-2 text-sm text-[#0F1C3F] placeholder:text-[#B0A898] focus:outline-none focus:ring-2 focus:ring-[#0F1C3F]/20 focus:border-[#0F1C3F]"
            />
          </div>

          {/* Logo */}
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-44 shrink-0">
              <label className="text-sm font-medium text-[#0F1C3F]">Logo</label>
              <p className="text-xs text-[#8A9BB8] mt-0.5">PNG, JPG, or WebP under 5 MB — saved immediately on upload</p>
            </div>
            <div className="flex-1 flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] flex items-center justify-center shrink-0 overflow-hidden">
                {displayLogoUrl ? (
                  <img src={displayLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <svg className="w-8 h-8 text-[#C4B89A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                <button
                  type="button"
                  disabled={isUploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                  className="text-sm rounded-lg border border-[#DDD5C4] bg-white px-3 py-1.5 text-[#0F1C3F] hover:bg-[#F8F6F0] disabled:opacity-60 transition-colors"
                >
                  {isUploadingLogo ? "Uploading…" : displayLogoUrl ? "Replace logo" : "Upload logo"}
                </button>
                {displayLogoUrl && (
                  <button
                    type="button"
                    onClick={() => { void handleRemoveLogo(); }}
                    className="text-xs text-[#8A9BB8] hover:text-red-500 transition-colors text-left"
                  >
                    Remove logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Brand color */}
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-44 shrink-0">
              <label className="text-sm font-medium text-[#0F1C3F]" htmlFor="brand-color">Accent color</label>
              <p className="text-xs text-[#8A9BB8] mt-0.5">Used in buttons and highlights</p>
            </div>
            <div className="flex-1">
              <BrandColorSection
                brandColor={brandColor}
                onChange={setBrandColor}
                onAutoSave={handleAutoSaveColor}
                extractEndpoint={`${SETTINGS_BASE}/extract-brand-colors`}
                getAuthHeaders={getAuthHeaders}
                colorScheme="internal"
              />
            </div>
          </div>
        </section>

        {/* Preview */}
        <section className="bg-white rounded-xl border border-[#DDD5C4] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#EFE8D8]">
            <h2 className="text-base font-semibold text-[#0F1C3F]">Customer form preview</h2>
            <p className="text-xs text-[#6B7A99] mt-0.5">This is how your branding appears in the header of customer-facing forms.</p>
          </div>
          <div className="bg-white border-b border-[#DDD5C4] px-4 py-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded shrink-0 flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#C49A38" }}
              >
                {displayLogoUrl ? (
                  <img src={displayLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-white text-xs font-bold">{(name || "?").charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-[#0F1C3F]">{name || "Your company name"}</div>
                <div className="text-[11px] text-[#6B7A99]">Secure document collection</div>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 bg-[#F8F6F0]">
            <div className="h-2 w-32 rounded bg-[#DDD5C4]" />
          </div>
        </section>

        {/* Admin accounts dashboard */}
        <AdminAccountsSection getAuthHeaders={getAuthHeaders} />
      </div>
    </div>
  );
}
