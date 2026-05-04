export interface UsState {
  slug: string;
  name: string;
  abbr: string;
  region: "Northeast" | "Southeast" | "Midwest" | "Southwest" | "West";
  capitalGainsTax?: boolean;
  salesTaxOnGold?: boolean;
  taxNote?: string;
}

export const US_STATES: UsState[] = [
  { slug: "alabama", name: "Alabama", abbr: "AL", region: "Southeast", salesTaxOnGold: false, taxNote: "Alabama exempts gold and silver bullion from state sales tax." },
  { slug: "alaska", name: "Alaska", abbr: "AK", region: "West", salesTaxOnGold: false, taxNote: "Alaska has no state sales tax, so bullion purchases are not subject to state sales tax." },
  { slug: "arizona", name: "Arizona", abbr: "AZ", region: "Southwest", salesTaxOnGold: false, taxNote: "Arizona exempts gold and silver bullion from state sales tax." },
  { slug: "arkansas", name: "Arkansas", abbr: "AR", region: "Southeast", salesTaxOnGold: false },
  { slug: "california", name: "California", abbr: "CA", region: "West", salesTaxOnGold: true, taxNote: "California exempts bullion purchases over $1,500 from state sales tax; smaller purchases may be taxable." },
  { slug: "colorado", name: "Colorado", abbr: "CO", region: "West", salesTaxOnGold: false, taxNote: "Colorado exempts gold and silver bullion from state sales tax." },
  { slug: "connecticut", name: "Connecticut", abbr: "CT", region: "Northeast", salesTaxOnGold: false },
  { slug: "delaware", name: "Delaware", abbr: "DE", region: "Northeast", salesTaxOnGold: false, taxNote: "Delaware has no state sales tax." },
  { slug: "florida", name: "Florida", abbr: "FL", region: "Southeast", salesTaxOnGold: false, taxNote: "Florida exempts gold and silver bullion from state sales tax." },
  { slug: "georgia", name: "Georgia", abbr: "GA", region: "Southeast", salesTaxOnGold: false },
  { slug: "hawaii", name: "Hawaii", abbr: "HI", region: "West", salesTaxOnGold: true },
  { slug: "idaho", name: "Idaho", abbr: "ID", region: "West", salesTaxOnGold: false },
  { slug: "illinois", name: "Illinois", abbr: "IL", region: "Midwest", salesTaxOnGold: false, taxNote: "Illinois exempts gold and silver bullion from state sales tax." },
  { slug: "indiana", name: "Indiana", abbr: "IN", region: "Midwest", salesTaxOnGold: false },
  { slug: "iowa", name: "Iowa", abbr: "IA", region: "Midwest", salesTaxOnGold: false },
  { slug: "kansas", name: "Kansas", abbr: "KS", region: "Midwest", salesTaxOnGold: false },
  { slug: "kentucky", name: "Kentucky", abbr: "KY", region: "Southeast", salesTaxOnGold: false },
  { slug: "louisiana", name: "Louisiana", abbr: "LA", region: "Southeast", salesTaxOnGold: false },
  { slug: "maine", name: "Maine", abbr: "ME", region: "Northeast", salesTaxOnGold: false },
  { slug: "maryland", name: "Maryland", abbr: "MD", region: "Northeast", salesTaxOnGold: false },
  { slug: "massachusetts", name: "Massachusetts", abbr: "MA", region: "Northeast", salesTaxOnGold: false, taxNote: "Massachusetts exempts investment-grade bullion from sales tax." },
  { slug: "michigan", name: "Michigan", abbr: "MI", region: "Midwest", salesTaxOnGold: false },
  { slug: "minnesota", name: "Minnesota", abbr: "MN", region: "Midwest", salesTaxOnGold: false, taxNote: "Minnesota exempts gold and silver bullion from state sales tax." },
  { slug: "mississippi", name: "Mississippi", abbr: "MS", region: "Southeast", salesTaxOnGold: true },
  { slug: "missouri", name: "Missouri", abbr: "MO", region: "Midwest", salesTaxOnGold: false },
  { slug: "montana", name: "Montana", abbr: "MT", region: "West", salesTaxOnGold: false, taxNote: "Montana has no state sales tax." },
  { slug: "nebraska", name: "Nebraska", abbr: "NE", region: "Midwest", salesTaxOnGold: false },
  { slug: "nevada", name: "Nevada", abbr: "NV", region: "West", salesTaxOnGold: false, taxNote: "Nevada exempts precious metals bullion from sales tax." },
  { slug: "new-hampshire", name: "New Hampshire", abbr: "NH", region: "Northeast", salesTaxOnGold: false, taxNote: "New Hampshire has no state sales tax." },
  { slug: "new-jersey", name: "New Jersey", abbr: "NJ", region: "Northeast", salesTaxOnGold: false },
  { slug: "new-mexico", name: "New Mexico", abbr: "NM", region: "Southwest", salesTaxOnGold: false },
  { slug: "new-york", name: "New York", abbr: "NY", region: "Northeast", salesTaxOnGold: false, taxNote: "New York exempts investment bullion from state sales tax." },
  { slug: "north-carolina", name: "North Carolina", abbr: "NC", region: "Southeast", salesTaxOnGold: false },
  { slug: "north-dakota", name: "North Dakota", abbr: "ND", region: "Midwest", salesTaxOnGold: false },
  { slug: "ohio", name: "Ohio", abbr: "OH", region: "Midwest", salesTaxOnGold: false },
  { slug: "oklahoma", name: "Oklahoma", abbr: "OK", region: "Southwest", salesTaxOnGold: false },
  { slug: "oregon", name: "Oregon", abbr: "OR", region: "West", salesTaxOnGold: false, taxNote: "Oregon has no state sales tax." },
  { slug: "pennsylvania", name: "Pennsylvania", abbr: "PA", region: "Northeast", salesTaxOnGold: false, taxNote: "Pennsylvania exempts gold and silver bullion from sales tax." },
  { slug: "rhode-island", name: "Rhode Island", abbr: "RI", region: "Northeast", salesTaxOnGold: false },
  { slug: "south-carolina", name: "South Carolina", abbr: "SC", region: "Southeast", salesTaxOnGold: false },
  { slug: "south-dakota", name: "South Dakota", abbr: "SD", region: "Midwest", salesTaxOnGold: false, taxNote: "South Dakota exempts precious metals bullion from sales tax." },
  { slug: "tennessee", name: "Tennessee", abbr: "TN", region: "Southeast", salesTaxOnGold: false },
  { slug: "texas", name: "Texas", abbr: "TX", region: "Southwest", salesTaxOnGold: false, taxNote: "Texas exempts gold and silver bullion from state sales tax, and hosts the Texas Bullion Depository." },
  { slug: "utah", name: "Utah", abbr: "UT", region: "West", salesTaxOnGold: false, taxNote: "Utah recognizes gold and silver as legal tender and exempts bullion from sales tax." },
  { slug: "vermont", name: "Vermont", abbr: "VT", region: "Northeast", salesTaxOnGold: false },
  { slug: "virginia", name: "Virginia", abbr: "VA", region: "Southeast", salesTaxOnGold: false },
  { slug: "washington", name: "Washington", abbr: "WA", region: "West", salesTaxOnGold: false, taxNote: "Washington exempts precious metals bullion from state sales tax." },
  { slug: "west-virginia", name: "West Virginia", abbr: "WV", region: "Southeast", salesTaxOnGold: false },
  { slug: "wisconsin", name: "Wisconsin", abbr: "WI", region: "Midwest", salesTaxOnGold: false },
  { slug: "wyoming", name: "Wyoming", abbr: "WY", region: "West", salesTaxOnGold: false, taxNote: "Wyoming has no state income tax and exempts gold and silver bullion from sales tax." },
];

export function getStateBySlug(slug: string): UsState | undefined {
  return US_STATES.find((s) => s.slug === slug);
}
