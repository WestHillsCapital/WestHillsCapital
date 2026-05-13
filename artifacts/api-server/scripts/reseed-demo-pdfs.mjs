/**
 * One-time migration: regenerate the stored PDF template for all demo packages
 * so they include the e-sign section with the disclosure note.
 *
 * Run from the api-server directory:
 *   node scripts/reseed-demo-pdfs.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { Pool } = require("pg");

const W = 612;
const H = 792;
const FIELD_LINES = [H-140, H-200, H-260, H-320, H-380, H-440, H-500, H-560];

async function buildDemoPdf() {
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

  page.drawText("Client Information Form", { x: 50, y: H - 60, size: 22, font: bold, color: dark });
  page.drawText("Demo — for testing purposes only", { x: 50, y: H - 82, size: 10, font: reg, color: amber });

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

  const SEP_Y = 212;
  page.drawLine({ start: { x: 50, y: SEP_Y }, end: { x: W - 50, y: SEP_Y }, thickness: 0.5, color: line });

  page.drawText("ELECTRONIC SIGNATURE", { x: 50, y: 198, size: 7, font: reg, color: gray });

  const BOX_X = 50; const BOX_Y = 105; const BOX_W = 310; const BOX_H = 72;
  page.drawRectangle({ x: BOX_X, y: BOX_Y, width: BOX_W, height: BOX_H, borderColor: navy, borderWidth: 0.75, opacity: 0 });
  page.drawText("Signature", { x: BOX_X + 6, y: BOX_Y + BOX_H - 14, size: 8, font: reg, color: gray });

  const DATE_X = 380;
  page.drawText("Date", { x: DATE_X, y: BOX_Y + BOX_H - 14, size: 8, font: reg, color: gray });
  page.drawLine({ start: { x: DATE_X, y: BOX_Y + BOX_H - 28 }, end: { x: W - 50, y: BOX_Y + BOX_H - 28 }, thickness: 0.5, color: line });

  page.drawText(
    "Note: E-sign fields are not part of the sandbox demo.",
    { x: 50, y: 83, size: 8, font: italic, color: amber },
  );

  page.drawText(
    "By signing above, the client confirms the information provided is accurate and authorizes processing.",
    { x: 50, y: 63, size: 7, font: reg, color: gray },
  );

  return await doc.save();
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: demoPkgs } = await pool.query(`
      SELECT p.id AS package_id, d.document_id
      FROM docuplete_packages p
      JOIN docuplete_package_documents d ON d.package_id = p.id
      WHERE p.name = 'Demo — Client Information'
      ORDER BY p.id
    `);

    if (demoPkgs.length === 0) {
      console.log("No demo packages found.");
      return;
    }

    console.log(`Found ${demoPkgs.length} demo package(s). Regenerating PDFs…`);
    const newPdfBytes = await buildDemoPdf();
    const buf = Buffer.from(newPdfBytes);
    console.log(`New PDF size: ${buf.length} bytes`);

    for (const { package_id, document_id } of demoPkgs) {
      await pool.query(
        `UPDATE docuplete_package_documents
            SET pdf_data = $1, byte_size = $2, updated_at = now()
          WHERE package_id = $3 AND document_id = $4`,
        [buf, buf.length, package_id, document_id],
      );
      await pool.query(
        `UPDATE docuplete_packages
            SET documents = (
              SELECT jsonb_agg(
                CASE WHEN (elem->>'id') = $2
                  THEN jsonb_set(elem, '{byteSize}', $3::text::jsonb)
                  ELSE elem
                END
              )
              FROM jsonb_array_elements(documents) AS elem
            )
          WHERE id = $1`,
        [package_id, document_id, buf.length],
      );
      console.log(`  ✓ package ${package_id} (doc ${document_id})`);
    }

    console.log("Done.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
