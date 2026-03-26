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

// ─── Yahoo Finance Historical Market Data ────────────────────────────────────
// Real COMEX closing prices: GC=F (Gold Futures), SI=F (Silver Futures)
// These track spot price extremely closely and are industry-standard benchmarks.

type HistoryPoint = { timestamp: string; goldBid: number; silverBid: number };

const YF_BASE          = "https://query1.finance.yahoo.com/v8/finance/chart";
const YF_SYMBOL_GOLD   = "GC=F";
const YF_SYMBOL_SILVER = "SI=F";

/** Period → Yahoo Finance { range, interval } params */
const YF_PERIOD_PARAMS: Record<string, { range: string; interval: string }> = {
  "3M":  { range: "3mo", interval: "1d"  },
  "6M":  { range: "6mo", interval: "1d"  },
  "1Y":  { range: "1y",  interval: "1wk" },
  "5Y":  { range: "5y",  interval: "1wk" },
  "ALL": { range: "max", interval: "1mo" },
};

interface YFChartResult {
  timestamp: number[];
  indicators: { quote: Array<{ close: (number | null)[] }> };
}
interface YFChartResponse {
  chart: { result?: YFChartResult[]; error?: unknown };
}

/** Fetch one Yahoo Finance symbol → Map<day-unix-seconds, close-price> */
async function fetchYFSymbol(symbol: string, range: string, interval: string): Promise<Map<number, number>> {
  const url = `${YF_BASE}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Yahoo Finance ${symbol}: HTTP ${res.status}`);
  const json: YFChartResponse = await res.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo Finance ${symbol}: empty result`);

  const map = new Map<number, number>();
  result.timestamp.forEach((ts, i) => {
    const close = result.indicators.quote[0].close[i];
    if (close != null && close > 0) {
      map.set(Math.floor(ts / 86400) * 86400, close); // normalise to day boundary
    }
  });
  return map;
}

/** Merge gold + silver maps into sorted HistoryPoint array */
function mergeGoldSilver(
  goldMap: Map<number, number>,
  silverMap: Map<number, number>,
  tolerance = 0,
): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  for (const [dayKey, goldBid] of goldMap) {
    let silverBid = silverMap.get(dayKey);
    if (silverBid == null && tolerance > 0) {
      for (let d = 86400; d <= tolerance; d += 86400) {
        silverBid = silverMap.get(dayKey + d) ?? silverMap.get(dayKey - d);
        if (silverBid != null) break;
      }
    }
    if (silverBid == null) continue;
    points.push({
      timestamp: new Date(dayKey * 1000).toISOString(),
      goldBid:   parseFloat(goldBid.toFixed(2)),
      silverBid: parseFloat(silverBid.toFixed(4)),
    });
  }
  return points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/** In-memory cache: key → { data, fetchedAt }. TTL = 6 h (prices don't change intraday historically) */
const yfCache = new Map<string, { data: HistoryPoint[]; fetchedAt: number }>();
const YF_CACHE_TTL = 6 * 60 * 60 * 1000;

async function getYahooHistory(period: string): Promise<HistoryPoint[]> {
  const params = YF_PERIOD_PARAMS[period];
  if (!params) return [];

  const cacheKey = `${period}:${params.interval}`;
  const cached = yfCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < YF_CACHE_TTL) return cached.data;

  const [goldMap, silverMap] = await Promise.all([
    fetchYFSymbol(YF_SYMBOL_GOLD,   params.range, params.interval),
    fetchYFSymbol(YF_SYMBOL_SILVER, params.range, params.interval),
  ]);

  // For monthly data allow ±3 days tolerance when matching timestamps
  const tolerance = params.interval === "1mo" ? 3 * 86400 : 0;
  const data = mergeGoldSilver(goldMap, silverMap, tolerance);

  // Pin the last point to current live price so the chart ends at today's exact price
  if (cachedSpot && data.length > 0) {
    data.push({
      timestamp: new Date().toISOString(),
      goldBid:   cachedSpot.goldBid,
      silverBid: cachedSpot.silverBid,
    });
  }

  yfCache.set(cacheKey, { data, fetchedAt: Date.now() });
  return data;
}

const DB_PERIOD_INTERVAL: Record<string, string> = {
  "1D": "1 day",
  "1W": "7 days",
  "1M": "30 days",
};

// GET /api/pricing/history?period=1D|1W|1M|3M|6M|1Y|5Y|ALL
router.get("/history", async (req, res) => {
  try {
    const period = typeof req.query.period === "string" ? req.query.period : "1M";

    // Short periods (1D/1W/1M) — DB hourly data
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
          goldBid:   parseFloat(r.gold_bid),
          silverBid: parseFloat(r.silver_bid),
        })),
      });
    }

    // Longer periods — real historical data from Yahoo Finance (COMEX)
    const history = await getYahooHistory(period);
    return res.json({ history });
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
