import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { logger } from "./logger";

// ── Demo fields (explicit stable ids so mapping references are reliable) ───────
const DEMO_FIELDS = [
  { id: "client_first_name",    libraryFieldId: "client_first_name",    label: "Client first name",    type: "text", source: "firstName",    required: true,  category: "Customer identity" },
  { id: "client_last_name",     libraryFieldId: "client_last_name",     label: "Client last name",     type: "text", source: "lastName",     required: true,  category: "Customer identity" },
  { id: "client_email",         libraryFieldId: "client_email",         label: "Client email",         type: "text", source: "email",        required: true,  category: "Contact",
    validationType: "email", validationMessage: "Enter a valid email address." },
  { id: "client_dob",           libraryFieldId: "client_dob",           label: "Client date of birth", type: "date", source: "dateOfBirth",  required: true,  category: "Customer identity" },
  { id: "client_address_line1", libraryFieldId: "client_address_line1", label: "Client address",       type: "text", source: "addressLine1", required: true,  category: "Address" },
  { id: "client_city",          libraryFieldId: "client_city",          label: "Client city",          type: "text", source: "city",         required: true,  category: "Address" },
  { id: "client_state",         libraryFieldId: "client_state",         label: "Client state",         type: "text", source: "state",        required: true,  category: "Address" },
  { id: "client_zip",           libraryFieldId: "client_zip",           label: "Client ZIP code",      type: "text", source: "zip",          required: true,  category: "Address",
    validationType: "custom", validationPattern: "^\\d{5}(-\\d{4})?$", validationMessage: "Enter a valid ZIP code." },
];

/**
 * Build a letter-size PDF with fill lines for each demo field plus a
 * signature / date section at the bottom.
 *
 * All y coordinates below use pdf-lib's bottom-left origin convention.
 * The DEMO_MAPPINGS constant below uses percentage-based top-left coordinates
 * (the format expected by the DocuFill mapper and PDF overlay engine).
 *
 * Coordinate derivation for text fields (h = 3 %, fontSize = 11):
 *   boxHeight_pt = (3/100) × 792 = 23.76 pt
 *   yDraw (text baseline) = yTop − boxHeight + fontSize×0.2 + 2
 *   Target yDraw ≈ line_y + 2  (text sits just above the fill line)
 *   → yTop = line_y + boxHeight − fontSize×0.2 = line_y + 21.6 pt
 *   → mapping.y% = (792 − yTop) / 792 × 100
 */

const W = 612;
const H = 792;

// PDF bottom-origin y of each field's fill line
const FIELD_LINES = [H-140, H-200, H-260, H-320, H-380, H-440, H-500, H-560];
//  = [652, 592, 532, 472, 412, 352, 292, 232]

// mapping.y% derived from each FIELD_LINE using the formula above
const FIELD_Y_PCT = FIELD_LINES.map((lineY) => parseFloat(((H - (lineY + 21.6)) / H * 100).toFixed(1)));
//  ≈ [15.0, 22.5, 30.1, 37.6, 45.2, 52.7, 60.3, 68.0]

const X_PCT  = parseFloat((50 / W * 100).toFixed(1));   // 8.2 %
const W_PCT  = parseFloat((512 / W * 100).toFixed(1));  // 83.7 %
const H3_PCT = 3;                                        // 3 % ≈ 24 pt  (one text line)

// Signature section
const SIG_BOX_Y_BOTTOM = 80;   // pdf bottom-origin bottom of sig box
const SIG_BOX_Y_TOP    = 175;  // pdf bottom-origin top of sig box  (95 pt tall)
const SIG_X_RIGHT      = 350;  // pdf x of right edge of sig box

const SIG_MAP_Y_PCT  = parseFloat(((H - SIG_BOX_Y_TOP)  / H * 100).toFixed(1)); // ≈ 78.0
const SIG_MAP_H_PCT  = parseFloat(((SIG_BOX_Y_TOP - SIG_BOX_Y_BOTTOM) / H * 100).toFixed(1)); // ≈ 12.0
const SIG_MAP_W_PCT  = parseFloat(((SIG_X_RIGHT - 50) / W * 100).toFixed(1)); // ≈ 49.0

