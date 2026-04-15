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

      const priceMap: Record<string, number> = {};
      for (const p of prodJson.products ?? []) {
        priceMap[p.id] = p.finalPrice;
      }
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          unitPrice: priceMap[r.productId] != null
            ? String(priceMap[r.productId])
            : r.unitPrice,
        }))
      );
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
