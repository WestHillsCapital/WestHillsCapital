import { useMutation } from "@tanstack/react-query";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface LeadIntakeRequest {
  formType: "ira" | "general";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  state: string;
  allocationType?: string;
  allocationRange?: string;
  timeline?: string;
  currentCustodian?: string;
  notes?: string;
}

export interface LeadIntakeResponse {
  success: boolean;
  message: string;
}

export function useSubmitLeadIntake() {
  return useMutation({
    mutationFn: async (data: LeadIntakeRequest) => {
      const res = await fetch(`${API_BASE}/api/leads/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ?? `HTTP ${res.status}`
        );
      }

      return (await res.json()) as LeadIntakeResponse;
    },
  });
}