const DATE_LINE_X = 368;
const DATE_MAP_Y_PCT = parseFloat(((H - (SIG_BOX_Y_BOTTOM + 21.6)) / H * 100).toFixed(1)); // ≈ 87.0
const DATE_MAP_X_PCT = parseFloat((DATE_LINE_X / W * 100).toFixed(1));                      // ≈ 60.1
const DATE_MAP_W_PCT = parseFloat(((W - 50 - DATE_LINE_X) / W * 100).toFixed(1));           // ≈ 31.7

/** Build the demo PDF. */
async function buildDemoPdf(): Promise<{ bytes: Uint8Array; pageSizes: Array<{ width: number; height: number }> }> {
  const doc  = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);

  const page = doc.addPage([W, H]);
  const gray  = rgb(0.4, 0.4, 0.4);
  const dark  = rgb(0.1, 0.1, 0.1);
  const amber = rgb(0.6, 0.4, 0.1);
  const navy  = rgb(0.07, 0.11, 0.25);
  const line  = rgb(0.75, 0.75, 0.75);
  const light = rgb(0.94, 0.94, 0.94);

  // Header
  page.drawText("Client Information Form", { x: 50, y: H - 60, size: 22, font: bold, color: dark });
  page.drawText("Demo — for testing purposes only", { x: 50, y: H - 82, size: 10, font: reg, color: amber });

  // Form fields
  const rows = [
    { label: "First name",    y: FIELD_LINES[0] },
    { label: "Last name",     y: FIELD_LINES[1] },
    { label: "Email address", y: FIELD_LINES[2] },
    { label: "Date of birth", y: FIELD_LINES[3] },
    { label: "Address",       y: FIELD_LINES[4] },
    { label: "City",          y: FIELD_LINES[5] },
    { label: "State",         y: FIELD_LINES[6] },
    { label: "ZIP code",      y: FIELD_LINES[7] },
  ];

  for (const row of rows) {
    page.drawText(row.label, { x: 50, y: row.y + 14, size: 9, font: reg, color: gray });
    page.drawLine({ start: { x: 50, y: row.y }, end: { x: W - 50, y: row.y }, thickness: 0.5, color: line });
  }

  // Divider above signature section
  page.drawLine({ start: { x: 50, y: 205 }, end: { x: W - 50, y: 205 }, thickness: 0.5, color: line });
  page.drawText("ELECTRONIC SIGNATURE", { x: 50, y: 190, size: 7.5, font: bold, color: rgb(0.5, 0.5, 0.5) });

  // Signature box
  page.drawRectangle({
    x: 50, y: SIG_BOX_Y_BOTTOM,
    width: SIG_X_RIGHT - 50, height: SIG_BOX_Y_TOP - SIG_BOX_Y_BOTTOM,
    borderColor: light, borderWidth: 1, color: rgb(0.98, 0.98, 0.98),
  });
  page.drawText("Signature", { x: 55, y: SIG_BOX_Y_TOP - 13, size: 7.5, font: reg, color: gray });

  // Date label + line
  page.drawText("Date", { x: DATE_LINE_X, y: SIG_BOX_Y_BOTTOM + 16, size: 9, font: reg, color: gray });
  page.drawLine({
    start: { x: DATE_LINE_X, y: SIG_BOX_Y_BOTTOM },
    end:   { x: W - 50,      y: SIG_BOX_Y_BOTTOM },
    thickness: 0.5, color: line,
  });

  // Agree text
  page.drawText(
    "By signing above I confirm the information provided is accurate and authorize processing.",
    { x: 50, y: 60, size: 7, font: reg, color: rgb(0.6, 0.6, 0.6) },
  );

  const bytes = await doc.save();
  return { bytes, pageSizes: [{ width: W, height: H }] };
}

