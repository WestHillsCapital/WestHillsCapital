import { useQuery, useMutation } from "@tanstack/react-query";

// Use VITE_API_URL when set (local dev → Railway).
// In production (Vercel), VITE_API_URL is not set so we default to "" which
// routes through Vercel's /api rewrite proxy → Railway. This avoids
// cross-origin POST issues from SSO-protected Vercel deployments.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface AppointmentSlot {
  id: string;
  dateTime: string;
  dayLabel: string;
  timeLabel: string;
  available: boolean;
}

export interface AvailableSlotsResponse {
  slots: AppointmentSlot[];
  timezone: string;
}

export interface BookAppointmentRequest {
  slotId: string;
  allocationType: string;
  allocationRange: string;
  timeline: string;
  state: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface BookAppointmentResponse {
  confirmationId: string;
  scheduledTime: string;
  dayLabel: string;
  timeLabel: string;
  message: string;
}

export function useAvailableSlots() {
  return useQuery<AvailableSlotsResponse>({
    queryKey: ["scheduling-slots"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/scheduling/slots`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ??
            `Scheduling unavailable (${res.status})`
        );
      }
      return res.json() as Promise<AvailableSlotsResponse>;
    },
    retry: 2,
    staleTime: 60_000,
  });
}

export function useBookAppointment() {
  return useMutation<BookAppointmentResponse, Error, BookAppointmentRequest>({
    mutationFn: async (data: BookAppointmentRequest) => {
      const res = await fetch(`${API_BASE}/api/scheduling/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ??
            "Booking failed. Please call (800) 867-6768."
        );
      }

      return res.json() as Promise<BookAppointmentResponse>;
    },
  });
}

export async function submitPrequalLead(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  state: string;
  allocationType: string;
  allocationRange: string;
  timeline: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const url = `${API_BASE}/api/leads/intake`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formType: "schedule_prequal", ...data }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return {
      ok: false,
      message: `Server error ${res.status}: ${(body as { message?: string }).message ?? "unknown"}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
