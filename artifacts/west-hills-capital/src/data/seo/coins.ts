export interface CoinYear {
  year: number;
  notes?: string;
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
  description: string;
  whyBullion: string;
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
    description:
      "The American Gold Eagle is the world's most recognized gold bullion coin. Authorized by the Gold Bullion Coin Act of 1985 and first minted in 1986, it is issued by the United States Mint and backed by the U.S. government for its gold content and weight. Despite being .9167 fine (22-karat) rather than .9999, Congress explicitly approved the Gold Eagle for IRA inclusion — making it fully IRA-eligible.",
    whyBullion:
      "Sovereign bullion coins like the American Gold Eagle are preferred over proof coins for long-term investors because their premiums are tied to the metal's value — not collector demand. Proof coins carry 30–100%+ premiums over spot that are rarely recoverable on resale. Bullion coins trade at modest, transparent premiums and are the most liquid gold you can own.",
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
    description:
      "The American Gold Buffalo is the United States Mint's first 24-karat (.9999 fine) gold bullion coin, introduced in 2006. It features the iconic Buffalo Nickel design by James Earle Fraser and is one of the purest sovereign gold coins available from any government mint. The Gold Buffalo meets IRS purity standards for IRA inclusion and is widely recognized worldwide.",
    whyBullion:
      "The American Gold Buffalo delivers maximum gold purity in a government-guaranteed coin — without the excessive premiums of proof or commemorative editions. As pure 24-karat gold, every ounce you buy goes entirely into metal. Sovereign bullion coins from trusted mints are the standard for IRA-eligible precious metals holdings because they combine liquidity, recognizability, and fair premiums.",
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
    description:
      "The American Silver Eagle is the official silver bullion coin of the United States, first issued in 1986 alongside the Gold Eagle program. It contains exactly one troy ounce of .999 fine silver and is the best-selling silver bullion coin in the world. The Silver Eagle features Adolph Weinman's Walking Liberty design on the obverse and is produced by the United States Mint from American-mined silver.",
    whyBullion:
      "Silver Eagles command the widest recognition and the strongest buyback market of any silver coin. When it comes time to sell, dealers know exactly what they are buying. Proof Silver Eagles exist but carry premiums of 50–200% over spot that evaporate in the secondary market. Bullion Silver Eagles trade at modest, fair premiums over spot — keeping more of your money in actual metal.",
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
];

export function getCoinBySlug(slug: string): CoinProduct | undefined {
  return COINS.find((c) => c.slug === slug);
}