/**
 * Seeds a realistic demo package for a newly created Docuplete account.
 * Concurrency-safe: inserts a state row first (ON CONFLICT DO NOTHING) and
 * only proceeds if this process won the race.
 * Non-fatal: errors are caught and logged so account creation is unaffected.
 */
export async function seedDemoPackage(db: Pool, accountId: number): Promise<void> {
  const stateKey = `demo_package_account_${accountId}`;
  try {
    const claim = await db.query(
      `INSERT INTO docufill_migration_state (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`,
      [stateKey],
    );
    if ((claim.rowCount ?? 0) === 0) return; // another request already won

    const { bytes: pdfBytes, pageSizes } = await buildDemoPdf();
    const documentId = `doc_${randomBytes(12).toString("base64url")}`;
    const filename   = "demo-client-information.pdf";
    const pageCount  = 1;

    // Build the mapping array — using percentage-based top-left coordinates
    const mappings = [
      ...DEMO_FIELDS.map((f, i) => ({
        id: `dm_${f.id}`,
        fieldId: f.id,
        documentId,
        page: 1,
        x: X_PCT, y: FIELD_Y_PCT[i], w: W_PCT, h: H3_PCT,
        fontSize: 11, align: "left", format: "as-entered",
      })),
      // E-sign: signature drawing area
      {
        id: "dm_signature",
        fieldId: "__signature__",
        documentId,
        page: 1,
        x: X_PCT, y: SIG_MAP_Y_PCT, w: SIG_MAP_W_PCT, h: SIG_MAP_H_PCT,
        fontSize: 14, align: "left", format: "signature",
      },
      // E-sign: signer date (auto-filled with today's date)
      {
        id: "dm_signer_date",
        fieldId: "__signer_date__",
        documentId,
        page: 1,
        x: DATE_MAP_X_PCT, y: DATE_MAP_Y_PCT, w: DATE_MAP_W_PCT, h: H3_PCT,
        fontSize: 11, align: "left", format: "as-entered",
      },
    ];

    const pkgResult = await db.query<{ id: number }>(
      `INSERT INTO docufill_packages (
         account_id, name, description, status, tags,
         fields, documents, mappings,
         enable_interview, enable_customer_link, enable_csv,
         auth_level, webhook_secret
       ) VALUES ($1,$2,$3,'active',$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,
                 true, true, false, 'email_otp', $8)
       RETURNING id`,
      [
        accountId,
        "Demo — Client Information",
        "A pre-built sample package so you can experience Docuplete as your clients will. " +
          "Click \"Try it as your client\" above to fill out the form and e-sign. " +
          "You can archive or delete this package at any time.",
        JSON.stringify(["Demo"]),
        JSON.stringify(DEMO_FIELDS),
        JSON.stringify([{
          id: documentId, title: "Client Information Form",
          pages: pageCount, fileName: filename,
          byteSize: pdfBytes.length, contentType: "application/pdf",
          pdfStored: true, pageSizes,
        }]),
        JSON.stringify(mappings),
        randomBytes(32).toString("hex"),
      ],
    );

    const packageId = pkgResult.rows[0].id;

    await db.query(
      `INSERT INTO docufill_package_documents
         (package_id, document_id, filename, content_type, byte_size, page_count, page_sizes, pdf_data)
       VALUES ($1,$2,$3,'application/pdf',$4,$5,$6::jsonb,$7)`,
      [packageId, documentId, filename, pdfBytes.length, pageCount, JSON.stringify(pageSizes), Buffer.from(pdfBytes)],
    );

    logger.info({ accountId, packageId }, "[DemoPackage] Demo package seeded");
  } catch (err) {
    logger.error({ err, accountId }, "[DemoPackage] Failed to seed demo package (non-fatal)");
    await db.query(`DELETE FROM docufill_migration_state WHERE key = $1`, [stateKey]).catch(() => {});
  }
}
