import { useState, useCallback } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function useOpsActions(
  getAuthHeaders:                     () => HeadersInit,
  savedDealId:                        number | null,
  setPaymentReceivedAt:               (ts: string) => void, // legacy
  setWireReceivedAt:                  (ts: string) => void,
  setOrderPaidAt:                     (ts: string) => void,
  setShippedAt:                       (ts: string) => void,
  setDeliveredAt:                     (ts: string) => void,
  setShippingNotificationScheduledAt: (ts: string) => void,
) {
  const [isMarkingWire,     setIsMarkingWire]     = useState(false);
  const [isMarkingDGPaid,   setIsMarkingDGPaid]   = useState(false);
  const [isSavingTracking,  setIsSavingTracking]  = useState(false);
  const [isMarkingDelivered,setIsMarkingDelivered]= useState(false);
  const [opsActionError,    setOpsActionError]    = useState<string | null>(null);

  const patchDeal = useCallback(async (endpoint: string): Promise<unknown> => {
    const res = await fetch(`${API_BASE}/api/deals/${savedDealId}/${endpoint}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Server error" }));
      throw new Error((err as { error?: string }).error ?? "Request failed");
    }
    return res.json();
  }, [savedDealId, getAuthHeaders]);

  // Mark customer wire received (replaces legacy markPaymentReceived)
  const markWireReceived = useCallback(async () => {
    if (!savedDealId) return;
    setIsMarkingWire(true);
    setOpsActionError(null);
    try {
      const data = await patchDeal("wire-received") as { wireReceivedAt?: string };
      setWireReceivedAt(data.wireReceivedAt ?? new Date().toISOString());
      setPaymentReceivedAt(data.wireReceivedAt ?? new Date().toISOString()); // keep legacy in sync
    } catch (err) {
      setOpsActionError(err instanceof Error ? err.message : "Could not mark wire received.");
    } finally {
      setIsMarkingWire(false);
    }
  }, [savedDealId, patchDeal, setWireReceivedAt, setPaymentReceivedAt]);

  // Mark Dillon Gage paid via ACH on Fiztrade
  const markOrderPaid = useCallback(async () => {
    if (!savedDealId) return;
    setIsMarkingDGPaid(true);
    setOpsActionError(null);
    try {
      const data = await patchDeal("order-paid") as { orderPaidAt?: string };
      setOrderPaidAt(data.orderPaidAt ?? new Date().toISOString());
    } catch (err) {
      setOpsActionError(err instanceof Error ? err.message : "Could not mark order paid.");
    } finally {
      setIsMarkingDGPaid(false);
    }
  }, [savedDealId, patchDeal, setOrderPaidAt]);

  // Save tracking number — schedules shipping email 24h later
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
        throw new Error((err as { error?: string }).error ?? "Failed to save tracking number");
      }
      const data = await res.json() as {
        shippingNotificationScheduledAt?: string;
      };
      if (data.shippingNotificationScheduledAt) {
        setShippingNotificationScheduledAt(data.shippingNotificationScheduledAt);
      }
      // Optimistically set shipped_at to the scheduled time so the UI updates
      if (data.shippingNotificationScheduledAt) {
        setShippedAt(data.shippingNotificationScheduledAt);
      }
    } catch (err) {
      setOpsActionError(err instanceof Error ? err.message : "Could not save tracking number.");
    } finally {
      setIsSavingTracking(false);
    }
  }, [savedDealId, getAuthHeaders, setShippingNotificationScheduledAt, setShippedAt]);

  // Mark package delivered — triggers 7d/30d follow-up scheduling
  const markDelivered = useCallback(async () => {
    if (!savedDealId) return;
    setIsMarkingDelivered(true);
    setOpsActionError(null);
    try {
      const data = await patchDeal("delivered") as { deliveredAt?: string };
      setDeliveredAt(data.deliveredAt ?? new Date().toISOString());
    } catch (err) {
      setOpsActionError(err instanceof Error ? err.message : "Could not mark delivered.");
    } finally {
      setIsMarkingDelivered(false);
    }
  }, [savedDealId, patchDeal, setDeliveredAt]);

  return {
    markWireReceived,
    markOrderPaid,
    saveTrackingNumber,
    markDelivered,
    isMarkingWire,
    isMarkingDGPaid,
    isSavingTracking,
    isMarkingDelivered,
    opsActionError,
    // legacy alias — kept so anything referencing markPaymentReceived still compiles
    markPaymentReceived: markWireReceived,
    isMarkingPayment:    isMarkingWire,
  };
}
