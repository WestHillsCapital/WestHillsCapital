import { Router, type IRouter } from "express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import {
  appendDealToOpsSheet,
  writeDealLinkToMasterSheet,
  syncDealOpsStatus,
  type DealPayload,
} from "../lib/google-sheets";
import { sendDealLockNotification, sendDealRecapEmail } from "../lib/email";
import { lockAndExecuteTrade }   from "../lib/fiztrade";
import { generateInvoicePdf }   from "../lib/invoice-pdf";
import { saveDealPdfToDrive }   from "../lib/google-drive";
import { isRateLimited }        from "../lib/ratelimit";

const router: IRouter = Router();

// ── Constants ─────────────────────────────────────────────────────────────────

export const CURRENT_TERMS_VERSION = "v1.0";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Non-fatal wrapper — call syncDealOpsStatus and log errors without throwing. */
async function syncDealStatus(deal: Record<string, unknown>): Promise<void> {
  await syncDealOpsStatus({
    id:                 deal.id                  as number,
    lockedAt:           deal.locked_at            as string | Date,
    paymentReceivedAt:  deal.payment_received_at  as Date | null | undefined,
    trackingNumber:     deal.tracking_number      as string | null | undefined,
    orderPlacedAt:      deal.order_placed_at      as Date | null | undefined,
  });
}

function yyyymmdd(d: Date): string {
  return String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
}

