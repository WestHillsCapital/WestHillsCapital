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

// Fallback data in case the backend endpoints aren't live yet
const MOCK_SPOT_PRICES: SpotPrices = {
  gold: 2384.50,
  silver: 28.75,
  lastUpdated: new Date().toISOString(),
  source: "Mock Market Data"
};

const MOCK_PRODUCTS: ProductPricesResponse = {
  products: [
    {
      id: "gold-eagle",
      name: "1 oz Gold American Eagle",
      metal: "gold",
      weight: "1 oz",
      spotPrice: 2384.50,
      spreadPercent: 4.5,
      finalPrice: 2491.80,
      iraEligible: true,
      deliveryWindow: "3-5 Business Days",
      imageUrl: `${import.meta.env.BASE_URL}images/gold-eagle.png`,
      description: "The official gold bullion coin of the United States, guaranteed by the U.S. Mint for weight and purity."
    },
    {
      id: "gold-buffalo",
      name: "1 oz Gold American Buffalo",
      metal: "gold",
      weight: "1 oz",
      spotPrice: 2384.50,
      spreadPercent: 4.5,
      finalPrice: 2491.80,
      iraEligible: true,
      deliveryWindow: "3-5 Business Days",
      imageUrl: `${import.meta.env.BASE_URL}images/gold-buffalo.png`,
      description: "The first .9999 fine 24-karat gold coin ever struck by the United States Mint."
    },
    {
      id: "silver-eagle",
      name: "1 oz Silver American Eagle",
      metal: "silver",
      weight: "1 oz",
      spotPrice: 28.75,
      spreadPercent: 12.0,
      finalPrice: 32.20,
      iraEligible: true,
      deliveryWindow: "3-5 Business Days",
      imageUrl: `${import.meta.env.BASE_URL}images/silver-eagle.png`,
      description: "The most popular silver bullion coin in the world, widely traded and highly liquid."
    }
  ],
  lastUpdated: new Date().toISOString(),
};

const MOCK_BUYBACK: BuybackPricesResponse = {
  prices: [
    { productId: "gold-eagle", productName: "1 oz Gold American Eagle", buybackPrice: 2372.50, buybackSpreadPercent: -0.5 },
    { productId: "gold-buffalo", productName: "1 oz Gold American Buffalo", buybackPrice: 2372.50, buybackSpreadPercent: -0.5 },
    { productId: "silver-eagle", productName: "1 oz Silver American Eagle", buybackPrice: 28.15, buybackSpreadPercent: -2.0 },
  ],
  disclaimer: "Buyback prices are indications only. Final price confirmed upon receipt and authentication of metals at the depository.",
  lastUpdated: new Date().toISOString()
};

export function useSpotPrices() {
  return useQuery({
    queryKey: ["/api/pricing/spot"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/pricing/spot");
        if (!res.ok) throw new Error("Network response was not ok");
        return (await res.json()) as SpotPrices;
      } catch (err) {
        console.warn("Failed to fetch spot prices, using mock data", err);
        return MOCK_SPOT_PRICES;
      }
    },
    staleTime: 4000,
    refetchInterval: 5000, // Refetch every 5 seconds (matches backend Dillon Gage cache TTL)
  });
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useProductPrices() {
  return useQuery({
    queryKey: ["/api/pricing/products"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/pricing/products");
        if (!res.ok) throw new Error("Network response was not ok");
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
        console.warn("Failed to fetch product prices, using mock data", err);
        return MOCK_PRODUCTS;
      }
    },
    staleTime: 4000,
    refetchInterval: 5000,
  });
}

export function useBuybackPrices() {
  return useQuery({
    queryKey: ["/api/pricing/buyback"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/pricing/buyback");
        if (!res.ok) throw new Error("Network response was not ok");
        return (await res.json()) as BuybackPricesResponse;
      } catch (err) {
        console.warn("Failed to fetch buyback prices, using mock data", err);
        return MOCK_BUYBACK;
      }
    },
    staleTime: 4000,
  });
}

export function useSpotHistory() {
  return useQuery({
    queryKey: ["/api/pricing/history"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/history");
      if (!res.ok) throw new Error("Failed to fetch price history");
      return (await res.json()) as SpotHistoryResponse;
    },
    staleTime: 5 * 60 * 1000,      // refresh every 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });
}
