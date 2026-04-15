import { Router } from "express";
import { searchFedExLocations } from "../lib/fedex";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /api/fedex/locations
 * Body: { postalCode: "67206" }
 * Returns up to 2 nearest FedEx Office / Ship Center locations.
 * Protected by requireInternalAuth (registered in index.ts under /fedex).
 */
router.post("/locations", async (req, res) => {
  const { postalCode, zip } = (req.body ?? {}) as { postalCode?: string; zip?: string };
  const code = (postalCode ?? zip ?? "").replace(/\D/g, "").slice(0, 5);

  if (code.length !== 5) {
    res.status(400).json({ error: "Valid 5-digit ZIP code required" });
    return;
  }

  try {
    const locations = await searchFedExLocations(code);
    res.json({ locations });
  } catch (err) {
    logger.error({ err }, "[FedEx] Location search error");
    res.status(502).json({ error: "FedEx location search unavailable", locations: [] });
  }
});

export default router;
