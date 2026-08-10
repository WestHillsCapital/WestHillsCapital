#!/usr/bin/env tsx
/**
 * Seed the West Hills Capital self-serve Purchase Agreement package in Docuplete.
 *
 * Usage (from repo root):
 *   pnpm --filter @workspace/api-server tsx src/scripts/seedPurchaseAgreementPackage.ts
 *
 * After running, set the printed DOCUPLETE_PURCHASE_EMBED_KEY in your environment.
 * Re-running replaces the existing package (identified by account_id + name).
 */

import { randomBytes } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage, Color } from "pdf-lib";
import { getDb } from "../db";
import { ObjectStorageService } from "../lib/objectStorage";
import { isEncryptionEnabled, getOrCreateAccountDek, encryptBuffer } from "../lib/encryption";
import { logger } from "../lib/logger";

// ── Constants ─────────────────────────────────────────────────────────────────
const W          = 612;           // letter width (pt)
const H          = 792;           // letter height (pt)
const MARGIN     = 50;            // left/right margin
const TEXT_W     = W - MARGIN * 2;
const ACCOUNT_ID = 1;             // West Hills Capital
const PKG_NAME   = "WHC Self-Serve Purchase Agreement";

// ── Colours ───────────────────────────────────────────────────────────────────
const DARK   = rgb(0.08, 0.08, 0.08);
const GRAY   = rgb(0.45, 0.45, 0.45);
const LGRAY  = rgb(0.75, 0.75, 0.75);
const NAVY   = rgb(0.07, 0.11, 0.25);

// ── Coordinate helpers ────────────────────────────────────────────────────────
// pdf-lib: bottom-left origin.  Mappings: % from top-left.
//
// Convention for single-line fields:
//   drawText at   yDraw = yLine + 2        (baseline just above underline)
//   drawLine at   yLine                    (the underline)
//   mapping box:  yTop_pdf = yLine + FIELD_H   (top of box in pdf-lib coords)
//                 y%       = (H − yTop_pdf) / H × 100

const FIELD_H  = 14;                                       // pt — single-line field height
const FIELD_H_PCT = parseFloat((FIELD_H / H * 100).toFixed(1));  // ≈ 1.8 %

function xp(x: number)          { return parseFloat((x / W * 100).toFixed(1)); }
function yp(yLine: number, bh = FIELD_H) {
  return parseFloat(((H - yLine - bh) / H * 100).toFixed(1));
}
function wp(w: number)          { return parseFloat((w / W * 100).toFixed(1)); }
function hp(h: number)          { return parseFloat((h / H * 100).toFixed(1)); }

// ── Drawing helpers ───────────────────────────────────────────────────────────
function hline(page: PDFPage, y: number, x1 = MARGIN, x2 = W - MARGIN) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color: LGRAY });
}
function uline(page: PDFPage, y: number, x1: number, x2: number) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.4, color: LGRAY });
}
function text(page: PDFPage, str: string, x: number, y: number, size: number, font: PDFFont, color: Color) {
  page.drawText(str, { x, y, size, font, color });
}
function textC(page: PDFPage, str: string, y: number, size: number, font: PDFFont, color: Color) {
  const tw = font.widthOfTextAtSize(str, size);
  page.drawText(str, { x: (W - tw) / 2, y, size, font, color });
}

function drawWrapped(
  page: PDFPage, str: string,
  x: number, startY: number, maxW: number,
  font: PDFFont, size: number, color: Color, lineH: number,
): number {
  const words = str.split(" ");
  let line  = "";
  let currY = startY;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxW && line) {
      page.drawText(line, { x, y: currY, size, font, color });
      line  = word;
      currY -= lineH;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x, y: currY, size, font, color });
    currY -= lineH;
  }
  return currY;
}

