#!/usr/bin/env tsx
/**
 * Exports the WHC Purchase Agreement PDF (matches the on-screen review layout).
 * Usage: cd artifacts/api-server && npx tsx src/scripts/exportPurchaseAgreementPdf.ts
 */
import { writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage, Color } from "pdf-lib";

// ── Page constants ────────────────────────────────────────────────────────────
const W = 612; const H = 792;
const ML = 50; const MR = 50;          // left / right margin
const TW = W - ML - MR;               // 512 pt usable width

// ── Colours (mirror Tailwind tokens used on-screen) ───────────────────────────
const INK    = rgb(0.07, 0.07, 0.07); // foreground
const GRAY   = rgb(0.48, 0.48, 0.48); // foreground/60
const LGRAY  = rgb(0.74, 0.74, 0.74); // border
const WHITE  = rgb(1, 1, 1);

// ── Drawing helpers ───────────────────────────────────────────────────────────
const t = (p: PDFPage, s: string, x: number, y: number, sz: number, f: PDFFont, c: Color) =>
  p.drawText(s, { x, y, size: sz, font: f, color: c });

const tc = (p: PDFPage, s: string, y: number, sz: number, f: PDFFont, c: Color) => {
  const w = f.widthOfTextAtSize(s, sz);
  p.drawText(s, { x: (W - w) / 2, y, size: sz, font: f, color: c });
};

const hline = (p: PDFPage, y: number, x1 = ML, x2 = W - MR, thick = 0.5) =>
  p.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: thick, color: LGRAY });

const uline = (p: PDFPage, y: number, x1: number, x2: number) =>
  p.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.35, color: LGRAY });

function wrap(
  p: PDFPage, s: string, x: number, y: number, maxW: number,
  f: PDFFont, sz: number, c: Color, lh: number,
): number {
  const words = s.split(" "); let line = ""; let cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (f.widthOfTextAtSize(test, sz) > maxW && line) {
      p.drawText(line, { x, y: cy, size: sz, font: f, color: c });
      line = w; cy -= lh;
    } else { line = test; }
  }
  if (line) { p.drawText(line, { x, y: cy, size: sz, font: f, color: c }); cy -= lh; }
  return cy;
}

