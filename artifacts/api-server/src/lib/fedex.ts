/**
 * FedEx Locations API — find nearby FedEx Office and Ship Center locations.
 *
 * Auth flow: POST /oauth/token (client_credentials) → bearer token → POST /location/v1/locations
 * Raw API responses are logged at INFO so field names can be verified on first live call.
 */
import { logger } from "./logger";

const FEDEX_BASE = "https://apis.fedex.com";

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

// ── Defensive field-name extraction ──────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchFedExLocations(postalCode: string): Promise<FedExLocation[]> {
  const token = await getFedExToken();

  const requestBody = {
    locationsSummaryRequestControlParameters: { maxOptions: 5 },
    locationSearchCriterion: "ADDRESS",
    location: {
      address: { postalCode, countryCode: "US" },
    },
    sortDetail:    { criterion: "DISTANCE", order: "ASCENDING" },
    locationTypes: ["FEDEX_OFFICE", "SHIP_CENTER"],
  };

  const res = await fetch(`${FEDEX_BASE}/location/v1/locations`, {
    method:  "POST",
    headers: {
      Authorization:    `Bearer ${token}`,
      "Content-Type":   "application/json",
      "X-locale":       "en_US",
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
  logger.info({ postalCode, preview: JSON.stringify(data).slice(0, 800) }, "[FedEx] Raw locations response");

  // The FedEx Location API v1 wraps results in output.locationDetailList
  const output       = pick<Record<string, unknown>>(data, "output") ?? data;
  const detailList   = (pick<unknown[]>(output, "locationDetailList", "locationDetails", "locations") ?? []) as Record<string, unknown>[];

  return detailList.slice(0, 2).map((loc): FedExLocation => {
    // Distance
    const distObj  = pick<Record<string, unknown>>(loc, "distance") ?? {};
    const distVal  = pick<number>(distObj, "value");
    const distUnit = pickStr(distObj, "units") || "MI";
    const distance = distVal !== undefined ? `${Number(distVal).toFixed(1)} ${distUnit}` : "";

    // Location detail block
    const detail    = pick<Record<string, unknown>>(loc, "locationDetail", "detail") ?? loc;
    const name      = pickStr(detail, "locationName", "storeName", "name") ||
                      `FedEx ${pickStr(detail, "locationType")}`;
    const locType   = pickStr(detail, "locationType", "type");

    // Address — try contactAndAddress first, then direct address
    const contactAndAddr = pick<Record<string, unknown>>(detail, "locationContactAndAddress", "contactAndAddress") ?? {};
    const addrFromContact = pick<Record<string, unknown>>(contactAndAddr, "address") ?? {};
    const addrDirect      = pick<Record<string, unknown>>(detail, "address") ?? pick<Record<string, unknown>>(loc, "address") ?? {};
    const addr            = Object.keys(addrFromContact).length ? addrFromContact : addrDirect;

    const streetLines = pick<string[]>(addr, "streetLines", "addressLines") ?? [];
    const street      = streetLines[0] ?? "";
    const city        = pickStr(addr, "city");
    const state       = pickStr(addr, "stateOrProvinceCode", "state", "stateCode");
    const zip         = pickStr(addr, "postalCode", "zip");

    // Phone
    const contact = pick<Record<string, unknown>>(contactAndAddr, "contact") ?? {};
    const phone   = pickStr(contact, "phoneNumber", "phone");

    return { name, locationType: locType, address: street, city, state, zip, distance, phone };
  });
}
