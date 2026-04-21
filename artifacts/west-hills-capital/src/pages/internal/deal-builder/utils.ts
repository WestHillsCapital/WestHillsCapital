import type { Customer, ProductRow } from "./types";

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

export type DocuFillEntity = {
  id: number;
  name: string;
  active: boolean;
};

export type DocuFillPackage = {
  id: number;
  name: string;
  custodian_id: number | null;
  depository_id: number | null;
  status: string;
  transaction_scope: string;
  version: number;
};

export const DOCUFILL_TRANSACTION_TYPES = [
  { value: "ira_transfer", label: "IRA transfer / rollover" },
  { value: "ira_contribution", label: "IRA contribution" },
  { value: "ira_distribution", label: "IRA distribution" },
  { value: "cash_purchase", label: "Cash purchase" },
  { value: "storage_change", label: "Storage change" },
  { value: "beneficiary_update", label: "Beneficiary update" },
  { value: "liquidation", label: "Liquidation" },
  { value: "buy_sell_direction", label: "Buy / sell direction" },
  { value: "address_change", label: "Address change" },
] as const;

export function getDocuFillTransactionLabel(scope: string | null | undefined) {
  return DOCUFILL_TRANSACTION_TYPES.find((item) => item.value === scope)?.label ?? "IRA transfer / rollover";
}

export function normalizeDocuFillTransactionScope(scope: string | null | undefined) {
  if (DOCUFILL_TRANSACTION_TYPES.some((item) => item.value === scope)) return scope as string;
  const text = String(scope ?? "").toLowerCase();
  if (text.includes("contribution")) return "ira_contribution";
  if (text.includes("distribution")) return "ira_distribution";
  if (text.includes("cash")) return "cash_purchase";
  if (text.includes("storage")) return "storage_change";
  if (text.includes("beneficiary")) return "beneficiary_update";
  if (text.includes("liquidation")) return "liquidation";
  if (text.includes("buy") || text.includes("sell") || text.includes("direction")) return "buy_sell_direction";
  if (text.includes("address")) return "address_change";
  if (text.includes("transfer") || text.includes("rollover") || text.includes("ira")) return "ira_transfer";
  if (/^[a-z0-9_]{2,48}$/.test(String(scope ?? ""))) return String(scope);
  return "ira_transfer";
}

export function resolveDocuFillSelections(
  customer: Pick<Customer, "custodianId" | "custodian" | "depositoryId" | "depository">,
  custodians: DocuFillEntity[],
  depositories: DocuFillEntity[],
) {
  return {
    selectedCustodian: custodians.find((c) => String(c.id) === customer.custodianId)
      ?? custodians.find((c) => c.name === customer.custodian),
    selectedDepository: depositories.find((d) => String(d.id) === customer.depositoryId)
      ?? depositories.find((d) => d.name === customer.depository),
  };
}

export function getMatchingDocuFillPackages(
  packages: DocuFillPackage[],
  selectedCustodian: DocuFillEntity | undefined,
  selectedDepository: DocuFillEntity | undefined,
  transactionScope = "ira_transfer",
) {
  return packages.filter((pkg) => {
    if (pkg.status !== "active") return false;
    if (selectedCustodian && pkg.custodian_id !== selectedCustodian.id) return false;
    if (selectedDepository && pkg.depository_id !== selectedDepository.id) return false;
    if (normalizeDocuFillTransactionScope(pkg.transaction_scope) !== transactionScope) return false;
    return true;
  });
}

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];
