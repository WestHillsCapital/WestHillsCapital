import assert from "node:assert/strict";
import {
  getMatchingDocuFillPackages,
  resolveDocuFillSelections,
  type DocuFillEntity,
  type DocuFillPackage,
} from "./utils";

const custodians: DocuFillEntity[] = [
  { id: 1, name: "Old Equity Trust", active: true },
  { id: 2, name: "Renamed Equity Trust", active: true },
];

const depositories: DocuFillEntity[] = [
  { id: 10, name: "Legacy Depository", active: true },
  { id: 20, name: "Renamed Depository", active: true },
];

const packages: DocuFillPackage[] = [
  { id: 101, name: "Legacy package", custodian_id: 1, depository_id: 10, status: "active", transaction_scope: "ira", version: 1 },
  { id: 202, name: "Renamed package", custodian_id: 2, depository_id: 20, status: "active", transaction_scope: "ira", version: 1 },
  { id: 303, name: "Inactive renamed package", custodian_id: 2, depository_id: 20, status: "inactive", transaction_scope: "ira", version: 1 },
];

const reopenedIdBackedDeal = {
  custodianId: "2",
  custodian: "Old Equity Trust",
  depositoryId: "20",
  depository: "Legacy Depository",
};

const idBackedSelections = resolveDocuFillSelections(reopenedIdBackedDeal, custodians, depositories);
assert.equal(idBackedSelections.selectedCustodian?.id, 2);
assert.equal(idBackedSelections.selectedCustodian?.name, "Renamed Equity Trust");
assert.equal(idBackedSelections.selectedDepository?.id, 20);
assert.equal(idBackedSelections.selectedDepository?.name, "Renamed Depository");
assert.deepEqual(
  getMatchingDocuFillPackages(packages, idBackedSelections.selectedCustodian, idBackedSelections.selectedDepository).map((pkg) => pkg.id),
  [202],
);

const reopenedLegacyNameOnlyDeal = {
  custodianId: "",
  custodian: "Old Equity Trust",
  depositoryId: "",
  depository: "Legacy Depository",
};

const legacySelections = resolveDocuFillSelections(reopenedLegacyNameOnlyDeal, custodians, depositories);
assert.equal(legacySelections.selectedCustodian?.id, 1);
assert.equal(legacySelections.selectedDepository?.id, 10);
assert.deepEqual(
  getMatchingDocuFillPackages(packages, legacySelections.selectedCustodian, legacySelections.selectedDepository).map((pkg) => pkg.id),
  [101],
);

console.log("DocuFill deal selection regression checks passed");