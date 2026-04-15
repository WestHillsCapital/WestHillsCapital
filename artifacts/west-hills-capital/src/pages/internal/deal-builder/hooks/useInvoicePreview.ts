import { useState, useCallback } from "react";
import type { DealState } from "./useDealState";
import { parseNum, parseQty } from "../utils";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function useInvoicePreview(
  getAuthHeaders: () => HeadersInit,
  s: DealState,
  subtotal: number,
  shipping: number,
  total: number,
) {
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  const handlePreviewInvoice = useCallback(async () => {
    setIsGeneratingPreview(true);
    try {
      const activeProducts = s.rows
        .filter((r) => parseQty(r.qty) > 0 && parseNum(r.unitPrice) > 0)
        .map((r) => ({
          productName: r.productName,
          qty:         parseQty(r.qty),
          unitPrice:   parseNum(r.unitPrice),
          lineTotal:   parseQty(r.qty) * parseNum(r.unitPrice),
        }));

      const res = await fetch(`${API_BASE}/api/deals/preview-invoice`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          firstName:          s.customer.firstName || "Preview",
          lastName:           s.customer.lastName  || "Client",
          email:              s.customer.email,
          phone:              s.customer.phone              || undefined,
          state:              s.customer.state              || undefined,
          dealType:           s.dealType,
          shippingMethod:     s.deliveryMethod,
          fedexLocation:      s.fedexLocation               || undefined,
          fedexLocationHours: s.fedexLocationHours          || undefined,
          shipToLine1:        s.shipToLine1                 || undefined,
          shipToCity:         s.shipToCity                  || undefined,
          shipToState:        s.shipToState                 || undefined,
          shipToZip:          s.shipToZip                   || undefined,
          billingLine1:       s.billingLine1                || undefined,
          billingLine2:       s.billingLine2                || undefined,
          billingCity:        s.billingCity                 || undefined,
          billingState:       s.billingState                || undefined,
          billingZip:         s.billingZip                  || undefined,
          products:           activeProducts,
          subtotal,
          shipping,
          total,
          goldSpotAsk:        s.spotData.goldSpotAsk        ?? undefined,
          silverSpotAsk:      s.spotData.silverSpotAsk      ?? undefined,
        }),
      });

      if (!res.ok) throw new Error("Server error generating preview");

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `WHC-PREVIEW-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not generate preview PDF.");
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [getAuthHeaders, s, subtotal, shipping, total]);

  return { handlePreviewInvoice, isGeneratingPreview };
}
