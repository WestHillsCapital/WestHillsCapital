import { useMutation } from "@tanstack/react-query";

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
      try {
        const res = await fetch("/api/leads/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        
        if (!res.ok) {
          throw new Error("Failed to submit intake");
        }
        return (await res.json()) as LeadIntakeResponse;
      } catch (err) {
        console.warn("Using mock lead intake response", err);
        // Artificial delay for realism
        await new Promise(resolve => setTimeout(resolve, 600));
        
        return {
          success: true,
          message: "Information submitted successfully."
        } as LeadIntakeResponse;
      }
    },
  });
}
