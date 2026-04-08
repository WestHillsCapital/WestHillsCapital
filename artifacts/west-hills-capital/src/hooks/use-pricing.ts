import { useQuery } from "@tanstack/react-query";

export interface SpotPrices {
  gold: number;
  silver: number;
  lastUpdated: string;
  source: string;
  goldChange?: number;
  goldChangePercent?: number;
  silverChange?: number;
  silverChangePercent?: number;
  goldBid?: number;
  goldAsk?: number;
  silverBid?: number;
  silverAsk?: number;
}

export interface ProductPrice {
  id: string;
  name: string;
  metal: "gold" | "silver";
  weight: string;
  spotPrice: number;
  spreadPercent: number;
  finalPrice: number;
  iraEligible: boolean;
  deliveryWindow: string;
  imageUrl: string;
  reverseImageUrl?: string;
  description: string;
}

export interface SpotHistoryPoint {
  timestamp: string;
  goldBid: number;
  silverBid: number;
}

export interface SpotHistoryResponse {
  history: SpotHistoryPoint[];
}

export interface ProductPricesResponse {
  products: ProductPrice[];
  lastUpdated: string;
}

export interface BuybackPrice {
  productId: string;
  productName: string;
  buybackPrice: number;
  buybackSpreadPercent: number;
}

export interface BuybackPricesResponse {
  prices: BuybackPrice[];
  disclaimer: string;
  lastUpdated: string;
}

// When VITE_API_URL is set (Vercel production), hit the Railway API directly.
// In local dev (no env var), fall back to relative /api/... paths via Vite proxy.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// All three hooks return null on error so the UI can show explicit "temporarily
// unavailable" states rather than silently displaying stale mock figures.

export function useSpotPrices() {
  return useQuery<SpotPrices | null>({
    queryKey: ["/api/pricing/spot"],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pricing/spot`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as SpotPrices;
      } catch (err) {
        console.warn("Failed to fetch spot prices — live pricing unavailable", err);
        return null; // Explicit unavailable signal; UI shows "—" rather than stale mock prices
      }
    },
    staleTime: 4000,
    refetchInterval: 5000, // Refetch every 5 seconds (matches backend Dillon Gage cache TTL)
  });
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useProductPrices() {
  return useQuery<ProductPricesResponse | null>({
    queryKey: ["/api/pricing/products"],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pricing/products`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ProductPricesResponse;
        return {
          ...data,
          products: data.products.map((p) => ({
            ...p,
            imageUrl: p.imageUrl.startsWith("/") ? `${BASE}${p.imageUrl}` : p.imageUrl,
            reverseImageUrl: p.reverseImageUrl
              ? p.reverseImageUrl.startsWith("/") ? `${BASE}${p.reverseImageUrl}` : p.reverseImageUrl
              : undefined,
          })),
        };
      } catch (err) {
        console.warn("Failed to fetch product prices — product pricing unavailable", err);
        return null;
      }
    },
    staleTime: 4000,
    refetchInterval: 5000,
  });
}

export function useBuybackPrices() {
  return useQuery<BuybackPricesResponse | null>({
    queryKey: ["/api/pricing/buyback"],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pricing/buyback`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as BuybackPricesResponse;
      } catch (err) {
        console.warn("Failed to fetch buyback prices — buyback indications unavailable", err);
        return null;
      }
    },
    staleTime: 4000,
  });
}

export type ChartPeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "ALL";

export function useSpotHistory(period: ChartPeriod = "1M") {
  // Short periods update live; longer periods are historical and only need occasional refresh
  const isLive = period === "1D" || period === "1W" || period === "1M";
  const staleMs = isLive ? 60_000 : 10 * 60_000;
  return useQuery({
    queryKey: ["/api/pricing/history", period],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pricing/history?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch price history");
      return (await res.json()) as SpotHistoryResponse;
    },
    staleTime: staleMs,
    refetchInterval: staleMs,
  });
}
