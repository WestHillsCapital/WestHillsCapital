import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SESSIONS_URL = `${API_BASE}/api/v1/product/docufill/sessions/portal-list`;

interface PortalSession {
  token: string;
  id: number;
  package_id: number;
  package_name: string;
  status: "draft" | "in_progress" | "generated";
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signed_at: string | null;
  pdf_sha256: string | null;
  tsa_url: string | null;
  tsa_obtained: boolean;
  pdf_stored: boolean;
  generated_pdf_url: string | null;
  link_email_recipient: string | null;
}

type SortField = "updated_at" | "created_at" | "status" | "package_name" | "signed_at";
type SortDir = "asc" | "desc";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:       { label: "Draft",       cls: "bg-gray-100 text-gray-600" },
  in_progress: { label: "In Progress", cls: "bg-blue-50 text-blue-700" },
  generated:   { label: "Signed",      cls: "bg-green-50 text-green-700" },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtDatetime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function TsaBadge({ obtained }: { obtained: boolean }) {
  if (!obtained) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span title="RFC 3161 timestamp obtained" className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      TSA
    </span>
  );
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <svg className="w-3 h-3 text-gray-300 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>;
  return sortDir === "desc"
    ? <svg className="w-3 h-3 text-gray-600 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
    : <svg className="w-3 h-3 text-gray-600 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>;
}

export default function AppSessions({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  const [sessions, setSessions] = useState<PortalSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("");
  const [page, setPage]             = useState(0);
  const [sortField, setSortField]   = useState<SortField>("updated_at");
  const [sortDir, setSortDir]       = useState<SortDir>("desc");

  const LIMIT = 25;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(page * LIMIT),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`${SESSIONS_URL}?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { sessions: PortalSession[]; total: number };
      let rows = data.sessions ?? [];
      // client-side sort (server returns updated_at DESC by default)
      rows = [...rows].sort((a, b) => {
        const av = a[sortField] ?? "";
        const bv = b[sortField] ?? "";
        const cmp = String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
      setSessions(rows);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, page, debouncedSearch, statusFilter, sortField, sortDir]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const Th = ({ field, label }: { field: SortField; label: string }) => (
    <th
      scope="col"
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sessions</h1>
          <p className="text-sm text-gray-500 mt-0.5">All interview sessions across your packages</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or package…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="in_progress">In Progress</option>
          <option value="generated">Signed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {error && (
          <div className="p-6 text-sm text-red-600 text-center">{error}</div>
        )}
        {!error && loading && sessions.length === 0 && (
          <div className="p-10 flex justify-center">
            <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!error && !loading && sessions.length === 0 && (
          <div className="p-10 text-center text-sm text-gray-400">No sessions found.</div>
        )}
        {!error && sessions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <Th field="package_name" label="Package" />
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Signer</th>
                  <Th field="status" label="Status" />
                  <Th field="signed_at" label="Signed" />
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">TSA</th>
                  <Th field="updated_at" label="Updated" />
                  <Th field="created_at" label="Created" />
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {sessions.map((s) => {
                  const statusInfo = STATUS_LABELS[s.status] ?? { label: s.status, cls: "bg-gray-100 text-gray-600" };
                  const recipient = s.signer_name || s.signer_email || s.link_email_recipient || "—";
                  const recipientSub = s.signer_name && s.signer_email ? s.signer_email : null;
                  const pdfHref = `${API_BASE}/api/v1/public/docufill/sessions/${s.token}/packet.pdf`;
                  return (
                    <tr key={s.token} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-800 line-clamp-1">{s.package_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-800 truncate max-w-[180px]">{recipient}</div>
                        {recipientSub && <div className="text-xs text-gray-400 truncate max-w-[180px]">{recipientSub}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(s.signed_at)}</td>
                      <td className="px-4 py-3"><TsaBadge obtained={s.tsa_obtained} /></td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDatetime(s.updated_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(s.created_at)}</td>
                      <td className="px-4 py-3">
                        {s.status === "generated" ? (
                          <a
                            href={pdfHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2"
                          >
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {s.pdf_stored ? "Stored" : "Generate"}
                          </a>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!error && total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Showing {sessions.length} session{sessions.length !== 1 ? "s" : ""} · Total {total}
      </p>
    </div>
  );
}
