import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { logger } from "./logger";

const DEMO_FIELDS = [
  {
    libraryFieldId: "client_first_name",
    label: "Client first name",
    type: "text",
    source: "firstName",
    required: true,
    category: "Customer identity",
  },
  {
    libraryFieldId: "client_last_name",
    label: "Client last name",
    type: "text",
    source: "lastName",
    required: true,
    category: "Customer identity",
  },
  {
    libraryFieldId: "client_email",
    label: "Client email",
    type: "text",
    source: "email",
    required: true,
    category: "Contact",
  },
  {
    libraryFieldId: "client_dob",
    label: "Client date of birth",
    type: "date",
    source: "dateOfBirth",
    required: true,
    category: "Customer identity",
  },
  {
    libraryFieldId: "client_address_line1",
    label: "Client address line 1",
    type: "text",
    source: "addressLine1",
    required: true,
    category: "Address",
  },
  {
    libraryFieldId: "client_city",
    label: "Client city",
    type: "text",
    source: "city",
    required: true,
    category: "Address",
  },
  {
    libraryFieldId: "client_state",
    label: "Client state",
    type: "text",
    source: "state",
    required: true,
    category: "Address",
  },
  {
    libraryFieldId: "client_zip",
    label: "Client ZIP code",
    type: "text",
    source: "zip",
    required: true,
    category: "Address",
    validationType: "custom",
    validationPattern: "^\\d{5}(-\\d{4})?$",
    validationMessage: "Enter a valid ZIP code.",
  },
];

/** Build a letter-size PDF with labelled fill-in lines for each demo field. */
async function buildDemoPdf(): Promise<{ bytes: Uint8Array; pageSizes: Array<{ width: number; height: number }> }> {
  const doc = await PDFDocument.create();
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvetica    = await doc.embedFont(StandardFonts.Helvetica);

  const W = 612;
  const H = 792;
  const page = doc.addPage([W, H]);
  const gray = rgb(0.4, 0.4, 0.4);
  const dark = rgb(0.1, 0.1, 0.1);
  const line = rgb(0.75, 0.75, 0.75);

  page.drawText("Client Information Form", {
    x: 50, y: H - 60,
    size: 22,
    font: helveticaBold,
    color: dark,
  });
  page.drawText("Demo — for testing purposes only", {
    x: 50, y: H - 82,
    size: 10,
    font: helvetica,
    color: rgb(0.6, 0.4, 0.1),
  });

  const rows = [
    { label: "First name",    fieldId: "client_first_name", y: H - 140 },
    { label: "Last name",     fieldId: "client_last_name",  y: H - 200 },
    { label: "Email",         fieldId: "client_email",      y: H - 260 },
    { label: "Date of birth", fieldId: "client_dob",        y: H - 320 },
    { label: "Address",       fieldId: "client_address_line1", y: H - 380 },
    { label: "City",          fieldId: "client_city",       y: H - 440 },
    { label: "State",         fieldId: "client_state",      y: H - 500 },
    { label: "ZIP code",      fieldId: "client_zip",        y: H - 560 },
  ];

  for (const row of rows) {
    page.drawText(row.label, { x: 50, y: row.y + 14, size: 9, font: helvetica, color: gray });
    page.drawLine({ start: { x: 50, y: row.y }, end: { x: W - 50, y: row.y }, thickness: 0.5, color: line });
  }

  const bytes = await doc.save();
  return { bytes, pageSizes: [{ width: W, height: H }] };
}

/**
 * Seeds a realistic demo package for a newly created Docuplete account.
 * Concurrency-safe: inserts the state row first (ON CONFLICT DO NOTHING)
 * and only proceeds if the INSERT won, preventing duplicate packages on
 * concurrent calls (e.g. double-POST at onboarding).
 * Errors are caught and logged — caller's account creation is not affected.
 */
export async function seedDemoPackage(db: Pool, accountId: number): Promise<void> {
  const stateKey = `demo_package_account_${accountId}`;
  try {
    // Claim the slot atomically — only proceed if this INSERT wins.
    const claim = await db.query(
      `INSERT INTO docufill_migration_state (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`,
      [stateKey],
    );
    if ((claim.rowCount ?? 0) === 0) return;

    const { bytes: pdfBytes, pageSizes } = await buildDemoPdf();
    const documentId = `doc_${randomBytes(12).toString("base64url")}`;
    const pageCount = 1;
    const byteSize = pdfBytes.length;
    const filename = "demo-client-information.pdf";

    const pkgResult = await db.query<{ id: number }>(
      `INSERT INTO docufill_packages (
        account_id, name, description, status, tags,
        fields, documents, mappings,
        enable_interview, enable_customer_link, enable_csv,
        webhook_secret
      ) VALUES ($1, $2, $3, 'active', $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, true, true, false, $8)
      RETURNING id`,
      [
        accountId,
        "Demo — Client Information",
        "A sample interview package pre-loaded for you to explore. Try generating a client interview link to see the full Docuplete flow. You can archive or delete this package at any time.",
        JSON.stringify(["Demo"]),
        JSON.stringify(DEMO_FIELDS),
        JSON.stringify([{
          id: documentId,
          title: "Client Information Form",
          pages: pageCount,
          fileName: filename,
          byteSize,
          contentType: "application/pdf",
          pdfStored: true,
          pageSizes,
        }]),
        JSON.stringify(DEMO_FIELDS.map((f, i) => ({
          fieldId: f.libraryFieldId,
          documentId,
          page: 1,
          x: 52,
          y: 780 - 140 - i * 60,
          w: 510,
          h: 20,
          fontSize: 11,
          align: "left",
        }))),
        randomBytes(32).toString("hex"), // webhook_secret ($8)
      ],
    );

    const packageId = pkgResult.rows[0].id;

    await db.query(
      `INSERT INTO docufill_package_documents
        (package_id, document_id, filename, content_type, byte_size, page_count, page_sizes, pdf_data)
       VALUES ($1, $2, $3, 'application/pdf', $4, $5, $6::jsonb, $7)`,
      [packageId, documentId, filename, byteSize, pageCount, JSON.stringify(pageSizes), Buffer.from(pdfBytes)],
    );

    logger.info({ accountId, packageId }, "[DemoPackage] Demo package seeded");
  } catch (err) {
    logger.error({ err, accountId }, "[DemoPackage] Failed to seed demo package (non-fatal)");
    // Roll back the state claim so a retry can succeed
    await db.query(
      `DELETE FROM docufill_migration_state WHERE key = $1`,
      [stateKey],
    ).catch(() => {});
  }
}
