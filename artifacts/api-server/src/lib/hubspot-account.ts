/**
 * HubSpot — per-account OAuth integration.
 *
 * Uses HubSpot's OAuth 2.0 flow to store per-account access + refresh tokens.
 * On submission, creates or updates a HubSpot contact with data extracted from
 * the DocuFill session (prefill values + interview answers).
 *
 * Access tokens expire after 30 minutes; the lib retries once with a fresh
 * token on 401 and returns the new token so callers can persist it.
 */

import { logger } from "./logger";

const HUBSPOT_AUTH_BASE  = "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN_URL  = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_API_BASE   = "https://api.hubapi.com";

// ── Config ────────────────────────────────────────────────────────────────────

export function isHubSpotConfigured(): boolean {
  return !!(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET);
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

export function generateHubSpotAuthUrl(state: string, redirectUri: string): string | null {
  if (!isHubSpotConfigured()) return null;
  const params = new URLSearchParams({
    client_id:    process.env.HUBSPOT_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope:        "crm.objects.contacts.write crm.objects.contacts.read",
    state,
  });
  return `${HUBSPOT_AUTH_BASE}?${params.toString()}`;
}

interface HubSpotTokenResponse {
  access_token:  string;
  refresh_token: string;
  hub_id:        number;
  hub_domain:    string;
  expires_in:    number;
}

export interface HubSpotExchangeResult {
  accessToken:  string;
  refreshToken: string;
  hubId:        number;
  hubDomain:    string;
}

export async function exchangeHubSpotCode(code: string, redirectUri: string): Promise<HubSpotExchangeResult> {
  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      redirect_uri:  redirectUri,
      code,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HubSpot token exchange failed: ${errText}`);
  }
  const data = await res.json() as HubSpotTokenResponse;
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    hubId:        data.hub_id,
    hubDomain:    data.hub_domain,
  };
}

export async function refreshHubSpotToken(refreshToken: string): Promise<string> {
  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HubSpot token refresh failed: ${errText}`);
  }
  const data = await res.json() as HubSpotTokenResponse;
  return data.access_token;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function hubspotFetch(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  return { ok: res.ok, status: res.status, data };
}

// ── Contact upsert ────────────────────────────────────────────────────────────

export interface HubSpotContactProperties {
  email?:     string;
  firstname?: string;
  lastname?:  string;
  phone?:     string;
  company?:   string;
  address?:   string;
  city?:      string;
  state?:     string;
  zip?:       string;
  [key: string]: string | undefined;
}

export interface UpsertContactResult {
  contactId:      string;
  created:        boolean;
  newAccessToken?: string;
}

/**
 * Creates or updates a HubSpot contact for the given properties.
 * Looks up by email first; falls back to creating a new record.
 * Retries with a refreshed token on 401 and returns it for the caller to persist.
 */
export async function upsertHubSpotContact(
  accessToken:  string,
  refreshToken: string,
  props:        HubSpotContactProperties,
): Promise<UpsertContactResult> {
  let token = accessToken;
  let newAccessToken: string | undefined;

  async function call(method: string, path: string, body?: unknown) {
    let r = await hubspotFetch(method, path, token, body);
    if (r.status === 401) {
      token = await refreshHubSpotToken(refreshToken);
      newAccessToken = token;
      r = await hubspotFetch(method, path, token, body);
    }
    return r;
  }

  const cleanProps = Object.fromEntries(
    Object.entries(props).filter(([, v]) => v !== undefined && v !== ""),
  );

  // Search by email when available
  if (props.email) {
    const search = await call("POST", "/crm/v3/objects/contacts/search", {
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: props.email }] }],
      properties: ["email"],
      limit: 1,
    });
    if (search.ok) {
      const { results } = search.data as { results?: Array<{ id: string }> };
      if (results && results.length > 0) {
        const contactId = results[0].id;
        await call("PATCH", `/crm/v3/objects/contacts/${contactId}`, { properties: cleanProps });
        logger.info({ contactId }, "[HubSpot] Updated existing contact");
        return { contactId, created: false, newAccessToken };
      }
    }
  }

  // Create new contact
  const create = await call("POST", "/crm/v3/objects/contacts", { properties: cleanProps });
  if (!create.ok) {
    const errData = create.data as { message?: string; id?: string };
    if (create.status === 409 && errData.id) {
      logger.info({ contactId: errData.id }, "[HubSpot] Contact conflict, using existing");
      return { contactId: errData.id, created: false, newAccessToken };
    }
    throw new Error(`HubSpot contact creation failed (${create.status}): ${errData.message ?? "unknown"}`);
  }
  const created = create.data as { id: string };
  logger.info({ contactId: created.id }, "[HubSpot] Created new contact");
  return { contactId: created.id, created: true, newAccessToken };
}

