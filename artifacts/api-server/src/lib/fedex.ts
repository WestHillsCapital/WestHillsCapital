/**
 * FedEx Locations API — find nearby FedEx Office and Ship Center locations
 * that support Hold at Location (staffed FedEx employees only).
 *
 * Auth flow: POST /oauth/token (client_credentials) → bearer token → POST /location/v1/locations
 * Full raw API responses are logged at DEBUG so field names can be verified.
 */
import { logger } from "./logger";

// Default to production; override with FEDEX_BASE_URL=https://apis-sandbox.fedex.com
// in dev/staging environments that use sandbox credentials.
const FEDEX_BASE = process.env.FEDEX_BASE_URL ?? "https://apis.fedex.com";

// ── Token ─────────────────────────────────────────────────────────────────────

async function getFedExToken(): Promise<string> {
  const clientId     = process.env.FEDEX_CLIENT_ID;
  const clientSecret = process.env.FEDEX_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("FEDEX_CLIENT_ID / FEDEX_CLIENT_SECRET not configured");
  }

  const res = await fetch(`${FEDEX_BASE}/oauth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, "[FedEx] OAuth token failed");
    throw new Error(`FedEx auth failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FedExLocation {
  name:         string;
  locationType: string;
  address:      string;
  city:         string;
  state:        string;
  zip:          string;
  distance:     string;
  phone:        string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick<T>(obj: unknown, ...keys: string[]): T | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

function pickStr(obj: unknown, ...keys: string[]): string {
  return String(pick<unknown>(obj, ...keys) ?? "");
}

/**
 * Extract the FedEx store's physical address from a locationDetail object.
 * Tries every known field-name variant from the FedEx Location v1 API.
 * Returns null if no usable address can be found so callers don't accidentally
 * fall back to the searched/customer address.
 */
function extractStoreAddress(detail: Record<string, unknown>): {
  street: string; city: string; state: string; zip: string;
} | null {
  // Candidates in priority order — all observed in FedEx API v1 responses
  const candidates: Record<string, unknown>[] = [];

  // 1. locationContactAndAddress.address  (most common)
  const lca = pick<Record<string, unknown>>(detail,
    "locationContactAndAddress", "contactAndAddress");
  if (lca) {
    const a = pick<Record<string, unknown>>(lca, "address", "physicalAddress");
    if (a) candidates.push(a);
  }

  // 2. physicalAddress directly on detail
  const pa = pick<Record<string, unknown>>(detail, "physicalAddress", "address");
  if (pa) candidates.push(pa);

  // 3. storeAddress (some sandbox versions)
  const sa = pick<Record<string, unknown>>(detail, "storeAddress", "locationAddress");
  if (sa) candidates.push(sa);

  for (const addr of candidates) {
    const streetLines = pick<string[]>(addr, "streetLines", "addressLines") ?? [];
    const street = (Array.isArray(streetLines) ? streetLines[0] : "") ?? "";
    const city   = pickStr(addr, "city");
    const state  = pickStr(addr, "stateOrProvinceCode", "stateCode", "state");
    const zip    = pickStr(addr, "postalCode", "zipCode", "zip");

    // Only accept if we have at least street + city — otherwise skip this candidate
    if (street && city) {
      return { street, city, state, zip };
    }
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchFedExLocations(postalCode: string): Promise<FedExLocation[]> {
  const token = await getFedExToken();

  // FedEx sandbox only has drop-box (FEDEX_SELF_SERVICE_LOCATION) inventory,
  // so locationTypes filter is skipped in sandbox mode to get any results.
  // Production narrows to staffed Hold-at-Location facilities only.
  const isSandbox = FEDEX_BASE.includes("sandbox");

  const requestBody = {
    locationsSummaryRequestControlParameters: { maxOptions: 10 },
    locationSearchCriterion: "ADDRESS",
    location: {
      address: { postalCode, countryCode: "US" },
    },
    sortDetail: { criterion: "DISTANCE", order: "ASCENDING" },
    storeServiceTypes: ["HOLD_AT_LOCATION"],
    ...(isSandbox ? {} : { locationTypes: ["FEDEX_OFFICE", "FEDEX_SHIP_CENTER"] }),
  };

  const res = await fetch(`${FEDEX_BASE}/location/v1/locations`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-locale":     "en_US",
      "X-Customer-Transaction-Id": `whc-${Date.now()}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, "[FedEx] Locations request failed");
    throw new Error(`FedEx Locations API: HTTP ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;

  // Log the FULL raw response so field names can be verified in Railway logs
  logger.info({ postalCode, rawResponse: JSON.stringify(data) }, "[FedEx] Full locations response");

  const output     = pick<Record<string, unknown>>(data, "output") ?? data;
  const detailList = (
    pick<unknown[]>(output, "locationDetailList", "locationDetails", "locations") ?? []
  ) as Record<string, unknown>[];

  const results: FedExLocation[] = [];

  for (const loc of detailList) {
    if (results.length >= 3) break;

    // Distance
    const distObj  = pick<Record<string, unknown>>(loc, "distance") ?? {};
    const distVal  = pick<number>(distObj, "value");
    const distUnit = pickStr(distObj, "units") || "MI";
    const distance = distVal !== undefined ? `${Number(distVal).toFixed(1)} ${distUnit}` : "";

    // Production wraps data in a "locationDetail" block; sandbox puts it directly
    // on the list item. Fall back to `loc` itself so sandbox results parse correctly.
    const detail = pick<Record<string, unknown>>(loc, "locationDetail", "detail") ?? loc;

    // Name: try locationDetail fields first, then addressAncillaryDetail.displayName
    // (sandbox uses the latter)
    const ancillary = pick<Record<string, unknown>>(
      pick<Record<string, unknown>>(loc, "contactAndAddress") ?? {},
      "addressAncillaryDetail",
    ) ?? {};
    const name    = pickStr(detail, "locationName", "storeName", "name") ||
                    pickStr(ancillary, "displayName") ||
                    `FedEx ${pickStr(detail, "locationType")}`;
    const locType = pickStr(detail, "locationType", "type") ||
                    pickStr(ancillary, "displayName");

    // Extract the store's physical address — strict, no fallback to customer address
    const addr = extractStoreAddress(detail);
    if (!addr) {
      logger.warn({ name, detail: JSON.stringify(detail).slice(0, 600) },
        "[FedEx] Could not parse store address — skipping location");
      continue;
    }

    // Phone
    const lca     = pick<Record<string, unknown>>(detail, "locationContactAndAddress", "contactAndAddress") ?? {};
    const contact = pick<Record<string, unknown>>(lca, "contact") ?? {};
    const phone   = pickStr(contact, "phoneNumber", "phone");

    results.push({
      name,
      locationType: locType,
      address:      addr.street,
      city:         addr.city,
      state:        addr.state,
      zip:          addr.zip,
      distance,
      phone,
    });
  }

  return results;
}