// ── PDF builder ───────────────────────────────────────────────────────────────
async function buildPdf(): Promise<{
  bytes: Uint8Array;
  pageSizes: Array<{ width: number; height: number }>;
  documentId: string;
  mappings: Record<string, unknown>[];
}> {
  const doc    = await PDFDocument.create();
  const bold   = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg    = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const docId  = `doc_${randomBytes(12).toString("base64url")}`;
  const maps: Record<string, unknown>[] = [];

  let mapIdx = 0;
  function addMap(
    fieldId: string, page: number,
    xVal: number, yLine: number, wVal: number,
    opts: { bh?: number; fontSize?: number; align?: string; format?: string } = {},
  ) {
    const bh = opts.bh ?? FIELD_H;
    maps.push({
      id:         `mp_${docId}_${mapIdx++}`,
      fieldId,
      documentId: docId,
      page,
      x:          xp(xVal),
      y:          yp(yLine, bh),
      w:          wp(wVal),
      h:          hp(bh),
      fontSize:   opts.fontSize ?? 10,
      align:      opts.align   ?? "left",
      format:     opts.format  ?? "as-entered",
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Header, Buyer Info, Section 1 (Purchase)
  // ════════════════════════════════════════════════════════════════════════════
  const p1 = doc.addPage([W, H]);

  // Title
  textC(p1, "PURCHASE AGREEMENT",     748, 18, bold, DARK);
  textC(p1, "West Hills Capital LLC", 730, 10, reg,  GRAY);
  hline(p1, 720);

  // ── Date / Confirmation ID row ──────────────────────────────────────────────
  //   Label sits 12pt above the underline; field value prints 2pt above underline.
  const DATE_LINE = 700;
  text(p1, "Date:",             MARGIN,      DATE_LINE + 12, 9, reg, GRAY);
  uline(p1, DATE_LINE,          82, 240);
  addMap("agreement_date",  1,  82, DATE_LINE, 158);          // AGREEMENT_DATE

  text(p1, "Confirmation ID:", 300,          DATE_LINE + 12, 9, reg, GRAY);
  uline(p1, DATE_LINE,          400, W - MARGIN);
  addMap("confirmation_id", 1,  400, DATE_LINE, 162);         // CONFIRMATION_ID

  hline(p1, 691);

  // ── Buyer Information block ─────────────────────────────────────────────────
  text(p1, "BUYER INFORMATION", MARGIN, 679, 7.5, bold, GRAY);

  const BI: Array<[string, string, number, number, number]> = [
    // [fieldId, label, labelX, lineY, fieldX]
    ["buyer_full_name", "Buyer Name:",     MARGIN, 660, 133],
    ["buyer_address",   "Mailing Address:", MARGIN, 640, 152],
    ["buyer_email",     "Email:",           MARGIN, 620, 82],
    ["buyer_phone",     "Phone:",           MARGIN, 600, 82],
  ];
  for (const [fid, lbl, lx, ly, fx] of BI) {
    text(p1, lbl, lx, ly + 12, 9, reg, GRAY);
    uline(p1, ly, fx, W - MARGIN);
    addMap(fid, 1, fx, ly, W - MARGIN - fx);
  }

  text(p1, "Dealer: West Hills Capital LLC, a California limited liability company.",
       MARGIN, 586, 9, italic, GRAY);

  hline(p1, 576);

  // ── Section 1: Purchase ─────────────────────────────────────────────────────
  text(p1, "1.  PURCHASE", MARGIN, 564, 10.5, bold, DARK);
  text(p1, "Buyer agrees to purchase the following precious metals from Dealer:",
       MARGIN, 548, 9.5, reg, DARK);

  // Table header
  const TH_Y = 532;
  text(p1, "Product / Item", MARGIN,  TH_Y, 8.5, bold, DARK);
  text(p1, "Qty",            358,     TH_Y, 8.5, bold, DARK);
  text(p1, "Unit Price",     400,     TH_Y, 8.5, bold, DARK);
  text(p1, "Line Total",     471,     TH_Y, 8.5, bold, DARK);
  hline(p1, 525);

  // ORDER_SUMMARY — multi-line text area (8 lines × ~11pt each ≈ 88 pt)
  const OS_TOP  = 524;   // pdf-lib y of top of box
  const OS_BOT  = 428;   // pdf-lib y of bottom of box
  const OS_H    = OS_TOP - OS_BOT;   // 96 pt
  // helper note drawn inside box in light gray
  text(p1, "(order items will be listed here)", MARGIN + 4, OS_BOT + 42, 8, italic, LGRAY);
  hline(p1, OS_BOT);
  addMap("order_summary", 1, MARGIN, OS_BOT, TEXT_W, { bh: OS_H, fontSize: 10 });

  // Totals (right-aligned)
  const TV_X  = 471;          // value field left edge
  const TV_W  = W - MARGIN - TV_X;   // 41 pt

  text(p1, "Product Subtotal:",     340, 415, 9, reg, GRAY);
  uline(p1, 404, TV_X, W - MARGIN);
  addMap("product_subtotal", 1, TV_X, 404, TV_W, { align: "right" });

  text(p1, "Shipping & Insurance:", 340, 394, 9, reg, GRAY);
  uline(p1, 383, TV_X, W - MARGIN);
  addMap("shipping_fee",     1, TV_X, 383, TV_W, { align: "right" });

  hline(p1, 372, 340, W - MARGIN);

  text(p1, "Estimated Total:",      340, 359, 9.5, bold, DARK);
  uline(p1, 348, TV_X, W - MARGIN);
  addMap("estimated_total",  1, TV_X, 348, TV_W, { align: "right", fontSize: 11 });

  hline(p1, 337);

  // Metal totals
  const MT_Y = 323;
  text(p1, "Gold:",   MARGIN, MT_Y,  9, reg, GRAY);
  uline(p1, MT_Y - 10, 78, 175);
  addMap("total_troy_oz_gold",   1,  78, MT_Y - 10, 97);
  text(p1, "troy oz", 178,    MT_Y,  9, reg, GRAY);

  text(p1, "Silver:", 270,    MT_Y,  9, reg, GRAY);
  uline(p1, MT_Y - 10, 305, 400);
  addMap("total_troy_oz_silver", 1, 305, MT_Y - 10, 95);
  text(p1, "troy oz", 403,    MT_Y,  9, reg, GRAY);

  hline(p1, 306);

  // FedEx location
  text(p1, "FedEx Staffed Pickup Location:", MARGIN, 294, 9.5, bold, DARK);

  //   Name line
  text(p1, "Name:",    MARGIN, 279, 9, reg, GRAY);
  uline(p1, 268, 88, W - MARGIN);
  addMap("fedex_location_name", 1, 88, 268, W - MARGIN - 88);

  //   Address / City / State / ZIP on one line
  text(p1, "Address:", MARGIN, 254, 9, reg, GRAY);
  uline(p1, 243, 97, 302);
  addMap("fedex_location_address", 1, 97,  243, 205);

  text(p1, "City:",    308,    254, 9, reg, GRAY);
  uline(p1, 243, 331, 450);
  addMap("fedex_location_city",    1, 331, 243, 119);

  text(p1, "St:",      456,    254, 9, reg, GRAY);
  uline(p1, 243, 468, 497);
  addMap("fedex_location_state",   1, 468, 243, 29);

  text(p1, "ZIP:",     503,    254, 9, reg, GRAY);
  uline(p1, 243, 519, W - MARGIN);
  addMap("fedex_location_zip",     1, 519, 243, W - MARGIN - 519);

  // Adult sig notice
  text(p1, "Adult signature required at pickup.", MARGIN, 230, 9, italic, GRAY);

  hline(p1, 215);

  // Page footer
  text(p1, "Page 1 of 2", W - MARGIN - 45, 22, 7.5, reg, LGRAY);

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Legal Terms + Signature Block
  // ════════════════════════════════════════════════════════════════════════════
  const p2 = doc.addPage([W, H]);

  // Continuation header
  text(p2, "West Hills Capital LLC  —  Purchase Agreement (continued)", MARGIN, 769, 8, italic, GRAY);
  hline(p2, 762);

  // ── Section 2: Payment ──────────────────────────────────────────────────────
  text(p2, "2.  PAYMENT", MARGIN, 749, 10.5, bold, DARK);
  const s2Text =
    "Payment must be received by wire transfer no later than the end of the next business day " +
    "following execution of this Agreement. Wire instructions will be included in your invoice, " +
    "delivered by email upon completion of signing.";
  let cy = drawWrapped(p2, s2Text, MARGIN, 733, TEXT_W, reg, 9.5, DARK, 14);

  // ── Section 3: Cancellation Fee ────────────────────────────────────────────
  cy -= 8;
  text(p2, "3.  CANCELLATION FEE", MARGIN, cy, 10.5, bold, DARK);
  cy -= 16;
  const s3Text =
    "If payment is not received by the deadline, West Hills Capital reserves the right to cancel " +
    "this order and charge a fee equal to the greater of $125.00 or the actual market loss " +
    "sustained by West Hills Capital as a result of executing and unwinding the corresponding " +
    "trade with its supplier.";
  cy = drawWrapped(p2, s3Text, MARGIN, cy, TEXT_W, reg, 9.5, DARK, 14);

  // ── Section 4: Price ───────────────────────────────────────────────────────
  cy -= 8;
  text(p2, "4.  PRICE", MARGIN, cy, 10.5, bold, DARK);
  cy -= 16;
  const s4Text =
    "The estimated total above reflects live market pricing at the time of this Agreement. " +
    "Final price is confirmed at trade execution, which occurs upon confirmed receipt of cleared " +
    "funds. Prices may vary slightly at execution.";
  cy = drawWrapped(p2, s4Text, MARGIN, cy, TEXT_W, reg, 9.5, DARK, 14);

  // ── Section 5: Terms ───────────────────────────────────────────────────────
  cy -= 8;
  text(p2, "5.  TERMS", MARGIN, cy, 10.5, bold, DARK);
  cy -= 16;
  const s5Text =
    "This Agreement is subject to West Hills Capital's Terms of Service " +
    "(westhillscapital.com/terms) and Privacy Policy (westhillscapital.com/privacy). " +
    "This Agreement constitutes the entire agreement between the parties with respect to " +
    "the subject matter hereof and supersedes all prior negotiations, representations, " +
    "or agreements.";
  cy = drawWrapped(p2, s5Text, MARGIN, cy, TEXT_W, reg, 9.5, DARK, 14);

  // ── Signature block ─────────────────────────────────────────────────────────
  cy -= 20;
  hline(p2, cy);
  cy -= 14;

  text(p2, "BUYER SIGNATURE", MARGIN, cy, 7.5, bold, GRAY);
  cy -= 16;

  // Signature rectangle
  const SIG_X = MARGIN;
  const SIG_W = 310;
  const SIG_H = 90;
  const SIG_BOT = cy - SIG_H;
  p2.drawRectangle({
    x: SIG_X, y: SIG_BOT, width: SIG_W, height: SIG_H,
    borderColor: NAVY, borderWidth: 0.75, opacity: 0,
  });
  text(p2, "Signature", SIG_X + 6, SIG_BOT + SIG_H - 14, 8, reg, GRAY);
  // Map __signature__ to this box
  addMap("__signature__", 2, SIG_X, SIG_BOT, SIG_W, { bh: SIG_H, format: "signature" });

  // Date field (right of signature box)
  const DT_X = 380;
  text(p2, "Date", DT_X, SIG_BOT + SIG_H - 14, 8, reg, GRAY);
  const DT_LINE = SIG_BOT + SIG_H - 32;
  uline(p2, DT_LINE, DT_X, W - MARGIN);
  addMap("__signer_date__", 2, DT_X, DT_LINE, W - MARGIN - DT_X);

  // Printed name + email (below signature box)
  const PN_Y = SIG_BOT - 22;
  text(p2, "Printed Name:", MARGIN, PN_Y + 12, 9, reg, GRAY);
  uline(p2, PN_Y, 133, 350);
  addMap("buyer_full_name", 2, 133, PN_Y, 217);   // re-mapped on page 2

  text(p2, "Email:", 360, PN_Y + 12, 9, reg, GRAY);
  uline(p2, PN_Y, 394, W - MARGIN);
  addMap("buyer_email", 2, 394, PN_Y, W - MARGIN - 394);   // re-mapped on page 2

  // Disclosure
  const DISC_Y = SIG_BOT - 52;
  hline(p2, DISC_Y + 14);
  const disc =
    "By signing above, Buyer confirms they have read and agree to this Purchase Agreement, " +
    "and that the electronic signature collected via a secure link sent to their email address " +
    "is legally binding to the same extent as a handwritten signature.";
  drawWrapped(p2, disc, MARGIN, DISC_Y, TEXT_W, italic, 8.5, GRAY, 12);

  // Page footer with confirmation ID placeholder
  hline(p2, 34);
  text(p2, "West Hills Capital LLC  |  Purchase Agreement  |  Confirmation ID:", MARGIN, 22, 7.5, reg, LGRAY);
  const CID_LABEL_W = reg.widthOfTextAtSize(
    "West Hills Capital LLC  |  Purchase Agreement  |  Confirmation ID:", 7.5,
  );
  const CID_X = MARGIN + CID_LABEL_W + 2;
  uline(p2, 18, CID_X, CID_X + 100);
  addMap("confirmation_id", 2, CID_X, 18, 100, { fontSize: 7.5 });

  text(p2, "Page 2 of 2", W - MARGIN - 45, 22, 7.5, reg, LGRAY);

  const bytes = await doc.save();
  return {
    bytes,
    pageSizes: [{ width: W, height: H }, { width: W, height: H }],
    documentId: docId,
    mappings: maps,
  };
}

// ── Field definitions ─────────────────────────────────────────────────────────
// source keys are matched case-insensitively against prefill keys sent by buy.ts
function buildFields() {
  const prefillField = (id: string, label: string, source: string, category: string) => ({
    id, libraryFieldId: id, label, type: "text", source,
    required: false, interviewMode: "omitted", category,
  });

  return [
    prefillField("agreement_date",          "Agreement Date",             "agreement_date",          "Document"),
    prefillField("confirmation_id",         "Confirmation ID",            "confirmation_id",         "Document"),
    prefillField("buyer_full_name",         "Buyer Full Name",            "buyer_full_name",         "Buyer"),
    prefillField("buyer_address",           "Buyer Mailing Address",      "buyer_address",           "Buyer"),
    prefillField("buyer_email",             "Buyer Email",                "buyer_email",             "Buyer"),
    prefillField("buyer_phone",             "Buyer Phone",                "buyer_phone",             "Buyer"),
    prefillField("order_summary",           "Order Summary",              "order_summary",           "Order"),
    prefillField("product_subtotal",        "Product Subtotal",           "product_subtotal",        "Order"),
    prefillField("shipping_fee",            "Shipping Fee",               "shipping_fee",            "Order"),
    prefillField("estimated_total",         "Estimated Total",            "estimated_total",         "Order"),
    prefillField("total_troy_oz_gold",      "Total Troy Oz (Gold)",       "total_troy_oz_gold",      "Order"),
    prefillField("total_troy_oz_silver",    "Total Troy Oz (Silver)",     "total_troy_oz_silver",    "Order"),
    prefillField("fedex_location_name",     "FedEx Location Name",        "fedex_location_name",     "Delivery"),
    prefillField("fedex_location_address",  "FedEx Location Address",     "fedex_location_address",  "Delivery"),
    prefillField("fedex_location_city",     "FedEx Location City",        "fedex_location_city",     "Delivery"),
    prefillField("fedex_location_state",    "FedEx Location State",       "fedex_location_state",    "Delivery"),
    prefillField("fedex_location_zip",      "FedEx Location ZIP",         "fedex_location_zip",      "Delivery"),
    // E-sign system fields (injected automatically by normalizeEsignFields, listed here for clarity)
    { id: "__signature__",   libraryFieldId: "__signature__",   label: "Signature",   type: "text",     format: "signature", interviewMode: "omitted", source: "esign-system",  category: "Signature" },
    { id: "__signer_date__", libraryFieldId: "__signer_date__", label: "Signer Date", type: "date",                          interviewMode: "omitted", source: "esign-system",  category: "Signature" },
  ];
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Building Purchase Agreement PDF…");
  const { bytes, pageSizes, documentId, mappings } = await buildPdf();

  const db       = getDb();
  const filename = "whc-purchase-agreement.pdf";

  // ── Delete any existing WHC Purchase Agreement package ────────────────────
  const existing = await db.query<{ id: number; embed_key: string | null }>(
    `SELECT id, embed_key FROM docuplete_packages WHERE account_id = $1 AND name = $2`,
    [ACCOUNT_ID, PKG_NAME],
  );
  for (const row of existing.rows) {
    console.log(`Deleting existing package id=${row.id}…`);
    await db.query(`DELETE FROM docuplete_packages WHERE id = $1`, [row.id]);
  }

  // ── Upload PDF (GCS or DB fallback) ──────────────────────────────────────
  const pdfBuf = Buffer.from(bytes);
  let pdfGcsKey:        string | null = null;
  let pdfDataForDb:     Buffer | null = null;
  let pdfCipherForDb:   string | null = null;

  try {
    const storage = new ObjectStorageService();
    // We don't have the package id yet; use a temp path keyed by documentId
    pdfGcsKey = await storage.uploadBuffer(
      `pdfs/${ACCOUNT_ID}/purchase-agreement/${documentId}.pdf`,
      pdfBuf,
      "application/pdf",
    );
    console.log(`PDF uploaded to GCS: ${pdfGcsKey}`);
  } catch (gcsErr) {
    console.warn("GCS unavailable — storing PDF in DB:", (gcsErr as Error).message);
    if (isEncryptionEnabled()) {
      try {
        const dek = await getOrCreateAccountDek(ACCOUNT_ID, db);
        pdfCipherForDb = encryptBuffer(pdfBuf, dek);
      } catch {
        pdfDataForDb = pdfBuf;
      }
    } else {
      pdfDataForDb = pdfBuf;
    }
  }

  const fields  = buildFields();
  const embedKey = `emb_${randomBytes(16).toString("base64url")}`;

  // ── Insert package ────────────────────────────────────────────────────────
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO docuplete_packages (
       account_id, name, description, status, tags,
       fields, documents, mappings,
       enable_interview, enable_customer_link, enable_csv,
       auth_level, webhook_secret, is_demo,
       enable_embed, embed_key,
       notify_staff_on_submit, notify_client_on_submit,
       webhook_enabled
     ) VALUES ($1,$2,$3,'active',$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,
               false, false, false,
               'email_otp', $8, false,
               true, $9,
               false, false,
               false)
     RETURNING id`,
    [
      ACCOUNT_ID,
      PKG_NAME,
      "Self-serve purchase agreement for westhillscapital.com/buy. " +
        "All fields are prefilled from the buyer's selections. Auth level: email OTP + e-signature.",
      JSON.stringify(["Purchase", "Self-Serve"]),
      JSON.stringify(fields),
      JSON.stringify([{
        id: documentId, title: "WHC Purchase Agreement",
        pages: 2, fileName: filename,
        byteSize: bytes.length, contentType: "application/pdf",
        pdfStored: true, pageSizes,
      }]),
      JSON.stringify(mappings),
      randomBytes(32).toString("hex"),   // webhook_secret (for future use)
      embedKey,
    ],
  );

  const packageId = rows[0].id;

  // ── Insert package document ───────────────────────────────────────────────
  await db.query(
    `INSERT INTO docuplete_package_documents
       (package_id, document_id, filename, content_type, byte_size,
        page_count, page_sizes, pdf_data, pdf_gcs_key, pdf_data_ciphertext)
     VALUES ($1,$2,$3,'application/pdf',$4,$5,$6::jsonb,$7,$8,$9)`,
    [
      packageId, documentId, filename, bytes.length,
      2, JSON.stringify(pageSizes),
      pdfDataForDb, pdfGcsKey, pdfCipherForDb,
    ],
  );

  console.log("\n════════════════════════════════════════════════════════");
  console.log(`  Package created:  id=${packageId}  account=${ACCOUNT_ID}`);
  console.log(`  Auth level:       email_otp (e-signature)`);
  console.log(`  PDF:              ${filename}  (${bytes.length.toLocaleString()} bytes, 2 pages)`);
  console.log(`  Field mappings:   ${mappings.length}`);
  console.log("════════════════════════════════════════════════════════");
  console.log("\n  Set this environment variable:\n");
  console.log(`  DOCUPLETE_PURCHASE_EMBED_KEY=${embedKey}`);
  console.log("\n════════════════════════════════════════════════════════\n");

  await db.end();
}

main().catch((err) => {
  console.error("Seeder failed:", err);
  process.exit(1);
});
