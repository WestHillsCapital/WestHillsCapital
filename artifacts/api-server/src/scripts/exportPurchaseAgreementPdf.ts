#!/usr/bin/env tsx
/**
 * Exports a sample WHC Purchase Agreement PDF for review.
 * Usage: cd artifacts/api-server && npx tsx src/scripts/exportPurchaseAgreementPdf.ts
 */
import { writeFileSync } from "node:fs";
import { generatePurchaseAgreementPdf } from "../lib/generatePurchaseAgreementPdf";

const SAMPLE: Parameters<typeof generatePurchaseAgreementPdf>[0] = {
  agreementDate:        "August 10, 2026",
  confirmationId:       "Assigned on signing",
  buyerFirstName:       "John",
  buyerLastName:        "Smith",
  buyerStreet:          "1234 Maple Avenue",
  buyerCity:            "Los Angeles",
  buyerState:           "CA",
  buyerZip:             "90210",
  buyerEmail:           "john.smith@example.com",
  lineItems: [
    { name: "1 oz American Gold Eagle (BU)",   qty: 2, total: 5_340.00 },
    { name: "10 oz Silver Bar (PAMP Suisse)",  qty: 5, total: 1_500.00 },
  ],
  shipping:             25.00,
  estimatedTotal:       6_865.00,
  fedexLocationName:    "FedEx Office Print & Ship Center",
  fedexLocationAddress: "8501 Canoga Ave",
  fedexLocationCity:    "Canoga Park",
  fedexLocationState:   "CA",
  fedexLocationZip:     "91304",
};

generatePurchaseAgreementPdf(SAMPLE).then(bytes => {
  const out = "/home/runner/workspace/whc-purchase-agreement.pdf";
  writeFileSync(out, bytes);
  console.log(`Saved: ${out}  (${bytes.length.toLocaleString()} bytes)`);
}).catch(err => { console.error(err); process.exit(1); });
