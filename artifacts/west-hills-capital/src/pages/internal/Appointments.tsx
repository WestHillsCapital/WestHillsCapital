import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useInternalAuth } from "../../hooks/useInternalAuth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface Appointment {
  id: number;
  confirmation_id: string;
  slot_id: string;
  scheduled_time: string;
  day_label: string;
  time_label: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  state: string;
  allocation_type: string | null;
  allocation_range: string | null;
  timeline: string | null;
  status: string;
  lead_id: number | null;
  notes: string | null;
  created_at: string;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    confirmed: "bg-green-900 text-green-300",
    cancelled: "bg-red-900 text-red-300",
    completed: "bg-white text-[#6B7A99]",
    no_show:   "bg-yellow-900 text-yellow-300",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? "bg-white text-[#374560]"}`}>
      {status}
    </span>
  );
}

export default function InternalAppointments() {
  const [, navigate] = useLocation();
  const { getAuthHeaders } = useInternalAuth();

  const { data, isLoading, error } = useQuery<{ appointments: Appointment[] }>({
    queryKey: ["/api/internal/appointments"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/internal/appointments`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const appts = data?.appointments ?? [];

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F1C3F]">Scheduled Calls</h1>
          <p className="text-sm text-[#8A9BB8] mt-1">
            {appts.length} scheduled call{appts.length !== 1 ? "s" : ""} · use Open Deal to start a deal for any contact
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="text-[#6B7A99] text-sm py-12 text-center">Loading scheduled calls…</div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded px-4 py-3 text-sm">
          Failed to load scheduled calls. Check that the API server is running.
        </div>
      )}

      {!isLoading && !error && appts.length === 0 && (
        <div className="text-[#8A9BB8] text-sm py-12 text-center">No scheduled calls found.</div>
      )}

      {appts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#DDD5C4] shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DDD5C4] bg-white">
                {["Call ID", "Name", "Email", "Phone", "State", "Scheduled", "Structure", "Status", "Prospect", ""].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-[#6B7A99] uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appts.map((appt) => (
                <tr
                  key={appt.id}
                  className="border-b border-[#DDD5C4]/50 hover:bg-white/80 transition-colors"
                >
                  <td className="px-3 py-2.5 text-[#C49A38] font-mono text-xs">{appt.confirmation_id}</td>
                  <td className="px-3 py-2.5 text-[#0F1C3F] font-medium whitespace-nowrap">
                    {appt.first_name} {appt.last_name}
                  </td>
                  <td className="px-3 py-2.5 text-[#374560]">{appt.email}</td>
                  <td className="px-3 py-2.5 text-[#6B7A99] whitespace-nowrap">{appt.phone}</td>
                  <td className="px-3 py-2.5 text-[#6B7A99]">{appt.state}</td>
                  <td className="px-3 py-2.5 text-[#374560] whitespace-nowrap">
                    {appt.day_label} {appt.time_label}
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7A99] max-w-[120px] truncate">
                    {appt.allocation_type ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">{statusBadge(appt.status)}</td>
                  <td className="px-3 py-2.5 text-[#8A9BB8] text-xs">
                    {appt.lead_id ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() =>
                        navigate(
                          `/internal/deal-builder?confirmationId=${encodeURIComponent(appt.confirmation_id)}${appt.lead_id ? `&leadId=${appt.lead_id}` : ""}`
                        )
                      }
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
