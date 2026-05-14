import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const outPath = "/home/runner/workspace/artifacts/west-hills-capital/public/affiliate-program-agreement.pdf";

const GOLD   = "#C49A38";
const NAVY   = "#0F1C3F";
const DARK   = "#1a1a1a";
const MUTED  = "#555555";
const LIGHT  = "#888888";

const doc = new PDFDocument({
  size:    "LETTER",
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  info: {
    Title:    "Docuplete Affiliate Program Agreement",
    Author:   "West Hills Capital",
    Subject:  "Affiliate Program Terms",
    Keywords: "affiliate, commission, docuplete",
  },
});

doc.pipe(fs.createWriteStream(outPath));

// ── helpers ────────────────────────────────────────────────────────────────

function headerRule() {
  doc.moveTo(72, doc.y).lineTo(540, doc.y).strokeColor(GOLD).lineWidth(1.5).stroke();
  doc.moveDown(0.4);
}

function sectionTitle(text) {
  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(NAVY).text(text.toUpperCase(), { letterSpacing: 0.6 });
  doc.moveDown(0.25);
  doc.moveTo(72, doc.y).lineTo(540, doc.y).strokeColor("#dddddd").lineWidth(0.5).stroke();
  doc.moveDown(0.35);
}

function body(text, opts = {}) {
  doc.font("Helvetica").fontSize(10).fillColor(DARK).text(text, { lineGap: 3, ...opts });
  doc.moveDown(0.4);
}

function bullet(items) {
  for (const item of items) {
    doc.font("Helvetica").fontSize(10).fillColor(DARK)
       .text(`\u2022  ${item}`, { indent: 16, lineGap: 3 });
  }
  doc.moveDown(0.4);
}

function definition(term, def) {
  doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK).text(`"${term}"`, { continued: true });
  doc.font("Helvetica").fontSize(10).fillColor(DARK).text(`  means ${def}`, { lineGap: 3 });
  doc.moveDown(0.3);
}

// ── COVER / HEADER ─────────────────────────────────────────────────────────

doc.rect(0, 0, 612, 108).fill(NAVY);

doc.font("Helvetica-Bold").fontSize(20).fillColor("#FFFFFF")
   .text("Docuplete", 72, 28, { continued: true });
doc.font("Helvetica").fontSize(20).fillColor(GOLD).text("  Affiliate Program Agreement");

doc.font("Helvetica").fontSize(10).fillColor("rgba(255,255,255,0.65)")
   .text("West Hills Capital  ·  westhillscapital.com  ·  affiliates@westhillscapital.com", 72, 60);

doc.font("Helvetica").fontSize(9).fillColor("rgba(255,255,255,0.45)")
   .text("Effective upon electronic acceptance by the Affiliate. Last updated: May 2026.", 72, 82);

doc.y = 132;

// ── INTRO ──────────────────────────────────────────────────────────────────

headerRule();

body(
  "This Affiliate Program Agreement (\"Agreement\") is entered into between West Hills Capital, LLC " +
  "(\"Company,\" \"we,\" or \"us\"), the operator of the Docuplete document-automation platform, and the " +
  "individual or entity that accepts this Agreement electronically (\"Affiliate,\" \"you,\" or \"your\").\n\n" +
  "By checking the acceptance box on the Docuplete affiliate application form, you agree to be bound by " +
  "all terms of this Agreement. If you are accepting on behalf of a company or other legal entity, you " +
  "represent that you have the authority to bind that entity."
);

// ── 1 DEFINITIONS ─────────────────────────────────────────────────────────

sectionTitle("1. Definitions");

definition("Qualified Referral",
  "a new customer who (a) has not previously registered for a Docuplete account, (b) signs up " +
  "through the Affiliate's unique referral link or using the Affiliate's referral code, (c) completes " +
  "a paid subscription (excluding trial periods), and (d) makes at least one successful billed payment.");

definition("Commission Period",
  "the 12 consecutive calendar months immediately following a Qualified Referral's first successful " +
  "billed payment.");

