import { useState, useCallback, useEffect } from "react";
import type { SpotData, ProductRow } from "../types";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function useSpotPricing(
  urlDealId: string,
  setSpotData: (s: SpotData) => void,
  setRows: React.Dispatch<React.SetStateAction<ProductRow[]>>,
) {
  const [isFetchingSpot, setIsFetchingSpot] = useState(false);
  const [spotError,      setSpotError]      = useState<string | null>(null);

  const getSpotPrice = useCallback(async () => {
    setIsFetchingSpot(true);
    setSpotError(null);
    try {
      const [spotRes, prodRes] = await Promise.all([
        fetch(`${API_BASE}/api/pricing/spot`),
        fetch(`${API_BASE}/api/pricing/products`),
      ]);
      if (!spotRes.ok || !prodRes.ok) throw new Error("Pricing API unavailable");

      const spotJson = await spotRes.json();
      const prodJson = await prodRes.json();

      setSpotData({
        goldSpotAsk:   spotJson.goldAsk   ?? spotJson.gold   ?? null,
        silverSpotAsk: spotJson.silverAsk ?? spotJson.silver ?? null,
        spotTimestamp: new Date().toISOString(),
      });

      const apiProducts: { id: string; name: string; metal: "gold" | "silver"; finalPrice: number }[] =
        prodJson.products ?? [];

      setRows((prev) => {
        // Build a map of what the user has typed so far (qty, unitPrice overrides)
        const prevMap: Record<string, { qty: string; unitPrice: string }> = {};
        for (const r of prev) prevMap[r.productId] = { qty: r.qty, unitPrice: r.unitPrice };

        // Rebuild rows from the API response — this is the single source of truth
        // for productId, productName, and metal.  Qty is preserved from previous state.
        const updated = apiProducts.map((p) => ({
          productId:   p.id,
          productName: p.name,
          metal:       p.metal,
          qty:         prevMap[p.id]?.qty ?? "",
          unitPrice:   String(p.finalPrice),
        }));

        // If the API returned nothing (e.g. network glitch), keep existing rows unchanged
        return updated.length > 0 ? updated : prev;
      });
    } catch {
      setSpotError("Could not fetch live pricing. Check API connection.");
    } finally {
      setIsFetchingSpot(false);
    }
  }, [setSpotData, setRows]);

  // Auto-fetch on mount for new deals only
  useEffect(() => {
    if (!urlDealId) void getSpotPrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { getSpotPrice, isFetchingSpot, spotError };
}
