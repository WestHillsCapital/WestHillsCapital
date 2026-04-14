import { Router, type IRouter } from "express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import {
  writeDealToBuilderSheet,
  appendDealToOpsSheet,
  writeDealLinkToMasterSheet,
} from "../lib/google-sheets";

const router: IRouter = Router();

// POST /api/deals
// Saves a locked deal to the DB and syncs to Google Sheets
router.post("/", async (req, res) => {
  const {
    leadId,
    confirmationId,
    dealType = "cash",
    iraType,
    firstName,
    lastName,
    email,
    phone,
    state,
    custodian,
    iraAccountNumber,
    goldSpotAsk,
    silverSpotAsk,
    spotTimestamp,
    products,
    subtotal,
    shipping,
    total,
    balanceDue,
    shippingMethod = "fedex_hold",
    fedexLocation,
    notes,
  } = req.body as {
    leadId?: number | null;
    confirmationId?: string | null;
    dealType?: string;
    iraType?: string | null;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    state?: string | null;
    custodian?: string | null;
    iraAccountNumber?: string | null;
    goldSpotAsk?: number | null;
    silverSpotAsk?: number | null;
    spotTimestamp?: string | null;
    products?: {
      productId: string;
      productName: string;
      metal: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
    }[];
    subtotal?: number;
    shipping?: number;
    total?: number;
    balanceDue?: number;
    shippingMethod?: string;
    fedexLocation?: string | null;
    notes?: string | null;
  };

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: "firstName, lastName, and email are required" });
  }

  const lockedAt = new Date();

  try {
    const db = getDb();
    const result = await db.query<{ id: number }>(
      `INSERT INTO deals
         (lead_id, confirmation_id, deal_type, ira_type,
          first_name, last_name, email, phone, state,
          custodian, ira_account_number,
          gold_spot_ask, silver_spot_ask, spot_timestamp,
          products, subtotal, shipping, total, balance_due,
          shipping_method, fedex_location, notes,
          status, locked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING id`,
      [
        leadId ?? null,
        confirmationId ?? null,
        dealType,
        iraType ?? null,
        firstName,
        lastName,
        email,
        phone ?? null,
        state ?? null,
        custodian ?? null,
        iraAccountNumber ?? null,
        goldSpotAsk ?? null,
        silverSpotAsk ?? null,
        spotTimestamp ? new Date(spotTimestamp) : null,
        products ? JSON.stringify(products) : null,
        subtotal ?? null,
        shipping ?? null,
        total ?? null,
        balanceDue ?? null,
        shippingMethod,
        fedexLocation ?? null,
        notes ?? null,
        "locked",
        lockedAt,
      ]
    );

    const dealId = result.rows[0].id;
    logger.info({ dealId, email }, "[Deals] Deal saved to DB");

    const deal = {
      id: dealId,
      leadId: leadId ?? undefined,
      confirmationId: confirmationId ?? undefined,
      dealType,
      iraType: iraType ?? undefined,
      firstName,
      lastName,
      email,
      phone: phone ?? undefined,
      state: state ?? undefined,
      custodian: custodian ?? undefined,
      iraAccountNumber: iraAccountNumber ?? undefined,
      goldSpotAsk: goldSpotAsk ?? undefined,
      silverSpotAsk: silverSpotAsk ?? undefined,
      spotTimestamp: spotTimestamp ?? undefined,
      products: products ?? [],
      subtotal: subtotal ?? 0,
      shipping: shipping ?? 0,
      total: total ?? 0,
      balanceDue: balanceDue ?? 0,
      shippingMethod,
      fedexLocation: fedexLocation ?? undefined,
      notes: notes ?? undefined,
      lockedAt: lockedAt.toISOString(),
    };

    // Sheets write-back — all non-fatal; never block the response
    Promise.allSettled([
      writeDealToBuilderSheet(deal).catch((err) =>
        logger.error({ err }, "[Deals] writeDealToBuilderSheet failed")
      ),
      appendDealToOpsSheet(deal).catch((err) =>
        logger.error({ err }, "[Deals] appendDealToOpsSheet failed")
      ),
      writeDealLinkToMasterSheet(deal).catch((err) =>
        logger.error({ err }, "[Deals] writeDealLinkToMasterSheet failed")
      ),
    ]).catch(() => {});

    return res.status(201).json({ dealId, status: "locked", lockedAt: lockedAt.toISOString() });
  } catch (err) {
    logger.error({ err }, "[Deals] Failed to save deal");
    return res.status(500).json({ error: "Failed to save deal" });
  }
});

// GET /api/deals/:id
// Returns a single saved deal by ID
router.get("/:id", async (req, res) => {
  const dealId = parseInt(req.params.id, 10);
  if (isNaN(dealId)) {
    return res.status(400).json({ error: "Invalid deal ID" });
  }

  try {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT * FROM deals WHERE id = $1`,
      [dealId]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "Deal not found" });
    }
    return res.json({ deal: rows[0] });
  } catch (err) {
    logger.error({ err }, "[Deals] Failed to fetch deal");
    return res.status(500).json({ error: "Failed to fetch deal" });
  }
});

export default router;
