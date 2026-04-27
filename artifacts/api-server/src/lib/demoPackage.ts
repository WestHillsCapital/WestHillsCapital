import type { Pool } from "pg";
import { logger } from "./logger";

const DEMO_FIELDS = JSON.stringify([
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
]);

/**
 * Seeds a realistic demo package for a newly created Docuplete account.
 * Idempotent — guarded by a migration state row so it never runs twice for
 * the same account, even if called concurrently on startup.
 *
 * Errors are caught and logged; the caller's account creation is not affected.
 */
export async function seedDemoPackage(db: Pool, accountId: number): Promise<void> {
  const stateKey = `demo_package_account_${accountId}`;
  try {
    const { rows } = await db.query(
      `SELECT 1 FROM docufill_migration_state WHERE key = $1`,
      [stateKey],
    );
    if (rows[0]) return;

    await db.query(
      `INSERT INTO docufill_packages (
        account_id, name, description, status, tags,
        fields, documents, mappings,
        enable_interview, enable_customer_link, enable_csv
      ) VALUES ($1, $2, $3, 'active', $4::jsonb, $5::jsonb, '[]'::jsonb, '[]'::jsonb, true, true, false)`,
      [
        accountId,
        "Demo — Client Information",
        "A sample interview package pre-loaded for you to explore. Try generating a client interview link to see the full Docuplete flow. You can archive or delete this package at any time.",
        JSON.stringify(["Demo"]),
        DEMO_FIELDS,
      ],
    );

    await db.query(
      `INSERT INTO docufill_migration_state (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`,
      [stateKey],
    );

    logger.info({ accountId }, "[DemoPackage] Demo package seeded");
  } catch (err) {
    logger.error({ err, accountId }, "[DemoPackage] Failed to seed demo package (non-fatal)");
  }
}
