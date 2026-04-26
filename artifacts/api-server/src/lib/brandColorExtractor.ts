/**
 * Brand color extraction from a public URL.
 *
 * Sources (in priority order):
 *   1. <meta name="theme-color"> tag
 *   2. CSS custom properties matching --primary, --brand-*, --accent, --color-primary
 *   3. Dominant non-trivial color from the page favicon (PNG only)
 *
 * Returns up to 5 deduped, valid hex colors.
 * All network calls have a hard 6-second timeout.
 */

import { inflateSync } from "node:zlib";
import { logger } from "./logger";

const FETCH_TIMEOUT_MS = 6_000;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// ── SSRF guard ────────────────────────────────────────────────────────────────
const PRIVATE_PREFIXES = [
  "localhost", "127.", "0.", "::1",
  "10.", "192.168.",
  "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.",
  "172.24.", "172.25.", "172.26.", "172.27.",
  "172.28.", "172.29.", "172.30.", "172.31.",
  "169.254.", // link-local
];

export function isSafeUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return !PRIVATE_PREFIXES.some((p) => host === p.replace(/\.$/, "") || host.startsWith(p));
}

// ── Hex helpers ───────────────────────────────────────────────────────────────
function normalizeHex(value: string): string | null {
  const v = value.trim();
  if (HEX_RE.test(v)) return v.toLowerCase();
  // Expand shorthand #abc → #aabbcc
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  }
  return null;
}

function isTrivialColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Skip near-white and near-black
  if (r > 240 && g > 240 && b > 240) return true;
  if (r < 20 && g < 20 && b < 20) return true;
  // Skip very low-saturation grays (r≈g≈b within ±12)
  const avg = (r + g + b) / 3;
  if (Math.abs(r - avg) < 12 && Math.abs(g - avg) < 12 && Math.abs(b - avg) < 12) return true;
  return false;
}

function dedup(colors: string[]): string[] {
  return [...new Map(colors.map((c) => [c.toLowerCase(), c.toLowerCase()])).values()];
}

// ── Network helpers ───────────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── HTML parsing ──────────────────────────────────────────────────────────────
function extractThemeColor(html: string): string | null {
  const m = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i);
  if (!m) return null;
  return normalizeHex(m[1]);
}

const CSS_VAR_PATTERNS = [
  /--primary\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
  /--brand-?color\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
  /--brand-?primary\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
  /--accent(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
  /--color-primary\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
  /--color-brand\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
];

function extractCssVarColors(html: string): string[] {
  const results: string[] = [];
  for (const pattern of CSS_VAR_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
      const hex = normalizeHex(m[1]);
      if (hex) results.push(hex);
    }
  }
  return results;
}

function extractFaviconUrl(html: string, baseUrl: string): string {
  // Prefer PNG icons, then SVG (skip), fallback to /favicon.ico
  const matchers = [
    /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+\.png[^"']*)["']/i,
    /<link[^>]+href=["']([^"']+\.png[^"']*)["'][^>]+rel=["'](?:icon|shortcut icon)["']/i,
    /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon)["']/i,
  ];
  for (const re of matchers) {
    const m = html.match(re);
    if (m) {
      try {
        return new URL(m[1], baseUrl).href;
      } catch {
        // bad URL, continue
      }
    }
  }
  return new URL("/favicon.ico", baseUrl).href;
}

// ── PNG dominant color ────────────────────────────────────────────────────────
function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function applyFilter(
  type: number,
  raw: Uint8Array,
  prev: Uint8Array | null,
  bpp: number,
): Uint8Array {
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const x = raw[i];
    const a = i >= bpp ? out[i - bpp] : 0;
    const b = prev ? prev[i] : 0;
    const c = i >= bpp && prev ? prev[i - bpp] : 0;
    switch (type) {
      case 0: out[i] = x; break;
      case 1: out[i] = (x + a) & 0xff; break;
      case 2: out[i] = (x + b) & 0xff; break;
      case 3: out[i] = (x + Math.floor((a + b) / 2)) & 0xff; break;
      case 4: out[i] = (x + paethPredictor(a, b, c)) & 0xff; break;
      default: out[i] = x;
    }
  }
  return out;
}

