/**
 * Invoice PDF generation — customer-facing.
 *
 * Uses pdfkit to produce a professional letter-size PDF that is emailed to
 * the client and saved to Google Drive.  Zero references to Dillon Gage or
 * the wholesale source; everything is presented as a West Hills Capital
 * transaction.
 */
import PDFDocument from "pdfkit";
import { logger } from "./logger";

// ── Wire instructions (Commerce Bank) ─────────────────────────────────────────
const WIRE = {
  bank:        "Commerce Bank",
  bankAddress: "1551 Waterfront, Wichita, KS 67206",
  routing:     "101000019",
  accountName: "West Hills Capital",
  accountAddr: "1314 N. Oliver Ave. #8348, Wichita, KS 67208",
  accountNum:  "690108249",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InvoiceDeal {
  id:            number;
  firstName:     string;
  lastName:      string;
  email:         string;
  phone?:        string;
  state?:        string;
  dealType:      string;
  shippingMethod?: string;
  fedexLocation?:  string;
  shipToLine1?:    string;
  shipToCity?:     string;
  shipToState?:    string;
  shipToZip?:      string;
  billingLine1?:   string;
  billingLine2?:   string;
  billingCity?:    string;
  billingState?:   string;
  billingZip?:     string;
  products: {
    productName: string;
    qty:         number;
    unitPrice:   number;
    lineTotal:   number;
  }[];
  subtotal:       number;
  shipping:       number;
  total:          number;
  goldSpotAsk?:   number;
  silverSpotAsk?: number;
  lockedAt:       string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function invoiceNumber(dealId: number, lockedAt: string): string {
  const d = new Date(lockedAt);
  const ymd =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  return `WHC-${dealId}-${ymd}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

// ── PDF generator ─────────────────────────────────────────────────────────────

export async function generateInvoicePdf(deal: InvoiceDeal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const LEFT  = 50;
    const RIGHT = 562;  // page width 612 − 50
    const GOLD  = "#B8860B";
    const DARK  = "#1a1a1a";
    const GRAY  = "#6b7280";
    const LGRAY = "#e5e7eb";

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor(DARK)
      .text("West Hills Capital", LEFT, 50);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(GRAY)
      .text("Physical Precious Metals Allocation", LEFT, 76)
      .text("(800) 867-6768  |  westhillscapital.com", LEFT, 88);

    // Invoice block (top-right)
    const invNum = invoiceNumber(deal.id, deal.lockedAt);
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor(GOLD)
      .text("INVOICE", RIGHT - 120, 50, { width: 120, align: "right" });
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(GRAY)
      .text(`Invoice #: ${invNum}`, RIGHT - 200, 74, { width: 200, align: "right" })
      .text(`Date: ${formatDate(deal.lockedAt)}`, RIGHT - 200, 86, { width: 200, align: "right" });

    // Divider
    doc
      .moveTo(LEFT, 110)
      .lineTo(RIGHT, 110)
      .strokeColor(LGRAY)
      .lineWidth(1)
      .stroke();

    // ── Bill To ─────────────────────────────────────────────────────────────
    let y = 122;
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(GRAY)
      .text("BILL TO", LEFT, y);
    y += 14;
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor(DARK)
      .text(`${deal.firstName} ${deal.lastName}`, LEFT, y);
    y += 16;
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(GRAY);
    if (deal.email) { doc.text(deal.email, LEFT, y); y += 13; }
    if (deal.phone) { doc.text(deal.phone, LEFT, y); y += 13; }
    // Billing address lines
    if (deal.billingLine1) { doc.text(deal.billingLine1, LEFT, y); y += 13; }
    if (deal.billingLine2) { doc.text(deal.billingLine2, LEFT, y); y += 13; }
    if (deal.billingCity || deal.billingState || deal.billingZip) {
      const cityLine = [deal.billingCity, deal.billingState].filter(Boolean).join(", ") +
        (deal.billingZip ? ` ${deal.billingZip}` : "");
      doc.text(cityLine.trim(), LEFT, y); y += 13;
    } else if (deal.state) {
      doc.text(deal.state, LEFT, y); y += 13;
    }

    // ── Delivery ─────────────────────────────────────────────────────────────
    const isFedex = deal.shippingMethod === "fedex_hold";
    const deliveryLabel = isFedex ? "FedEx Hold" : "Home Delivery";

    // Build delivery address line
    const addrParts: string[] = [];
    if (isFedex && deal.fedexLocation) addrParts.push(deal.fedexLocation);
    if (deal.shipToLine1) addrParts.push(deal.shipToLine1);
    if (deal.shipToCity && deal.shipToState) {
      addrParts.push(`${deal.shipToCity}, ${deal.shipToState} ${deal.shipToZip ?? ""}`.trim());
    }
    const deliveryAddr = addrParts.join(" — ");

    const deliveryY = 122;
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(GRAY)
      .text("DELIVERY", LEFT + 240, deliveryY);
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor(DARK)
      .text(deliveryLabel, LEFT + 240, deliveryY + 14);
    if (deliveryAddr) {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor(GRAY)
        .text(deliveryAddr, LEFT + 240, deliveryY + 30, { width: 270 });
    }

    // ── Product Table ────────────────────────────────────────────────────────
    const tableTop = Math.max(y + 16, 200);

    // Header row
    doc
      .moveTo(LEFT, tableTop)
      .lineTo(RIGHT, tableTop)
      .strokeColor(LGRAY)
      .stroke();

    const COL = { product: LEFT, qty: 340, unit: 410, total: 500 };

    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(GRAY)
      .text("PRODUCT",    COL.product, tableTop + 6)
      .text("QTY",        COL.qty,     tableTop + 6, { width: 60,  align: "right" })
      .text("UNIT PRICE", COL.unit,    tableTop + 6, { width: 80,  align: "right" })
      .text("LINE TOTAL", COL.total,   tableTop + 6, { width: 62,  align: "right" });

    doc
      .moveTo(LEFT, tableTop + 20)
      .lineTo(RIGHT, tableTop + 20)
      .strokeColor(LGRAY)
      .stroke();

    let rowY = tableTop + 28;
    const activeProducts = deal.products.filter((p) => p.qty > 0 && p.unitPrice > 0);

    for (const p of activeProducts) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor(DARK)
        .text(p.productName,       COL.product, rowY, { width: 280 })
        .text(String(p.qty),       COL.qty,     rowY, { width: 60,  align: "right" })
        .text(usd(p.unitPrice),    COL.unit,    rowY, { width: 80,  align: "right" })
        .text(usd(p.lineTotal),    COL.total,   rowY, { width: 62,  align: "right" });
      rowY += 22;

      doc
        .moveTo(LEFT, rowY - 4)
        .lineTo(RIGHT, rowY - 4)
        .strokeColor(LGRAY)
        .lineWidth(0.5)
        .stroke();
    }

    // ── Totals ───────────────────────────────────────────────────────────────
    rowY += 6;
    const TLEFT = COL.unit;

    const totalsRow = (label: string, amount: number, bold = false) => {
      doc
        .fontSize(10)
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fillColor(bold ? DARK : GRAY)
        .text(label,        TLEFT, rowY, { width: 80,  align: "right" })
        .text(usd(amount),  COL.total, rowY, { width: 62, align: "right" });
      rowY += 18;
    };

    totalsRow("Subtotal",  deal.subtotal);
    totalsRow("Shipping",  deal.shipping);
    doc
      .moveTo(TLEFT, rowY - 2)
      .lineTo(RIGHT, rowY - 2)
      .strokeColor(DARK)
      .lineWidth(1)
      .stroke();
    rowY += 4;
    totalsRow("Total Due", deal.total, true);
    rowY += 10;

    // ── Wire Instructions ────────────────────────────────────────────────────
    const boxTop = rowY + 8;
    const boxH   = 145;

    doc
      .roundedRect(LEFT, boxTop, RIGHT - LEFT, boxH, 4)
      .strokeColor(GOLD)
      .lineWidth(1)
      .stroke();

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor(GOLD)
      .text("PAYMENT INSTRUCTIONS — WIRE TRANSFER", LEFT + 12, boxTop + 12);

    doc
      .moveTo(LEFT + 12, boxTop + 25)
      .lineTo(RIGHT - 12, boxTop + 25)
      .strokeColor(LGRAY)
      .lineWidth(0.5)
      .stroke();

    const wl = LEFT + 12;
    let wy  = boxTop + 34;
    const wRow = (label: string, value: string) => {
      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor(GRAY)
        .text(label + ":", wl, wy, { width: 120 });
      doc
        .font("Helvetica")
        .fillColor(DARK)
        .text(value, wl + 122, wy, { width: RIGHT - wl - 134 });
      wy += 16;
    };

    wRow("Bank",         WIRE.bank);
    wRow("Bank Address", WIRE.bankAddress);
    wRow("Routing #",    WIRE.routing);
    wRow("Account Name", WIRE.accountName);
    wRow("Account Addr", WIRE.accountAddr);
    wRow("Account #",    WIRE.accountNum);

    // Reference line
    const refLast = deal.lastName.replace(/\s+/g, "").toUpperCase().slice(0, 10);
    const ref = `${refLast}-WHC${deal.id}`;
    wRow("Reference",   ref);

    wy += 4;
    doc
      .fontSize(8)
      .font("Helvetica-Oblique")
      .fillColor(GRAY)
      .text(
        "Wire must be received in full before metals are released for shipment.",
        wl, wy, { width: RIGHT - wl - 24 },
      );

    // ── Footer ───────────────────────────────────────────────────────────────
    const footY = 720;
    doc
      .moveTo(LEFT, footY)
      .lineTo(RIGHT, footY)
      .strokeColor(LGRAY)
      .lineWidth(0.5)
      .stroke();

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(GRAY)
      .text(
        "West Hills Capital  |  (800) 867-6768  |  westhillscapital.com  |  Physical Precious Metals Allocation",
        LEFT, footY + 8, { align: "center", width: RIGHT - LEFT },
      );

    const spotParts: string[] = [];
    if (deal.goldSpotAsk)   spotParts.push(`Gold spot at lock: ${usd(deal.goldSpotAsk)}`);
    if (deal.silverSpotAsk) spotParts.push(`Silver spot: ${usd(deal.silverSpotAsk)}`);
    if (spotParts.length) {
      doc.text(spotParts.join("  |  "), LEFT, footY + 20, { align: "center", width: RIGHT - LEFT });
    }
    doc.text(`Locked: ${new Date(deal.lockedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`, LEFT, footY + 32, { align: "center", width: RIGHT - LEFT });

    doc.end();
    logger.info({ dealId: deal.id, invoiceNum: invNum }, "[Invoice] PDF generated");
  });
}
