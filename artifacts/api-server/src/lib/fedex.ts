/**
 * FedEx Locations API — find nearby FedEx Office and Ship Center locations
 * that support Hold at Location (staffed FedEx employees only).
 *
 * Auth flow: POST /oauth/token (client_credentials) → bearer token → POST /location/v1/locations
 * Sandbox mode: set FEDEX_BASE_URL=https://apis-sandbox.fedex.com
 */
import { logger } from "./logger";

// Default to production; override with FEDEX_BASE_URL=https://apis-sandbox.fedex.com
// in dev/staging environments that use sandbox credentials.
// .trim() guards against copy-paste artifacts (leading/trailing whitespace or '=').
const FEDEX_BASE_RAW = (process.env.FEDEX_BASE_URL ?? "https://apis.fedex.com").trim();
// Ensure the value is a valid absolute URL — fail loudly at startup rather than
// producing a cryptic "Invalid URL" error on the first request.
const FEDEX_BASE = FEDEX_BASE_RAW.startsWith("http")
  ? FEDEX_BASE_RAW
  : `https://${FEDEX_BASE_RAW.replace(/^[^a-zA-Z]+/, "")}`;
const isSandbox  = FEDEX_BASE.includes("sandbox");

logger.info({ fedexBase: FEDEX_BASE, isSandbox, rawEnv: FEDEX_BASE_RAW }, "[FedEx] Configured endpoint");

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
 * Build the prioritised list of candidate address objects from a
 * locationDetail entry, handling all observed FedEx API v1 schemas.
 */
function addressCandidates(detail: Record<string, unknown>): Record<string, unknown>[] {
  const list: Record<string, unknown>[] = [];

  // 1. locationContactAndAddress.address  (production — most common)
  const lca = pick<Record<string, unknown>>(detail,
    "locationContactAndAddress", "contactAndAddress");
  if (lca) {
    const a = pick<Record<string, unknown>>(lca, "address", "physicalAddress");
    if (a) list.push(a);
  }

  // 2. physicalAddress or address directly on detail
  const pa = pick<Record<string, unknown>>(detail, "physicalAddress", "address");
  if (pa && typeof pa === "object" && !Array.isArray(pa)) list.push(pa);

  // 3. storeAddress / locationAddress (some sandbox versions)
  const sa = pick<Record<string, unknown>>(detail, "storeAddress", "locationAddress");
  if (sa) list.push(sa);

  // 4. Flat fields directly on detail (alternate sandbox schema)
  list.push(detail);

  return list;
}

function parseStreet(addr: Record<string, unknown>): string {
  const raw = pick<unknown>(addr, "streetLines", "addressLines");
  if (Array.isArray(raw) && raw.length > 0) return String(raw[0]);
  if (typeof raw === "string" && raw) return raw;
  return "";
}

/**
 * Extract the FedEx store's physical address from a locationDetail object.
 * Tries every known field-name variant from the FedEx Location v1 API.
 *
 * Returns { street, city, state, zip } on success. street may be empty when
 * only city/state/zip are available (partial result). Returns null only when
 * no address data whatsoever can be found.
 */
function extractStoreAddress(detail: Record<string, unknown>): {
  street: string; city: string; state: string; zip: string;
} | null {
  const candidates = addressCandidates(detail);

  // Pass 1: full address (street + city required)
  for (const addr of candidates) {
    const street = parseStreet(addr);
    const city   = pickStr(addr, "city");
    const state  = pickStr(addr, "stateOrProvinceCode", "stateCode", "state");
    const zip    = pickStr(addr, "postalCode", "zipCode", "zip");
    if (street && city) return { street, city, state, zip };
  }

  // Pass 2: partial address (city alone is enough to be useful)
  for (const addr of candidates) {
    const city  = pickStr(addr, "city");
    const state = pickStr(addr, "stateOrProvinceCode", "stateCode", "state");
    const zip   = pickStr(addr, "postalCode", "zipCode", "zip");
    if (city) return { street: "", city, state, zip };
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchFedExLocations(postalCode: string): Promise<FedExLocation[]> {
  const token = await getFedExToken();

  // Sandbox only has FEDEX_SELF_SERVICE_LOCATION (drop boxes) inventory —
  // skip locationTypes filter so we get any results at all.
  // Production narrows to staffed Hold-at-Location facilities only.
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

  logger.info(
    { postalCode, fedexBase: FEDEX_BASE, isSandbox, body: requestBody },
    "[FedEx] Sending locations request",
  );

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
    logger.error(
      { status: res.status, body: text, fedexBase: FEDEX_BASE },
      "[FedEx] Locations request failed",
    );
    throw new Error(`FedEx Locations API: HTTP ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;

  // Debug-only: full raw response for schema troubleshooting.
  // Enable by setting LOG_LEVEL=debug in the environment.
  logger.debug({ postalCode, rawResponse: data }, "[FedEx] Full raw locations response");

  // Diagnostic log: top-level response shape without the full payload
  const output     = pick<Record<string, unknown>>(data, "output") ?? data;
  const detailList = (
    pick<unknown[]>(output, "locationDetailList", "locationDetails", "locations") ?? []
  ) as Record<string, unknown>[];

  logger.info(
    {
      postalCode,
      topLevelKeys:  Object.keys(data),
      outputKeys:    Object.keys(output),
      listKey:       Object.keys(output).find(k =>
        ["locationDetailList", "locationDetails", "locations"].includes(k)) ?? "none",
      listLength:    detailList.length,
      firstItemKeys: detailList[0] ? Object.keys(detailList[0]) : [],
    },
    "[FedEx] Locations response parsed",
  );

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

    // Name — try multiple aliases; last resort is a generic label
    const ancillary = pick<Record<string, unknown>>(
      pick<Record<string, unknown>>(loc, "contactAndAddress") ?? {},
      "addressAncillaryDetail",
    ) ?? {};
    const name    = pickStr(detail, "locationName", "storeName", "name") ||
                    pickStr(ancillary, "displayName") ||
                    pickStr(loc, "locationType", "type").replace(/_/g, " ") ||
                    "FedEx Location";
    const locType = pickStr(detail, "locationType", "type") ||
                    pickStr(loc, "locationType", "type");

    // Extract address — strict parser first
    const addr = extractStoreAddress(detail);

    // Phone
    const lca     = pick<Record<string, unknown>>(detail,
      "locationContactAndAddress", "contactAndAddress") ?? {};
    const contact = pick<Record<string, unknown>>(lca, "contact") ?? {};
    const phone   = pickStr(contact, "phoneNumber", "phone");

    if (addr) {
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
    } else {
      // Graceful degradation: no address data found anywhere in this entry.
      // Include the location by name + distance so the user can still select
      // it and type the address manually, rather than hiding it entirely.
      // Set LOG_LEVEL=debug to see the full raw entry for schema troubleshooting.
      logger.warn(
        {
          name,
          locType,
          detailKeys:  Object.keys(detail),
          locKeys:     Object.keys(loc),
        },
        "[FedEx] No address found in location entry — included with empty address fields",
      );
      results.push({
        name,
        locationType: locType,
        address:      "",
        city:         "",
        state:        "",
        zip:          "",
        distance,
        phone,
      });
    }
  }

  logger.info(
    { postalCode, resultCount: results.length },
    "[FedEx] Returning locations",
  );

  return results;
}