export function pngDominantColor(buffer: Buffer): string | null {
  try {
    // PNG signature: 8 bytes
    if (
      buffer.length < 8
      || buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47
    ) return null;

    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idatBuffers: Buffer[] = [];
    let plte: Buffer | null = null;
    let offset = 8;

    while (offset + 12 <= buffer.length) {
      const chunkLen = buffer.readUInt32BE(offset);
      const type = buffer.toString("ascii", offset + 4, offset + 8);
      const data = buffer.subarray(offset + 8, offset + 8 + chunkLen);
      if (type === "IHDR") {
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        bitDepth = data[8];
        colorType = data[9];
      } else if (type === "PLTE") {
        plte = Buffer.from(data);
      } else if (type === "IDAT") {
        idatBuffers.push(Buffer.from(data));
      } else if (type === "IEND") {
        break;
      }
      offset += 12 + chunkLen;
    }

    if (!width || !height || !idatBuffers.length || bitDepth !== 8) return null;

    // bpp = bytes per pixel
    const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
    const stride = width * bpp;
    const raw = inflateSync(Buffer.concat(idatBuffers));

    const colorCounts = new Map<number, number>();
    let rowStart = 0;
    let prevRow: Uint8Array | null = null;

    for (let y = 0; y < height; y++) {
      const filterByte = raw[rowStart++];
      const scanline = new Uint8Array(raw.buffer, raw.byteOffset + rowStart, stride);
      const filtered = applyFilter(filterByte, scanline, prevRow, bpp);
      prevRow = filtered;
      rowStart += stride;

      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 255;
        const base = x * bpp;
        if (colorType === 6) {
          r = filtered[base]; g = filtered[base + 1]; b = filtered[base + 2]; a = filtered[base + 3];
        } else if (colorType === 2) {
          r = filtered[base]; g = filtered[base + 1]; b = filtered[base + 2];
        } else if (colorType === 3 && plte) {
          const idx = filtered[base];
          r = plte[idx * 3]; g = plte[idx * 3 + 1]; b = plte[idx * 3 + 2];
        } else if (colorType === 4) {
          r = g = b = filtered[base]; a = filtered[base + 1];
        } else {
          r = g = b = filtered[base];
        }
        if (a < 128) continue;
        // Quantize to 5-bit (round to nearest 8) to reduce noise
        r = Math.round(r / 8) * 8;
        g = Math.round(g / 8) * 8;
        b = Math.round(b / 8) * 8;
        // Pack into single integer key
        const key = (r << 16) | (g << 8) | b;
        colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
      }
    }

    if (colorCounts.size === 0) return null;

    // Sort by frequency and skip trivial colors
    const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [key] of sorted) {
      const r = (key >> 16) & 0xff;
      const g = (key >> 8) & 0xff;
      const b = key & 0xff;
      const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      if (!isTrivialColor(hex)) return hex;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function extractBrandColors(rawUrl: string): Promise<string[]> {
  if (!isSafeUrl(rawUrl)) {
    throw new Error("URL must be a public http/https address.");
  }

  const collected: string[] = [];

  try {
    const res = await fetchWithTimeout(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DocuPak-BrandBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Read at most 200 KB of HTML — enough for head section
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    if (reader) {
      while (totalBytes < 200_000) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        totalBytes += value.length;
      }
      reader.cancel();
    }
    const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8", 0, 200_000);

    // 1. meta theme-color
    const themeColor = extractThemeColor(html);
    if (themeColor && !isTrivialColor(themeColor)) collected.push(themeColor);

    // 2. CSS custom property colors
    for (const c of extractCssVarColors(html)) {
      if (!isTrivialColor(c)) collected.push(c);
    }

    // 3. Favicon dominant color
    try {
      const faviconUrl = extractFaviconUrl(html, rawUrl);
      if (isSafeUrl(faviconUrl)) {
        const favRes = await fetchWithTimeout(faviconUrl);
        if (favRes.ok) {
          const favBuf = Buffer.from(await favRes.arrayBuffer());
          const dominant = pngDominantColor(favBuf);
          if (dominant && !isTrivialColor(dominant)) collected.push(dominant);
        }
      }
    } catch {
      // favicon is best-effort, ignore failures
    }
  } catch (err) {
    logger.warn({ err, url: rawUrl }, "[BrandExtractor] Failed to fetch page");
    throw new Error("Could not reach that URL. Check the address and try again.");
  }

  return dedup(collected).slice(0, 5);
}
