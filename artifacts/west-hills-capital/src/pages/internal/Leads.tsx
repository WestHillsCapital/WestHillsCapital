import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useInternalAuth } from "../../hooks/useInternalAuth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface Lead {
  id: number;
  form_type: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  state: string | null;
  allocation_type: string | null;
  allocation_range: string | null;
  timeline: string | null;
  status: string;
  notes: string | null;
  linked_confirmation_id: string | null;
  created_at: string;
  updated_at: string;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    new:       "bg-blue-900 text-blue-300",
    contacted: "bg-yellow-900 text-yellow-300",
    qualified: "bg-green-900 text-green-300",
    closed:    "bg-[#F9F6F1] text-[#6B7A99]",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? "bg-[#F9F6F1] text-[#374560]"}`}>
      {status}
    </span>
  );
}

export default function InternalLeads() {
  const [, navigate] = useLocation();
  const { getAuthHeaders } = useInternalAuth();

  const { data, isLoading, error } = useQuery<{ leads: Lead[] }>({
    queryKey: ["/api/internal/leads"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/internal/leads`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const leads = data?.leads ?? [];

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F1C3F]">Leads</h1>
          <p className="text-sm text-[#8A9BB8] mt-1">
            {leads.length} lead{leads.length !== 1 ? "s" : ""} · click a row or use Open Deal
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="text-[#6B7A99] text-sm py-12 text-center">Loading leads…</div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded px-4 py-3 text-sm">
          Failed to load leads. Check that the API server is running.
        </div>
      )}

      {!isLoading && !error && leads.length === 0 && (
        <div className="text-[#8A9BB8] text-sm py-12 text-center">No leads found.</div>
      )}

      {leads.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#DDD5C4] shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DDD5C4] bg-white">
                {["ID", "Name", "Email", "Phone", "State", "Structure", "Status", "Created", ""].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-[#6B7A99] uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-[#DDD5C4]/50 hover:bg-[#F5F0E8]/80 transition-colors"
                >
                  <td className="px-3 py-2.5 text-[#6B7A99] font-mono text-xs">{lead.id}</td>
                  <td className="px-3 py-2.5 text-[#0F1C3F] font-medium whitespace-nowrap">
                    {lead.first_name} {lead.last_name}
                  </td>
                  <td className="px-3 py-2.5 text-[#374560]">{lead.email}</td>
                  <td className="px-3 py-2.5 text-[#6B7A99] whitespace-nowrap">{lead.phone ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[#6B7A99]">{lead.state ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[#6B7A99] max-w-[140px] truncate">
                    {lead.allocation_type ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">{statusBadge(lead.status)}</td>
                  <td className="px-3 py-2.5 text-[#8A9BB8] text-xs whitespace-nowrap">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => navigate(`/internal/deal-builder?leadId=${lead.id}`)}
                      className="px-3 py-1 rounded text-xs font-medium bg-[#C49A38]/20 text-[#C49A38] hover:bg-[#C49A38]/30 transition-colors whitespace-nowrap"
                    >
                      Open Deal
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