definition("Net Revenue",
  "the monthly subscription fees actually collected from a Qualified Referral, excluding taxes, " +
  "chargebacks, refunds, and platform or payment-processing fees.");

definition("Referral Link",
  "the unique URL or promo code assigned to the Affiliate by the Company.");

definition("Stripe Connect Account",
  "the Affiliate's connected payout account established through Stripe, Inc., required to receive " +
  "commission payments.");

// ── 2 PROGRAM ENROLLMENT ──────────────────────────────────────────────────

sectionTitle("2. Program Enrollment");

body(
  "Upon approval of your application, the Company will: (a) issue you a unique Referral Link and " +
  "referral code; (b) send you a Stripe Connect onboarding link to set up your payout account; and " +
  "(c) grant you access to your affiliate dashboard showing referred accounts, commission status, and " +
  "payout history.\n\n" +
  "Enrollment is subject to the Company's sole discretion and may be denied or revoked at any time " +
  "for any reason, including conduct inconsistent with the Company's brand or values."
);

// ── 3 COMMISSION STRUCTURE ────────────────────────────────────────────────

sectionTitle("3. Commission Structure");

body("Subject to the terms of this Agreement, the Company will pay the Affiliate a commission as follows:");

bullet([
  "Rate:  20% of Net Revenue generated by each Qualified Referral.",
  "Duration:  Commissions are earned for the Commission Period (12 months) per Qualified Referral.",
  "Calculation:  Commissions are calculated on the monthly billing date of each Qualified Referral " +
  "and accumulate until the payout date.",
  "No recurring obligation:  After the 12-month Commission Period expires for a given referral, no " +
  "further commissions are owed on that referral's subscription, even if the customer remains active.",
]);

body(
  "Custom commission rates or extended terms may be agreed upon in a separate written addendum " +
  "signed by both parties. In the absence of such an addendum, the terms above govern."
);

// ── 4 PAYMENT ─────────────────────────────────────────────────────────────

sectionTitle("4. Payment");

bullet([
  "Commissions are paid monthly, within 15 business days following the end of each calendar month " +
  "in which they were earned.",
  "Payment is made exclusively via Stripe Connect to the Affiliate's verified payout account. " +
  "The Affiliate is responsible for completing Stripe onboarding and maintaining a valid payout method.",
  "Commissions below $25 in a given month will roll over to the following month until the " +
  "accumulated balance meets the $25 minimum.",
  "The Company reserves the right to withhold payment for commissions under dispute, reversal, or " +
  "fraud investigation.",
  "The Affiliate is solely responsible for all taxes, duties, and withholdings applicable to " +
  "commission payments in their jurisdiction.",
]);

// ── 5 AFFILIATE OBLIGATIONS ────────────────────────────────────────────────

sectionTitle("5. Affiliate Obligations");

body("The Affiliate agrees to:");

bullet([
  "Promote Docuplete only through lawful, truthful, and non-deceptive means.",
  "Not misrepresent Docuplete's features, pricing, or capabilities.",
  "Disclose the affiliate relationship clearly and conspicuously in any promotional content, in " +
  "compliance with applicable law (including FTC guidelines).",
  "Not engage in paid search advertising on branded terms (\"Docuplete,\" \"West Hills Capital,\" " +
  "or confusingly similar terms) without prior written consent.",
  "Not send unsolicited bulk email (spam) using the Referral Link.",
  "Keep referral codes and Referral Links confidential and not share them in a manner intended to " +
  "generate illegitimate signups.",
  "Promptly notify the Company of any errors, misrepresentations, or suspected abuse of the " +
  "Referral Link.",
]);

// ── 6 PROHIBITED CONDUCT ──────────────────────────────────────────────────

sectionTitle("6. Prohibited Conduct");

body("The following activities are grounds for immediate termination of this Agreement and forfeiture of any unpaid commissions:");

