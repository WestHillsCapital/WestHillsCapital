import type { ProductRow } from "./types";

/**
 * Look up city and state abbreviation for a 5-digit US ZIP code.
 * Returns null if the ZIP is invalid or the lookup fails.
 * Uses the public zippopotam.us API (no key required, CORS-enabled).
 */
export async function lookupZipCity(zip: string): Promise<{ city: string; state: string } | null> {
  if (zip.length !== 5) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) return null;
    return {
      city:  (place["place name"] as string) ?? "",
      state: (place["state abbreviation"] as string) ?? "",
    };
  } catch {
    return null;
  }
}

export function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function parseNum(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function parseQty(s: string): number {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

export const PRODUCT_DEFS: Pick<ProductRow, "productId" | "productName" | "metal">[] = [
  { productId: "gold-american-eagle-1oz",   productName: "1 oz American Gold Eagle",   metal: "gold"   },
  { productId: "gold-american-buffalo-1oz", productName: "1 oz American Gold Buffalo", metal: "gold"   },
  { productId: "silver-american-eagle-1oz", productName: "1 oz American Silver Eagle", metal: "silver" },
];

export const EMPTY_ROWS: ProductRow[] = PRODUCT_DEFS.map((d) => ({
  ...d, qty: "", unitPrice: "",
}));

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];
