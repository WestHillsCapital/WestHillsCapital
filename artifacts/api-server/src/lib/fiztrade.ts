/**
 * Dillon Gage / Fiztrade trade execution.
 *
 * Flow (must complete within 20 seconds):
 *   1. LockPrices  — locks DG wholesale pricing for 20 s
 *   2. ExecuteTrade — places the buy order using the locked price
 *
 * The client-facing invoice always uses the prices entered in the Deal Builder
 * (WHC's retail price = DG wholesale + commission). The DG locked price is
 * only used internally to confirm the wholesale execution.
 */
import { logger } from "./logger";

const DG_BASE_RAW = (process.env.FIZTRADE_BASE_URL ?? "https://connect.fiztrade.com/FizServices").trim();
// Auto-heal: restore https:// if it was stripped via copy-paste in Railway
const DG_BASE = DG_BASE_RAW.startsWith("http")
  ? DG_BASE_RAW
  : `https://${DG_BASE_RAW.replace(/^[^a-zA-Z]+/, "")}`;
const DG_TOKEN = (process.env.DILLON_GAGE_API_KEY ?? "").trim();

/** When true, LockPrices/ExecuteTrade are simulated — no real DG order is placed. */
export const DRY_RUN = process.env.FIZTRADE_DRY_RUN === "true";

logger.info({ dgBase: DG_BASE, rawEnv: DG_BASE_RAW, dryRun: DRY_RUN }, "[Fiztrade] Active API base URL");

// ── WHC product ID → Fiztrade product code ────────────────────────────────────
const DG_CODE: Record<string, string> = {
  "gold-american-eagle-1oz":   "1EAGLE",
  "gold-american-buffalo-1oz": "1B",
  "silver-american-eagle-1oz": "SE",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DGProduct {
  productId: string;
  qty: number;
}

export interface DGShipTo {
  firstName: string;
  lastName:  string;
  address1:  string;
  address2?: string;
  city:      string;
  state:     string;
  zip:       string;
  phone?:    string;
}

export interface DGTradeResult {
  externalTradeId:       string;
  supplierConfirmationId: string;
  rawLockResponse:       unknown;
  rawTradeResponse:      unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function dgPost(endpoint: string, body: unknown): Promise<unknown> {
  if (!DG_TOKEN) throw new Error("DILLON_GAGE_API_KEY is not set");

  const url = `${DG_BASE}/${endpoint}/${DG_TOKEN}`;
  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body:    JSON.stringify(body),
  });

  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = text; }

  if (!res.ok) {
    logger.error({ endpoint, status: res.status, body: json }, "[DG] API error");
    throw new Error(`Fiztrade ${endpoint} failed (${res.status}): ${text.slice(0, 200)}`);
  }

  logger.info({ endpoint, response: json }, "[DG] Raw API response");
  return json;
}

/** Extract a string value from an object, trying multiple field names. */
function pickField(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return "";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * LockPrices then ExecuteTrade in immediate succession.
 * The caller should invoke this as part of the deal-lock flow so the full
 * round-trip completes well within the 20-second pricing window.
 */
export async function lockAndExecuteTrade(
  products: DGProduct[],
  shipTo:   DGShipTo,
): Promise<DGTradeResult> {
  // ── Dry-run short-circuit ────────────────────────────────────────────────────
  // When FIZTRADE_DRY_RUN=true: return a realistic simulated result without
  // calling Dillon Gage. Everything downstream (DB save, PDF, Sheets, email)
  // runs normally so the full production flow is exercised.
  if (DRY_RUN) {
    const fakeTransId  = `DRY-LOCK-${Date.now()}`;
    const fakeConfirmId = `DRY-CONF-${Date.now()}`;
    logger.warn(
      { fakeTransId, fakeConfirmId, products, shipTo: { city: shipTo.city, state: shipTo.state } },
      "[DG DRY RUN] Skipping LockPrices + ExecuteTrade — simulated response returned",
    );
    return {
      externalTradeId:        fakeTransId,
      supplierConfirmationId: fakeConfirmId,
      rawLockResponse:        { dryRun: true, transId: fakeTransId, message: "Simulated LockPrices response" },
      rawTradeResponse:       { dryRun: true, confirmationId: fakeConfirmId, message: "Simulated ExecuteTrade response" },
    };
  }

  // Map WHC product IDs to DG product codes; skip unknown products
  const dgProducts = products
    .filter((p) => DG_CODE[p.productId])
    .map((p) => ({ code: DG_CODE[p.productId], qty: p.qty }));

  if (dgProducts.length === 0) {
    throw new Error("No mappable DG product codes in deal — check product IDs");
  }

  // ── Step 1: LockPrices ──────────────────────────────────────────────────────
  logger.info({ products: dgProducts }, "[DG] Calling LockPrices");
  const lockRaw = await dgPost("LockPrices", dgProducts) as Record<string, unknown>;

  // Extract the lock/transaction ID — try common field names
  const transId = pickField(
    lockRaw,
    "transId", "transactionId", "lockId", "LockId", "TransId", "id", "ID",
  );
  if (!transId) {
    logger.error({ lockRaw }, "[DG] Could not find lock transaction ID in LockPrices response");
    throw new Error("LockPrices succeeded but returned no recognisable transaction ID");
  }
  logger.info({ transId }, "[DG] LockPrices OK — transaction locked");

  // ── Step 2: ExecuteTrade ────────────────────────────────────────────────────
  const tradeBody = {
    transId,
    products: dgProducts,
    firstName: shipTo.firstName,
    lastName:  shipTo.lastName,
    address1:  shipTo.address1,
    address2:  shipTo.address2 ?? "",
    city:      shipTo.city,
    state:     shipTo.state,
    zip:       shipTo.zip,
    phone:     shipTo.phone ?? "",
  };

  logger.info({ transId, shipTo: { city: shipTo.city, state: shipTo.state } }, "[DG] Calling ExecuteTrade");
  const tradeRaw = await dgPost("ExecuteTrade", tradeBody) as Record<string, unknown>;

  // Extract confirmation — try common field names
  const confirmId = pickField(
    tradeRaw,
    "confirmationId", "ConfirmationId", "orderId", "OrderId",
    "tradeId", "TradeId", "id", "ID", "confirmId",
  );

  logger.info({ transId, confirmId }, "[DG] ExecuteTrade OK");

  return {
    externalTradeId:       transId,
    supplierConfirmationId: confirmId || transId,
    rawLockResponse:        lockRaw,
    rawTradeResponse:       tradeRaw,
  };
}
