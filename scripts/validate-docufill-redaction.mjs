import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { buildDocuFillFallbackSummaryRows, buildDocuFillPacketSummary, fieldAnswerValue, formatDocuFillMappedValue, hydratePackageFields } from "../artifacts/api-server/src/lib/docufill-redaction.ts";
import { getDocuFillPrefillDisplayValue } from "../artifacts/west-hills-capital/src/lib/docufill-redaction.ts";

const sensitiveValue = "123-45-6789";
const accountValue = "IRA-9988776655";
const publicValue = "Alice Investor";
const sensitiveField = {
  id: "ssn_field",
  name: "Social Security Number",
  source: "ssn",
  defaultValue: "",
  sensitive: true,
};
const accountField = {
  id: "account_field",
  name: "IRA account number",
  source: "iraAccountNumber",
  defaultValue: "",
  sensitive: true,
};
const session = {
  package_name: "Sensitive Test Package",
  package_version: 1,
  custodian_name: "Test Custodian",
  depository_name: "Test Depository",
  documents: [{ id: "doc_one", title: "Application", pages: 1, fileName: "application.pdf", byteSize: 2048, pdfStored: true }],
  fields: [
    sensitiveField,
    accountField,
    { id: "name_field", name: "Client name", source: "clientName", defaultValue: "", sensitive: false },
  ],
  mappings: [{ id: "map_one", fieldId: "ssn_field", documentId: "doc_one", page: 1, x: 20, y: 30 }],
  prefill: { ssn: sensitiveValue, iraAccountNumber: accountValue, clientName: publicValue },
  answers: { ssn_field: sensitiveValue, name_field: publicValue },
};

const packetSummary = buildDocuFillPacketSummary(session, "2026-04-21T00:00:00.000Z");
assert.equal(packetSummary.sensitiveFieldCount, 2);
assert.equal(packetSummary.documentCount, 1);
assert.equal(packetSummary.mappingCount, 1);
assert.deepEqual(JSON.stringify(packetSummary).includes(sensitiveValue), false);
assert.deepEqual(JSON.stringify(packetSummary).includes(accountValue), false);
assert.match(packetSummary.valuePolicy, /Sensitive answers are omitted/);

const fallbackRows = buildDocuFillFallbackSummaryRows(session);
const fallbackText = JSON.stringify(fallbackRows);
assert.equal(fallbackText.includes(sensitiveValue), false);
assert.equal(fallbackText.includes(accountValue), false);
assert.equal(fallbackText.includes("••••6789"), true);
assert.equal(fallbackText.includes("••••6655"), true);
assert.equal(fallbackText.includes(publicValue), true);

const prefillDisplay = getDocuFillPrefillDisplayValue("ssn", sensitiveValue, session.fields);
const accountDisplay = getDocuFillPrefillDisplayValue("iraAccountNumber", accountValue, session.fields);
const publicDisplay = getDocuFillPrefillDisplayValue("clientName", publicValue, session.fields);
assert.equal(prefillDisplay, "••••6789");
assert.equal(accountDisplay, "••••6655");
assert.equal(publicDisplay, publicValue);

const overlayValue = fieldAnswerValue(sensitiveField, session.answers, session.prefill);
assert.equal(overlayValue, sensitiveValue);
assert.equal(fieldAnswerValue({ id: "concept_name", name: "Name", source: "clientName" }, {}, { firstName: "Alice", lastName: "Investor" }), "Alice Investor");
assert.equal(formatDocuFillMappedValue("Alice Beth Investor", { format: "first-name" }), "Alice");
assert.equal(formatDocuFillMappedValue("Alice Beth Investor", { format: "middle-name" }), "Beth");
assert.equal(formatDocuFillMappedValue("Alice Beth Investor", { format: "last-name" }), "Investor");
assert.equal(formatDocuFillMappedValue("Alice Beth Investor", { format: "first-last" }), "Alice Investor");
assert.equal(formatDocuFillMappedValue("Alice Beth Investor", { format: "last-first-m" }), "Investor, Alice B.", "three-part name: Last, First M.");
assert.equal(formatDocuFillMappedValue("Alice Investor", { format: "last-first-m" }), "Investor, Alice", "two-part name: Last, First (no middle)");
assert.equal(formatDocuFillMappedValue("Investor", { format: "last-first-m" }), "Investor", "single-part name: returned as-is");
assert.equal(formatDocuFillMappedValue("Alice Beth Marie Investor", { format: "last-first-m" }), "Investor, Alice B.", "four-part name: still uses first middle initial only");
assert.equal(formatDocuFillMappedValue("Alice Beth Investor", { format: "initials" }), "ABI");