function fillRect(p: PDFPage, x: number, y: number, w: number, h: number, color: Color) {
  p.drawRectangle({ x, y, width: w, height: h, color, borderWidth: 0 });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function build(): Promise<Uint8Array> {
  const doc   = await PDFDocument.create();
  const bold  = await doc.embedFont(StandardFonts.TimesRomanBold);
  const reg   = await doc.embedFont(StandardFonts.TimesRoman);
  const ital  = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const boldI = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);

  const p = doc.addPage([W, H]);

  // ── HEADER — centered, border-bottom ────────────────────────────────────────
  tc(p, "PURCHASE AGREEMENT", 748, 16, bold, INK);
  tc(p, "West Hills Capital LLC", 730, 9, reg, GRAY);
  hline(p, 720, ML, W - MR, 0.6);

  // ── DATE / ID ROW — two columns, border-bottom ──────────────────────────────
  // Left: "Date: ___________"
  t(p, "Date:", ML, 708, 8.5, reg, GRAY);
  const dtLblW = reg.widthOfTextAtSize("Date: ", 8.5);
  uline(p, 703, ML + dtLblW, ML + dtLblW + 165);
  // Right: "ID: ___________" (right-aligned)
  const idLbl = "ID:";
  t(p, idLbl, W - MR - 185, 708, 8.5, reg, GRAY);
  uline(p, 703, W - MR - 185 + reg.widthOfTextAtSize("ID: ", 8.5), W - MR);
  hline(p, 697, ML, W - MR, 0.4);

  // ── INTRO PARAGRAPH ─────────────────────────────────────────────────────────
  const BODY_SZ = 10;
  const LH = 15; // line height

  // Line 1 (fully static)
  const L1 = "This Purchase Agreement (\u201cAgreement\u201d) is entered into between West Hills Capital LLC";
  t(p, L1, ML, 683, BODY_SZ, reg, INK);

  // Line 2: (\u201cDealer\u201d) and [BUYER_FULL_NAME] (\u201cBuyer\u201d),
  const L2a  = "(\u201cDealer\u201d) and ";
  const L2b  = " (\u201cBuyer\u201d),";
  const L2_Y = 683 - LH;
  const L2aW = reg.widthOfTextAtSize(L2a, BODY_SZ);
  t(p, L2a, ML, L2_Y, BODY_SZ, reg, INK);
  const NAME_X = ML + L2aW;
  const NAME_W = 175;                          // reserve 175 pt for buyer name
  uline(p, L2_Y - 2, NAME_X, NAME_X + NAME_W);
  t(p, L2b, NAME_X + NAME_W, L2_Y, BODY_SZ, reg, INK);

  // Line 3: located at [BUYER_ADDRESS].
  const L3a  = "located at ";
  const L3_Y = L2_Y - LH;
  const L3aW = reg.widthOfTextAtSize(L3a, BODY_SZ);
  t(p, L3a, ML, L3_Y, BODY_SZ, reg, INK);
  const ADDR_X = ML + L3aW;
  const ADDR_W = W - MR - ADDR_X - 4;         // leave a sliver for the period
  uline(p, L3_Y - 2, ADDR_X, ADDR_X + ADDR_W);
  t(p, ".", ADDR_X + ADDR_W, L3_Y, BODY_SZ, reg, INK);

  // ── SECTION 1: PURCHASE ─────────────────────────────────────────────────────
  const S1_Y = L3_Y - 20;
  t(p, "1. Purchase", ML, S1_Y, BODY_SZ, bold, INK);
  t(p, "Buyer agrees to purchase the following from Dealer:", ML, S1_Y - LH, BODY_SZ, reg, INK);

  // Table geometry
  const TBL_TOP   = S1_Y - LH - 8;  // top of the table rectangle (pdf-lib top y)
  const TBL_X     = ML;
  const TBL_W     = TW;
  const TBL_RIGHT = ML + TW;

  // Row heights
  const OS_ROWS   = 6;               // rows reserved for ORDER_SUMMARY
  const OS_H      = OS_ROWS * 14;    // 84 pt
  const SHIP_H    = 17;
  const TOT_H     = 20;
  const TBL_H     = OS_H + SHIP_H + TOT_H;  // 121 pt

  const OS_BOT    = TBL_TOP - OS_H;         // bottom of ORDER_SUMMARY area
  const SHIP_BOT  = OS_BOT  - SHIP_H;
  const TOT_BOT   = SHIP_BOT - TOT_H;       // = table bottom

  // Draw table background fills first
  fillRect(p, TBL_X, OS_BOT,   TBL_W, OS_H,   WHITE);
  fillRect(p, TBL_X, SHIP_BOT, TBL_W, SHIP_H, WHITE);
  fillRect(p, TBL_X, TOT_BOT,  TBL_W, TOT_H,  WHITE);

  // Table border and row separators
  p.drawRectangle({ x: TBL_X, y: TOT_BOT, width: TBL_W, height: TBL_H, borderColor: LGRAY, borderWidth: 0.6, opacity: 0 });
  hline(p, OS_BOT,   TBL_X, TBL_RIGHT, 0.5);
  hline(p, SHIP_BOT, TBL_X, TBL_RIGHT, 0.5);

  // ORDER_SUMMARY field placeholder (light hint text)
  t(p, "(order items)", TBL_X + 5, OS_BOT + OS_H / 2 - 4, 8, ital, rgb(0.82, 0.82, 0.82));

  // Shipping row
  const SHIP_TEXT_Y = SHIP_BOT + (SHIP_H - 9) / 2 + 1;
  t(p, "Shipping & Insurance", TBL_X + 6, SHIP_TEXT_Y, 9, reg, INK);
  uline(p, SHIP_TEXT_Y - 3, TBL_RIGHT - 75, TBL_RIGHT - 4);

  // Total row
  const TOT_TEXT_Y = TOT_BOT + (TOT_H - 10) / 2 + 1;
  t(p, "Estimated Total", TBL_X + 6, TOT_TEXT_Y, 10, bold, INK);
  uline(p, TOT_TEXT_Y - 3, TBL_RIGHT - 90, TBL_RIGHT - 4);

  // ── FEDEX LOCATION ──────────────────────────────────────────────────────────
  const FX_Y = TOT_BOT - 14;
  t(p, "Metals will be shipped via FedEx 2-Day, fully insured, to:", ML, FX_Y, 8.5, reg, GRAY);

  // "NAME — address, city, state zip" on one bold line
  const LOC_Y = FX_Y - 13;
  uline(p, LOC_Y - 2, ML, ML + 200);   // FedEx location name
  t(p, " \u2014 ", ML + 201, LOC_Y, 9, bold, INK);
  const DASH_W = bold.widthOfTextAtSize(" \u2014 ", 9);
  uline(p, LOC_Y - 2, ML + 201 + DASH_W, W - MR); // address + city + state + zip

  t(p, "Adult signature required at pickup.", ML, LOC_Y - 13, 8.5, ital, GRAY);

  // ── SECTIONS 2-5 ────────────────────────────────────────────────────────────
  let cy = LOC_Y - 31;

  // Section 2
  t(p, "2. Payment", ML, cy, BODY_SZ, bold, INK); cy -= LH;
  cy = wrap(p,
    "Payment must be received by wire transfer no later than the end of the next business day " +
    "following execution of this Agreement. Wire instructions will be included in your invoice, " +
    "delivered by email upon completion of signing.",
    ML, cy, TW, reg, BODY_SZ, INK, LH) - 6;

  // Section 3
  t(p, "3. Cancellation Fee", ML, cy, BODY_SZ, bold, INK); cy -= LH;
  cy = wrap(p,
    "If payment is not received by the deadline, West Hills Capital reserves the right to cancel " +
    "this order and charge a fee equal to the greater of $125.00 or the actual market loss " +
    "sustained by West Hills Capital as a result of executing and unwinding the corresponding " +
    "trade with its supplier.",
    ML, cy, TW, reg, BODY_SZ, INK, LH) - 6;

  // Section 4
  t(p, "4. Price", ML, cy, BODY_SZ, bold, INK); cy -= LH;
  cy = wrap(p,
    "The estimated total above reflects live market pricing at the time of this Agreement. " +
    "Final price is confirmed at trade execution, which occurs upon confirmed receipt of cleared " +
    "funds. Prices may vary slightly at execution.",
    ML, cy, TW, reg, BODY_SZ, INK, LH) - 6;

  // Section 5
  t(p, "5. Terms", ML, cy, BODY_SZ, bold, INK); cy -= LH;
  cy = wrap(p,
    "This Agreement is subject to West Hills Capital\u2019s Terms of Service " +
    "(westhillscapital.com/terms) and Privacy Policy (westhillscapital.com/privacy).",
    ML, cy, TW, reg, BODY_SZ, INK, LH) - 10;

  // ── FOOTER DISCLOSURE — border-top ──────────────────────────────────────────
  hline(p, cy + 4, ML, W - MR, 0.5);
  cy -= 4;
  const DISC_SZ = 8.5;
  const DISC_LH = 12;

  // "By clicking Send for Signature, Buyer acknowledges..."
  t(p, "By clicking ", ML, cy, DISC_SZ, ital, GRAY);
  const bcW = ital.widthOfTextAtSize("By clicking ", DISC_SZ);
  t(p, "Send for Signature", ML + bcW, cy, DISC_SZ, boldI, GRAY);
  const sfW = boldI.widthOfTextAtSize("Send for Signature", DISC_SZ);
  t(p, ", Buyer acknowledges they have read and agree to this Agreement.", ML + bcW + sfW, cy, DISC_SZ, ital, GRAY);

  cy -= DISC_LH;
  t(p, "Electronic signature will be collected via a secure link sent to: ", ML, cy, DISC_SZ, ital, GRAY);
  const elW = ital.widthOfTextAtSize("Electronic signature will be collected via a secure link sent to: ", DISC_SZ);
  uline(p, cy - 2, ML + elW, ML + elW + 190);  // BUYER_EMAIL field underline

  return doc.save();
}

build().then(bytes => {
  const out = "/home/runner/workspace/whc-purchase-agreement.pdf";
  writeFileSync(out, bytes);
  console.log(`Saved: ${out}  (${bytes.length.toLocaleString()} bytes)`);
}).catch(err => { console.error(err); process.exit(1); });
