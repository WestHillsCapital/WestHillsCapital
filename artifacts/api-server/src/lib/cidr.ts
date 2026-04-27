/**
 * Minimal IPv4 CIDR matching library.
 * No external dependencies — pure bit arithmetic.
 *
 * Designed to be extended for IPv6 when the e-sign audit trail
 * or enterprise IP-restriction feature requires it.
 */

/** Convert a dotted-decimal IPv4 string to a 32-bit unsigned integer. */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let val = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    val = (val << 8) | n;
  }
  return val >>> 0;
}

/**
 * Returns true if `ip` falls within `cidr`.
 *
 * Accepts:
 *   - CIDR notation:  "192.168.1.0/24"
 *   - Single address: "10.0.0.5" (treated as /32)
 *
 * IPv6 addresses and malformed inputs always return false without throwing.
 */
export function ipMatchesCidr(ip: string, cidr: string): boolean {
  try {
    // Strip port if present (e.g. "1.2.3.4:5678" from X-Forwarded-For)
    const cleanIp = ip.split(":")[0] ?? ip;

    const [cidrAddr, prefix] = cidr.includes("/")
      ? cidr.split("/")
      : [cidr, "32"];

    const prefixLen = parseInt(prefix ?? "32", 10);
    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;

    const ipInt   = ipv4ToInt(cleanIp);
    const netInt  = ipv4ToInt(cidrAddr ?? "");
    if (ipInt === null || netInt === null) return false;

    if (prefixLen === 0) return true;   // 0.0.0.0/0 matches everything
    if (prefixLen === 32) return ipInt === netInt;

    const mask = (~0 << (32 - prefixLen)) >>> 0;
    return (ipInt & mask) >>> 0 === (netInt & mask) >>> 0;
  } catch {
    return false;
  }
}

/**
 * Returns true if `ip` matches any entry in `allowedRanges`.
 * Returns true (allow) when `allowedRanges` is empty — empty list means
 * "no IP restriction configured".
 */
export function isIpAllowed(ip: string, allowedRanges: string[]): boolean {
  if (!allowedRanges.length) return true;
  return allowedRanges.some((cidr) => ipMatchesCidr(ip, cidr));
}