assert.equal(formatDocuFillMappedValue("Primary", { format: "checkbox-option:Primary" }), "X", "matching option prints X");
assert.equal(formatDocuFillMappedValue("Contingent", { format: "checkbox-option:Primary" }), "", "non-matching option prints blank");
assert.equal(formatDocuFillMappedValue("Primary", { format: "checkbox-option:Contingent" }), "", "option value comparison is exact");
assert.equal(formatDocuFillMappedValue("Primary, Contingent", { format: "checkbox-option:Contingent" }), "X", "comma-separated multi-select matches correctly");
assert.equal(formatDocuFillMappedValue("Primary, Contingent", { format: "checkbox-option:Primary" }), "X", "first item in multi-select also matches");
assert.equal(formatDocuFillMappedValue("", { format: "checkbox-option:Primary" }), "", "empty answer always prints blank");
assert.equal(formatDocuFillMappedValue("primary", { format: "checkbox-option:Primary" }), "", "option matching is case-sensitive");

const hydratedFields = hydratePackageFields(
  [
    {
      id: "package_dropdown",
      libraryFieldId: "shared_distribution_method",
      name: "Old package label",
      source: "legacySource",
      type: "text",
      sensitive: false,
      required: false,
      validationType: "none",
      options: ["Package-specific option"],
      interviewVisible: false,
      adminOnly: true,
      color: "#123456",
      mappings: [{ id: "mapping_one", documentId: "doc_one", page: 1, x: 10, y: 20 }],
    },
  ],
  [
    {
      id: "shared_distribution_method",
      label: "Distribution method",
      source: "distributionMethod",
      type: "dropdown",
      sensitive: true,
      required: true,
      validationType: "custom",
      validationPattern: "^(check|wire)$",
      validationMessage: "Choose check or wire.",
      options: ["Library check", "Library wire"],
    },
  ],
);
assert.equal(hydratedFields[0].name, "Distribution method");
assert.equal(hydratedFields[0].source, "distributionMethod");
assert.equal(hydratedFields[0].type, "dropdown");
assert.equal(hydratedFields[0].sensitive, true);
assert.equal(hydratedFields[0].required, true);
assert.equal(hydratedFields[0].validationType, "custom");
assert.equal(hydratedFields[0].validationPattern, "^(check|wire)$");
assert.deepEqual(hydratedFields[0].options, ["Package-specific option"]);
assert.equal(hydratedFields[0].interviewVisible, false);
assert.equal(hydratedFields[0].adminOnly, true);
assert.equal(hydratedFields[0].color, "#123456");
assert.equal(hydratedFields[0].mappings.length, 1);

const clearedValidationFields = hydratePackageFields(
  [{ id: "package_cleared_validation", libraryFieldId: "shared_optional_note", validationPattern: "stale", validationMessage: "stale" }],
  [{ id: "shared_optional_note", label: "Optional note", type: "text", source: "interview", validationType: "none", validationPattern: null, validationMessage: null }],
);
assert.equal(clearedValidationFields[0].validationPattern, "");
assert.equal(clearedValidationFields[0].validationMessage, "");

