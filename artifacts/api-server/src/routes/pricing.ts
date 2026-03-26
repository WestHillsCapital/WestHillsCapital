import { Router, type IRouter } from "express";
import type { Pool } from "pg";
import {
  GetSpotPricesResponse,
  GetProductPricesResponse,
  GetBuybackPricesResponse,
} from "@workspace/api-zod";
import { getDb } from "../db";

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

  // Record to history DB asynchronously (non-blocking)
  recordSpotReading(cachedSpot.goldBid, cachedSpot.silverBid).catch(() => {});

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

// ─── Spot Price History (DB-backed) ──────────────────────────────────────────

let historyTableReady = false;
let lastHistoryRecordTs = 0;
const HISTORY_RECORD_INTERVAL_MS = 60 * 60 * 1000; // write one row per hour

function gaussRandom(): number {
  const u = Math.max(1e-10, Math.random());
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

async function seedSpotHistory(db: Pool, goldBid: number, silverBid: number): Promise<void> {
  const HOURS = 30 * 24; // 720 hourly data points
  const goldSigma = goldBid * 0.0016;
  const silverSigma = silverBid * 0.003;

  // Walk backward from current price, then reverse so oldest is first
  const goldPrices: number[] = [goldBid];
  const silverPrices: number[] = [silverBid];
  for (let i = 1; i <= HOURS; i++) {
    goldPrices.push(Math.max(goldPrices[i - 1] + gaussRandom() * goldSigma, 500));
    silverPrices.push(Math.max(silverPrices[i - 1] + gaussRandom() * silverSigma, 5));
  }
  goldPrices.reverse();
  silverPrices.reverse();

  const now = new Date();
  const valueSql: string[] = [];
  const params: (string | number)[] = [];
  let idx = 1;
  for (let i = 0; i < goldPrices.length; i++) {
    const ts = new Date(now.getTime() - (HOURS - i) * 60 * 60 * 1000);
    valueSql.push(`($${idx++}, $${idx++}, $${idx++})`);
    params.push(goldPrices[i].toFixed(2), silverPrices[i].toFixed(4), ts.toISOString());
  }

  await db.query(
    `INSERT INTO spot_price_history (gold_bid, silver_bid, captured_at) VALUES ${valueSql.join(",")}`,
    params,
  );
}

async function ensureHistoryTable(): Promise<void> {
  if (historyTableReady) return;
  const db = getDb();

  await db.query(`
    CREATE TABLE IF NOT EXISTS spot_price_history (
      id         SERIAL PRIMARY KEY,
      gold_bid   NUMERIC(10,2) NOT NULL,
      silver_bid NUMERIC(10,4) NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_spot_history_captured ON spot_price_history (captured_at)`,
  );

  const { rows } = await db.query<{ cnt: string }>(
    "SELECT COUNT(*)::text AS cnt FROM spot_price_history",
  );
  if (parseInt(rows[0].cnt, 10) === 0) {
    let goldBid = 4500;
    let silverBid = 70;
    if (cachedSpot) {
      goldBid = cachedSpot.goldBid;
      silverBid = cachedSpot.silverBid;
    }
    await seedSpotHistory(db, goldBid, silverBid);
  }

  historyTableReady = true;
}

async function recordSpotReading(goldBid: number, silverBid: number): Promise<void> {
  const now = Date.now();
  if (now - lastHistoryRecordTs < HISTORY_RECORD_INTERVAL_MS) return;
  lastHistoryRecordTs = now;
  await ensureHistoryTable();
  const db = getDb();
  await db.query(
    "INSERT INTO spot_price_history (gold_bid, silver_bid) VALUES ($1, $2)",
    [goldBid.toFixed(2), silverBid.toFixed(4)],
  );
  // Prune data older than 90 days
  await db.query(`DELETE FROM spot_price_history WHERE captured_at < NOW() - INTERVAL '90 days'`);
}

// ─── Long-term Historical Price Data ─────────────────────────────────────────
// Annual average gold/silver bid prices (USD per troy oz), approximate
// Sources: LBMA, Kitco, World Gold Council historical data
// Gold prices were fixed ($35/oz Bretton Woods) until Aug 1971 — data starts then.

const GOLD_ANNUAL: [number, number][] = [
  [1971, 40],   [1972, 64],   [1973, 98],   [1974, 160],
  [1975, 161],  [1976, 125],  [1977, 148],  [1978, 194],
  [1979, 307],  [1980, 613],  [1981, 460],  [1982, 376],
  [1983, 424],  [1984, 361],  [1985, 318],  [1986, 368],
  [1987, 447],  [1988, 437],  [1989, 381],  [1990, 384],
  [1991, 363],  [1992, 344],  [1993, 360],  [1994, 384],
  [1995, 384],  [1996, 388],  [1997, 332],  [1998, 294],
  [1999, 279],  [2000, 280],  [2001, 271],  [2002, 310],
  [2003, 364],  [2004, 410],  [2005, 445],  [2006, 604],
  [2007, 695],  [2008, 872],  [2009, 973],  [2010, 1225],
  [2011, 1572], [2012, 1669], [2013, 1412], [2014, 1266],
  [2015, 1160], [2016, 1251], [2017, 1257], [2018, 1269],
  [2019, 1393], [2020, 1770], [2021, 1799], [2022, 1800],
  [2023, 1941], [2024, 2386], [2025, 3100],
];

const SILVER_ANNUAL: [number, number][] = [
  [1971, 1.55],  [1972, 1.68],  [1973, 2.56],  [1974, 4.71],
  [1975, 4.42],  [1976, 4.35],  [1977, 4.62],  [1978, 5.40],
  [1979, 11.09], [1980, 20.63], [1981, 10.52], [1982, 7.95],
  [1983, 11.44], [1984, 8.14],  [1985, 6.14],  [1986, 5.47],
  [1987, 7.01],  [1988, 6.53],  [1989, 5.50],  [1990, 4.82],
  [1991, 4.06],  [1992, 3.95],  [1993, 4.31],  [1994, 5.28],
  [1995, 5.20],  [1996, 5.20],  [1997, 4.90],  [1998, 5.55],
  [1999, 5.22],  [2000, 4.95],  [2001, 4.37],  [2002, 4.60],
  [2003, 4.88],  [2004, 6.66],  [2005, 7.31],  [2006, 11.55],
  [2007, 13.38], [2008, 15.00], [2009, 14.99], [2010, 20.19],
  [2011, 35.12], [2012, 31.15], [2013, 23.79], [2014, 19.08],
  [2015, 15.68], [2016, 17.14], [2017, 17.05], [2018, 15.71],
  [2019, 16.21], [2020, 20.55], [2021, 25.14], [2022, 21.73],
  [2023, 23.44], [2024, 29.40], [2025, 38.00],
];

/** Deterministic noise: returns a value in [-1, 1] for a given integer seed */
function deterministicNoise(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return (x - Math.floor(x)) * 2 - 1;
}

type HistoryPoint = { timestamp: string; goldBid: number; silverBid: number };

/** Build monthly synthetic historical data from 1971 to the current live spot price */
function buildSyntheticHistory(): HistoryPoint[] {
  const goldMap = new Map(GOLD_ANNUAL);
  const silverMap = new Map(SILVER_ANNUAL);
  const years = GOLD_ANNUAL.map(([y]) => y);
  const startYear = years[0];
  const endYear = years[years.length - 1];
  const result: HistoryPoint[] = [];
  let seed = 4217;

  for (let year = startYear; year <= endYear; year++) {
    const g1 = goldMap.get(year) ?? 0;
    const g2 = goldMap.get(year + 1) ?? g1;
    const s1 = silverMap.get(year) ?? 0;
    const s2 = silverMap.get(year + 1) ?? s1;

    for (let month = 0; month < 12; month++) {
      const t = month / 12;
      const gBase = g1 + (g2 - g1) * t;
      const sBase = s1 + (s2 - s1) * t;
      const gBid = Math.max(1, gBase + deterministicNoise(++seed) * gBase * 0.025);
      const sBid = Math.max(0.5, sBase + deterministicNoise(++seed) * sBase * 0.04);
      result.push({
        timestamp: new Date(year, month, 1).toISOString(),
        goldBid: parseFloat(gBid.toFixed(2)),
        silverBid: parseFloat(sBid.toFixed(4)),
      });
    }
  }

  // Append current live price as the final data point
  if (cachedSpot) {
    result.push({
      timestamp: new Date().toISOString(),
      goldBid: cachedSpot.goldBid,
      silverBid: cachedSpot.silverBid,
    });
  }

  return result;
}

const PERIOD_CUTOFF_DAYS: Record<string, number | null> = {
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "5Y": 5 * 365,
  "ALL": null,
};

const DB_PERIOD_INTERVAL: Record<string, string> = {
  "1D": "1 day",
  "1W": "7 days",
  "1M": "30 days",
};

// GET /api/pricing/history?period=1D|1W|1M|3M|6M|1Y|5Y|ALL
router.get("/history", async (req, res) => {
  try {
    const period = typeof req.query.period === "string" ? req.query.period : "1M";

    // Short periods (1D/1W/1M) — serve from DB hourly data
    if (period in DB_PERIOD_INTERVAL) {
      await ensureHistoryTable();
      const db = getDb();
      const interval = DB_PERIOD_INTERVAL[period];
      const { rows } = await db.query<{
        gold_bid: string;
        silver_bid: string;
        captured_at: string;
      }>(
        `SELECT gold_bid, silver_bid, captured_at
         FROM spot_price_history
         WHERE captured_at >= NOW() - INTERVAL '${interval}'
         ORDER BY captured_at ASC`,
      );
      return res.json({
        history: rows.map((r) => ({
          timestamp: r.captured_at,
          goldBid: parseFloat(r.gold_bid),
          silverBid: parseFloat(r.silver_bid),
        })),
      });
    }

    // Longer periods — serve synthetic historical data
    const allHistory = buildSyntheticHistory();
    const cutoffDays = PERIOD_CUTOFF_DAYS[period] ?? null;

    const filtered = cutoffDays === null
      ? allHistory
      : (() => {
          const cutoff = Date.now() - cutoffDays * 24 * 60 * 60 * 1000;
          return allHistory.filter((p) => new Date(p.timestamp).getTime() >= cutoff);
        })();

    return res.json({ history: filtered });
  } catch (err) {
    console.error("Error fetching spot history:", err);
    res.status(502).json({ error: "Unable to fetch price history" });
  }
});

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

// Local images — background-removed transparent PNGs, used for all products
const LOCAL_IMAGES: Record<string, string> = {
  "1EAGLE": "/images/gold-eagle.png",
  "1B":     "/images/gold-buffalo-obverse-clean.png",
  "SE":     "/images/silver-eagle-clean.png",
};

const LOCAL_REVERSE_IMAGES: Record<string, string> = {
  "1EAGLE": "/images/gold-eagle-reverse.png",
  "1B":     "/images/gold-buffalo-reverse-clean.png",
  "SE":     "/images/silver-eagle-reverse-clean.png",
};

function pickImage(_dgImages: { imgType: string; imgPath: string }[], code: string): string {
  // Always use local background-removed images
  return LOCAL_IMAGES[code] ?? "/images/gold-eagle.png";
}

function pickReverseImage(_dgImages: { imgType: string; imgPath: string }[], code: string): string | undefined {
  // Always use local background-removed reverse images where available
  return LOCAL_REVERSE_IMAGES[code];
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
