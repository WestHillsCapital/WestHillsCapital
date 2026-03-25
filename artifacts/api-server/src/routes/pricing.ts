import { Router, type IRouter } from "express";
import {
  GetSpotPricesResponse,
  GetProductPricesResponse,
  GetBuybackPricesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Dillon Gage / Fiztrade API ──────────────────────────────────────────────
const DG_TOKEN = process.env.DILLON_GAGE_API_KEY;
const DG_BASE = "https://connect.fiztrade.com/FizServices";

// ─── Dillon Gage per-product dealer premiums (% over spot bid) ───────────────
// DG prices each product at a specific percentage over spot. These rates are
// confirmed by West Hills Capital's account pricing at connect.fiztrade.com.
// Replace with live GetPricesForProducts values once the portal is configured —
// that endpoint will return DG's exact per-product dealer price directly.
//
//   Gold Eagle  (Fiztrade: 1EAGLE) — DG charges WHC 1.5% over spot
//   Gold Buffalo (Fiztrade: 1B)    — DG charges WHC 2.0% over spot
//   Silver Eagle (Fiztrade: SE)    — DG charges WHC ~5.42% over spot (ASE mint premium)
//
const DG_PREMIUM_PERCENT = {
  goldEagle:   1.5,   // confirmed 2026-03-25
  goldBuffalo: 2.0,   // confirmed 2026-03-25
  silverEagle: 5.42,  // derived: $74.90 DG / $71.05 spot on 2026-03-24
};

// ─── West Hills Capital commission (applied on top of DG dealer price) ───────
const GOLD_COMMISSION_PERCENT = 2;   // 2% over DG dealer price
const SILVER_COMMISSION_PERCENT = 5; // 5% over DG dealer price

// ─── Buyback spread (below spot) ─────────────────────────────────────────────
const GOLD_BUYBACK_SPREAD_PERCENT = 1;
const SILVER_BUYBACK_SPREAD_PERCENT = 3;

// ─── In-memory cache (poll up to once per second per Fiztrade API docs) ──────
let cachedSpot: {
  gold: number;
  silver: number;
  goldBid: number;
  goldAsk: number;
  silverBid: number;
  silverAsk: number;
  goldChange: number;
  silverChange: number;
  goldChangePercent: number;
  silverChangePercent: number;
  lastUpdated: string;
  source: string;
} | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 5000; // Refresh every 5 seconds

async function getLiveSpot() {
  const now = Date.now();
  if (cachedSpot && now - cacheTs < CACHE_TTL_MS) {
    return cachedSpot;
  }

  if (!DG_TOKEN) {
    throw new Error("DILLON_GAGE_API_KEY environment variable is not set");
  }

  const res = await fetch(`${DG_BASE}/GetSpotPriceData/${DG_TOKEN}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Dillon Gage API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    goldBid: number;
    goldAsk: number;
    silverBid: number;
    silverAsk: number;
    goldChange: number;
    silverChange: number;
    goldChangePercent: number;
    silverChangePercent: number;
  };

  cachedSpot = {
    gold: data.goldBid,
    silver: data.silverBid,
    goldBid: data.goldBid,
    goldAsk: data.goldAsk,
    silverBid: data.silverBid,
    silverAsk: data.silverAsk,
    goldChange: data.goldChange,
    silverChange: data.silverChange,
    goldChangePercent: data.goldChangePercent,
    silverChangePercent: data.silverChangePercent,
    lastUpdated: new Date().toISOString(),
    source: "dillon-gage",
  };
  cacheTs = now;

  return cachedSpot;
}

// GET /api/pricing/spot
router.get("/spot", async (_req, res) => {
  try {
    const spot = await getLiveSpot();
    const data = GetSpotPricesResponse.parse({
      gold: spot.gold,
      silver: spot.silver,
      lastUpdated: spot.lastUpdated,
      source: spot.source,
      goldChange: spot.goldChange,
      goldChangePercent: spot.goldChangePercent,
      silverChange: spot.silverChange,
      silverChangePercent: spot.silverChangePercent,
      goldBid: spot.goldBid,
      goldAsk: spot.goldAsk,
      silverBid: spot.silverBid,
      silverAsk: spot.silverAsk,
    });
    res.json(data);
  } catch (err) {
    console.error("Error fetching spot prices:", err);
    res.status(502).json({ error: "Unable to fetch live spot prices" });
  }
});

// GET /api/pricing/products
router.get("/products", async (_req, res) => {
  try {
    const spot = await getLiveSpot();

    // Customers buy at Ask; WHC buys back at Bid.
    // spot × (1 + DG_premium%) × (1 + WHC_commission%) — per product, based on Ask
    const dgPrice = (spotAsk: number, dgPremiumPct: number) =>
      spotAsk * (1 + dgPremiumPct / 100);
    const calcFinalPrice = (spotAsk: number, dgPremiumPct: number, commissionPct: number) =>
      Math.round(dgPrice(spotAsk, dgPremiumPct) * (1 + commissionPct / 100) * 100) / 100;

    // ─── Product definitions ────────────────────────────────────────────────
    // Dillon Gage Fiztrade product codes (for use with GetPricesForProducts
    // once products are configured in the Fiztrade portal at connect.fiztrade.com):
    //   1EAGLE  → 1 oz American Gold Eagle
    //   1B      → 1 oz American Gold Buffalo
    //   SE      → 1 oz American Silver Eagle (Random Year)
    const products = [
      {
        id: "gold-american-eagle-1oz",
        name: "1 oz American Gold Eagle",
        metal: "gold" as const,
        weight: "1 troy oz",
        spotPrice: spot.goldAsk,  // Ask: basis for customer buy prices
        spreadPercent: GOLD_COMMISSION_PERCENT,
        finalPrice: calcFinalPrice(spot.goldAsk, DG_PREMIUM_PERCENT.goldEagle, GOLD_COMMISSION_PERCENT),
        iraEligible: true,
        deliveryWindow: "",
        imageUrl: "/images/gold-eagle.png",
        description:
          "The Gold American Eagle is the official gold bullion coin of the United States, struck from 91.67% pure gold. Among the most widely recognized and liquid coins in the world.",
      },
      {
        id: "gold-american-buffalo-1oz",
        name: "1 oz American Gold Buffalo",
        metal: "gold" as const,
        weight: "1 troy oz",
        spotPrice: spot.goldAsk,  // Ask: basis for customer buy prices
        spreadPercent: GOLD_COMMISSION_PERCENT,
        finalPrice: calcFinalPrice(spot.goldAsk, DG_PREMIUM_PERCENT.goldBuffalo, GOLD_COMMISSION_PERCENT),
        iraEligible: true,
        deliveryWindow: "",
        imageUrl: "/images/gold-buffalo.png",
        description:
          "The Gold American Buffalo is the first 24-karat gold coin struck by the United States Mint. At .9999 fine gold purity, it is one of the most refined gold coins available.",
      },
      {
        id: "silver-american-eagle-1oz",
        name: "1 oz American Silver Eagle",
        metal: "silver" as const,
        weight: "1 troy oz",
        spotPrice: spot.silverAsk,  // Ask: basis for customer buy prices
        spreadPercent: SILVER_COMMISSION_PERCENT,
        finalPrice: calcFinalPrice(spot.silverAsk, DG_PREMIUM_PERCENT.silverEagle, SILVER_COMMISSION_PERCENT),
        iraEligible: true,
        deliveryWindow: "",
        imageUrl: "/images/silver-eagle.png",
        description:
          "The Silver American Eagle is the official silver bullion coin of the United States. At .999 fine silver, it is one of the most widely held and recognized silver coins globally.",
      },
    ];

    const data = GetProductPricesResponse.parse({
      products,
      lastUpdated: spot.lastUpdated,
    });

    res.json(data);
  } catch (err) {
    console.error("Error fetching product prices:", err);
    res.status(502).json({ error: "Unable to fetch live product prices" });
  }
});

// GET /api/pricing/buyback
router.get("/buyback", async (_req, res) => {
  try {
    const spot = await getLiveSpot();

    const goldBuyback = (price: number) =>
      Math.round(price * (1 - GOLD_BUYBACK_SPREAD_PERCENT / 100) * 100) / 100;
    const silverBuyback = (price: number) =>
      Math.round(price * (1 - SILVER_BUYBACK_SPREAD_PERCENT / 100) * 100) / 100;

    // WHC buys back at Bid — the lower of the two spot prices
    const prices = [
      {
        productId: "gold-american-eagle-1oz",
        productName: "1 oz Gold American Eagle",
        buybackPrice: goldBuyback(spot.goldBid),
        buybackSpreadPercent: GOLD_BUYBACK_SPREAD_PERCENT,
      },
      {
        productId: "gold-american-buffalo-1oz",
        productName: "1 oz Gold American Buffalo",
        buybackPrice: goldBuyback(spot.goldBid),
        buybackSpreadPercent: GOLD_BUYBACK_SPREAD_PERCENT,
      },
      {
        productId: "silver-american-eagle-1oz",
        productName: "1 oz Silver American Eagle",
        buybackPrice: silverBuyback(spot.silverBid),
        buybackSpreadPercent: SILVER_BUYBACK_SPREAD_PERCENT,
      },
    ];

    const data = GetBuybackPricesResponse.parse({
      prices,
      disclaimer:
        "Buyback prices are estimates based on current spot prices and are subject to change at the time of transaction. All buybacks require verbal confirmation and are subject to product condition and market conditions at time of execution. West Hills Capital reserves the right to adjust buyback pricing based on current market conditions.",
      lastUpdated: spot.lastUpdated,
    });

    res.json(data);
  } catch (err) {
    console.error("Error fetching buyback prices:", err);
    res.status(502).json({ error: "Unable to fetch live buyback prices" });
  }
});

// TEMP: test GetFeaturedProducts — remove after confirmed working
router.get("/dg-probe", async (_req, res) => {
  if (!DG_TOKEN) return res.status(500).json({ error: "No token" });
  try {
    const r = await fetch(`${DG_BASE}/GetFeaturedProducts/${DG_TOKEN}`, {
      headers: { Accept: "application/json" },
    });
    const text = await r.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text; }
    res.json({ status: r.status, length: text.length, body });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