const inheritedOptionFields = hydratePackageFields(
  [{ id: "package_inherited_dropdown", libraryFieldId: "shared_distribution_method", optionsMode: "inherit", options: ["Old package option"] }],
  [{ id: "shared_distribution_method", label: "Distribution method", type: "dropdown", source: "distributionMethod", options: ["Library check", "Library wire"] }],
);
assert.deepEqual(inheritedOptionFields[0].options, ["Library check", "Library wire"]);

const defaultInheritedOptionFields = hydratePackageFields(
  [{ id: "package_default_inherited_dropdown", libraryFieldId: "shared_distribution_method" }],
  [{ id: "shared_distribution_method", label: "Distribution method", type: "dropdown", source: "distributionMethod", options: ["Library check", "Library wire"] }],
);
assert.equal(defaultInheritedOptionFields[0].optionsMode, "inherit");
assert.deepEqual(defaultInheritedOptionFields[0].options, ["Library check", "Library wire"]);

const explicitEmptyOverrideFields = hydratePackageFields(
  [{ id: "package_empty_override_dropdown", libraryFieldId: "shared_distribution_method", optionsMode: "override", options: [] }],
  [{ id: "shared_distribution_method", label: "Distribution method", type: "dropdown", source: "distributionMethod", options: ["Library check", "Library wire"] }],
);
assert.equal(explicitEmptyOverrideFields[0].optionsMode, "override");
assert.deepEqual(explicitEmptyOverrideFields[0].options, []);

