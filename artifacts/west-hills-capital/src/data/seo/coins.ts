export interface CoinYear {
  year: number;
  notes?: string;
}

export interface CoinReporting {
  isReportable: boolean;
  threshold?: string;
  notes: string;
}

export interface CoinProduct {
  slug: string;
  name: string;
  shortName: string;
  metal: "gold" | "silver";
  purity: string;
  weight: string;
  diameter: string;
  mintedSince: number;
  issuer: string;
  iraEligible: boolean;
  recommended: boolean;
  description: string;
  whyBullion: string;
  reporting: CoinReporting;
  specs: { label: string; value: string }[];
  years: CoinYear[];
}

const GOLD_YEARS: CoinYear[] = [
  { year: 2025 },
  { year: 2024 },
  { year: 2023 },
  { year: 2022 },
  { year: 2021 },
  { year: 2020 },
];

const SILVER_YEARS: CoinYear[] = [
  { year: 2025 },
  { year: 2024 },
  { year: 2023 },
  { year: 2022 },
  { year: 2021 },
  { year: 2020 },
];

export const COINS: CoinProduct[] = [
  {
    slug: "american-gold-eagle",
    name: "American Gold Eagle",
    shortName: "Gold Eagle",
    metal: "gold",
    purity: ".9167 fine (22-karat)",
    weight: "1 troy oz",
    diameter: "32.7 mm",
    mintedSince: 1986,
    issuer: "United States Mint",
    iraEligible: true,
    recommended: true,
    description:
      "The American Gold Eagle is the world's most recognized gold bullion coin. Authorized by the Gold Bullion Coin Act of 1985 and first minted in 1986, it is issued by the United States Mint and backed by the U.S. government for its gold content and weight. Despite being .9167 fine (22-karat) rather than .9999, Congress explicitly approved the Gold Eagle for IRA inclusion — making it fully IRA-eligible.",
    whyBullion:
      "Sovereign bullion coins like the American Gold Eagle are preferred over proof coins for long-term investors because their premiums are tied to the metal's value — not collector demand. Proof coins carry 30–100%+ premiums over spot that are rarely recoverable on resale. Bullion coins trade at modest, transparent premiums and are the most liquid gold you can own.",
    reporting: {
      isReportable: false,
      notes:
        "The American Gold Eagle is not subject to IRS Form 1099-B dealer reporting requirements. As U.S. legal tender issued by the United States Mint, Gold Eagles are not on the IRS list of reportable precious metals, regardless of quantity sold. This is one of several advantages American Eagles carry over some foreign bullion coins. Note that you remain personally responsible for reporting any capital gains on your own tax return — the absence of dealer reporting does not affect your individual filing obligations.",
    },
    specs: [
      { label: "Purity", value: ".9167 fine (22-karat)" },
      { label: "Actual Gold Content", value: "1 troy oz" },
      { label: "Total Weight", value: "1.0909 troy oz (alloyed)" },
      { label: "Diameter", value: "32.7 mm" },
      { label: "Thickness", value: "2.87 mm" },
      { label: "Alloy", value: "Gold, silver, copper" },
      { label: "Legal Tender", value: "$50 USD (face value)" },
      { label: "IRA Eligible", value: "Yes (statutory exception)" },
      { label: "Minted Since", value: "1986" },
    ],
    years: GOLD_YEARS,
  },
  {
    slug: "american-gold-buffalo",
    name: "American Gold Buffalo",
    shortName: "Gold Buffalo",
    metal: "gold",
    purity: ".9999 fine (24-karat)",
    weight: "1 troy oz",
    diameter: "32.7 mm",
    mintedSince: 2006,
    issuer: "United States Mint",
    iraEligible: true,
    recommended: true,
    description:
      "The American Gold Buffalo is the United States Mint's first 24-karat (.9999 fine) gold bullion coin, introduced in 2006. It features the iconic Buffalo Nickel design by James Earle Fraser and is one of the purest sovereign gold coins available from any government mint. The Gold Buffalo meets IRS purity standards for IRA inclusion and is widely recognized worldwide.",
    whyBullion:
      "The American Gold Buffalo delivers maximum gold purity in a government-guaranteed coin — without the excessive premiums of proof or commemorative editions. As pure 24-karat gold, every ounce you buy goes entirely into metal. Sovereign bullion coins from trusted mints are the standard for IRA-eligible precious metals holdings because they combine liquidity, recognizability, and fair premiums.",
    reporting: {
      isReportable: false,
      notes:
        "The American Gold Buffalo is not on the IRS list of reportable precious metals. Dealers are not required to file Form 1099-B when you sell Gold Buffalos, regardless of quantity. This makes the Gold Buffalo one of the most private gold coins available for investors who are sensitive to dealer reporting requirements. Note that you remain personally responsible for reporting any capital gains on your tax return — non-reportability to the dealer does not affect your own filing obligations.",
    },
    specs: [
      { label: "Purity", value: ".9999 fine (24-karat)" },
      { label: "Gold Content", value: "1 troy oz" },
      { label: "Diameter", value: "32.7 mm" },
      { label: "Thickness", value: "2.95 mm" },
      { label: "Design (Obverse)", value: "Native American profile (Fraser)" },
      { label: "Design (Reverse)", value: "American Bison (Fraser)" },
      { label: "Legal Tender", value: "$50 USD (face value)" },
      { label: "IRA Eligible", value: "Yes" },
      { label: "Minted Since", value: "2006" },
    ],
    years: GOLD_YEARS,
  },
  {
    slug: "american-silver-eagle",
    name: "American Silver Eagle",
    shortName: "Silver Eagle",
    metal: "silver",
    purity: ".999 fine",
    weight: "1 troy oz",
    diameter: "40.6 mm",
    mintedSince: 1986,
    issuer: "United States Mint",
    iraEligible: true,
    recommended: true,
    description:
      "The American Silver Eagle is the official silver bullion coin of the United States, first issued in 1986 alongside the Gold Eagle program. It contains exactly one troy ounce of .999 fine silver and is the best-selling silver bullion coin in the world. The Silver Eagle features Adolph Weinman's Walking Liberty design on the obverse and is produced by the United States Mint from American-mined silver.",
    whyBullion:
      "Silver Eagles command the widest recognition and the strongest buyback market of any silver coin. When it comes time to sell, dealers know exactly what they are buying. Proof Silver Eagles exist but carry premiums of 50–200% over spot that evaporate in the secondary market. Bullion Silver Eagles trade at modest, fair premiums over spot — keeping more of your money in actual metal.",
    reporting: {
      isReportable: true,
      threshold: "1,000 or more 1 oz coins in a single transaction",
      notes:
        "When you sell 1,000 or more 1 oz American Silver Eagles to a dealer in a single transaction, the dealer is required to file IRS Form 1099-B. This threshold is significantly higher than for gold coins — most individual investors will never trigger this requirement. Transactions below 1,000 oz are not subject to dealer reporting, though you remain responsible for reporting capital gains on your own return.",
    },
    specs: [
      { label: "Purity", value: ".999 fine" },
      { label: "Silver Content", value: "1 troy oz" },
      { label: "Diameter", value: "40.6 mm" },
      { label: "Thickness", value: "2.98 mm" },
      { label: "Design (Obverse)", value: "Walking Liberty (Weinman)" },
      { label: "Design (Reverse)", value: "Heraldic Eagle" },
      { label: "Legal Tender", value: "$1 USD (face value)" },
      { label: "IRA Eligible", value: "Yes" },
      { label: "Minted Since", value: "1986" },
    ],
    years: SILVER_YEARS,
  },
  {
    slug: "canadian-gold-maple-leaf",
    name: "Canadian Gold Maple Leaf",
    shortName: "Gold Maple Leaf",
    metal: "gold",
    purity: ".9999 fine (24-karat)",
    weight: "1 troy oz",
    diameter: "30.0 mm",
    mintedSince: 1979,
    issuer: "Royal Canadian Mint",
    iraEligible: true,
    recommended: false,
    description:
      "The Canadian Gold Maple Leaf has been produced by the Royal Canadian Mint since 1979 and is one of the most widely traded gold bullion coins in the world. At .9999 fine purity — 24-karat gold — it is among the purest sovereign gold coins issued by any government. The iconic maple leaf design is recognized by dealers and investors in every major market worldwide.",
    whyBullion:
      "The Gold Maple Leaf's .9999 purity and global recognition make it one of the most liquid gold coins available. Dealers in North America, Europe, and Asia all buy and sell Maple Leafs at transparent spreads. Its IRA eligibility and deep secondary market liquidity make it a practical choice for long-term investors who prioritize maximum gold purity in a sovereign coin.",
    reporting: {
      isReportable: true,
      threshold: "25 or more 1 oz coins in a single transaction",
      notes:
        "When you sell 25 or more 1 oz Canadian Gold Maple Leafs to a dealer in a single transaction, the dealer is required to file IRS Form 1099-B. This is the same threshold that applies to American Gold Eagles and South African Krugerrands. Transactions below 25 oz are not subject to dealer reporting, though you remain personally responsible for reporting any capital gains on your own tax return.",
    },
    specs: [
      { label: "Purity", value: ".9999 fine (24-karat)" },
      { label: "Gold Content", value: "1 troy oz" },
      { label: "Diameter", value: "30.0 mm" },
      { label: "Thickness", value: "2.87 mm" },
      { label: "Design (Obverse)", value: "Queen Elizabeth II / King Charles III" },
      { label: "Design (Reverse)", value: "Stylized maple leaf" },
      { label: "Legal Tender", value: "50 CAD (face value)" },
      { label: "IRA Eligible", value: "Yes" },
      { label: "Minted Since", value: "1979" },
    ],
    years: GOLD_YEARS,
  },
  {
    slug: "australian-gold-kangaroo",
    name: "Australian Gold Kangaroo",
    shortName: "Gold Kangaroo",
    metal: "gold",
    purity: ".9999 fine (24-karat)",
    weight: "1 troy oz",
    diameter: "32.1 mm",
    mintedSince: 1986,
    issuer: "Perth Mint",
    iraEligible: true,
    recommended: false,
    description:
      "The Australian Gold Kangaroo, produced by the Perth Mint, is Australia's official gold bullion coin and one of the most respected sovereign coins in the world. First issued in 1986 as the Australian Gold Nugget, it was renamed the Kangaroo in 1989 and features a new kangaroo design each year. The Perth Mint is one of the world's most technologically advanced mints and the Kangaroo is recognized worldwide for its exceptional quality and .9999 purity.",
    whyBullion:
      "The Australian Gold Kangaroo offers .9999 pure gold in a government-backed sovereign coin with strong global recognition. Perth Mint's reputation for quality is reflected in the coin's consistently tight premiums over spot and strong dealer buyback market. The annual design change creates collector interest while maintaining bullion pricing for standard investment-grade examples.",
    reporting: {
      isReportable: false,
      notes:
        "The Australian Gold Kangaroo is not on the IRS list of precious metals subject to dealer 1099-B reporting. Dealers are not required to file Form 1099-B when you sell Australian Gold Kangaroos, regardless of quantity. As with all precious metals sales, you remain personally responsible for reporting any capital gains on your own return — the absence of dealer reporting does not change your individual tax obligations.",
    },
    specs: [
      { label: "Purity", value: ".9999 fine (24-karat)" },
      { label: "Gold Content", value: "1 troy oz" },
      { label: "Diameter", value: "32.1 mm" },
      { label: "Thickness", value: "2.65 mm" },
      { label: "Design (Obverse)", value: "King Charles III" },
      { label: "Design (Reverse)", value: "Kangaroo (changes annually)" },
      { label: "Legal Tender", value: "100 AUD (face value)" },
      { label: "IRA Eligible", value: "Yes" },
      { label: "Minted Since", value: "1986" },
    ],
    years: GOLD_YEARS,
  },
  {
    slug: "austrian-gold-philharmonic",
    name: "Austrian Gold Philharmonic",
    shortName: "Gold Philharmonic",
    metal: "gold",
    purity: ".9999 fine (24-karat)",
    weight: "1 troy oz",
    diameter: "37.0 mm",
    mintedSince: 1989,
    issuer: "Austrian Mint",
    iraEligible: true,
    recommended: false,
    description:
      "The Austrian Gold Philharmonic has been produced by the Austrian Mint (Münze Österreich) since 1989 and is Europe's best-selling gold bullion coin. Named in honor of the Vienna Philharmonic Orchestra, the coin features the Great Organ of the Musikverein concert hall on the obverse and various orchestral instruments on the reverse. At .9999 fine gold and denominated in Euros, the Philharmonic is the most popular gold coin in continental Europe.",
    whyBullion:
      "The Gold Philharmonic's size — at 37mm, it is the largest of the major 1 oz gold coins — makes it immediately distinctive. Its European origin and Euro denomination make it particularly liquid in European markets, while its global recognition ensures strong buyback demand worldwide. For U.S. investors, the Philharmonic provides geographic diversification within their gold holdings.",
    reporting: {
      isReportable: false,
      notes:
        "The Austrian Gold Philharmonic is not on the IRS list of precious metals subject to dealer 1099-B reporting. Dealers are not required to file Form 1099-B when you sell Philharmonics, regardless of quantity. This is in contrast to American Gold Eagles, Canadian Maple Leafs, and South African Krugerrands, which are reportable at 25+ oz. You remain personally responsible for reporting capital gains on your own return regardless of dealer reporting obligations.",
    },
    specs: [
      { label: "Purity", value: ".9999 fine (24-karat)" },
      { label: "Gold Content", value: "1 troy oz" },
      { label: "Diameter", value: "37.0 mm" },
      { label: "Thickness", value: "2.00 mm" },
      { label: "Design (Obverse)", value: "Great Organ of the Musikverein" },
      { label: "Design (Reverse)", value: "Vienna Philharmonic instruments" },
      { label: "Legal Tender", value: "100 EUR (face value)" },
      { label: "IRA Eligible", value: "Yes" },
      { label: "Minted Since", value: "1989" },
    ],
    years: GOLD_YEARS,
  },
  {
    slug: "south-african-krugerrand",
    name: "South African Krugerrand",
    shortName: "Krugerrand",
    metal: "gold",
    purity: ".9167 fine (22-karat)",
    weight: "1 troy oz",
    diameter: "32.6 mm",
    mintedSince: 1967,
    issuer: "South African Mint",
    iraEligible: false,
    recommended: false,
    description:
      "The South African Krugerrand, introduced in 1967, was the world's first modern gold bullion coin and is the most widely traded gold coin in history by total volume. Named for President Paul Kruger and the South African rand, it contains exactly one troy ounce of gold alloyed with copper to the same 22-karat standard as the American Gold Eagle. At its peak in the 1970s and 1980s, the Krugerrand accounted for roughly 90% of global gold coin sales.",
    whyBullion:
      "The Krugerrand's historical significance and enormous global supply make it one of the most liquid gold coins in the world. Dealers everywhere recognize it instantly. While it is not IRA-eligible under U.S. tax law (unlike the Gold Eagle, which received a specific statutory exemption), the Krugerrand is an excellent choice for direct purchase — any investor who wants physical gold outside a retirement account benefits from its strong liquidity and modest premiums.",
    reporting: {
      isReportable: true,
      threshold: "25 or more 1 oz coins in a single transaction",
      notes:
        "When you sell 25 or more 1 oz South African Krugerrands to a dealer in a single transaction, the dealer is required to file IRS Form 1099-B. The Krugerrand shares this reporting threshold with the American Gold Eagle and Canadian Gold Maple Leaf. Investors who hold Krugerrands should be aware that large liquidations will generate a 1099-B. Transactions below 25 oz are not reportable by the dealer, though you remain responsible for reporting capital gains on your own return regardless.",
    },
    specs: [
      { label: "Purity", value: ".9167 fine (22-karat)" },
      { label: "Actual Gold Content", value: "1 troy oz" },
      { label: "Total Weight", value: "1.0909 troy oz (alloyed)" },
      { label: "Diameter", value: "32.6 mm" },
      { label: "Thickness", value: "2.84 mm" },
      { label: "Alloy", value: "Gold, copper" },
      { label: "Legal Tender", value: "Yes (South Africa)" },
      { label: "IRA Eligible", value: "No" },
      { label: "Minted Since", value: "1967" },
    ],
    years: GOLD_YEARS,
  },
  {
    slug: "canadian-silver-maple-leaf",
    name: "Canadian Silver Maple Leaf",
    shortName: "Silver Maple Leaf",
    metal: "silver",
    purity: ".9999 fine",
    weight: "1 troy oz",
    diameter: "38.0 mm",
    mintedSince: 1988,
    issuer: "Royal Canadian Mint",
    iraEligible: true,
    recommended: false,
    description:
      "The Canadian Silver Maple Leaf has been produced by the Royal Canadian Mint since 1988 and is one of the best-selling silver bullion coins in the world, second only to the American Silver Eagle. At .9999 fine purity, it is the purest major silver bullion coin available from any government mint. The Maple Leaf design is instantly recognized by dealers worldwide, and the coin's security features — including a radial line background and micro-engraved laser mark — are among the most sophisticated of any bullion coin.",
    whyBullion:
      "The Silver Maple Leaf's .9999 purity exceeds the .999 standard of the American Silver Eagle, making it the purest widely available silver bullion coin. Its global recognition and deep dealer network ensure strong liquidity when you're ready to sell. For IRA investors, the Maple Leaf meets the IRS purity threshold for silver (.999 or better) and is fully eligible for self-directed IRA accounts.",
    reporting: {
      isReportable: true,
      threshold: "1,000 or more 1 oz coins in a single transaction",
      notes:
        "When you sell 1,000 or more 1 oz Canadian Silver Maple Leafs to a dealer in a single transaction, the dealer is required to file IRS Form 1099-B. This is the same threshold that applies to American Silver Eagles. At current silver prices, 1,000 oz represents a significant position — the vast majority of individual investors will never approach this threshold. You remain responsible for reporting capital gains on your own return regardless of whether a 1099-B is filed.",
    },
    specs: [
      { label: "Purity", value: ".9999 fine" },
      { label: "Silver Content", value: "1 troy oz" },
      { label: "Diameter", value: "38.0 mm" },
      { label: "Thickness", value: "3.29 mm" },
      { label: "Design (Obverse)", value: "King Charles III" },
      { label: "Design (Reverse)", value: "Maple leaf with radial lines" },
      { label: "Legal Tender", value: "5 CAD (face value)" },
      { label: "IRA Eligible", value: "Yes" },
      { label: "Minted Since", value: "1988" },
    ],
    years: SILVER_YEARS,
  },
];

export function getCoinBySlug(slug: string): CoinProduct | undefined {
  return COINS.find((c) => c.slug === slug);
}

export const RECOMMENDED_COINS = COINS.filter((c) => c.recommended);