bullet([
  "Self-referral: signing up for a Docuplete account using your own Referral Link.",
  "Incentivized signups: offering third parties cash, rebates, or other compensation in exchange " +
  "for using the Referral Link, unless pre-approved in writing.",
  "Cookie stuffing or click fraud.",
  "Trademark infringement or brand impersonation.",
  "Any conduct that violates applicable law or regulation.",
]);

// ── 7 INTELLECTUAL PROPERTY ───────────────────────────────────────────────

sectionTitle("7. Intellectual Property");

body(
  "The Company grants the Affiliate a limited, non-exclusive, non-transferable, revocable license " +
  "to use the Docuplete name, logo, and approved marketing materials solely for the purpose of " +
  "promoting the Docuplete platform under this Agreement.\n\n" +
  "The Affiliate may not modify the Company's trademarks, create derivative works, or use them in " +
  "any manner that implies endorsement of the Affiliate's own products or services beyond referral " +
  "promotion. All goodwill arising from use of the Company's trademarks inures to the Company."
);

// ── 8 CONFIDENTIALITY ─────────────────────────────────────────────────────

sectionTitle("8. Confidentiality");

body(
  "\"Confidential Information\" means any non-public information disclosed by the Company to the " +
  "Affiliate, including commission rates, business terms, customer data, and technical information. " +
  "The Affiliate will not disclose Confidential Information to any third party without prior written " +
  "consent and will use it only for the purpose of performing under this Agreement. This obligation " +
  "survives termination for three (3) years."
);

// ── 9 TERM AND TERMINATION ────────────────────────────────────────────────

sectionTitle("9. Term and Termination");

bullet([
  "This Agreement begins on the date of electronic acceptance and continues until terminated.",
  "Either party may terminate this Agreement for any reason with 14 days' written notice (email " +
  "to affiliates@westhillscapital.com is sufficient).",
  "The Company may terminate immediately upon breach of Sections 5 or 6.",
  "Upon termination, the Affiliate will cease all use of the Referral Link and Company trademarks.",
  "Commissions earned prior to the effective termination date will be paid in the normal course, " +
  "except where forfeited under Section 6. Commissions for the 12-month Commission Period " +
  "continue for referrals already made prior to termination.",
]);

// ── 10 DISCLAIMERS ────────────────────────────────────────────────────────

sectionTitle("10. Disclaimer of Warranties");

body(
  "THE COMPANY PROVIDES THE AFFILIATE PROGRAM \"AS IS\" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR " +
  "IMPLIED. THE COMPANY DOES NOT WARRANT THAT THE PLATFORM WILL BE ERROR-FREE OR UNINTERRUPTED, " +
  "THAT REFERRAL LINKS WILL FUNCTION AT ALL TIMES, OR THAT ANY SPECIFIC COMMISSION LEVELS WILL " +
  "BE ACHIEVABLE. THE AFFILIATE BEARS ALL RISK RELATING TO PROMOTIONAL ACTIVITIES."
);

// ── 11 LIMITATION OF LIABILITY ────────────────────────────────────────────

sectionTitle("11. Limitation of Liability");

body(
  "TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE COMPANY'S TOTAL LIABILITY TO THE AFFILIATE UNDER " +
  "THIS AGREEMENT SHALL NOT EXCEED THE TOTAL COMMISSIONS PAID TO THE AFFILIATE IN THE THREE MONTHS " +
  "PRECEDING THE CLAIM. IN NO EVENT WILL THE COMPANY BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, " +
  "CONSEQUENTIAL, OR PUNITIVE DAMAGES."
);

// ── 12 INDEPENDENT CONTRACTOR ─────────────────────────────────────────────

sectionTitle("12. Independent Contractor");

body(
  "The Affiliate is an independent contractor. Nothing in this Agreement creates an employment, " +
  "partnership, joint venture, or agency relationship between the parties. The Affiliate has no " +
  "authority to bind the Company to any obligation."
);

// ── 13 MODIFICATIONS ──────────────────────────────────────────────────────

sectionTitle("13. Modifications to This Agreement");