// ── Field extraction ──────────────────────────────────────────────────────────

/**
 * Source keys from the Docuplete shared field library that map to standard
 * HubSpot contact properties. Source key is checked first; label-based fuzzy
 * matching is used as a fallback for fields that have no source key or whose
 * source key is not in this map.
 */
export const SOURCE_KEY_TO_HUBSPOT: Record<string, keyof HubSpotContactProperties> = {
  email:        "email",
  phone:        "phone",
  mobilePhone:  "phone",
  firstName:    "firstname",
  lastName:     "lastname",
  company:      "company",
  employer:     "company",
  businessName: "company",
  city:         "city",
  state:        "state",
  zip:          "zip",
  addressLine1: "address",
};

/**
 * Source keys that carry a full name (first + last combined). When matched,
 * the value is split on the first space and mapped to firstname + lastname
 * unless those slots are already filled.
 */
const FULL_NAME_SOURCE_KEYS = new Set(["fullName", "clientName", "signerName", "name"]);

/**
 * Derives HubSpot contact properties from a DocuFill session's prefill
 * values and interview answers.
 *
 * Priority order for each property:
 *   1. Prefill semantic keys (firstName, lastName, email, phone)
 *   2. Interview answer matched by field Source Key (library field mapping)
 *   3. Interview answer matched by field label (fuzzy fallback)
 */
export function extractHubSpotProperties(
  prefill:  Record<string, unknown>,
  fields:   Array<{ id: string; label: string; source?: string; type?: string }>,
  answers:  Record<string, unknown>,
): HubSpotContactProperties {
  const props: HubSpotContactProperties = {};

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  // 1. Prefill semantic keys
  if (str(prefill.firstName)) props.firstname = str(prefill.firstName);
  if (str(prefill.lastName))  props.lastname  = str(prefill.lastName);
  if (str(prefill.email))     props.email     = str(prefill.email);
  if (str(prefill.phone))     props.phone     = str(prefill.phone);

  // 2. Source-key mapping (primary — uses the shared field library's source attribute)
  for (const field of fields) {
    const source = str(field.source);
    const val    = str(answers[field.id]);
    if (!source || !val) continue;

    if (FULL_NAME_SOURCE_KEYS.has(source)) {
      if (!props.firstname || !props.lastname) {
        const spaceIdx = val.indexOf(" ");
        if (spaceIdx > 0) {
          if (!props.firstname) props.firstname = val.slice(0, spaceIdx);
          if (!props.lastname)  props.lastname  = val.slice(spaceIdx + 1).trim();
        } else {
          if (!props.firstname) props.firstname = val;
        }
      }
      continue;
    }

    const hubspotProp = SOURCE_KEY_TO_HUBSPOT[source];
    if (hubspotProp && !props[hubspotProp]) {
      props[hubspotProp] = val;
    }
  }

  // 3. Label-based fuzzy fallback (for fields with no recognised source key)
  for (const field of fields) {
    const source = str(field.source);
    if (source && (FULL_NAME_SOURCE_KEYS.has(source) || SOURCE_KEY_TO_HUBSPOT[source])) continue;

    const label = field.label.toLowerCase();
    const val   = str(answers[field.id]);
    if (!val) continue;

    if (!props.email    && (label.includes("email") || label.includes("e-mail")))                                                     props.email    = val;
    if (!props.phone    && (label.includes("phone") || label.includes("mobile") || label.includes("cell") || label.includes("tel")))   props.phone    = val;
    if (!props.company  && (label.includes("company") || label.includes("employer") || label.includes("business") || label.includes("firm"))) props.company = val;
    if (!props.firstname && (label === "first name" || label.endsWith(" first name") || label.startsWith("first name")))               props.firstname = val;
    if (!props.lastname  && (label === "last name"  || label.endsWith(" last name")  || label.startsWith("last name")))                props.lastname  = val;
  }

  return props;
}