// POST /api/deals
// Full orchestration: save → DG trade → invoice PDF → Drive → recap email
// Rate-limited: max 10 deal submissions per operator per 10 minutes.
// This protects the Dillon Gage API from runaway requests while allowing
// legitimate back-to-back deals during busy allocation calls.
router.post("/", async (req, res) => {
  const ip = String(req.ip ?? "unknown");
  const operatorEmail = String((req as unknown as { internalEmail?: string }).internalEmail ?? ip);
  if (isRateLimited(`deals:${operatorEmail}`, 10, 10 * 60 * 1000)) {
    res.status(429).json({ error: "Too many deal submissions — please wait a few minutes." });
    return;
  }
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
    // Ship-to address fields (required for DG ExecuteTrade)
    shipToName,
    shipToLine1,
    shipToCity,
    shipToState,
    shipToZip,
    // Billing address (shown on invoice Bill To block)
    billingLine1,
    billingLine2,
    billingCity,
    billingState,
    billingZip,
    // FedEx Hold location hours (shown on invoice + recap email)
    fedexLocationHours,
    // Terms of Service acknowledgment (required)
    termsProvided,
    termsVersion,
    confirmationMethod,
    notes,
  } = req.body as {
    leadId?:           number | null;
    confirmationId?:   string | null;
    dealType?:         string;
    iraType?:          string | null;
    firstName:         string;
    lastName:          string;
    email:             string;
    phone?:            string | null;
    state?:            string | null;
    custodian?:        string | null;
    iraAccountNumber?: string | null;
    goldSpotAsk?:      number | null;
    silverSpotAsk?:    number | null;
    spotTimestamp?:    string | null;
    products?: {
      productId:   string;
      productName: string;
      metal:       string;
      qty:         number;
      unitPrice:   number;
      lineTotal:   number;
    }[];
    subtotal?:       number;
    shipping?:       number;
    total?:          number;
    balanceDue?:     number;
    shippingMethod?: string;
    fedexLocation?:  string | null;
    shipToName?:     string | null;
    shipToLine1?:    string | null;
    shipToCity?:     string | null;
    shipToState?:    string | null;
    shipToZip?:      string | null;
    billingLine1?:       string | null;
    billingLine2?:       string | null;
    billingCity?:        string | null;
    billingState?:       string | null;
    billingZip?:         string | null;
    fedexLocationHours?: string | null;
    termsProvided?:      boolean;
    termsVersion?:       string | null;
    confirmationMethod?: string | null;
    notes?:              string | null;
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validationErrors: string[] = [];

  if (!firstName?.trim())      validationErrors.push("firstName is required");
  if (!lastName?.trim())       validationErrors.push("lastName is required");
  if (!email?.includes("@"))   validationErrors.push("email must be a valid address");

  if (!["cash", "ira"].includes(dealType)) {
    validationErrors.push("dealType must be 'cash' or 'ira'");
  }
  if (!["fedex_hold", "home_delivery"].includes(shippingMethod)) {
    validationErrors.push("shippingMethod must be 'fedex_hold' or 'home_delivery'");
  }
  if (!Array.isArray(products) || products.length === 0) {
    validationErrors.push("products must be a non-empty array");
  } else {
    products.forEach((p, i) => {
      if (!p.productId)       validationErrors.push(`products[${i}].productId is required`);
      if (!p.metal)           validationErrors.push(`products[${i}].metal is required`);
      if (!(p.qty > 0))       validationErrors.push(`products[${i}].qty must be > 0`);
      if (!(p.unitPrice > 0)) validationErrors.push(`products[${i}].unitPrice must be > 0`);
    });
  }
  if (typeof total !== "number" || total <= 0) {
    validationErrors.push("total must be a positive number");
  }
  if (termsProvided !== true) {
    validationErrors.push("termsProvided must be true — Terms of Service acknowledgment is required before execution");
  }
  if (!termsVersion?.trim()) {
    validationErrors.push("termsVersion is required");
  }
  if (!confirmationMethod?.trim()) {
    validationErrors.push("confirmationMethod is required");
  }

  if (validationErrors.length > 0) {
    return res.status(400).json({ error: validationErrors.join("; ") });
  }

  const lockedAt  = new Date();
  const invoiceId = `WHC-${0}-${yyyymmdd(lockedAt)}`; // placeholder — updated after insert

  try {
    const db = getDb();

    // ── 1. Save deal to DB ───────────────────────────────────────────────────
    const result = await db.query<{ id: number }>(
      `INSERT INTO deals
         (lead_id, confirmation_id, deal_type, ira_type,
          first_name, last_name, email, phone, state,
          custodian, ira_account_number,
          gold_spot_ask, silver_spot_ask, spot_timestamp,
          products, subtotal, shipping, total, balance_due,
          shipping_method, fedex_location,
          ship_to_name, ship_to_line1, ship_to_city, ship_to_state, ship_to_zip,
          billing_line1, billing_line2, billing_city, billing_state, billing_zip,
          fedex_location_hours,
          terms_provided, terms_provided_at, terms_version, confirmation_method,
          notes, status, locked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39)
       RETURNING id`,
      [
        leadId ?? null, confirmationId ?? null, dealType, iraType ?? null,
        firstName, lastName, email,
        phone ?? null, state ?? null, custodian ?? null, iraAccountNumber ?? null,
        goldSpotAsk ?? null, silverSpotAsk ?? null,
        spotTimestamp ? new Date(spotTimestamp) : null,
        products ? JSON.stringify(products) : null,
        subtotal ?? null, shipping ?? null, total ?? null, balanceDue ?? null,
        shippingMethod, fedexLocation ?? null,
        shipToName  ?? null, shipToLine1  ?? null, shipToCity  ?? null,
        shipToState ?? null, shipToZip    ?? null,
        billingLine1 ?? null, billingLine2 ?? null, billingCity ?? null,
        billingState ?? null, billingZip  ?? null,
        fedexLocationHours ?? null,
        true, lockedAt, termsVersion ?? CURRENT_TERMS_VERSION, confirmationMethod ?? "verbal_recorded_call",
        notes ?? null, "locked", lockedAt,
      ],
    );

    const dealId   = result.rows[0].id;
    const finalInvoiceId = `WHC-${dealId}-${yyyymmdd(lockedAt)}`;
    logger.info({ dealId, email }, "[Deals] Deal saved");

    // Build canonical deal object used across remaining steps
    const deal: DealPayload = {
      id:              dealId,
      leadId:          leadId ?? undefined,
      confirmationId:  confirmationId ?? undefined,
      dealType,
      iraType:         iraType ?? undefined,
      firstName,
      lastName,
      email,
      phone:           phone ?? undefined,
      state:           state ?? undefined,
      custodian:       custodian ?? undefined,
      iraAccountNumber: iraAccountNumber ?? undefined,
      goldSpotAsk:     goldSpotAsk ?? undefined,
      silverSpotAsk:   silverSpotAsk ?? undefined,
      spotTimestamp:   spotTimestamp ?? undefined,
      products:        products ?? [],
      subtotal:        subtotal ?? 0,
      shipping:        shipping ?? 0,
      total:           total ?? 0,
      balanceDue:      balanceDue ?? 0,
      shippingMethod,
      fedexLocation:      fedexLocation      ?? undefined,
      fedexLocationHours: fedexLocationHours ?? undefined,
      shipToName:         shipToName         ?? undefined,
      shipToLine1:     shipToLine1 ?? undefined,
      shipToCity:      shipToCity  ?? undefined,
      shipToState:     shipToState ?? undefined,
      shipToZip:       shipToZip   ?? undefined,
      billingLine1:    billingLine1 ?? undefined,
      billingLine2:    billingLine2 ?? undefined,
      billingCity:     billingCity  ?? undefined,
      billingState:    billingState ?? undefined,
      billingZip:      billingZip   ?? undefined,
      notes:           notes ?? undefined,
      lockedAt:        lockedAt.toISOString(),
      invoiceId:       finalInvoiceId,
    };

    // ── 2. DG Trade Execution (LockPrices → ExecuteTrade) ───────────────────
    // Critical path — if this fails the deal is saved but marked failed.
    let externalTradeId       = "";
    let supplierConfirmationId = "";
    let executionStatus       = "pending";
    const warnings: string[] = [];

    try {
      const dgResult = await lockAndExecuteTrade(
        (products ?? []).map((p) => ({ productId: p.productId, qty: p.qty })),
        (() => {
          const isFedexHold = shippingMethod === "fedex_hold" && !!fedexLocation;
          // FedEx Hold label format (10-year proven format):
          //   Name    → "FedEx Office Print & Ship Center FBO [ClientFirstName] [ClientLastName]"
          //   Attn    → "[ClientFirstName] [ClientLastName]"
          //   address1 → street address
          //   address2 → same as Name (redundancy if label is compromised)
          const facilityFbo = isFedexHold
            ? `${fedexLocation} FBO ${firstName} ${lastName}`
            : undefined;
          return {
            firstName: isFedexHold ? (facilityFbo ?? firstName) : firstName,
            lastName:  isFedexHold ? `${firstName} ${lastName}` : lastName,
            address1:  shipToLine1 ?? "",
            address2:  isFedexHold ? facilityFbo : undefined,
            city:      shipToCity  ?? "",
            state:     shipToState ?? state ?? "",
            zip:       shipToZip   ?? "",
            phone:     phone       ?? "",
          };
        })(),
      );
      externalTradeId        = dgResult.externalTradeId;
      supplierConfirmationId = dgResult.supplierConfirmationId;
      executionStatus        = "executed";

      await db.query(
        `UPDATE deals SET
           external_trade_id = $1, supplier_confirmation_id = $2,
           execution_status = 'executed', execution_timestamp = NOW(),
           status = 'executed', updated_at = NOW()
         WHERE id = $3`,
        [externalTradeId, supplierConfirmationId, dealId],
      );
      logger.info({ dealId, externalTradeId }, "[Deals] DG trade executed");

    } catch (dgErr) {
      executionStatus = "execution_failed";
      await db.query(
        `UPDATE deals SET execution_status = 'execution_failed', updated_at = NOW() WHERE id = $1`,
        [dealId],
      ).catch(() => {});
      logger.error({ dealId, err: dgErr }, "[Deals] DG trade execution failed");
      return res.status(502).json({
        error:   "Trade execution failed — deal was saved but DG order was not placed",
        dealId,
        details: dgErr instanceof Error ? dgErr.message : "Unknown error",
      });
    }

    // Update deal object with execution results
    deal.externalTradeId        = externalTradeId;
    deal.supplierConfirmationId = supplierConfirmationId;
    deal.executionStatus        = executionStatus;
    deal.executionTimestamp     = new Date().toISOString();

    // ── 3. Invoice PDF ───────────────────────────────────────────────────────
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await generateInvoicePdf({
        id:            dealId,
        firstName,
        lastName,
        email,
        phone:         phone ?? undefined,
        state:         state ?? undefined,
        dealType,
        shippingMethod,
        fedexLocation:      fedexLocation      ?? undefined,
        fedexLocationHours: fedexLocationHours ?? undefined,
        shipToLine1:        shipToLine1        ?? undefined,
        shipToCity:    shipToCity    ?? undefined,
        shipToState:   shipToState   ?? undefined,
        shipToZip:     shipToZip     ?? undefined,
        billingLine1:  billingLine1  ?? undefined,
        billingLine2:  billingLine2  ?? undefined,
        billingCity:   billingCity   ?? undefined,
        billingState:  billingState  ?? undefined,
        billingZip:    billingZip    ?? undefined,
        products:      (products ?? []).map((p) => ({
          productName: p.productName,
          qty:         p.qty,
          unitPrice:   p.unitPrice,
          lineTotal:   p.lineTotal,
        })),
        subtotal:      subtotal ?? 0,
        shipping:      shipping ?? 0,
        total:         total ?? 0,
        goldSpotAsk:   goldSpotAsk  ?? undefined,
        silverSpotAsk: silverSpotAsk ?? undefined,
        lockedAt:      lockedAt.toISOString(),
      });

      await db.query(
        `UPDATE deals SET invoice_id = $1, invoice_generated_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [finalInvoiceId, dealId],
      );
      deal.invoiceGeneratedAt = new Date().toISOString();
      logger.info({ dealId, finalInvoiceId }, "[Deals] Invoice PDF generated");

    } catch (pdfErr) {
      logger.error({ dealId, err: pdfErr }, "[Deals] PDF generation failed (non-fatal)");
      warnings.push("Invoice PDF generation failed");
    }

    // ── 4. Google Drive upload ───────────────────────────────────────────────
    let invoiceUrl: string | null = null;
    const rootFolderId = process.env.GOOGLE_DRIVE_DEALS_FOLDER_ID;
    if (pdfBuffer && rootFolderId) {
      try {
        const driveResult = await saveDealPdfToDrive(pdfBuffer, { id: dealId, firstName, lastName, dealType, lockedAt: lockedAt.toISOString() }, rootFolderId);
        invoiceUrl = driveResult.webViewLink;
        await db.query(
          `UPDATE deals SET invoice_url = $1, updated_at = NOW() WHERE id = $2`,
          [invoiceUrl, dealId],
        );
        deal.invoiceUrl = invoiceUrl ?? undefined;
        logger.info({ dealId, invoiceUrl }, "[Deals] PDF saved to Drive");

      } catch (driveErr) {
        logger.error({ dealId, err: driveErr }, "[Deals] Drive upload failed (non-fatal)");
        warnings.push("Google Drive upload failed");
      }
    }

    // ── 5. Client recap email with PDF attachment ────────────────────────────
    let emailSentTo: string | null = null;
    if (pdfBuffer) {
      try {
        await sendDealRecapEmail({ ...deal, invoiceId: finalInvoiceId }, pdfBuffer);
        emailSentTo = email;
        await db.query(
          `UPDATE deals SET recap_email_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [dealId],
        );
        deal.recapEmailSentAt = new Date().toISOString();
        logger.info({ dealId, email }, "[Deals] Recap email sent");

      } catch (emailErr) {
        logger.error({ dealId, err: emailErr }, "[Deals] Recap email failed (non-fatal)");
        warnings.push("Recap email failed");
      }
    }

    // ── 6. Fire-and-forget: Sheets sync + admin notification ─────────────────
    Promise.allSettled([
      appendDealToOpsSheet(deal).catch((err) =>
        logger.error({ err }, "[Deals] appendDealToOpsSheet failed"),
      ),
      writeDealLinkToMasterSheet(deal).catch((err) =>
        logger.error({ err }, "[Deals] writeDealLinkToMasterSheet failed"),
      ),
      sendDealLockNotification({
        dealId,
        dealType,
        firstName,
        lastName,
        email,
        phone:          phone ?? null,
        state:          state ?? null,
        total:          total ?? 0,
        products:       products ?? [],
        goldSpotAsk:    goldSpotAsk    ?? null,
        silverSpotAsk:  silverSpotAsk  ?? null,
        lockedAt:       lockedAt.toISOString(),
        confirmationId: confirmationId ?? null,
      }).catch((err) =>
        logger.error({ err }, "[Deals] admin notification failed"),
      ),
    ]).catch(() => {});

    // ── 7. Respond ───────────────────────────────────────────────────────────
    return res.status(201).json({
      dealId,
      status:          "executed",
      invoiceId:       finalInvoiceId,
      invoiceUrl,
      emailSentTo,
      lockedAt:        lockedAt.toISOString(),
      ...(warnings.length > 0 ? { warnings } : {}),
    });

  } catch (err) {
    logger.error({ err }, "[Deals] Failed to save deal");
    return res.status(500).json({ error: "Failed to save deal" });
  }
});

