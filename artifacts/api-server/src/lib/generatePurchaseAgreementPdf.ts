/**
 * Generates the WHC Purchase Agreement PDF with all buyer and order data
 * substituted inline — no placeholder fields or underlines.
 * Mirrors the on-screen PA review layout from Buy.tsx (serif, 1 page).
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage, Color } from "pdf-lib";

// ── Page & margin constants ───────────────────────────────────────────────────
const PW = 612, PH = 792;
const ML = 56, MR = 56;
const TW = PW - ML - MR; // 500 pt usable width

// ── Colors (mirror Tailwind tokens used on-screen) ───────────────────────────
const INK    = rgb(0.07, 0.07, 0.07); // foreground
const GRAY   = rgb(0.48, 0.48, 0.48); // foreground/60
const BORDER = rgb(0.74, 0.74, 0.74); // border

// ── Drawing helpers ───────────────────────────────────────────────────────────

function dt(p: PDFPage, s: string, x: number, y: number, sz: number, f: PDFFont, c: Color = INK) {
  p.drawText(s, { x, y, size: sz, font: f, color: c });
}

function dtc(p: PDFPage, s: string, y: number, sz: number, f: PDFFont, c: Color = INK) {
  p.drawText(s, { x: (PW - f.widthOfTextAtSize(s, sz)) / 2, y, size: sz, font: f, color: c });
}

function hr(p: PDFPage, y: number, x1 = ML, x2 = PW - MR) {
  p.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color: BORDER });
}

/** Draw mixed-font segments on one line; returns x after last segment. */
function inline(
  p: PDFPage,
  segs: { t: string; f: PDFFont; c?: Color }[],
  x: number, y: number, sz: number,
): number {
  let cx = x;
  for (const s of segs) {
    p.drawText(s.t, { x: cx, y, size: sz, font: s.f, color: s.c ?? INK });
    cx += s.f.widthOfTextAtSize(s.t, sz);
  }
  return cx;
}

/** Word-wrap a plain string; returns y after the last line (already decremented). */
function wrap(
  p: PDFPage, s: string, x: number, y: number, maxW: number,
  f: PDFFont, sz: number, lh: number, c: Color = INK,
): number {
  const words = s.split(" ");
  let line = "", cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (f.widthOfTextAtSize(test, sz) > maxW && line) {
      p.drawText(line, { x, y: cy, size: sz, font: f, color: c });
      line = w; cy -= lh;
    } else line = test;
  }
  if (line) { p.drawText(line, { x, y: cy, size: sz, font: f, color: c }); cy -= lh; }
  return cy;
}

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface PurchaseAgreementData {
  /** e.g. "August 10, 2026" */
  agreementDate: string;
  /** e.g. "WHC-2026-XXXX" or "Assigned on signing" */
  confirmationId: string;
  buyerFirstName: string;
  buyerLastName: string;
  buyerStreet: string;
  buyerCity: string;
  buyerState: string;
  buyerZip: string;
  buyerEmail: string;
  lineItems: { name: string; qty: number; total: number }[];
  /** 0 = free */
  shipping: number;
  estimatedTotal: number;
  fedexLocationName: string;
  fedexLocationAddress: string;
  fedexLocationCity: string;
  fedexLocationState: string;
  fedexLocationZip: string;
}

