import { createHmac, randomInt, createHash } from "node:crypto";

function esignSecret(): Buffer {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (key) return Buffer.from(key, "hex");
  return Buffer.from("docuplete-esign-dev-only-insecure-fallback", "utf8");
}

/** Generate a 6-digit OTP and its SHA-256 hash. */
export function generateOtp(): { code: string; hash: string } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const hash = createHash("sha256").update(code).digest("hex");
  return { code, hash };
}

/** SHA-256 hash of an OTP code (for verification lookups). */
export function hashOtp(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

/** SHA-256 hex digest of a PDF buffer (for integrity attestation). */
export function hashPdfBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export type EsignIdentityToken = { sessionToken: string; email: string };

/**
 * Create a short-lived HMAC-signed identity token that proves the signer
 * completed email OTP verification for a specific session.
 * Expires in 2 hours.
 */
export function createEsignIdentityToken(sessionToken: string, email: string): string {
  const exp = Date.now() + 2 * 60 * 60 * 1000;
  const payload = Buffer.from(
    JSON.stringify({ s: sessionToken, e: email.toLowerCase().trim(), exp }),
  ).toString("base64url");
  const sig = createHmac("sha256", esignSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/**
 * Verify and decode an identity token.
 * Returns null if the signature is invalid, the token is expired, or
 * the session token doesn't match the expected value.
 */
export function verifyEsignIdentityToken(
  token: string,
  expectedSessionToken: string,
): EsignIdentityToken | null {
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx < 1) return null;
    const payload = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const expectedSig = createHmac("sha256", esignSecret()).update(payload).digest("base64url");
    if (sig !== expectedSig) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      s: string;
      e: string;
      exp: number;
    };
    if (typeof data.s !== "string" || typeof data.e !== "string" || typeof data.exp !== "number") return null;
    if (data.s !== expectedSessionToken) return null;
    if (data.exp < Date.now()) return null;
    return { sessionToken: data.s, email: data.e };
  } catch {
    return null;
  }
}
