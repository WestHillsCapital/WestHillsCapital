export type FeeVerificationStatus = "verified" | "unverified" | "call-required";

export interface StorageFee {
  type: "commingled" | "segregated" | "flat";
  annualRate: number | null;
  notes: string;
}

export interface AnnualFee {
  structure: "flat" | "asset-based" | "tiered";
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
    verificationStatus: "unverified",
    verifiedDate: null,
    feesUrl: "https://www.trustetc.com/self-directed-ira/fees/",
    setupFee: null,
    setupFeeNotes: "Needs verification — contact Equity Trust directly.",
    annualFee: {
      structure: "asset-based",
      tiers: [],
      notes: "Needs verification — Equity Trust is known to use asset-based annual fees. Contact for current schedule.",
    },
    storageFees: [
      {
        type: "commingled",
        annualRate: null,
        notes: "Needs verification — storage fees depend on chosen depository (Delaware Depository or Brinks).",
      },
      {
        type: "segregated",
        annualRate: null,
        notes: "Needs verification.",
      },
    ],
    transactionFee: null,
    transactionFeeNotes: "Needs verification.",
    wireTransferFee: null,
    distributionFee: null,
    otherFees: [],
    summaryNotes: "UNVERIFIED — all fields must be confirmed with Equity Trust before publishing.",
  },
  {
    slug: "strata-trust",
    name: "Strata Trust Company",
    verificationStatus: "unverified",
    verifiedDate: null,
    feesUrl: "https://www.stratatrust.com/fee-schedule/",
    setupFee: null,
    setupFeeNotes: "Needs verification.",
    annualFee: {
      structure: "flat",
      flatAmount: null,
      notes: "Needs verification — Strata Trust historically uses flat annual fees. Confirm current amount.",
    },
    storageFees: [
      {
        type: "flat",
        annualRate: null,
        notes: "Needs verification — storage is through designated depository, billed separately.",
      },
    ],
    transactionFee: null,
    transactionFeeNotes: "Needs verification.",
    wireTransferFee: null,
    distributionFee: null,
    otherFees: [],
    summaryNotes: "UNVERIFIED — all fields must be confirmed with Strata Trust before publishing.",
  },
  {
    slug: "kingdom-trust",
    name: "Kingdom Trust",
    verificationStatus: "unverified",
    verifiedDate: null,
    feesUrl: "https://www.kingdomtrust.com/pricing",
    setupFee: null,
    setupFeeNotes: "Needs verification.",
    annualFee: {
      structure: "tiered",
      tiers: [],
      notes: "Needs verification — Kingdom Trust may use tiered or asset-based annual fees.",
    },
    storageFees: [
      {
        type: "commingled",
        annualRate: null,
        notes: "Needs verification — storage via Delaware Depository or Brinks.",
      },
    ],
    transactionFee: null,
    transactionFeeNotes: "Needs verification.",
    wireTransferFee: null,
    distributionFee: null,
    otherFees: [],
    summaryNotes: "UNVERIFIED — all fields must be confirmed with Kingdom Trust before publishing.",
  },
  {
    slug: "goldstar-trust",
    name: "GoldStar Trust Company",
    verificationStatus: "unverified",
    verifiedDate: null,
    feesUrl: "https://www.goldstartrust.com/fee-schedule",
    setupFee: null,
    setupFeeNotes: "Needs verification.",
    annualFee: {
      structure: "flat",
      flatAmount: null,
      notes: "Needs verification — GoldStar specializes in precious metals IRAs and may have metals-specific flat fee.",
    },
    storageFees: [
      {
        type: "commingled",
        annualRate: null,
        notes: "Needs verification — primarily Delaware Depository.",
      },
      {
        type: "segregated",
        annualRate: null,
        notes: "Needs verification.",
      },
    ],
    transactionFee: null,
    transactionFeeNotes: "Needs verification.",
    wireTransferFee: null,
    distributionFee: null,
    otherFees: [],
    summaryNotes: "UNVERIFIED — all fields must be confirmed with GoldStar Trust before publishing.",
  },
  {
    slug: "midland-ira",
    name: "Midland IRA",
    verificationStatus: "call-required",
    verifiedDate: null,
    feesUrl: "https://midlandtrust.com/",
    setupFee: null,
    setupFeeNotes: "Midland IRA was acquired by Equity Trust. midlandira.com now redirects to midlandtrust.com which announces the merger. Confirm with Equity Trust whether Midland IRA accounts continue under a separate fee schedule or have been migrated to Equity Trust's standard schedule.",
    annualFee: {
      structure: "asset-based",
      tiers: [],
      notes: "STATUS UNCERTAIN — Midland IRA (midlandira.com) now redirects to Midland Trust, which is part of Equity Trust. Do not publish a separate Midland IRA fee comparison page until the post-merger fee structure is confirmed.",
    },
    storageFees: [],
    transactionFee: null,
    transactionFeeNotes: "See above — merger status must be resolved first.",
    wireTransferFee: null,
    distributionFee: null,
    otherFees: [],
    summaryNotes: "ACTION REQUIRED: Midland IRA has been acquired by Equity Trust. Verify whether to keep Midland as a separate custodian entry, redirect to Equity Trust, or retire this page entirely.",
  },
  {
    slug: "advanta-ira",
    name: "Advanta IRA",
    verificationStatus: "unverified",
    verifiedDate: null,
    feesUrl: "https://www.advantaira.com/fee-schedule/",
    setupFee: null,
    setupFeeNotes: "Needs verification.",
    annualFee: {
      structure: "flat",
      flatAmount: null,
      notes: "Needs verification.",
    },
    storageFees: [
      {
        type: "flat",
        annualRate: null,
        notes: "Needs verification — storage via Delaware Depository or IDS.",
      },
    ],
    transactionFee: null,
    transactionFeeNotes: "Needs verification.",
    wireTransferFee: null,
    distributionFee: null,
    otherFees: [],
    summaryNotes: "UNVERIFIED — all fields must be confirmed with Advanta IRA before publishing.",
  },
];

export function getCustodianFeesBySlug(slug: string): CustodianFees | undefined {
  return CUSTODIAN_FEES.find((f) => f.slug === slug);
}

export function getVerifiedCustodianFees(): CustodianFees[] {
  return CUSTODIAN_FEES.filter((f) => f.verificationStatus === "verified");
}
