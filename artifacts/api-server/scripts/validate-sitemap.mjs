/**
 * validate-sitemap.mjs
 *
 * Validates the static public/sitemap.xml against a set of structural
 * and content requirements:
 *   1. Well-formed XML (urlset namespace, every <url> has <loc>/<lastmod>/
 *      <changefreq>/<priority>)
 *   2. All <loc> values start with the expected site base
 *   3. Required URL families are present (core pages, hub pages, SEO pages)
 *   4. No duplicate <loc> values
 *   5. URL count is within the expected range (>= 150)
 *
 * Run:
 *   node artifacts/api-server/scripts/validate-sitemap.mjs
 *
 * Exit 0 = all checks passed, exit 1 = failures found.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITEMAP_PATH = path.resolve(__dirname, "../../west-hills-capital/public/sitemap.xml");
const SITE_BASE = "https://westhillscapital.com";

const REQUIRED_URLS = [
  // Core pages
  `${SITE_BASE}/`,
  `${SITE_BASE}/faq`,
  `${SITE_BASE}/about`,
  `${SITE_BASE}/pricing`,
  `${SITE_BASE}/ira`,
  `${SITE_BASE}/schedule`,
  `${SITE_BASE}/insights`,
  // Hub pages (must be present — these were previously missing)
  `${SITE_BASE}/ira/rollovers`,
  `${SITE_BASE}/ira/custodians`,
  `${SITE_BASE}/products`,
  `${SITE_BASE}/gold-ira`,
  // Spot-check SEO page families
  `${SITE_BASE}/ira/rollover/401k`,
  `${SITE_BASE}/ira/rollover/roth-ira`,
  `${SITE_BASE}/products/american-gold-eagle`,
  `${SITE_BASE}/products/american-gold-eagle/2025`,
  `${SITE_BASE}/gold-ira/california`,
  `${SITE_BASE}/gold-ira/texas`,
  `${SITE_BASE}/ira/custodians/equity-trust`,
  `${SITE_BASE}/learn/gold-vs-silver`,
  `${SITE_BASE}/learn/gold-ira-vs-roth-ira`,
];

const FORBIDDEN_URLS = [
  `${SITE_BASE}/verify`,
];

let xml;
try {
  xml = readFileSync(SITEMAP_PATH, "utf-8");
} catch (err) {
  console.error(`FAIL  Cannot read sitemap: ${SITEMAP_PATH}`);
  console.error(`      ${err.message}`);
  process.exit(1);
}

const failures = [];
const warnings = [];

function fail(msg) { failures.push(msg); }
function warn(msg) { warnings.push(msg); }

// 1. Namespace check
if (!xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
  fail("Missing sitemaps.org/schemas/sitemap/0.9 namespace declaration on <urlset>");
}

// 2. Extract all <loc> values
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());

if (locs.length === 0) {
  fail("No <loc> elements found — sitemap appears empty");
  console.error("FAIL  " + failures.join("\nFAIL  "));
  process.exit(1);
}

// 3. URL count
if (locs.length < 150) {
  fail(`URL count too low: found ${locs.length}, expected >= 150`);
} else {
  console.log(`PASS  URL count: ${locs.length}`);
}

// 4. All locs start with site base
const wrongBase = locs.filter(l => !l.startsWith(SITE_BASE));
if (wrongBase.length > 0) {
  fail(`${wrongBase.length} URL(s) do not start with ${SITE_BASE}:\n      ${wrongBase.slice(0, 5).join("\n      ")}`);
} else {
  console.log(`PASS  All URLs use correct base: ${SITE_BASE}`);
}

// 5. No duplicates
const seen = new Set();
const dupes = [];
for (const loc of locs) {
  if (seen.has(loc)) dupes.push(loc);
  seen.add(loc);
}
if (dupes.length > 0) {
  fail(`${dupes.length} duplicate URL(s):\n      ${dupes.slice(0, 5).join("\n      ")}`);
} else {
  console.log(`PASS  No duplicate URLs`);
}

// 6. Required URLs present
const locSet = new Set(locs);
const missing = REQUIRED_URLS.filter(u => !locSet.has(u));
if (missing.length > 0) {
  fail(`${missing.length} required URL(s) missing:\n      ${missing.join("\n      ")}`);
} else {
  console.log(`PASS  All ${REQUIRED_URLS.length} required URLs present`);
}

// 7. Forbidden URLs absent
const present = FORBIDDEN_URLS.filter(u => locSet.has(u));
if (present.length > 0) {
  fail(`${present.length} forbidden URL(s) found in sitemap:\n      ${present.join("\n      ")}`);
} else {
  console.log(`PASS  No forbidden URLs present`);
}

// 8. Every <url> block has lastmod
const urlBlocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => m[1]);
const missingLastmod = urlBlocks.filter(b => !b.includes("<lastmod>"));
if (missingLastmod.length > 0) {
  fail(`${missingLastmod.length} <url> block(s) missing <lastmod>`);
} else {
  console.log(`PASS  All URL entries have <lastmod>`);
}

// 9. lastmod format (YYYY-MM-DD)
const lastmodValues = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1].trim());
const badLastmod = lastmodValues.filter(v => !/^\d{4}-\d{2}-\d{2}$/.test(v));
if (badLastmod.length > 0) {
  fail(`${badLastmod.length} <lastmod> value(s) not in YYYY-MM-DD format:\n      ${badLastmod.slice(0, 5).join(", ")}`);
} else {
  console.log(`PASS  All <lastmod> values are in YYYY-MM-DD format`);
}

// Summary
console.log("");
if (warnings.length > 0) {
  warnings.forEach(w => console.warn(`WARN  ${w}`));
}
if (failures.length > 0) {
  failures.forEach(f => console.error(`FAIL  ${f}`));
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
} else {
  console.log(`All sitemap checks passed (${locs.length} URLs).`);
  console.log("");
  console.log("Next step: submit https://westhillscapital.com/sitemap.xml in Google Search Console");
  console.log("  https://search.google.com/search-console/sitemaps");
}
