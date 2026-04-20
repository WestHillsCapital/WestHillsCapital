import { Router, type IRouter } from "express";
import { getDb } from "../db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SITE_BASE = "https://westhillscapital.com";

const STATIC_PAGES = [
  { loc: "/",            changefreq: "weekly",  priority: "1.0" },
  { loc: "/faq",         changefreq: "monthly", priority: "0.8" },
  { loc: "/about",       changefreq: "monthly", priority: "0.8" },
  { loc: "/pricing",     changefreq: "daily",   priority: "0.9" },
  { loc: "/ira",         changefreq: "monthly", priority: "0.8" },
  { loc: "/schedule",    changefreq: "monthly", priority: "0.9" },
  { loc: "/insights",    changefreq: "weekly",  priority: "0.8" },
  { loc: "/disclosures", changefreq: "yearly",  priority: "0.3" },
  { loc: "/terms",       changefreq: "yearly",  priority: "0.3" },
  { loc: "/privacy",     changefreq: "yearly",  priority: "0.3" },
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

router.get("/sitemap.xml", async (_req, res) => {
  const articlePages: { loc: string; changefreq: string; priority: string }[] = STATIC_INSIGHT_SLUGS.map(
    (slug) => ({ loc: `/insights/${slug}`, changefreq: "yearly", priority: "0.7" })
  );

  try {
    const db = getDb();
    const { rows } = await db.query<{ slug: string }>(
      `SELECT slug FROM content_articles WHERE status = 'published' ORDER BY published_at DESC`
    );
    const staticSet = new Set(STATIC_INSIGHT_SLUGS);
    for (const row of rows) {
      if (!staticSet.has(row.slug)) {
        articlePages.push({ loc: `/insights/${row.slug}`, changefreq: "yearly", priority: "0.7" });
      }
    }
  } catch (err) {
    logger.warn({ err }, "[Sitemap] DB query failed — serving static-only sitemap");
  }

  const allPages = [...STATIC_PAGES, ...articlePages];
  const urlEntries = allPages
    .map(
      ({ loc, changefreq, priority }) =>
        `  <url>\n    <loc>${SITE_BASE}${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n${urlEntries}\n\n</urlset>\n`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

export default router;
