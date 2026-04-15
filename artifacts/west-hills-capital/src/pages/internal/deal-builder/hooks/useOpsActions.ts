import { useState, useCallback } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function useOpsActions(
  getAuthHeaders:      () => HeadersInit,
  savedDealId:         number | null,
  setPaymentReceivedAt: (ts: string) => void,
) {
  const [isMarkingPayment, setIsMarkingPayment] = useState(false);
  const [isSavingTracking, setIsSavingTracking] = useState(false);
  const [opsActionError,   setOpsActionError]   = useState<string | null>(null);

  const markPaymentReceived = useCallback(async () => {
    if (!savedDealId) return;
    setIsMarkingPayment(true);
    setOpsActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/deals/${savedDealId}/payment`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error ?? "Failed to mark payment");
      }
      const data = await res.json();
      setPaymentReceivedAt(data.paymentReceivedAt ?? new Date().toISOString());
    } catch (err) {
      setOpsActionError(err instanceof Error ? err.message : "Could not mark payment received.");
    } finally {
      setIsMarkingPayment(false);
    }
  }, [savedDealId, getAuthHeaders, setPaymentReceivedAt]);

  const saveTrackingNumber = useCallback(async (trackingNumber: string) => {
    if (!savedDealId || !trackingNumber.trim()) return;
    setIsSavingTracking(true);
    setOpsActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/deals/${savedDealId}/tracking`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ trackingNumber: trackingNumber.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error ?? "Failed to save tracking number");
      }
    } catch (err) {
      setOpsActionError(err instanceof Error ? err.message : "Could not save tracking number.");
    } finally {
      setIsSavingTracking(false);
    }
  }, [savedDealId, getAuthHeaders]);

  return { markPaymentReceived, saveTrackingNumber, isMarkingPayment, isSavingTracking, opsActionError };
}
