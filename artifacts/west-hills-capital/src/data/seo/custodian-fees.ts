export type FeeVerificationStatus = "verified" | "unverified" | "call-required" | "retired";

export interface StorageFee {
  type: "commingled" | "segregated" | "flat";
  annualRate: number | null;
  notes: string;
}

export interface AnnualFee {
  structure: "flat" | "asset-based" | "tiered" | "per-asset";
  tiers?: { upTo: number | null; fee: number }[];
  flatAmount?: number | null;
  notes: string;
}

export interface CustodianFees {
  slug: string;
  name: string;
  verificationStatus: FeeVerificationStatus;
  verifiedDate: string | null;
  feesUrl: string | null;
  setupFee: number | null;
  setupFeeNotes: string;
  annualFee: AnnualFee;
  storageFees: StorageFee[];
  transactionFee: number | null;
  transactionFeeNotes: string;
  wireTransferFee: number | null;
  distributionFee: number | null;
  otherFees: { label: string; amount: number | null; notes: string }[];
  summaryNotes: string;
}

export const CUSTODIAN_FEES: CustodianFees[] = [
  {
    slug: "equity-trust",
    name: "Equity Trust Company",
    verificationStatus: "verified",
    verifiedDate: "2025-06-19",
    feesUrl: "https://www.trustetc.com/self-directed-ira/fees/",
    setupFee: 50,
    setupFeeNotes: "Online application $50. Paper application $75. Gold Level Service Membership $249/yr. Gold Level Prime Membership $499 first year / $249/yr thereafter.",
    annualFee: {
      structure: "asset-based",
      tiers: [
        { upTo: 49999, fee: 350 },
        { upTo: 99999, fee: 500 },
        { upTo: 249999, fee: 750 },
        { upTo: 499999, fee: 1000 },
        { upTo: 749999, fee: 1500 },
        { upTo: 999999, fee: 2000 },
        { upTo: null, fee: 2500 },
      ],
      notes: "Based on total asset value. Includes alternative asset buys/sells, custody and administration, WealthBridge trades, 50 commission-free brokerage trades/year, Digital Asset Platform access, unlimited check/ACH deposits and disbursements.",
    },
    storageFees: [
      {
        type: "commingled",
        annualRate: 110,
        notes: "Non-segregated storage $110/yr. Assessed by the depository annually.",
      },
      {
        type: "segregated",
        annualRate: 160,
        notes: "Segregated storage $160/yr. Assessed by the depository annually.",
      },
    ],
    transactionFee: 10,
    transactionFeeNotes: "Precious metals liquidation $10/asset (max $30). Coin shipping/handling: cost + $10 ($50 minimum). In-kind distribution or transfer out: $50/transaction.",
    wireTransferFee: 30,
    distributionFee: 15,
    otherFees: [
      { label: "Full Termination Fee", amount: 250, notes: "" },
      { label: "Partial Termination Fee", amount: 100, notes: "Per asset." },
      { label: "Distribution/Re-Registration of Asset", amount: 100, notes: "Per asset." },
      { label: "Cashier's Check", amount: 30, notes: "Per check." },
      { label: "Overnight Mail", amount: 50, notes: "Per occurrence." },
      { label: "Late Fee", amount: 50, notes: "Failure to pay annual fee by provided deadline." },
      { label: "Paper Statement Fee", amount: 60, notes: "Annually. Avoided by enrolling in eStatements." },
      { label: "Foreign Currency Fee", amount: 100, notes: "Annually." },
    ],
    summaryNotes: "Verified from Equity Trust fee schedule (FS-0001-01 Rev. 110625, ©2025). Equity Trust also absorbed Midland IRA — existing Midland clients are now under Equity Trust administration.",
  },
  {
    slug: "strata-trust",
    name: "Strata Trust Company",
    verificationStatus: "verified",
    verifiedDate: "2025-06-19",
    feesUrl: "https://www.stratatrust.com/fee-schedule/",
    setupFee: 50,
    setupFeeNotes: "Account set-up fee $50. Waived for online account opening.",
    annualFee: {
      structure: "flat",
      flatAmount: 125,
      notes: "Precious Metals IRA annual account fee: $125. (Basic IRA: $150. Flex IRA for alternative investments: $350.) Fee schedule effective January 1, 2024.",
    },
    storageFees: [
      {
        type: "commingled",
        annualRate: 100,
        notes: "Commingled precious metals storage $100/yr. Charged annually on account anniversary.",
      },
      {
        type: "segregated",
        annualRate: 175,
        notes: "Segregated storage $175/yr — only Gold, Platinum, and Palladium. Depository exceptions may apply.",
      },
    ],
    transactionFee: 40,
    transactionFeeNotes: "Precious metals purchase, sale, or exchange: $40. Precious metals shipping: $10 + depository's cost. Depository precious metals handling/processing (eff. 5/1/2024): $35.",
    wireTransferFee: 35,
    distributionFee: 0,
    otherFees: [
      { label: "In-Kind Distribution or Asset Reinstatement", amount: 75, notes: "Per asset." },
      { label: "Account Closure", amount: 250, notes: "" },
      { label: "Partial Transfer Out", amount: 100, notes: "Waived for Flex IRAs." },
      { label: "Late Fee", amount: 50, notes: "Charged 30 days after invoice date." },
      { label: "Cashier's Check", amount: 50, notes: "" },
      { label: "Paper Statements Mailed", amount: 50, notes: "Per year. Electronic statements are free." },
      { label: "Roth Conversion or Recharacterization", amount: 50, notes: "Per asset." },
      { label: "Account Reinstatement", amount: 250, notes: "" },
      { label: "Special Requests or Research", amount: null, notes: "$25/request or $75/hr." },
    ],
    summaryNotes: "Verified from Strata Trust IRA Fee Schedule effective January 1, 2024. Three account tiers: Precious Metals IRA, Basic IRA, Flex IRA. Fees shown are for Precious Metals IRA unless noted.",
  },
  {
    slug: "kingdom-trust",
    name: "Choice IRA (formerly Kingdom Trust)",
    verificationStatus: "call-required",
    verifiedDate: null,
    feesUrl: "https://www.choiceapp.io/",
    setupFee: null,
    setupFeeNotes: "Kingdom Trust rebranded to Choice IRA (choiceapp.io). Confirm whether they still accept new precious metals IRA clients and obtain current fee schedule directly.",
    annualFee: {
      structure: "tiered",
      tiers: [],
      notes: "NEEDS VERIFICATION — Kingdom Trust has rebranded to Choice IRA and may no longer offer precious metals accounts. Do not publish fee comparison content for this custodian until metals eligibility and current fee schedule are confirmed.",
    },
    storageFees: [],
    transactionFee: null,
    transactionFeeNotes: "Needs verification — metals eligibility must be confirmed first.",
    wireTransferFee: null,
    distributionFee: null,
    otherFees: [],
    summaryNotes: "ACTION REQUIRED: Kingdom Trust has rebranded to Choice IRA. Confirm (1) whether they still accept precious metals IRA clients and (2) current fee schedule before publishing any content for this custodian.",
  },
  {
    slug: "goldstar-trust",
    name: "GoldStar Trust Company",
    verificationStatus: "verified",
    verifiedDate: "2025-06-19",
    feesUrl: "https://www.goldstartrust.com/forms-3/",
    setupFee: 50,
    setupFeeNotes: "Establishment fee: $50. Note: Fee schedule provided is for Self-Directed Custodial Account (Non-qualified or Custodial Plans). GoldStar publishes a separate IRA fee schedule — confirm IRA-specific setup fee with GoldStar if different.",
    annualFee: {
      structure: "flat",
      flatAmount: 150,
      notes: "Annual Maintenance Fee: $150. Note: Verified from the Custodial Plan fee schedule. GoldStar's IRA fee schedule may differ slightly — confirm directly for IRA accounts.",
    },
    storageFees: [
      {
        type: "segregated",
        annualRate: 225,
        notes: "Annual Segregated Depository Storage Fee: $225 minimum / no maximum. $1.80 per $1,000 of precious metals value greater than $125,000 (18 basis points). Storage fees billed on account anniversary.",
      },
    ],
    transactionFee: 0,
    transactionFeeNotes: "Buy, sell, or exchange: NO FEE. Shipping: $10 plus cost of shipping (may apply on liquidations and in-kind distributions).",
    wireTransferFee: 50,
    distributionFee: 15,
    otherFees: [
      { label: "Full Termination Fee", amount: 150, notes: "" },
      { label: "Partial Transfer of Assets / Distribution In-Kind Fee", amount: 75, notes: "" },
      { label: "Overnight Fee", amount: 60, notes: "" },
      { label: "Late Fee", amount: 50, notes: "Per occurrence — applies to fees not paid within 30 days of due date." },
      { label: "Annual Paper Statement Fee", amount: 40, notes: "" },
      { label: "Cashier's Check Fee", amount: 50, notes: "" },
      { label: "Insufficient Funds / Returned Check Fee", amount: 50, notes: "" },
      { label: "Research Assistance Fee", amount: null, notes: "$50/hour." },
      { label: "Recurring Check Distribution Fee", amount: 5, notes: "" },
      { label: "Statement Reprint Fee", amount: 10, notes: "" },
    ],
    summaryNotes: "Verified from GoldStar Trust Custodial Plan Fee Schedule (Non-qualified or Custodial Plans). GoldStar also publishes a separate IRA & ESA fee schedule — download from goldstartrust.com/forms-3/ to confirm any differences for IRA accounts.",
  },
  {
    slug: "advanta-ira",
    name: "Advanta IRA",
    verificationStatus: "verified",
    verifiedDate: "2025-06-19",
    feesUrl: "https://www.advantaira.com/self-directed-ira-resources/advanta-ira-forms/",
    setupFee: 50,
    setupFeeNotes: "Account Opening Fee: $50 one-time fee for establishment of account.",
    annualFee: {
      structure: "tiered",
      tiers: [
        { upTo: 14999, fee: 200 },
        { upTo: 29999, fee: 300 },
        { upTo: 59999, fee: 400 },
        { upTo: 89999, fee: 500 },
        { upTo: 124999, fee: 600 },
        { upTo: 249999, fee: 700 },
        { upTo: 499999, fee: 850 },
        { upTo: 749999, fee: 1500 },
        { upTo: null, fee: 1850 },
      ],
      notes: "Option 2: Based on Account Value (billed quarterly). Option 1 alternative: per-asset billing — precious metal holdings per depository: $250/yr (depository/storage fees not included). Cash-only accounts subject to $25/quarter charge.",
    },
    storageFees: [
      {
        type: "flat",
        annualRate: null,
        notes: "Depository/storage fees are separate and not included in the annual recordkeeping fee. Confirm storage costs with the designated depository (Delaware Depository or IDS).",
      },
    ],
    transactionFee: 95,
    transactionFeeNotes: "Purchase, sale, or exchange of any asset: $145 (new) / $95 (existing). Additional capital contribution/funding to existing investment: $50.",
    wireTransferFee: 30,
    distributionFee: 20,
    otherFees: [
      { label: "IRA-to-IRA Transfer / Account Closure", amount: null, notes: "0.5% of transfer amount. Max $150 if account open more than 2 years; max $250 if open less than 2 years." },
      { label: "Incoming Wire Transfer", amount: 15, notes: "" },
      { label: "International Wire Transfer", amount: 60, notes: "" },
      { label: "Cashier's Check", amount: 10, notes: "Per check." },
      { label: "Express Delivery (Next Day / 2nd Day / International)", amount: 50, notes: "$50 / $30 / $100." },
      { label: "Returned Items / Stop Payment", amount: 30, notes: "Per occurrence." },
      { label: "Special Services (research, fair market valuation, etc.)", amount: null, notes: "$150/hr ($50 minimum)." },
      { label: "Late Fee", amount: 25, notes: "Per month if fee remains unpaid more than 30 calendar days." },
    ],
    summaryNotes: "Verified from Advanta IRA Fee Schedule. Two annual fee options: per-asset (Option 1) or account-value-based (Option 2, billed quarterly). Storage fees are separate from the custodian fee and billed by the depository.",
  },
  {
    slug: "midland-ira",
    name: "Midland IRA",
    verificationStatus: "retired",
    verifiedDate: "2025-06-19",
    feesUrl: null,
    setupFee: null,
    setupFeeNotes: "Retired — Midland IRA was acquired by Equity Trust. midlandira.com redirects to midlandtrust.com which confirms the merger.",
    annualFee: {
      structure: "flat",
      flatAmount: null,
      notes: "Retired — see Equity Trust for current fee schedule.",
    },
    storageFees: [],
    transactionFee: null,
    transactionFeeNotes: "Retired.",
    wireTransferFee: null,
    distributionFee: null,
    otherFees: [],
    summaryNotes: "RETIRED: Midland IRA no longer operates as an independent custodian. Acquired by Equity Trust. Do not publish or link any Midland IRA content.",
  },
];

export function getCustodianFeesBySlug(slug: string): CustodianFees | undefined {
  return CUSTODIAN_FEES.find((f) => f.slug === slug);
}

export function getVerifiedCustodianFees(): CustodianFees[] {
  return CUSTODIAN_FEES.filter((f) => f.verificationStatus === "verified");
}

export function getActiveCustodianFees(): CustodianFees[] {
  return CUSTODIAN_FEES.filter((f) => f.verificationStatus !== "retired");
}