// POST /api/deals/preview-invoice
// Generates and streams the WHC invoice PDF for the current form state.
// No DB write, no DG call, no Drive upload, no email.
router.post("/preview-invoice", async (req, res) => {
  const {
    firstName = "Preview",
    lastName  = "Client",
    email     = "",
    phone,
    state,
    dealType  = "cash",
    shippingMethod,
    fedexLocation,
    fedexLocationHours,
    shipToLine1,
    shipToCity,
    shipToState,
    shipToZip,
    billingLine1,
    billingLine2,
    billingCity,
    billingState,
    billingZip,
    products  = [],
    subtotal  = 0,
    shipping  = 0,
    total     = 0,
    goldSpotAsk,
    silverSpotAsk,
  } = req.body as {
    firstName?:          string;
    lastName?:           string;
    email?:              string;
    phone?:              string;
    state?:              string;
    dealType?:           string;
    shippingMethod?:     string;
    fedexLocation?:      string;
    fedexLocationHours?: string;
    shipToLine1?:        string;
    shipToCity?:         string;
    shipToState?:        string;
    shipToZip?:          string;
    billingLine1?:       string;
    billingLine2?:       string;
    billingCity?:        string;
    billingState?:       string;
    billingZip?:         string;
    products?: { productName: string; qty: number; unitPrice: number; lineTotal: number }[];
    subtotal?:           number;
    shipping?:           number;
    total?:              number;
    goldSpotAsk?:        number;
    silverSpotAsk?:      number;
  };

  try {
    const now = new Date();
    const pdfBuffer = await generateInvoicePdf({
      id:            0,
      firstName:     firstName ?? "Preview",
      lastName:      lastName  ?? "Client",
      email:         email     ?? "",
      phone:         phone     ?? undefined,
      state:         state     ?? undefined,
      dealType:      dealType  ?? "cash",
      shippingMethod,
      fedexLocation,
      fedexLocationHours,
      shipToLine1,
      shipToCity,
      shipToState,
      shipToZip,
      billingLine1,
      billingLine2,
      billingCity,
      billingState,
      billingZip,
      products: (products ?? []).map((p) => ({
        productName: p.productName,
        qty:         Number(p.qty)       || 0,
        unitPrice:   Number(p.unitPrice) || 0,
        lineTotal:   Number(p.lineTotal) || 0,
      })),
      subtotal:       Number(subtotal)     || 0,
      shipping:       Number(shipping)     || 0,
      total:          Number(total)        || 0,
      goldSpotAsk:    goldSpotAsk    ? Number(goldSpotAsk)    : undefined,
      silverSpotAsk:  silverSpotAsk  ? Number(silverSpotAsk)  : undefined,
      lockedAt:       now.toISOString(),
    });

    const dateStr = yyyymmdd(now);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="WHC-PREVIEW-${dateStr}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error({ err }, "[Deals] Preview invoice generation failed");
    res.status(500).json({ error: "Failed to generate preview invoice" });
  }
});