body(
  "The Company may update this Agreement at any time by posting a revised version and notifying " +
  "the Affiliate by email. Continued participation in the affiliate program after the notice period " +
  "(14 days) constitutes acceptance of the revised terms. If the Affiliate does not accept the " +
  "revised terms, they must terminate this Agreement before the notice period expires."
);

// ── 14 GOVERNING LAW ──────────────────────────────────────────────────────

sectionTitle("14. Governing Law; Dispute Resolution");

body(
  "This Agreement is governed by the laws of the State of California, without regard to conflict-of-law " +
  "principles. Any dispute arising under or relating to this Agreement shall first be subject to " +
  "good-faith negotiation between the parties. If unresolved within 30 days, disputes shall be " +
  "submitted to binding arbitration administered by the American Arbitration Association under its " +
  "Commercial Arbitration Rules, conducted in Los Angeles County, California. Judgment on the award " +
  "may be entered in any court of competent jurisdiction."
);

// ── 15 GENERAL ────────────────────────────────────────────────────────────

sectionTitle("15. General Provisions");

bullet([
  "Entire Agreement: This Agreement constitutes the entire agreement between the parties regarding " +
  "the affiliate program and supersedes all prior discussions.",
  "Severability: If any provision is found unenforceable, the remaining provisions continue in effect.",
  "Waiver: Failure to enforce any provision is not a waiver of the right to enforce it later.",
  "Assignment: The Affiliate may not assign this Agreement without prior written consent. The " +
  "Company may assign it in connection with a merger, acquisition, or sale of substantially all assets.",
  "Notices: Legal notices to the Company should be sent to: West Hills Capital, LLC, " +
  "affiliates@westhillscapital.com.",
]);

// ── SIGNATURE BLOCK ───────────────────────────────────────────────────────

doc.moveDown(1.2);
doc.moveTo(72, doc.y).lineTo(540, doc.y).strokeColor(GOLD).lineWidth(1).stroke();
doc.moveDown(0.6);

doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text("Acceptance", { continued: false });
doc.moveDown(0.3);
doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(
  "This Agreement is accepted electronically. By checking the acceptance box on the affiliate " +
  "application form, you confirm that you have read, understood, and agree to be bound by all " +
  "terms of this Agreement. The date of acceptance and your IP address are recorded and constitute " +
  "your electronic signature."
);

doc.moveDown(1.5);

// two-column sig lines
const col1x = 72;
const col2x = 330;
const lineY  = doc.y;

doc.moveTo(col1x, lineY).lineTo(col1x + 200, lineY).strokeColor("#aaaaaa").lineWidth(0.8).stroke();
doc.moveTo(col2x, lineY).lineTo(col2x + 180, lineY).strokeColor("#aaaaaa").lineWidth(0.8).stroke();

doc.font("Helvetica").fontSize(8.5).fillColor(LIGHT)
   .text("Affiliate — Name",                col1x, lineY + 5)
   .text("West Hills Capital, LLC",          col2x, lineY + 5);

doc.moveDown(2);
const lineY2 = doc.y;
doc.moveTo(col1x, lineY2).lineTo(col1x + 200, lineY2).strokeColor("#aaaaaa").lineWidth(0.8).stroke();
doc.moveTo(col2x, lineY2).lineTo(col2x + 180, lineY2).strokeColor("#aaaaaa").lineWidth(0.8).stroke();
doc.font("Helvetica").fontSize(8.5).fillColor(LIGHT)
   .text("Date of Acceptance (auto-recorded)", col1x, lineY2 + 5)
   .text("Authorized Signatory",               col2x, lineY2 + 5);

// ── FOOTER on each page ────────────────────────────────────────────────────

const totalPages = doc.bufferedPageRange ? doc.bufferedPageRange().count : 1;
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.font("Helvetica").fontSize(8).fillColor(LIGHT)
     .text(
       `Docuplete Affiliate Program Agreement  ·  West Hills Capital, LLC  ·  Page ${i + 1}`,
       72, 756, { align: "center", width: 468 }
     );
}

doc.end();
console.log("Generated:", outPath);
