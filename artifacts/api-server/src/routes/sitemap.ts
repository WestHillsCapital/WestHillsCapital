import { Router, type IRouter } from "express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { IRA_ROLLOVERS } from "../../../west-hills-capital/src/data/seo/ira-rollovers";
import { COINS } from "../../../west-hills-capital/src/data/seo/coins";
import { US_STATES } from "../../../west-hills-capital/src/data/seo/states";
import { CUSTODIANS } from "../../../west-hills-capital/src/data/seo/custodians";
import { COMPARISONS } from "../../../west-hills-capital/src/data/seo/comparisons";

const router: IRouter = Router();

const SITE_BASE = "https://westhillscapital.com";
const BUILD_DATE = new Date().toISOString().split("T")[0];

const STATIC_PAGES = [
  { loc: "/",            changefreq: "weekly",  priority: "1.0", lastmod: BUILD_DATE },
  { loc: "/faq",         changefreq: "monthly", priority: "0.8", lastmod: BUILD_DATE },
  { loc: "/about",       changefreq: "monthly", priority: "0.8", lastmod: BUILD_DATE },
  { loc: "/pricing",     changefreq: "daily",   priority: "0.9", lastmod: BUILD_DATE },
  { loc: "/ira",         changefreq: "monthly", priority: "0.8", lastmod: BUILD_DATE },
  { loc: "/schedule",    changefreq: "monthly", priority: "0.9", lastmod: BUILD_DATE },
  { loc: "/insights",    changefreq: "weekly",  priority: "0.8", lastmod: BUILD_DATE },
  { loc: "/disclosures", changefreq: "yearly",  priority: "0.3", lastmod: BUILD_DATE },
  { loc: "/terms",       changefreq: "yearly",  priority: "0.3", lastmod: BUILD_DATE },
  { loc: "/privacy",     changefreq: "yearly",  priority: "0.3", lastmod: BUILD_DATE },
];

const STATIC_INSIGHT_SLUGS = [
  "what-spot-price-really-means",
  "why-people-overpay-for-gold-and-silver",
  "why-free-silver-is-never-free",
  "bullion-vs-proof-coins",
  "what-the-gold-to-silver-ratio-actually-means",
  "when-does-it-actually-make-sense-to-adjust-between-gold-and-silver",
  "why-pricing-everything-in-dollars-can-be-misleading",
  "what-happens-after-you-buy-gold",
  "gold-vs-silver-storage-transport-and-real-world-practicality",
  "gold-ira-what-actually-happens-step-by-step",
  "the-one-question-every-gold-buyer-should-ask",
  "how-to-choose-a-gold-dealer-without-getting-burned",
  "why-we-recommend-only-three-products",
  "why-we-only-carry-three-products",
];

const COIN_YEARS = [2020, 2021, 2022, 2023, 2024, 2025] as const;

type SitemapEntry = { loc: string; changefreq: string; priority: string; lastmod: string };

function buildSeoPages(): SitemapEntry[] {
  const pages: SitemapEntry[] = [];

  for (const rollover of IRA_ROLLOVERS) {
    pages.push({ loc: `/ira/rollover/${rollover.slug}`, changefreq: "monthly", priority: "0.75", lastmod: BUILD_DATE });
  }

  for (const coin of COINS) {
    pages.push({ loc: `/products/${coin.slug}`, changefreq: "monthly", priority: "0.75", lastmod: BUILD_DATE });
    for (const year of COIN_YEARS) {
      pages.push({ loc: `/products/${coin.slug}/${year}`, changefreq: "monthly", priority: "0.65", lastmod: BUILD_DATE });
    }
  }

  for (const state of US_STATES) {
    pages.push({ loc: `/gold-ira/${state.slug}`, changefreq: "monthly", priority: "0.7", lastmod: BUILD_DATE });
  }

  for (const custodian of CUSTODIANS) {
    pages.push({ loc: `/ira/custodians/${custodian.slug}`, changefreq: "monthly", priority: "0.7", lastmod: BUILD_DATE });
  }

  for (const comparison of COMPARISONS) {
    pages.push({ loc: `/learn/${comparison.slug}`, changefreq: "monthly", priority: "0.7", lastmod: BUILD_DATE });
  }

  return pages;
}

router.get("/sitemap.xml", async (_req, res) => {
  const articlePages: SitemapEntry[] = STATIC_INSIGHT_SLUGS.map(
    (slug) => ({ loc: `/insights/${slug}`, changefreq: "yearly", priority: "0.7", lastmod: BUILD_DATE })
  );

  try {
    const db = getDb();
    const { rows } = await db.query<{ slug: string; published_at: string }>(
      `SELECT slug, published_at FROM content_articles WHERE status = 'published' ORDER BY published_at DESC`
    );
    const staticSet = new Set(STATIC_INSIGHT_SLUGS);
    for (const row of rows) {
      if (!staticSet.has(row.slug)) {
        const lastmod = row.published_at
          ? new Date(row.published_at).toISOString().split("T")[0]
          : BUILD_DATE;
        articlePages.push({ loc: `/insights/${row.slug}`, changefreq: "yearly", priority: "0.7", lastmod });
      }
    }
  } catch (err) {
    logger.warn({ err }, "[Sitemap] DB query failed — serving static-only sitemap");
  }

  const seoPages = buildSeoPages();
  const allPages = [...STATIC_PAGES, ...articlePages, ...seoPages];

  const urlEntries = allPages
    .map(
      ({ loc, changefreq, priority, lastmod }) =>
        `  <url>\n    <loc>${SITE_BASE}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n${urlEntries}\n\n</urlset>\n`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

export default router;
