/**
 * Invoice PDF generation — customer-facing.
 *
 * Uses pdfkit to produce a professional single-page letter-size PDF that is
 * emailed to the client and saved to Google Drive.  Zero references to
 * Dillon Gage or the wholesale source; everything is presented as a West
 * Hills Capital transaction.
 */
import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { logger } from "./logger";
import { nextBusinessDayFrom } from "./date-utils";

// ── Logo path (same image used in the website navbar) ─────────────────────────
// __dirname in dist/ is: <workspace>/artifacts/api-server/dist/
// Logo lives at:         <workspace>/artifacts/west-hills-capital/public/images/logo.png
// Relative path:         ../../../artifacts/west-hills-capital/public/images/logo.png
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const LOGO_PATH  = path.resolve(
  __dirname,
  "../../../artifacts/west-hills-capital/public/images/logo.png",
);
const HAS_LOGO = existsSync(LOGO_PATH);

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
    const doc = new PDFDocument({ size: "LETTER", margin: 40, autoFirstPage: true });
    const chunks: Buffer[] = [];

    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const LEFT  = 40;
    const RIGHT = 572;   // 612 − 40
    const W     = RIGHT - LEFT;
    const GOLD  = "#B8860B";
    const DARK  = "#1a1a1a";
    const GRAY  = "#6b7280";
    const LGRAY = "#e5e7eb";
    const MID   = LEFT + 262;   // column split: ~46% left, 54% right
    const RCOL  = MID + 16;     // right column start

    const invNum = invoiceNumber(deal.id, deal.lockedAt);
    const lockedDate = new Date(deal.lockedAt);
    const payDeadline = nextBusinessDayFrom(lockedDate);

    // ──────────────────────────────────────────────────────────────────────────
    // HEADER LEFT — Logo + tagline only
    // ──────────────────────────────────────────────────────────────────────────
    let logoBottomY = 40;
    if (HAS_LOGO) {
      try {
        doc.image(LOGO_PATH, LEFT, 40, { fit: [190, 50], align: "left", valign: "top" });
        logoBottomY = 93;
      } catch {
        doc.fontSize(18).font("Helvetica-Bold").fillColor(DARK)
           .text("West Hills Capital", LEFT, 40, { width: MID - LEFT });
        logoBottomY = 63;
      }
    } else {
      doc.fontSize(18).font("Helvetica-Bold").fillColor(DARK)
         .text("West Hills Capital", LEFT, 40, { width: MID - LEFT });
      logoBottomY = 63;
    }

    doc.fontSize(7.5).font("Helvetica").fillColor(GRAY)
       .text(
         "Physical Precious Metals Allocation  |  (800) 867-6768  |  westhillscapital.com",
         LEFT, logoBottomY + 2, { width: MID - LEFT },
       );

    // ──────────────────────────────────────────────────────────────────────────
    // HEADER RIGHT — INVOICE label + number + date + spot prices (right-aligned)
    // ──────────────────────────────────────────────────────────────────────────
    doc.fontSize(20).font("Helvetica-Bold").fillColor(GOLD)
       .text("INVOICE", LEFT, 40, { width: W, align: "right" });

    let rY = 66;
    doc.fontSize(9).font("Helvetica-Bold").fillColor(DARK)
       .text(invNum, LEFT, rY, { width: W, align: "right" });
    rY += 13;
    doc.fontSize(8.5).font("Helvetica").fillColor(GRAY)
       .text(formatDate(deal.lockedAt), LEFT, rY, { width: W, align: "right" });
    rY += 12;
    if (deal.goldSpotAsk) {
      doc.fontSize(8).font("Helvetica").fillColor(GRAY)
         .text(`Gold Spot: ${usd(deal.goldSpotAsk)}`, LEFT, rY, { width: W, align: "right" });
      rY += 12;
    }
    if (deal.silverSpotAsk) {
      doc.fontSize(8).font("Helvetica").fillColor(GRAY)
         .text(`Silver Spot: ${usd(deal.silverSpotAsk)}`, LEFT, rY, { width: W, align: "right" });
      rY += 12;
    }

    // ── Header divider ────────────────────────────────────────────────────────
    const headerBottom = Math.max(logoBottomY + 18, rY + 6, 116);
    doc.moveTo(LEFT, headerBottom).lineTo(RIGHT, headerBottom)
       .strokeColor(LGRAY).lineWidth(1).stroke();

    // ──────────────────────────────────────────────────────────────────────────
    // BILL TO (left) + DELIVERY (right) — side by side below the header
    // ──────────────────────────────────────────────────────────────────────────
    const isFedex = deal.shippingMethod === "fedex_hold";
    const secY    = headerBottom + 8;

    // ── Bill To ───────────────────────────────────────────────────────────────
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(GRAY)
       .text("BILL TO", LEFT, secY, { width: MID - LEFT });
    doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK)
       .text(`${deal.firstName} ${deal.lastName}`, LEFT, secY + 11, { width: MID - LEFT });

    let billY = secY + 26;
    doc.fontSize(8.5).font("Helvetica").fillColor(GRAY);
    if (deal.email)        { doc.text(deal.email,        LEFT, billY, { width: MID - LEFT }); billY += 12; }
    if (deal.phone)        { doc.text(deal.phone,        LEFT, billY, { width: MID - LEFT }); billY += 12; }
    if (deal.billingLine1) { doc.text(deal.billingLine1, LEFT, billY, { width: MID - LEFT }); billY += 12; }
    if (deal.billingLine2) { doc.text(deal.billingLine2, LEFT, billY, { width: MID - LEFT }); billY += 12; }
    if (deal.billingCity || deal.billingState || deal.billingZip) {
      const cityLine =
        [deal.billingCity, deal.billingState].filter(Boolean).join(", ") +
        (deal.billingZip ? ` ${deal.billingZip}` : "");
      doc.text(cityLine.trim(), LEFT, billY, { width: MID - LEFT }); billY += 12;
    } else if (deal.state) {
      doc.text(deal.state, LEFT, billY, { width: MID - LEFT }); billY += 12;
    }

    // ── Delivery ──────────────────────────────────────────────────────────────
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(GRAY)
       .text("DELIVERY", RCOL, secY, { width: RIGHT - RCOL });

    let dY = secY + 11;
    doc.fontSize(8.5).font("Helvetica").fillColor(DARK);

    if (isFedex) {
      // FedEx Hold: show location name → FBO → address → hours (no "FedEx Hold" label)
      if (deal.fedexLocation) {
        doc.text(deal.fedexLocation, RCOL, dY, { width: RIGHT - RCOL }); dY += 12;
      }
      doc.text(`FBO ${deal.firstName} ${deal.lastName}`, RCOL, dY, { width: RIGHT - RCOL }); dY += 12;
      if (deal.shipToLine1) {
        doc.fillColor(GRAY).text(deal.shipToLine1, RCOL, dY, { width: RIGHT - RCOL }); dY += 12;
      }
      const cityLine = [deal.shipToCity, deal.shipToState].filter(Boolean).join(", ") +
        (deal.shipToZip ? ` ${deal.shipToZip}` : "");
      if (cityLine.trim()) {
        doc.fillColor(GRAY).text(cityLine.trim(), RCOL, dY, { width: RIGHT - RCOL }); dY += 12;
      }
      if (deal.fedexLocationHours) {
        doc.fillColor(GRAY).text(`Hours: ${deal.fedexLocationHours}`, RCOL, dY, { width: RIGHT - RCOL }); dY += 12;
      }
    } else {
      // Home delivery
      doc.fillColor(GRAY);
      if (deal.shipToLine1) { doc.text(deal.shipToLine1, RCOL, dY, { width: RIGHT - RCOL }); dY += 12; }
      const cityLine = [deal.shipToCity, deal.shipToState].filter(Boolean).join(", ") +
        (deal.shipToZip ? ` ${deal.shipToZip}` : "");
      if (cityLine.trim()) { doc.text(cityLine.trim(), RCOL, dY, { width: RIGHT - RCOL }); dY += 12; }
    }

    const sectionBottom = Math.max(billY, dY) + 6;
    doc.moveTo(LEFT, sectionBottom).lineTo(RIGHT, sectionBottom)
       .strokeColor(LGRAY).lineWidth(0.5).stroke();

    // ──────────────────────────────────────────────────────────────────────────
    // PRODUCT TABLE
    // ──────────────────────────────────────────────────────────────────────────
    const tableTop = sectionBottom + 8;
    const COL = { product: LEFT, qty: 340, unit: 410, total: 505 };

    doc
      .moveTo(LEFT, tableTop).lineTo(RIGHT, tableTop)
      .strokeColor(LGRAY).lineWidth(0.5).stroke();

    doc
      .fontSize(7.5).font("Helvetica-Bold").fillColor(GRAY)
      .text("PRODUCT",    COL.product, tableTop + 5, { width: 250 })
      .text("QTY",        COL.qty,     tableTop + 5, { width: 60,  align: "right" })
      .text("UNIT PRICE", COL.unit,    tableTop + 5, { width: 85,  align: "right" })
      .text("LINE TOTAL", COL.total,   tableTop + 5, { width: RIGHT - COL.total, align: "right" });

    doc
      .moveTo(LEFT, tableTop + 18).lineTo(RIGHT, tableTop + 18)
      .strokeColor(LGRAY).lineWidth(0.5).stroke();

    let rowY = tableTop + 26;
    const activeProducts = deal.products.filter((p) => p.qty > 0 && p.unitPrice > 0);

    for (const p of activeProducts) {
      doc
        .fontSize(9).font("Helvetica").fillColor(DARK)
        .text(p.productName,    COL.product, rowY, { width: 280 })
        .text(String(p.qty),    COL.qty,     rowY, { width: 60,  align: "right" })
        .text(usd(p.unitPrice), COL.unit,    rowY, { width: 85,  align: "right" })
        .text(usd(p.lineTotal), COL.total,   rowY, { width: RIGHT - COL.total, align: "right" });
      rowY += 19;

      doc
        .moveTo(LEFT, rowY - 2).lineTo(RIGHT, rowY - 2)
        .strokeColor(LGRAY).lineWidth(0.4).stroke();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TOTALS
    // ──────────────────────────────────────────────────────────────────────────
    rowY += 4;
    const TLEFT = COL.unit;

    const totalsRow = (label: string, amount: number, bold = false) => {
      doc
        .fontSize(9)
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fillColor(bold ? DARK : GRAY)
        .text(label,       TLEFT, rowY, { width: 85,  align: "right" })
        .text(usd(amount), COL.total, rowY, { width: RIGHT - COL.total, align: "right" });
      rowY += 16;
    };

    totalsRow("Subtotal", deal.subtotal);
    totalsRow("Shipping", deal.shipping);
    doc
      .moveTo(TLEFT, rowY - 2).lineTo(RIGHT, rowY - 2)
      .strokeColor(DARK).lineWidth(0.8).stroke();
    rowY += 3;
    totalsRow("Total Due", deal.total, true);
    rowY += 6;

    // ──────────────────────────────────────────────────────────────────────────
    // WIRE INSTRUCTIONS BOX
    // ──────────────────────────────────────────────────────────────────────────
    const boxTop = rowY + 4;
    const wl     = LEFT + 10;
    const boxH   = 148;  // 7 rows × 13pt + header/divider + deadline text row

    doc
      .roundedRect(LEFT, boxTop, W, boxH, 3)
      .strokeColor(GOLD).lineWidth(0.8).stroke();

    doc
      .fontSize(8.5).font("Helvetica-Bold").fillColor(GOLD)
      .text("PAYMENT INSTRUCTIONS — WIRE TRANSFER", wl, boxTop + 9, { width: W - 20 });

    doc
      .moveTo(wl, boxTop + 21).lineTo(RIGHT - 10, boxTop + 21)
      .strokeColor(LGRAY).lineWidth(0.4).stroke();

    let wy = boxTop + 28;
    const wRow = (label: string, value: string) => {
      doc
        .fontSize(8).font("Helvetica-Bold").fillColor(GRAY)
        .text(label + ":", wl, wy, { width: 110 });
      doc
        .font("Helvetica").fillColor(DARK)
        .text(value, wl + 112, wy, { width: RIGHT - wl - 122 });
      wy += 13;
    };

    wRow("Bank",         WIRE.bank);
    wRow("Bank Address", WIRE.bankAddress);
    wRow("Routing #",    WIRE.routing);
    wRow("Account Name", WIRE.accountName);
    wRow("Account Addr", WIRE.accountAddr);
    wRow("Account #",    WIRE.accountNum);

    const refLast = deal.lastName.replace(/\s+/g, "").toUpperCase().slice(0, 10);
    wRow("Reference",   `${refLast}-WHC${deal.id}`);

    wy += 2;
    doc
      .fontSize(7.5).font("Helvetica-Oblique").fillColor(GRAY)
      .text(
        `Wire must be received by close of business the following business day (${payDeadline}) to secure this pricing.`,
        wl, wy, { width: W - 20 },
      );

    // ──────────────────────────────────────────────────────────────────────────
    // TRANSACTION & DELIVERY DISCLOSURE
    // ──────────────────────────────────────────────────────────────────────────
    const discTop = boxTop + boxH + 10;

    doc
      .fontSize(7.5).font("Helvetica-Bold").fillColor(DARK)
      .text("Transaction & Delivery Disclosure", LEFT, discTop, { width: W });

    // Para 1 — facilitator / third-party language
    doc
      .fontSize(7).font("Helvetica").fillColor(GRAY)
      .text(
        "West Hills Capital acts solely as a facilitator in the acquisition and delivery of physical precious metals on behalf of the customer. " +
        "Upon receipt of funds, West Hills Capital secures metals through third-party suppliers and arranges shipment via insured carriers to the designated delivery location. " +
        "West Hills Capital is not responsible for the actions, delays, errors, or performance of third parties, including but not limited to financial institutions, wholesalers and suppliers, shipping carriers (including FedEx), and insurance providers associated with shipment.",
        LEFT, discTop + 11, { width: W },
      );

    // Para 2 — Title and Risk of Loss (use doc.y so position adapts to para-1 height)
    const para2Y = doc.y + 6;
    doc
      .fontSize(7.5).font("Helvetica-Bold").fillColor(DARK)
      .text("Title and Risk of Loss", LEFT, para2Y, { width: W });
    doc
      .fontSize(7).font("Helvetica").fillColor(GRAY)
      .text(
        "Title to and risk of loss for all products transfer in accordance with supplier and carrier terms once the metals are released for shipment. " +
        "All shipments are fully insured and require an adult signature upon delivery. West Hills Capital will monitor shipment progress and assist with delivery coordination. " +
        "While West Hills Capital will actively support tracking and resolution efforts, it does not assume liability for third-party performance or outcomes beyond its direct control.",
        LEFT, doc.y + 4, { width: W },
      );

    // ──────────────────────────────────────────────────────────────────────────
    // FOOTER — ToS line sits ABOVE the footer divider
    // ──────────────────────────────────────────────────────────────────────────
    const footDivY = 743;   // divider line
    const tosY     = footDivY - 15;  // ToS sentence above divider
    const compY    = footDivY + 7;   // company tagline below divider

    doc
      .fontSize(7).font("Helvetica").fillColor(GRAY)
      .text(
        "This transaction is subject to West Hills Capital's Terms of Service available at westhillscapital.com/terms",
        LEFT, tosY, { align: "center", width: W },
      );

    doc
      .moveTo(LEFT, footDivY).lineTo(RIGHT, footDivY)
      .strokeColor(LGRAY).lineWidth(0.5).stroke();

    doc
      .fontSize(7.5).font("Helvetica").fillColor(GRAY)
      .text(
        "West Hills Capital  |  (800) 867-6768  |  westhillscapital.com  |  Physical Precious Metals Allocation",
        LEFT, compY, { align: "center", width: W },
      );

    doc.end();
    logger.info({ dealId: deal.id, invoiceNum: invNum }, "[Invoice] PDF generated");
  });
}
