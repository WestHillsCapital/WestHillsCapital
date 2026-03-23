import { Router, type IRouter } from "express";
import {
  GetSpotPricesResponse,
  GetProductPricesResponse,
  GetBuybackPricesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Mock spot prices ────────────────────────────────────────────────────────
// TODO: Replace with Dillon Gage API call
// API endpoint: https://api.dillongage.com/v1/spot (placeholder)
// Set DILLON_GAGE_API_KEY in environment variables before going live

const MOCK_GOLD_SPOT = 3215.0;
const MOCK_SILVER_SPOT = 32.45;

// ─── Spread configuration ────────────────────────────────────────────────────
const GOLD_SPREAD_PERCENT = 2;
const SILVER_SPREAD_PERCENT = 5;

// ─── Buyback spread (below spot) ─────────────────────────────────────────────
const GOLD_BUYBACK_SPREAD_PERCENT = 1;
const SILVER_BUYBACK_SPREAD_PERCENT = 3;

function getMockSpot() {
  // TODO: Replace this function with a real API fetch from Dillon Gage
  // Pattern to follow:
  //   const res = await fetch("https://api.dillongage.com/v1/spot", {
  //     headers: { "Authorization": `Bearer ${process.env.DILLON_GAGE_API_KEY}` }
  //   });
  //   const data = await res.json();
  //   return { gold: data.XAU, silver: data.XAG };
  return {
    gold: MOCK_GOLD_SPOT,
    silver: MOCK_SILVER_SPOT,
    lastUpdated: new Date().toISOString(),
    source: "mock",
  };
}

// GET /api/pricing/spot
router.get("/spot", (_req, res) => {
  const spot = getMockSpot();
  const data = GetSpotPricesResponse.parse(spot);
  res.json(data);
});

// GET /api/pricing/products
router.get("/products", (_req, res) => {
  const spot = getMockSpot();

  const goldPrice = (price: number) =>
    Math.round(price * (1 + GOLD_SPREAD_PERCENT / 100) * 100) / 100;
  const silverPrice = (price: number) =>
    Math.round(price * (1 + SILVER_SPREAD_PERCENT / 100) * 100) / 100;

  const products = [
    {
      id: "gold-american-eagle-1oz",
      name: "1 oz Gold American Eagle",
      metal: "gold" as const,
      weight: "1 troy oz",
      spotPrice: spot.gold,
      spreadPercent: GOLD_SPREAD_PERCENT,
      finalPrice: goldPrice(spot.gold),
      iraEligible: true,
      deliveryWindow: "5–10 business days",
      imageUrl: "/images/gold-eagle.png",
      description:
        "The Gold American Eagle is the official gold bullion coin of the United States, struck from 91.67% pure gold. Among the most widely recognized and liquid coins in the world.",
    },
    {
      id: "gold-american-buffalo-1oz",
      name: "1 oz Gold American Buffalo",
      metal: "gold" as const,
      weight: "1 troy oz",
      spotPrice: spot.gold,
      spreadPercent: GOLD_SPREAD_PERCENT,
      finalPrice: goldPrice(spot.gold),
      iraEligible: true,
      deliveryWindow: "5–10 business days",
      imageUrl: "/images/gold-buffalo.png",
      description:
        "The Gold American Buffalo is the first 24-karat gold coin struck by the United States Mint. At .9999 fine gold purity, it is one of the most refined gold coins available.",
    },
    {
      id: "silver-american-eagle-1oz",
      name: "1 oz Silver American Eagle",
      metal: "silver" as const,
      weight: "1 troy oz",
      spotPrice: spot.silver,
      spreadPercent: SILVER_SPREAD_PERCENT,
      finalPrice: silverPrice(spot.silver),
      iraEligible: true,
      deliveryWindow: "5–10 business days",
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
});

// GET /api/pricing/buyback
router.get("/buyback", (_req, res) => {
  const spot = getMockSpot();

  const goldBuyback = (price: number) =>
    Math.round(price * (1 - GOLD_BUYBACK_SPREAD_PERCENT / 100) * 100) / 100;
  const silverBuyback = (price: number) =>
    Math.round(price * (1 - SILVER_BUYBACK_SPREAD_PERCENT / 100) * 100) / 100;

  const prices = [
    {
      productId: "gold-american-eagle-1oz",
      productName: "1 oz Gold American Eagle",
      buybackPrice: goldBuyback(spot.gold),
      buybackSpreadPercent: GOLD_BUYBACK_SPREAD_PERCENT,
    },
    {
      productId: "gold-american-buffalo-1oz",
      productName: "1 oz Gold American Buffalo",
      buybackPrice: goldBuyback(spot.gold),
      buybackSpreadPercent: GOLD_BUYBACK_SPREAD_PERCENT,
    },
    {
      productId: "silver-american-eagle-1oz",
      productName: "1 oz Silver American Eagle",
      buybackPrice: silverBuyback(spot.silver),
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
});

export default router;
