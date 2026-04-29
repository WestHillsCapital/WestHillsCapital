/**
 * RFC 3161 Trusted Timestamp Authority client.
 *
 * Builds a minimal DER-encoded TimeStampReq, POSTs it to a TSA endpoint,
 * and returns the raw TimeStampResp bytes for storage.  No heavy ASN.1
 * library required — only the request needs to be encoded; the response
 * is stored as-is for independent verification (openssl ts -verify).
 *
 * Free, no-registration TSA endpoints are tried in order:
 *   1. DigiCert  — http://timestamp.digicert.com       (most reliable)
 *   2. Sectigo   — http://timestamp.sectigo.com
 *   3. FreeTSA   — https://freetsa.org/tsr
 */

import { randomBytes } from "node:crypto";

// ── DER TLV helpers ────────────────────────────────────────────────────────

function derLength(len: number): Buffer {
  if (len < 0x80)    return Buffer.from([len]);
  if (len < 0x100)   return Buffer.from([0x81, len]);
  if (len < 0x10000) return Buffer.from([0x82, len >> 8, len & 0xff]);
  throw new Error(`DER length ${len} too large`);
}

function tlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

const SEQ  = (c: Buffer) => tlv(0x30, c);
const INT  = (c: Buffer) => tlv(0x02, c);
const OSTR = (c: Buffer) => tlv(0x04, c);

function derSmallInt(n: number): Buffer {
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const b = Buffer.from(hex, "hex");
  return INT(b[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), b]) : b);
}

function derNonce(): Buffer {
  const b = randomBytes(8);
  b[0] &= 0x7f; // ensure positive
  return INT(b);
}

// SHA-256 OID: 2.16.840.1.101.3.4.2.1
const SHA256_OID = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);
const NULL_DER   = Buffer.from([0x05, 0x00]);
const TRUE_DER   = Buffer.from([0x01, 0x01, 0xff]);

/**
 * Build a DER-encoded TimeStampReq for the given SHA-256 hex digest.
 */
function buildTsaRequest(sha256Hex: string): Buffer {
  const hashBytes    = Buffer.from(sha256Hex, "hex");
  const algId        = SEQ(Buffer.concat([SHA256_OID, NULL_DER]));
  const msgImprint   = SEQ(Buffer.concat([algId, OSTR(hashBytes)]));
  const version      = derSmallInt(1);
  const nonce        = derNonce();
  // certReq = TRUE — include the TSA signing certificate in the response
  return SEQ(Buffer.concat([version, msgImprint, nonce, TRUE_DER]));
}

// ── TSA response status ────────────────────────────────────────────────────

/**
 * Minimally parse the PKIStatusInfo status integer from a DER TimeStampResp.
 * Returns 0 (granted) or 1 (grantedWithMods) on success; throws otherwise.
 */
function checkTsaStatus(resp: Buffer): void {
  // TimeStampResp ::= SEQUENCE { status PKIStatusInfo, timeStampToken ... }
  // PKIStatusInfo ::= SEQUENCE { status INTEGER, ... }
  // Byte layout (after the outer SEQUENCE TL): inner SEQUENCE TL, then INTEGER TL value
  let offset = 0;
  if (resp[offset++] !== 0x30) throw new Error("TSA: not a SEQUENCE");
  // skip outer length (1 or 2 bytes)
  if (resp[offset] & 0x80) offset += (resp[offset] & 0x7f) + 1;
  else offset++;
  // PKIStatusInfo SEQUENCE
  if (resp[offset++] !== 0x30) throw new Error("TSA: expected PKIStatusInfo SEQUENCE");
  if (resp[offset] & 0x80) offset += (resp[offset] & 0x7f) + 1;
  else offset++;
  // status INTEGER
  if (resp[offset++] !== 0x02) throw new Error("TSA: expected status INTEGER");
  const intLen = resp[offset++];
  let status = 0;
  for (let i = 0; i < intLen; i++) status = (status << 8) | resp[offset + i];
  if (status !== 0 && status !== 1) {
    throw new Error(`TSA: request rejected (PKIStatus=${status})`);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export const TSA_ENDPOINTS = [
  "http://timestamp.digicert.com",
  "http://timestamp.sectigo.com",
  "https://freetsa.org/tsr",
];

export type TsaResult = {
  tokenB64: string;  // base64-encoded raw TimeStampResp DER
  tsaUrl:   string;  // which endpoint responded
};

/**
 * Request an RFC 3161 timestamp for the given SHA-256 hex digest.
 * Tries each endpoint in order; returns the first successful response.
 * Throws if all endpoints fail.
 */
export async function requestTimestamp(sha256Hex: string): Promise<TsaResult> {
  const body = buildTsaRequest(sha256Hex);
  const errors: string[] = [];

  for (const tsaUrl of TSA_ENDPOINTS) {
    try {
      const res = await fetch(tsaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/timestamp-query",
          "Accept":        "application/timestamp-reply",
          "User-Agent":    "Docuplete-TSA/1.0",
        },
        body,
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        errors.push(`${tsaUrl}: HTTP ${res.status}`);
        continue;
      }
      const respBytes = Buffer.from(await res.arrayBuffer());
      checkTsaStatus(respBytes);
      return { tokenB64: respBytes.toString("base64"), tsaUrl };
    } catch (err) {
      errors.push(`${tsaUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`RFC 3161 timestamp failed from all endpoints: ${errors.join("; ")}`);
}