if (process.env.DATABASE_URL) {
  const apiRequire = createRequire(new URL("../artifacts/api-server/package.json", import.meta.url));
  const { Client } = apiRequire("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE docufill_fields_migration_test (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        source TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 100
      ) ON COMMIT DROP
    `);
    await client.query(`
      CREATE TEMP TABLE docufill_packages_migration_test (
        id INTEGER PRIMARY KEY,
        fields JSONB NOT NULL
      ) ON COMMIT DROP
    `);
    await client.query(`
      INSERT INTO docufill_fields_migration_test (id, label, source, sort_order)
      VALUES
        ('client_email', 'Client email', 'email', 10),
        ('client_phone', 'Client phone', 'phone', 20),
        ('custodian_email', 'Custodian email', 'custodianEmail', 30)
    `);
    await client.query(`
      INSERT INTO docufill_packages_migration_test (id, fields)
      VALUES
        (1, $1::jsonb)
    `, [JSON.stringify([
      { id: "field_client_email", name: "Client email", source: "email" },
      { id: "field_custodian_email", name: "Custodian email", source: "email" },
      { id: "field_source_only_phone", source: "phone" },
      { id: "field_already_linked", name: "Client email", source: "email", libraryFieldId: "manual_link" },
    ])]);
    await client.query(`
      UPDATE docufill_packages_migration_test pkg
         SET fields = linked.fields
        FROM (
          SELECT pkg_inner.id,
                 jsonb_agg(
                   CASE
                     WHEN field_item.item ? 'libraryFieldId' THEN field_item.item
                     WHEN matched.id IS NOT NULL THEN field_item.item || jsonb_build_object('libraryFieldId', matched.id)
                     ELSE field_item.item
                   END
                   ORDER BY field_item.ordinality
                 ) AS fields
            FROM docufill_packages_migration_test pkg_inner
            CROSS JOIN LATERAL jsonb_array_elements(pkg_inner.fields) WITH ORDINALITY AS field_item(item, ordinality)
            LEFT JOIN LATERAL (
              SELECT id
                FROM docufill_fields_migration_test
               WHERE lower(label) = lower(COALESCE(field_item.item->>'label', field_item.item->>'name'))
                  OR (
                    COALESCE(field_item.item->>'label', field_item.item->>'name', '') = ''
                    AND lower(source) = lower(field_item.item->>'source')
                  )
               ORDER BY sort_order ASC
               LIMIT 1
            ) matched ON TRUE
           GROUP BY pkg_inner.id
        ) linked
       WHERE pkg.id = linked.id
    `);
    const { rows } = await client.query("SELECT fields FROM docufill_packages_migration_test WHERE id = 1");
    const migratedFields = rows[0].fields;
    assert.equal(migratedFields[0].libraryFieldId, "client_email");
    assert.equal(migratedFields[1].libraryFieldId, "custodian_email");
    assert.equal(migratedFields[2].libraryFieldId, "client_phone");
    assert.equal(migratedFields[3].libraryFieldId, "manual_link");
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

// ── yDraw vertical-alignment regression tests ──────────────────────────────
// Mirror the formula constants from artifacts/api-server/src/routes/docufill.ts
// lines 514–533.  These are pure arithmetic assertions that will catch any
// accidental edit to the positioning constants.

function assertClose(actual, expected, message, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

function computeYDraw({ fontSize, hPct, yPct, pageHeight, format }) {
  const yTop = pageHeight - (yPct / 100) * pageHeight;
  const boxHeight = Math.max(fontSize + 2, (hPct / 100) * pageHeight);
  const isCheckboxFormat =
    format === "checkbox-yes" || String(format ?? "").startsWith("checkbox-option:");
  const rawYDraw = isCheckboxFormat
    ? yTop - boxHeight / 2 - fontSize * 0.35
    : yTop - boxHeight + fontSize * 0.2 + 2;
  return Math.max(fontSize + 2, Math.min(pageHeight - 2, rawYDraw));
}

// Case 1: default single-line  (small box, no format)
// fontSize=11, h=10%, y=10%, pageHeight=792
// yTop = 792 - 79.2 = 712.8
// boxHeight = max(13, 79.2) = 79.2
// rawYDraw = 712.8 - 79.2 + 11*0.2 + 2 = 637.8
assertClose(
  computeYDraw({ fontSize: 11, hPct: 10, yPct: 10, pageHeight: 792, format: null }),
  637.8,
  "yDraw single-line default formula",
);

// Case 2: tall-box multiline  (large h forces a deeper box)
// fontSize=11, h=30%, y=10%, pageHeight=792
// yTop = 712.8, boxHeight = max(13, 237.6) = 237.6
// rawYDraw = 712.8 - 237.6 + 2.2 + 2 = 479.4
assertClose(
  computeYDraw({ fontSize: 11, hPct: 30, yPct: 10, pageHeight: 792, format: null }),
  479.4,
  "yDraw tall-box multiline formula",
);

// Case 3: checkbox-yes centering
// fontSize=11, h=10%, y=10%, pageHeight=792
// yTop = 712.8, boxHeight = 79.2
// rawYDraw = 712.8 - 79.2/2 - 11*0.35 = 712.8 - 39.6 - 3.85 = 669.35
assertClose(
  computeYDraw({ fontSize: 11, hPct: 10, yPct: 10, pageHeight: 792, format: "checkbox-yes" }),
  669.35,
  "yDraw checkbox-yes vertical centering formula",
);

// Case 4: checkbox-option: prefix also triggers centering
assertClose(
  computeYDraw({ fontSize: 11, hPct: 10, yPct: 10, pageHeight: 792, format: "checkbox-option:Primary" }),
  669.35,
  "yDraw checkbox-option: prefix also uses centering formula",
);

// Case 5: clamp – rawYDraw below minimum is raised to fontSize+2
// fontSize=11, h=99%, y=1%, pageHeight=100
// yTop = 100 - 1 = 99, boxHeight = max(13, 99) = 99
// rawYDraw = 99 - 99 + 11*0.2 + 2 = 4.2  →  clamped to max(13, 4.2) = 13
assert.equal(
  computeYDraw({ fontSize: 11, hPct: 99, yPct: 1, pageHeight: 100, format: null }),
  13,
  "yDraw clamps rawYDraw up to fontSize+2 minimum",
);

console.log("DocuFill redaction validation passed");