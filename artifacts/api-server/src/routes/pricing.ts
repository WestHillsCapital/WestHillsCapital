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

// ─── Dillon Gage product codes ────────────────────────────────────────────────
//   1EAGLE  → 1 oz American Gold Eagle
//   1B      → 1 oz American Gold Buffalo
//   SE      → 1 oz American Silver Eagle
const DG_PRODUCTS = ["1EAGLE", "1B", "SE"] as const;

// ─── Fallback DG premiums (used only if GetPricesForProducts call fails) ─────
const DG_FALLBACK_PREMIUM_PERCENT = {
  goldEagle:   1.5,
  goldBuffalo: 2.0,
  silverEagle: 4.56,
};

// ─── West Hills Capital commission (applied on top of DG dealer price) ───────
const GOLD_COMMISSION_PERCENT = 2;   // 2% over DG dealer price
const SILVER_COMMISSION_PERCENT = 5; // 5% over DG dealer price

// ─── Buyback spread (below spot) ─────────────────────────────────────────────
const GOLD_BUYBACK_SPREAD_PERCENT = 1;
const SILVER_BUYBACK_SPREAD_PERCENT = 3;

// ─── In-memory cache (poll up to once per second per Fiztrade API docs) ──────
type DGProductTier = {
  bid: number;
  ask: number;
  bidPercise: number;
  askPercise: number;
  spread: number;
};

type DGProductData = {
  code: string;
  tier1: DGProductTier;
  availability: string;
  metalType: number; // 1 = gold, 2 = silver
  isIRAConnectBidEligible: string;
  images: { imgType: string; imgPath: string }[];
};

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

let cachedProducts: DGProductData[] | null = null;
let productCacheTs = 0;

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

