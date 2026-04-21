import assert from "node:assert/strict";
import { buildDocuFillFallbackSummaryRows, buildDocuFillPacketSummary, fieldAnswerValue } from "../artifacts/api-server/src/lib/docufill-redaction.ts";
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

console.log("DocuFill redaction validation passed");