// PATCH /api/deals/:id/payment
// Marks payment received — sets payment_received_at = NOW() and syncs Ops status
router.patch("/:id/payment", async (req, res) => {
  const dealId = parseInt(req.params.id, 10);
  if (isNaN(dealId)) return res.status(400).json({ error: "Invalid deal ID" });

  try {
    const db = getDb();
    const { rows } = await db.query<{ id: number; payment_received_at: Date | null }>(
      `UPDATE deals SET payment_received_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [dealId],
    );
    if (!rows[0]) return res.status(404).json({ error: "Deal not found" });

    syncDealStatus(rows[0]).catch((err) =>
      logger.error({ err, dealId }, "[Deals] Ops status sync failed after payment mark")
    );

    return res.json({ success: true, paymentReceivedAt: rows[0].payment_received_at });
  } catch (err) {
    logger.error({ err }, "[Deals] Failed to mark payment received");
    return res.status(500).json({ error: "Failed to mark payment received" });
  }
});

// PATCH /api/deals/:id/tracking
// Records a tracking number and syncs Ops status
router.patch("/:id/tracking", async (req, res) => {
  const dealId = parseInt(req.params.id, 10);
  if (isNaN(dealId)) return res.status(400).json({ error: "Invalid deal ID" });

  const { trackingNumber } = req.body as { trackingNumber?: string };
  if (!trackingNumber?.trim()) {
    return res.status(400).json({ error: "trackingNumber is required" });
  }

  try {
    const db = getDb();
    const { rows } = await db.query(
      `UPDATE deals SET tracking_number = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [trackingNumber.trim(), dealId],
    );
    if (!rows[0]) return res.status(404).json({ error: "Deal not found" });

    syncDealStatus(rows[0]).catch((err) =>
      logger.error({ err, dealId }, "[Deals] Ops status sync failed after tracking update")
    );

    return res.json({ success: true, trackingNumber: trackingNumber.trim() });
  } catch (err) {
    logger.error({ err }, "[Deals] Failed to update tracking number");
    return res.status(500).json({ error: "Failed to update tracking number" });
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
    const { rows } = await db.query(`SELECT * FROM deals WHERE id = $1`, [dealId]);
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
