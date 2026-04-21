import assert from "node:assert/strict";
import { buildDocuFillFallbackSummaryRows, buildDocuFillPacketSummary, fieldAnswerValue, hydratePackageFields } from "../artifacts/api-server/src/lib/docufill-redaction.ts";
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

console.log("DocuFill redaction validation passed");