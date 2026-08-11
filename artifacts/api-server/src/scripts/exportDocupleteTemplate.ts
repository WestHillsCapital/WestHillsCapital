#!/usr/bin/env tsx
/**
 * Exports a BLANK Purchase Agreement template for upload to Docuplete.
 * All dynamic values (buyer info, order items, amounts, FedEx location)
 * are shown as underlined blank lines so you can see exactly where to
 * map each field in the Docuplete field editor.
 *
 * Usage: cd artifacts/api-server && npx tsx src/scripts/exportDocupleteTemplate.ts
 */
import { writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage, Color } from "pdf-lib";

const PW = 612, PH = 792;
const ML = 56, MR = 56;
const TW = PW - ML - MR; // 500 pt

const INK    = rgb(0.07, 0.07, 0.07);
const GRAY   = rgb(0.48, 0.48, 0.48);
const BORDER = rgb(0.74, 0.74, 0.74);
const FIELD  = rgb(0.74, 0.74, 0.74); // underline color for blank fields

function dt(p: PDFPage, s: string, x: number, y: number, sz: number, f: PDFFont, c: Color = INK) {
  p.drawText(s, { x, y, size: sz, font: f, color: c });
}
function dtc(p: PDFPage, s: string, y: number, sz: number, f: PDFFont, c: Color = INK) {
  p.drawText(s, { x: (PW - f.widthOfTextAtSize(s, sz)) / 2, y, size: sz, font: f, color: c });
}
function hr(p: PDFPage, y: number, x1 = ML, x2 = PW - MR) {
  p.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color: BORDER });
}
function uline(p: PDFPage, y: number, x1: number, x2: number) {
  p.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color: FIELD });
}

/** Draw text then advance x; returns new x. */
function seg(p: PDFPage, s: string, x: number, y: number, sz: number, f: PDFFont, c: Color = INK): number {
  p.drawText(s, { x, y, size: sz, font: f, color: c });
  return x + f.widthOfTextAtSize(s, sz);
}

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

async function build(): Promise<Uint8Array> {
  const doc   = await PDFDocument.create();
  const bold  = await doc.embedFont(StandardFonts.TimesRomanBold);
  const reg   = await doc.embedFont(StandardFonts.TimesRoman);
  const ital  = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const boldI = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);

  const p = doc.addPage([PW, PH]);
  const BSZ = 10, LH = 15;
  let y = 748;

  // ── HEADER ─────────────────────────────────────────────────────────────────
  dtc(p, "PURCHASE AGREEMENT", y, 16, bold);   y -= 19;
  dtc(p, "West Hills Capital LLC", y, 9, reg, GRAY); y -= 13;
  hr(p, y); y -= 14;

  // ── DATE / ID ROW ──────────────────────────────────────────────────────────
  // Left: "Date: ________________"
  let x = seg(p, "Date: ", ML, y, 8.5, reg, GRAY);
  uline(p, y - 2, x, x + 160);

  // Right: "ID: ________________"
  const idLblW = reg.widthOfTextAtSize("ID: ", 8.5);
  const idX = PW - MR - idLblW - 150;
  seg(p, "ID: ", idX, y, 8.5, reg, GRAY);
  uline(p, y - 2, idX + idLblW, PW - MR);

  y -= 11;
  hr(p, y); y -= 16;

  // ── INTRO PARAGRAPH ────────────────────────────────────────────────────────
  // Line 1 (static)
  x = seg(p, "This Purchase Agreement (\u201c", ML, y, BSZ, reg);
  x = seg(p, "Agreement", x, y, BSZ, boldI);
  seg(p, "\u201d) is entered into between", x, y, BSZ, reg);
  y -= LH;

  // Line 2: "West Hills Capital LLC ("Dealer") and _____________ ("Buyer"),"
  x = seg(p, "West Hills Capital LLC", ML, y, BSZ, bold);
  x = seg(p, " (\u201cDealer\u201d) and ", x, y, BSZ, reg);
  const nameX = x;
  uline(p, y - 2, nameX, nameX + 170); // BUYER_FULL_NAME
  x = nameX + 170;
  seg(p, " (\u201cBuyer\u201d),", x, y, BSZ, reg);
  y -= LH;

  // Line 3: "located at __________________________."
  x = seg(p, "located at ", ML, y, BSZ, reg);
  uline(p, y - 2, x, PW - MR - 8); // BUYER_ADDRESS
  seg(p, ".", PW - MR - 7, y, BSZ, reg);
  y -= LH + 10;

  // ── SECTION 1: PURCHASE ────────────────────────────────────────────────────
  dt(p, "1. Purchase", ML, y, BSZ, bold); y -= LH;
  dt(p, "Buyer agrees to purchase the following from Dealer:", ML, y, BSZ, reg); y -= 10;

  // Table — 6 item rows (blanks) + shipping + total
  const ITEM_H = 16, SHIP_H = 16, TOT_H = 22;
  const BLANK_ROWS = 6;
  const tableH  = BLANK_ROWS * ITEM_H + SHIP_H + TOT_H;
  const tblBot  = y - tableH;
  const tblRight = ML + TW;

  p.drawRectangle({
    x: ML, y: tblBot, width: TW, height: tableH,
    borderColor: BORDER, borderWidth: 0.6, opacity: 0,
  });

  // Blank item rows — ORDER_SUMMARY placeholder area
  for (let i = 0; i < BLANK_ROWS; i++) {
    const rowY = y - (i + 1) * ITEM_H + 5;
    // Left underline: item name+qty
    uline(p, rowY - 2, ML + 6, ML + 6 + 260);
    // Right underline: item total
    uline(p, rowY - 2, tblRight - 70, tblRight - 6);
  }

  // Shipping row
  const shipY = tblBot + TOT_H + SHIP_H - 11;
  dt(p, "Shipping & Insurance", ML + 6, shipY, 9, reg);
  uline(p, shipY - 2, tblRight - 70, tblRight - 6); // SHIPPING_FEE

  // Total row
  const totY = tblBot + 7;
  dt(p, "Estimated Total", ML + 6, totY, BSZ + 1, bold);
  uline(p, totY - 2, tblRight - 80, tblRight - 6); // ESTIMATED_TOTAL

  y = tblBot - 13;

  // ── FEDEX LOCATION ─────────────────────────────────────────────────────────
  dt(p, "Metals will be shipped via FedEx 2-Day, fully insured, to:", ML, y, 8.5, reg, GRAY);
  y -= 13;
  // "NAME  —  full address" on one bold line
  x = ML;
  uline(p, y - 2, x, x + 190);      // FEDEX_LOCATION_NAME
  x += 191;
  x = seg(p, "  \u2014  ", x, y, 9, bold);
  uline(p, y - 2, x, PW - MR);      // FEDEX_LOCATION_ADDRESS + city + state + zip
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

  x = seg(p, "By clicking ", ML, y, 8.5, ital, GRAY);
  x = seg(p, "Send for Signature", x, y, 8.5, boldI, GRAY);
  seg(p, ", Buyer acknowledges they have read and agree to this Agreement.", x, y, 8.5, ital, GRAY);
  y -= 12;

  x = seg(p, "Electronic signature will be collected via a secure link sent to ", ML, y, 8.5, ital, GRAY);
  uline(p, y - 2, x, x + 200); // BUYER_EMAIL

  return doc.save();
}

build().then(bytes => {
  const out = "/home/runner/workspace/whc-purchase-agreement-template.pdf";
  writeFileSync(out, bytes);
  console.log(`Saved: ${out}  (${bytes.length.toLocaleString()} bytes)`);
}).catch(err => { console.error(err); process.exit(1); });
