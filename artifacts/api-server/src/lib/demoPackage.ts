import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { logger } from "./logger";

// ── Demo fields (explicit stable ids so mapping references are reliable) ───────
const DEMO_FIELDS = [
  { id: "client_first_name",    libraryFieldId: "client_first_name",    label: "Client first name",    type: "text", source: "firstName",    required: true,  interviewMode: "required", category: "Customer identity" },
  { id: "client_last_name",     libraryFieldId: "client_last_name",     label: "Client last name",     type: "text", source: "lastName",     required: true,  interviewMode: "required", category: "Customer identity" },
  { id: "client_email",         libraryFieldId: "client_email",         label: "Client email",         type: "text", source: "email",        required: true,  interviewMode: "required", category: "Contact",
    validationType: "email", validationMessage: "Enter a valid email address." },
  { id: "client_dob",           libraryFieldId: "client_dob",           label: "Client date of birth", type: "date", source: "dateOfBirth",  required: true,  interviewMode: "required", category: "Customer identity" },
  { id: "client_address_line1", libraryFieldId: "client_address_line1", label: "Client address",       type: "text", source: "addressLine1", required: true,  interviewMode: "required", category: "Address" },
  { id: "client_city",          libraryFieldId: "client_city",          label: "Client city",          type: "text", source: "city",         required: true,  interviewMode: "required", category: "Address" },
  { id: "client_state",         libraryFieldId: "client_state",         label: "Client state",         type: "text", source: "state",        required: true,  interviewMode: "required", category: "Address" },
  { id: "client_zip",           libraryFieldId: "client_zip",           label: "Client ZIP code",      type: "text", source: "zip",          required: true,  interviewMode: "required", category: "Address",
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

/** Build the demo PDF. */
export async function buildDemoPdf(): Promise<{ bytes: Uint8Array; pageSizes: Array<{ width: number; height: number }> }> {
  const doc    = await PDFDocument.create();
  const bold   = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg    = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const page = doc.addPage([W, H]);
  const gray  = rgb(0.4, 0.4, 0.4);
  const dark  = rgb(0.1, 0.1, 0.1);
  const amber = rgb(0.6, 0.4, 0.1);
  const navy  = rgb(0.07, 0.11, 0.25);
  const line  = rgb(0.75, 0.75, 0.75);

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

  // ── E-sign section ───────────────────────────────────────────────────────────
  // Separator
  const SEP_Y = 212;
  page.drawLine({ start: { x: 50, y: SEP_Y }, end: { x: W - 50, y: SEP_Y }, thickness: 0.5, color: line });

  // Section heading
  page.drawText("ELECTRONIC SIGNATURE", { x: 50, y: 198, size: 7, font: reg, color: gray });

  // Signature box (outline only — field is not captured in the sandbox demo)
  const BOX_X = 50; const BOX_Y = 105; const BOX_W = 310; const BOX_H = 72;
  page.drawRectangle({ x: BOX_X, y: BOX_Y, width: BOX_W, height: BOX_H, borderColor: navy, borderWidth: 0.75, opacity: 0 });
  page.drawText("Signature", { x: BOX_X + 6, y: BOX_Y + BOX_H - 14, size: 8, font: reg, color: gray });

  // Date area (right of signature box)
  const DATE_X = 380;
  page.drawText("Date", { x: DATE_X, y: BOX_Y + BOX_H - 14, size: 8, font: reg, color: gray });
  page.drawLine({ start: { x: DATE_X, y: BOX_Y + BOX_H - 28 }, end: { x: W - 50, y: BOX_Y + BOX_H - 28 }, thickness: 0.5, color: line });

  // Disclosure note
  page.drawText(
    "Note: E-sign fields are not part of the sandbox demo.",
    { x: 50, y: 83, size: 8, font: italic, color: amber },
  );

  // Fine print
  page.drawText(
    "By signing above, the client confirms the information provided is accurate and authorizes processing.",
    { x: 50, y: 63, size: 7, font: reg, color: gray },
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
    ];

    const pkgResult = await db.query<{ id: number }>(
      `INSERT INTO docufill_packages (
         account_id, name, description, status, tags,
         fields, documents, mappings,
         enable_interview, enable_customer_link, enable_csv,
         auth_level, webhook_secret
       ) VALUES ($1,$2,$3,'active',$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,
                 true, true, false, 'none', $8)
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
