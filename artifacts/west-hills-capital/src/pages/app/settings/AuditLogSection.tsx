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

export function AuditLogSection({ getAuthHeaders, isAdmin }: { getAuthHeaders: () => HeadersInit; isAdmin: boolean }) {
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const LIMIT = 25;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function loadEntries(p: number, action: string, s: string, from?: string, to?: string) {
    setIsLoading(true);
    setLoadError(null);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (action) params.set("action", action);
    if (s.trim()) params.set("search", s.trim());
    if (from) params.set("after", from);
    if (to) params.set("before", to + "T23:59:59.999Z");
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
    loadEntries(page, actionFilter, search, dateFrom || undefined, dateTo || undefined);
  }, [page, actionFilter, search, dateFrom, dateTo, isAdmin]);

  function handleSearchChange(v: string) {
    setSearchInput(v);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(v);
      setPage(1);
    }, 350);
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      if (search.trim()) params.set("search", search.trim());
      if (dateFrom) params.set("after", dateFrom);
      if (dateTo) params.set("before", dateTo + "T23:59:59.999Z");
      const r = await fetch(`${SETTINGS_BASE}/audit-log/export?${params.toString()}`, { headers: authHeaders() });
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
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
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {isExporting ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-gray-100 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by user or resource…"
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
          />
          <div className="relative">
            <select
              value={actionFilter}
              onChange={(e) => handleActionFilterChange(e.target.value)}
              className="appearance-none rounded-lg border border-gray-200 bg-gray-50 pl-3 pr-8 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 cursor-pointer"
            >
              {ACTION_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 shrink-0">Date range</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <span className="text-xs text-gray-300">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear
            </button>
          )}
        </div>
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
          <div className="divide-y divide-[#E2E8F0]/80">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 px-6 py-3.5 hover:bg-slate-50/60 transition-colors">
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
                    {entry.action === "branding.update_color" && (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-gray-700">
                          <span className="w-2.5 h-2.5 rounded-sm border border-black/10 shrink-0" style={{ backgroundColor: entry.metadata.from }} />
                          {entry.metadata.from}
                        </span>
                        <span className="text-gray-300">→</span>
                        <span className="inline-flex items-center gap-1 font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-gray-700">
                          <span className="w-2.5 h-2.5 rounded-sm border border-black/10 shrink-0" style={{ backgroundColor: entry.metadata.to }} />
                          {entry.metadata.to}
                        </span>
                      </span>
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

