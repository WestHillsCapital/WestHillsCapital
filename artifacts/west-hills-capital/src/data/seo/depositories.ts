export interface Depository {
  slug: string;
  name: string;
  shortName: string;
  location: string;
  founded?: number;
  description: string;
  storageTypes: string[];
  howWeWork: string;
  features: string[];
  faqs: { q: string; a: string }[];
}

export const DEPOSITORIES: Depository[] = [
  {
    slug: "delaware-depository",
    name: "Delaware Depository Service Company",
    shortName: "Delaware Depository",
    location: "Wilmington, Delaware",
    founded: 1999,
    description:
      "Delaware Depository Service Company (DDSC) is the most widely used IRS-approved depository for precious metals IRA accounts in the United States. Located in Wilmington, Delaware, DDSC holds billions of dollars in precious metals on behalf of IRA investors, working seamlessly with all major self-directed IRA custodians. Their purpose-built facility, established insurance coverage, and long track record make them the default choice for most precious metals IRA transactions.",
    storageTypes: ["Segregated storage", "Commingled (non-segregated) storage"],
    howWeWork:
      "West Hills Capital delivers precious metals directly to Delaware Depository on behalf of IRA clients nationwide. After your self-directed IRA custodian issues a buy direction and we execute the purchase, metal ships by insured carrier to DDSC's Wilmington facility. The depository confirms receipt, issues a detailed holdings report, and coordinates with your custodian to update your account statement. The process is fully transparent — you receive confirmation at each step.",
    features: [
      "IRS-approved for IRA precious metals storage",
      "All-risk insurance coverage through Lloyd's of London",
      "Segregated and commingled storage options",
      "Works with all major self-directed IRA custodians",
      "Regular audit and reporting to account holders",
      "Accepts gold, silver, platinum, and palladium",
    ],
    faqs: [
      {
        q: "What is the difference between segregated and commingled storage at Delaware Depository?",
        a: "Segregated storage means your specific coins or bars are kept separate from other investors' metals and identified as yours. Commingled (non-segregated) storage pools metals of the same type together — you own a share of the pool, not specific bars. Segregated storage typically costs more but provides direct identification of your holdings.",
      },
      {
        q: "Is my metal at Delaware Depository insured?",
        a: "Yes. DDSC carries all-risk insurance through Lloyd's of London covering the full replacement value of metals in their facility. This is separate from FDIC insurance — it is specific to precious metals held in physical storage.",
      },
      {
        q: "Can I visit Delaware Depository to see my metals?",
        a: "DDSC is a professional depository, not a retail facility. Account holders do not have walk-in access to the vault. Your holdings are tracked and reported through your custodian's account statements and through DDSC's own confirmation reports.",
      },
    ],
  },
  {
    slug: "brinks-global-services",
    name: "Brinks Global Services",
    shortName: "Brinks",
    location: "Salt Lake City, Utah",
    founded: 1859,
    description:
      "Brinks Global Services is one of the world's most recognized security and logistics companies, with operations in over 100 countries. Their Salt Lake City precious metals vault is IRS-approved for self-directed IRA storage and is used by several major self-directed IRA custodians. Brinks' global infrastructure, established reputation, and institutional-grade security make them a trusted alternative to specialty depositories for IRA investors.",
    storageTypes: ["Segregated storage", "Commingled (non-segregated) storage"],
    howWeWork:
      "For clients whose custodians designate Brinks as their depository, West Hills Capital ships metal directly to the Brinks Salt Lake City facility upon purchase confirmation. The logistics process is the same as with any IRS-approved depository — insured carrier shipment, receipt confirmation, and account update through your custodian. Brinks' established carrier relationships ensure reliable, on-time delivery.",
    features: [
      "IRS-approved for precious metals IRA storage",
      "Institutional-grade vault security",
      "Global logistics infrastructure",
      "Full insurance coverage on all stored assets",
      "Electronic holdings tracking and reporting",
      "Accepted by major self-directed IRA custodians",
    ],
    faqs: [
      {
        q: "Is Brinks the same as a specialty precious metals depository?",
        a: "Brinks is a global security and logistics company that operates IRS-approved vaults for precious metals storage. Specialty depositories like Delaware Depository focus exclusively on precious metals. Both are fully acceptable for IRA purposes — the choice is typically determined by which custodian you use, as custodians often have established depository relationships.",
      },
      {
        q: "Which custodians use Brinks for precious metals storage?",
        a: "Several major self-directed IRA custodians, including Equity Trust and Kingdom Trust, offer Brinks as a storage option. The specific depository used is often determined during account setup — confirm with your custodian which options are available to you.",
      },
      {
        q: "How long has Brinks been in the vault storage business?",
        a: "Brinks was founded in 1859 and has been in the secure storage and transport business for over 160 years. Their precious metals IRA vault operations are a more recent offering — but built on one of the most established security reputations in the world.",
      },
    ],
  },
  {
    slug: "international-depository-services",
    name: "International Depository Services",
    shortName: "IDS",
    location: "Delaware City, Delaware",
    founded: 2000,
    description:
      "International Depository Services (IDS) is an IRS-approved precious metals depository with facilities in Delaware City, Delaware and facilities serving the Canadian market. Founded in 2000 specifically to serve the growing precious metals IRA market, IDS has established itself as a reliable alternative to larger depositories, offering competitive storage rates and strong custodian relationships.",
    storageTypes: ["Segregated storage", "Commingled (non-segregated) storage"],
    howWeWork:
      "West Hills Capital ships metals to IDS on behalf of IRA clients whose custodians designate IDS as their depository. The process follows the same protocol as any IRS-approved depository — purchase direction from custodian, trade execution, insured shipment, and receipt confirmation. IDS coordinates directly with your custodian for account updates.",
    features: [
      "IRS-approved for precious metals IRA storage",
      "Purpose-built precious metals storage facility",
      "Competitive storage fee structure",
      "Segregated and commingled storage options",
      "Works with multiple self-directed IRA custodians",
      "Accepts gold, silver, platinum, and palladium",
    ],
    faqs: [
      {
        q: "Why might a custodian use IDS instead of Delaware Depository?",
        a: "Custodians select depositories based on fee arrangements, relationships, and client preferences. IDS often offers competitive storage rates and works with custodians looking for an alternative to DDSC. For IRA investors, the choice of depository rarely affects the IRS compliance status of the account — all IRS-approved depositories meet the same federal standards.",
      },
      {
        q: "Does IDS offer delivery of metals after an IRA distribution?",
        a: "Yes. When you take a distribution from your precious metals IRA — either in-kind (physical metal) or by selling and taking cash — IDS coordinates the delivery or liquidation process with your custodian. In-kind distributions ship metal to your address of record.",
      },
      {
        q: "Is IDS insured?",
        a: "Yes. IDS carries insurance on metals held in their facility. Confirm current coverage details with IDS directly — insurance terms and limits can change. Your custodian can also provide documentation of IDS's insurance coverage.",
      },
    ],
  },
  {
    slug: "texas-precious-metals-depository",
    name: "Texas Precious Metals Depository",
    shortName: "Texas Depository",
    location: "Shiner, Texas",
    founded: 2018,
    description:
      "The Texas Precious Metals Depository (TPMD), located in Shiner, Texas, is one of the newer IRS-approved precious metals depositories. Built in 2018, TPMD is a purpose-built vault facility serving both retail and IRA investors. Texas's strong property rights tradition and the depository's modern security infrastructure have made it an increasingly popular choice for investors who prefer domestic-state storage outside the Northeast.",
    storageTypes: ["Segregated storage"],
    howWeWork:
      "For clients who prefer Texas-based storage — whether for geographic diversification or regional preference — West Hills Capital ships metals to Texas Precious Metals Depository upon custodian purchase direction. TPMD's modern facility and custody reporting integrate with major self-directed IRA custodians the same way as established depositories.",
    features: [
      "IRS-approved for precious metals IRA storage",
      "Purpose-built modern vault facility (opened 2018)",
      "Segregated storage with individual account tracking",
      "Texas-based geographic diversification",
      "Full insurance coverage",
      "Serves retail and IRA clients",
    ],
    faqs: [
      {
        q: "Why would an investor choose Texas Precious Metals Depository over Delaware Depository?",
        a: "Geographic diversification is the most common reason — some investors prefer their metals stored in a different region than the coastal financial centers. Texas's strong property rights laws and political climate also appeal to certain investors. TPMD is fully IRS-approved and meets the same federal standards as any other qualifying depository.",
      },
      {
        q: "Is Texas Precious Metals Depository approved for all IRA account types?",
        a: "TPMD is IRS-approved for self-directed precious metals IRA accounts. Compatibility with your specific custodian should be confirmed during account setup — not all custodians work with all depositories, and TPMD's custodian relationships are growing as a newer facility.",
      },
      {
        q: "Does TPMD offer public viewing of stored metals?",
        a: "TPMD has positioned itself as more accessible than traditional depositories. Contact them directly regarding their client access policies — policies may differ from older, more closed facilities.",
      },
    ],
  },
  {
    slug: "cnt-depository",
    name: "CNT Depository",
    shortName: "CNT",
    location: "Bridgewater, Massachusetts",
    founded: 1971,
    description:
      "CNT Depository, operated by the Coin & Currency Institute in Bridgewater, Massachusetts, is one of the longest-tenured precious metals storage facilities in the country. With roots going back to 1971, CNT has decades of experience in precious metals custody and is IRS-approved for self-directed IRA storage. Their New England location and institutional track record make them a reliable option for investors in the Northeast.",
    storageTypes: ["Segregated storage", "Commingled (non-segregated) storage"],
    howWeWork:
      "West Hills Capital ships metals to CNT Depository for IRA clients whose custodians designate CNT as their storage facility. The process is identical to any IRS-approved depository — custodian-issued buy direction, trade execution, insured carrier shipment, and receipt confirmation. CNT's long-standing relationships with precious metals dealers ensure a familiar, efficient process.",
    features: [
      "IRS-approved for precious metals IRA storage",
      "Over 50 years of precious metals custody experience",
      "Segregated and commingled storage options",
      "Full insurance coverage",
      "Established relationships with self-directed IRA custodians",
      "Accepts gold, silver, platinum, and palladium",
    ],
    faqs: [
      {
        q: "What is the Coin & Currency Institute's relationship to CNT Depository?",
        a: "CNT Depository is operated by the Coin & Currency Institute, a precious metals dealer and custody firm founded in 1971. The depository arm provides secure storage for IRA and retail clients, separate from the dealer's buying and selling operations.",
      },
      {
        q: "Which custodians work with CNT Depository?",
        a: "CNT works with a range of self-directed IRA custodians. The most straightforward way to confirm whether your specific custodian works with CNT is to ask when setting up your account. West Hills Capital can also provide guidance based on our transaction experience.",
      },
      {
        q: "How long has CNT been storing IRA precious metals?",
        a: "CNT's parent company has been in the precious metals business since 1971. Their involvement in IRA precious metals storage grew with the self-directed IRA market in the 1990s and 2000s. They bring decades of institutional experience to IRA storage.",
      },
    ],
  },
];

export function getDepositoryBySlug(slug: string): Depository | undefined {
  return DEPOSITORIES.find((d) => d.slug === slug);
}