async function getLiveProductData(): Promise<DGProductData[]> {
  const now = Date.now();
  if (cachedProducts && now - productCacheTs < CACHE_TTL_MS) {
    return cachedProducts;
  }

  if (!DG_TOKEN) {
    throw new Error("DILLON_GAGE_API_KEY environment variable is not set");
  }

  const res = await fetch(
    `${DG_BASE}/GetPricesForProducts/${DG_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify([...DG_PRODUCTS]),
    },
  );

  if (!res.ok) {
    throw new Error(`DG GetPricesForProducts error: ${res.status}`);
  }

  const raw = (await res.json()) as {
    code: string;
    tiers: Record<string, DGProductTier>;
    availability: string;
    metalType: number;
    isIRAConnectBidEligible: string;
    images?: { imgCode: string; imgType: string; imgPath: string }[];
  }[];

  cachedProducts = raw.map((p) => ({
    code: p.code,
    tier1: p.tiers["1"],
    availability: p.availability ?? "",
    metalType: p.metalType,
    isIRAConnectBidEligible: p.isIRAConnectBidEligible,
    images: (p.images ?? []).map((img) => ({ imgType: img.imgType, imgPath: img.imgPath })),
  }));
  productCacheTs = now;

  return cachedProducts;
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

// Local fallback image paths (used when DG CDN has no image for a product)
const LOCAL_FALLBACK_IMAGES: Record<string, string> = {
  "1EAGLE": "/images/gold-eagle.png",
  "1B":     "/images/gold-buffalo-obverse.png",
  "SE":     "/images/silver-eagle.png",
};

const LOCAL_FALLBACK_REVERSE_IMAGES: Record<string, string> = {
  "1B": "/images/gold-buffalo-reverse.png",
};

function pickImage(dgImages: { imgType: string; imgPath: string }[], code: string): string {
  // Prefer obv250 (250x250) → default → obverse (600x600) from DG CDN
  const preferred = ["obv250", "default", "obverse"];
  for (const type of preferred) {
    const img = dgImages.find((i) => i.imgType === type);
    if (img) return img.imgPath;
  }
  return LOCAL_FALLBACK_IMAGES[code] ?? "/images/gold-eagle.png";
}

function pickReverseImage(dgImages: { imgType: string; imgPath: string }[], code: string): string | undefined {
  // Prefer rev250 (250x250) → reverse (600x600) for hover/flip; fall back to local assets
  const preferred = ["rev250", "reverse"];
  for (const type of preferred) {
    const img = dgImages.find((i) => i.imgType === type);
    if (img) return img.imgPath;
  }
  return LOCAL_FALLBACK_REVERSE_IMAGES[code];
}

// GET /api/pricing/products
router.get("/products", async (_req, res) => {
  try {
    const [spot, dgProducts] = await Promise.all([
      getLiveSpot(),
      getLiveProductData().catch((err) => {
        console.warn("GetPricesForProducts failed, using spot fallback:", err);
        return null;
      }),
    ]);

    const withCommission = (dgAsk: number, commissionPct: number) =>
      Math.round(dgAsk * (1 + commissionPct / 100) * 100) / 100;

    // Fallback calculation used if DG product data unavailable
    const fallbackPrice = (spotAsk: number, premiumPct: number, commissionPct: number) =>
      Math.round(spotAsk * (1 + premiumPct / 100) * (1 + commissionPct / 100) * 100) / 100;

    const dg = (code: string) => dgProducts?.find((p) => p.code === code) ?? null;

    const eagleDG  = dg("1EAGLE");
    const buffDG   = dg("1B");
    const silverDG = dg("SE");

    const products = [
      {
        id: "gold-american-eagle-1oz",
        name: "1 oz American Gold Eagle",
        metal: "gold" as const,
        weight: "1 troy oz",
        spotPrice: spot.goldBid,  // Market gold spot — visible reference, not dealer cost
        spreadPercent: GOLD_COMMISSION_PERCENT,
        finalPrice: eagleDG
          ? withCommission(eagleDG.tier1.ask, GOLD_COMMISSION_PERCENT)
          : fallbackPrice(spot.goldAsk, DG_FALLBACK_PREMIUM_PERCENT.goldEagle, GOLD_COMMISSION_PERCENT),
        iraEligible: eagleDG ? eagleDG.isIRAConnectBidEligible === "Y" : true,
        deliveryWindow: eagleDG?.availability ?? "",
        imageUrl: pickImage(eagleDG?.images ?? [], "1EAGLE"),
        reverseImageUrl: pickReverseImage(eagleDG?.images ?? [], "1EAGLE"),
        description:
          "The Gold American Eagle is the official gold bullion coin of the United States, struck from 91.67% pure gold. Among the most widely recognized and liquid coins in the world.",
      },
      {
        id: "gold-american-buffalo-1oz",
        name: "1 oz American Gold Buffalo",
        metal: "gold" as const,
        weight: "1 troy oz",
        spotPrice: spot.goldBid,  // Market gold spot
        spreadPercent: GOLD_COMMISSION_PERCENT,
        finalPrice: buffDG
          ? withCommission(buffDG.tier1.ask, GOLD_COMMISSION_PERCENT)
          : fallbackPrice(spot.goldAsk, DG_FALLBACK_PREMIUM_PERCENT.goldBuffalo, GOLD_COMMISSION_PERCENT),
        iraEligible: buffDG ? buffDG.isIRAConnectBidEligible === "Y" : true,
        deliveryWindow: buffDG?.availability ?? "",
        imageUrl: pickImage(buffDG?.images ?? [], "1B"),
        reverseImageUrl: pickReverseImage(buffDG?.images ?? [], "1B"),
        description:
          "The Gold American Buffalo is the first 24-karat gold coin struck by the United States Mint. At .9999 fine gold purity, it is one of the most refined gold coins available.",
      },
      {
        id: "silver-american-eagle-1oz",
        name: "1 oz American Silver Eagle",
        metal: "silver" as const,
        weight: "1 troy oz",
        spotPrice: spot.silverBid,  // Market silver spot
        spreadPercent: SILVER_COMMISSION_PERCENT,
        finalPrice: silverDG
          ? withCommission(silverDG.tier1.ask, SILVER_COMMISSION_PERCENT)
          : fallbackPrice(spot.silverAsk, DG_FALLBACK_PREMIUM_PERCENT.silverEagle, SILVER_COMMISSION_PERCENT),
        iraEligible: silverDG ? silverDG.isIRAConnectBidEligible === "Y" : true,
        deliveryWindow: silverDG?.availability ?? "",
        imageUrl: pickImage(silverDG?.images ?? [], "SE"),
        reverseImageUrl: pickReverseImage(silverDG?.images ?? [], "SE"),
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


export default router;
