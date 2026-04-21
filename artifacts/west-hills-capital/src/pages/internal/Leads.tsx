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

interface Appointment {
  id: number;
  confirmation_id: string;
  scheduled_time: string;
  day_label: string;
  time_label: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  state: string;
  allocation_type: string | null;
  status: string;
  lead_id: number | null;
  created_at: string;
}

interface PipelineRow {
  key: string;
  leadId: number | null;
  confirmationId: string | null;
  prospectId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  state: string | null;
  allocationType: string | null;
  scheduledLabel: string | null;
  status: string;
  createdAt: string;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    new:       "bg-blue-900 text-blue-300",
    contacted: "bg-yellow-900 text-yellow-300",
    qualified: "bg-green-900 text-green-300",
    closed:    "bg-white text-[#6B7A99]",
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

function buildPipelineRows(leads: Lead[], appointments: Appointment[]): PipelineRow[] {
  const latestAppointmentByLeadId = new Map<number, Appointment>();
  const sortedAppointments = [...appointments].sort(
    (a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime(),
  );

  for (const appt of sortedAppointments) {
    if (appt.lead_id && !latestAppointmentByLeadId.has(appt.lead_id)) {
      latestAppointmentByLeadId.set(appt.lead_id, appt);
    }
  }

  const leadRows = leads.map((lead): PipelineRow => {
    const appt = latestAppointmentByLeadId.get(lead.id);
    return {
      key: `lead-${lead.id}`,
      leadId: lead.id,
      confirmationId: appt?.confirmation_id ?? lead.linked_confirmation_id,
      prospectId: String(lead.id),
      firstName: lead.first_name,
      lastName: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      state: lead.state,
      allocationType: lead.allocation_type,
      scheduledLabel: appt ? `${appt.day_label} ${appt.time_label}` : null,
      status: lead.status,
      createdAt: lead.created_at,
    };
  });

  const orphanScheduledCallRows = appointments
    .filter((appt) => !appt.lead_id || !leads.some((lead) => lead.id === appt.lead_id))
    .map((appt): PipelineRow => ({
      key: `call-${appt.confirmation_id}`,
      leadId: appt.lead_id,
      confirmationId: appt.confirmation_id,
      prospectId: appt.lead_id ? String(appt.lead_id) : "—",
      firstName: appt.first_name,
      lastName: appt.last_name,
      email: appt.email,
      phone: appt.phone,
      state: appt.state,
      allocationType: appt.allocation_type,
      scheduledLabel: `${appt.day_label} ${appt.time_label}`,
      status: appt.status,
      createdAt: appt.created_at,
    }));

  return [...leadRows, ...orphanScheduledCallRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export default function InternalLeads() {
  const [, navigate] = useLocation();
  const { getAuthHeaders } = useInternalAuth();

  const { data, isLoading, error } = useQuery<PipelineRow[]>({
    queryKey: ["/api/internal/prospecting-pipeline"],
    queryFn: async () => {
      const headers = { ...getAuthHeaders() };
      const [leadsRes, appointmentsRes] = await Promise.all([
        fetch(`${API_BASE}/api/internal/leads`, { headers }),
        fetch(`${API_BASE}/api/internal/appointments`, { headers }),
      ]);
      if (!leadsRes.ok) throw new Error(`Leads HTTP ${leadsRes.status}`);
      if (!appointmentsRes.ok) throw new Error(`Appointments HTTP ${appointmentsRes.status}`);
      const [{ leads }, { appointments }] = await Promise.all([
        leadsRes.json() as Promise<{ leads: Lead[] }>,
        appointmentsRes.json() as Promise<{ appointments: Appointment[] }>,
      ]);
      return buildPipelineRows(leads ?? [], appointments ?? []);
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const prospects = data ?? [];

  function openDeal(row: PipelineRow) {
    const params = new URLSearchParams();
    if (row.leadId) params.set("leadId", String(row.leadId));
    if (row.confirmationId) params.set("confirmationId", row.confirmationId);
    navigate(`/internal/deal-builder?${params.toString()}`);
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F1C3F]">Prospecting Pipeline</h1>
          <p className="text-sm text-[#8A9BB8] mt-1">
            {prospects.length} prospect{prospects.length !== 1 ? "s" : ""} · leads and scheduled calls in one workflow
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="text-[#6B7A99] text-sm py-12 text-center">Loading prospecting pipeline…</div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded px-4 py-3 text-sm">
          Failed to load prospects. Check that the API server is running.
        </div>
      )}

      {!isLoading && !error && prospects.length === 0 && (
        <div className="text-[#8A9BB8] text-sm py-12 text-center">No prospects found.</div>
      )}

      {prospects.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#DDD5C4] shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DDD5C4] bg-white">
                {["Prospect ID", "Name", "Email", "Phone", "State", "Structure", "Scheduled", "Status", "Created", ""].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-[#6B7A99] uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prospects.map((prospect) => (
                <tr
                  key={prospect.key}
                  className="border-b border-[#DDD5C4]/50 hover:bg-white/80 transition-colors"
                >
                  <td className="px-3 py-2.5 text-[#6B7A99] font-mono text-xs">{prospect.prospectId}</td>
                  <td className="px-3 py-2.5 text-[#0F1C3F] font-medium whitespace-nowrap">
                    {prospect.firstName} {prospect.lastName}
                  </td>
                  <td className="px-3 py-2.5 text-[#374560]">{prospect.email}</td>
                  <td className="px-3 py-2.5 text-[#6B7A99] whitespace-nowrap">{prospect.phone ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[#6B7A99]">{prospect.state ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[#6B7A99] max-w-[140px] truncate">
                    {prospect.allocationType ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[#374560] whitespace-nowrap">
                    {prospect.scheduledLabel ?? "Not scheduled"}
                  </td>
                  <td className="px-3 py-2.5">{statusBadge(prospect.status)}</td>
                  <td className="px-3 py-2.5 text-[#8A9BB8] text-xs whitespace-nowrap">
                    {new Date(prospect.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => openDeal(prospect)}
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