export async function generatePurchaseAgreementPdf(data: PurchaseAgreementData): Promise<Uint8Array> {
  const doc   = await PDFDocument.create();
  const bold  = await doc.embedFont(StandardFonts.TimesRomanBold);
  const reg   = await doc.embedFont(StandardFonts.TimesRoman);
  const ital  = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const boldI = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);

  const p = doc.addPage([PW, PH]);

  const BSZ = 10; // body font size
  const LH  = 15; // line height

  let y = 748;

  // ── HEADER ─────────────────────────────────────────────────────────────────
  dtc(p, "PURCHASE AGREEMENT", y, 16, bold);  y -= 19;
  dtc(p, "West Hills Capital LLC", y, 9, reg, GRAY); y -= 13;
  hr(p, y); y -= 14;

  // ── DATE / ID ROW ──────────────────────────────────────────────────────────
  // Left: "Date: August 10, 2026"
  dt(p, "Date: ", ML, y, 8.5, reg, GRAY);
  dt(p, data.agreementDate, ML + reg.widthOfTextAtSize("Date: ", 8.5), y, 8.5, bold);

  // Right: "ID: <confirmationId>"  (right-aligned as a block)
  const idLblW = reg.widthOfTextAtSize("ID: ", 8.5);
  const idValW = bold.widthOfTextAtSize(data.confirmationId, 8.5);
  const idX    = PW - MR - idLblW - idValW;
  dt(p, "ID: ", idX, y, 8.5, reg, GRAY);
  dt(p, data.confirmationId, idX + idLblW, y, 8.5, bold);

  y -= 11;
  hr(p, y); y -= 16;

  // ── INTRO PARAGRAPH ────────────────────────────────────────────────────────
  const buyerName = `${data.buyerFirstName} ${data.buyerLastName}`;
  const buyerAddr = `${data.buyerStreet}, ${data.buyerCity}, ${data.buyerState} ${data.buyerZip}`;

  // Line 1
  inline(p, [
    { t: "This Purchase Agreement (\u201c", f: reg },
    { t: "Agreement",                        f: boldI },
    { t: "\u201d) is entered into between",  f: reg },
  ], ML, y, BSZ);
  y -= LH;

  // Line 2
  inline(p, [
    { t: "West Hills Capital LLC",    f: bold },
    { t: " (\u201cDealer\u201d) and ", f: reg },
    { t: buyerName,                   f: bold },
    { t: " (\u201cBuyer\u201d),",     f: reg },
  ], ML, y, BSZ);
  y -= LH;

  // Line 3
  dt(p, `located at ${buyerAddr}.`, ML, y, BSZ, reg);
  y -= LH + 10;

  // ── SECTION 1: PURCHASE ────────────────────────────────────────────────────
  dt(p, "1. Purchase", ML, y, BSZ, bold); y -= LH;
  dt(p, "Buyer agrees to purchase the following from Dealer:", ML, y, BSZ, reg); y -= 10;

  // Table layout
  const ITEM_H  = 16;
  const SHIP_H  = 16;
  const TOT_H   = 22;
  const tableH  = data.lineItems.length * ITEM_H + SHIP_H + TOT_H;
  const tblTop  = y;
  const tblBot  = y - tableH;
  const tblRight = ML + TW;

  // Outer border (no internal row separators — matches the plain white on-screen table)
  p.drawRectangle({
    x: ML, y: tblBot, width: TW, height: tableH,
    borderColor: BORDER, borderWidth: 0.6, opacity: 0,
  });

  // Line items
  let ry = tblTop;
  for (const item of data.lineItems) {
    const ty = ry - ITEM_H + 5;
    dt(p, `${item.qty}\u00d7  ${item.name}`, ML + 6, ty, 9, reg);
    const ps = usd(item.total);
    dt(p, ps, tblRight - 6 - bold.widthOfTextAtSize(ps, 9), ty, 9, bold);
    ry -= ITEM_H;
  }

  // Shipping row  (ry is now at the top of the shipping zone)
  const shipY = ry - SHIP_H + 5;
  dt(p, "Shipping & Insurance", ML + 6, shipY, 9, reg);
  const ss = data.shipping === 0 ? "$0" : usd(data.shipping);
  dt(p, ss, tblRight - 6 - bold.widthOfTextAtSize(ss, 9), shipY, 9, bold);

  // Total row  (anchored to table bottom)
  const totY = tblBot + 7;
  dt(p, "Estimated Total", ML + 6, totY, BSZ + 1, bold);
  const ts = usd(data.estimatedTotal);
  dt(p, ts, tblRight - 6 - bold.widthOfTextAtSize(ts, BSZ + 1), totY, BSZ + 1, bold);

  y = tblBot - 13;

  // ── FEDEX LOCATION ─────────────────────────────────────────────────────────
  dt(p, "Metals will be shipped via FedEx 2-Day, fully insured, to:", ML, y, 8.5, reg, GRAY);
  y -= 13;
  const fedexLine = `${data.fedexLocationName}  \u2014  ${data.fedexLocationAddress}, ${data.fedexLocationCity}, ${data.fedexLocationState} ${data.fedexLocationZip}`;
  dt(p, fedexLine, ML, y, 9, bold);
  y -= 13;
  dt(p, "Adult signature required at pickup.", ML, y, 8.5, ital, GRAY);
  y -= LH + 8;

  // ── SECTION 2: PAYMENT ─────────────────────────────────────────────────────
  dt(p, "2. Payment", ML, y, BSZ, bold); y -= LH;
  y = wrap(p,
    "Payment must be received by wire transfer no later than the end of the next business day " +
    "following execution of this Agreement. Wire instructions will be included in your invoice, " +
    "delivered by email upon completion of signing.",
    ML, y, TW, reg, BSZ, LH) - 8;

  // ── SECTION 3: CANCELLATION FEE ────────────────────────────────────────────
  dt(p, "3. Cancellation Fee", ML, y, BSZ, bold); y -= LH;
  y = wrap(p,
    "If payment is not received by the deadline, West Hills Capital reserves the right to cancel " +
    "this order and charge a fee equal to the greater of $125.00 or the actual market loss " +
    "sustained by West Hills Capital as a result of executing and unwinding the corresponding " +
    "trade with its supplier.",
    ML, y, TW, reg, BSZ, LH) - 8;

  // ── SECTION 4: PRICE ───────────────────────────────────────────────────────
  dt(p, "4. Price", ML, y, BSZ, bold); y -= LH;
  y = wrap(p,
    "The estimated total above reflects live market pricing at the time of this Agreement. " +
    "Final price is confirmed at trade execution, which occurs upon confirmed receipt of cleared " +
    "funds. Prices may vary slightly at execution.",
    ML, y, TW, reg, BSZ, LH) - 8;

  // ── SECTION 5: TERMS ───────────────────────────────────────────────────────
  dt(p, "5. Terms", ML, y, BSZ, bold); y -= LH;
  y = wrap(p,
    "This Agreement is subject to West Hills Capital\u2019s Terms of Service " +
    "(westhillscapital.com/terms) and Privacy Policy (westhillscapital.com/privacy).",
    ML, y, TW, reg, BSZ, LH) - 12;

  // ── FOOTER DISCLOSURE ──────────────────────────────────────────────────────
  hr(p, y + 6);
  y -= 4;

  inline(p, [
    { t: "By clicking ",       f: ital,  c: GRAY },
    { t: "Send for Signature", f: boldI, c: GRAY },
    { t: ", Buyer acknowledges they have read and agree to this Agreement.", f: ital, c: GRAY },
  ], ML, y, 8.5);
  y -= 12;

  inline(p, [
    { t: "Electronic signature will be collected via a secure link sent to ", f: ital,  c: GRAY },
    { t: data.buyerEmail, f: boldI, c: GRAY },
    { t: ".",             f: ital,  c: GRAY },
  ], ML, y, 8.5);

  return doc.save();
}
