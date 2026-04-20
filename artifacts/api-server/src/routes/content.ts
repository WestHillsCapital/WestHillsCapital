import { Router, type IRouter } from "express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

// Lazy Anthropic client — only constructed when a draft is requested so the
// module loads cleanly even if env vars haven't been set yet.
function getAnthropicClient(): Anthropic {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    throw new Error("AI_INTEGRATIONS_ANTHROPIC_BASE_URL is not set");
  }
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
    throw new Error("AI_INTEGRATIONS_ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
}

// ─── TOPIC SEED LIST ──────────────────────────────────────────────────────────

const TOPIC_CLUSTERS = [
  {
    cluster: "Sovereign Bullion Philosophy",
    topics: [
      "Why sovereign bullion coins are different from generic bars",
      "What makes a coin 'legal tender' and why it matters to gold buyers",
      "The difference between allocated and unallocated metal",
      "Why government-minted coins hold liquidity advantages over private mint rounds",
    ],
  },
  {
    cluster: "Understanding Pricing & Premiums",
    topics: [
      "How gold premiums are calculated and what drives them higher",
      "Why silver premiums are proportionally higher than gold premiums",
      "What the ask-bid spread reveals about a dealer's business model",
      "How to compare gold dealer prices without getting confused by different products",
      "Why spot price alone tells you nothing about what you will actually pay",
    ],
  },
  {
    cluster: "Gold IRA Rules & Structure",
    topics: [
      "How a self-directed IRA rollover to gold actually works step by step",
      "IRS purity requirements for gold and silver in IRAs explained simply",
      "Why American Gold Eagles are IRA-eligible despite being less than .9999 fine",
      "What happens to your IRA gold when you take a distribution",
      "The difference between a transfer and a rollover in precious metals IRAs",
    ],
  },
  {
    cluster: "Product Selection",
    topics: [
      "American Gold Eagle vs. Gold Buffalo: which is right for you",
      "Why three products instead of hundreds: how limiting choice protects buyers",
      "What fractional gold coins cost per ounce vs. one-ounce coins",
      "Why Silver Eagles carry a higher premium than generic silver rounds",
    ],
  },
  {
    cluster: "Avoiding Costly Mistakes",
    topics: [
      "Red flags that reveal a high-pressure gold dealer",
      "Why proof coins underperform bullion for long-term holders",
      "The resale question every gold buyer should ask before purchasing",
      "How graded coins (NGC/PCGS slabs) compare to bullion for investors",
      "What to watch out for when a dealer offers 'free silver'",
    ],
  },
  {
    cluster: "Physical Ownership & Logistics",
    topics: [
      "Why shipping gold to a FedEx location is safer than home delivery",
      "How physical gold is stored in an IRA: custodians and depositories explained",
      "What to do when your gold order arrives: inspection and storage basics",
      "Why wire transfers are the preferred payment method for metal purchases",
    ],
  },
  {
    cluster: "Monetary History & Context",
    topics: [
      "A brief history of gold as money: what changed in 1971 and why it matters",
      "Why the gold-to-silver ratio has been tracked by investors for centuries",
      "Physical gold vs. gold ETFs: what ownership actually means",
      "How inflation affects the purchasing power of savings over decades",
    ],
  },
];

const WHC_VOICE_SYSTEM_PROMPT = `You are the editorial voice of West Hills Capital, a physical precious metals dealer founded in June 2011 that specializes in sovereign bullion for cash purchases and self-directed IRAs.

VOICE RULES (non-negotiable):
- Never use fear, urgency, or alarm to motivate purchasing decisions. No "now before it's too late," no crisis language, no doom framing.
- Never use hype: no "secret," "explosive," "incredible opportunity," no breathless language.
- Never name competitors or individual bad actors in the industry.
- Never give investment advice or tell people what to do with their money. You describe and explain — the reader decides.
- Write in plain, direct, educated language. Not academic. Not condescending. Not salesy.
- Paragraph style: plain flowing prose only. Do not use bullet lists or numbered lists inside the article body sections.
- Each section has one optional h2 heading and 2–4 substantive paragraphs.
- The tone is that of a knowledgeable friend who has spent decades studying this space.

FIRM BACKGROUND:
- Founded June 2011 by Joe, who spent 20 years studying monetary history, sovereign bullion philosophy, and the structure of physical metal markets before starting the firm.
- Three products only: 1 oz American Gold Eagle, 1 oz American Gold Buffalo, 1 oz American Silver Eagle — all sovereign bullion, all IRA-eligible.
- Gold commission: 2% over dealer cost. Silver commission: 5% over dealer cost. Fully transparent.
- Clients commit on the phone call, wire funds, receive metal via FedEx 2-Day fully insured with adult signature required.
- Core philosophy: physical metal is real money. Not a certificate, not a fund, not a paper claim. The metal is yours outright.

OUTPUT FORMAT:
Return ONLY a valid JSON object — no markdown, no explanation, no code fences — with this exact shape:
{
  "title": "string — clear, specific, searchable question or statement",
  "slug": "string — lowercase, hyphens only, no special chars",
  "excerpt": "string — 2-3 sentences of plain prose summarizing the article",
  "group": "one of: understanding-pricing | making-smart-decisions | ownership-and-practicality | choosing-who-to-trust",
  "metaDescription": "string — 140–160 chars, plain language, no first-person",
  "sections": [
    { "heading": "string", "paragraphs": ["string", "string"] }
  ]
}

ARTICLE REQUIREMENTS:
- Title: what would someone type into Google to find this article?
- Slug: derived from the title, all lowercase, words separated by hyphens
- Excerpt: plain prose, no first-person, sets up what the article covers
- metaDescription: 140–160 characters exactly. Informative, plain, no clickbait
- Sections: 8–12 sections total. First section often has no heading (the lede). Each section has 2–4 paragraphs.
- Group: pick the group that fits best
- Paragraphs: each paragraph is a complete, standalone sentence or set of sentences. Aim for 2–5 sentences per paragraph.`;

// ─── PUBLIC ENDPOINT ──────────────────────────────────────────────────────────

// GET /api/content/published
// No auth required — returns published articles for the public Insights page.
export const publicContentRouter: IRouter = Router();

publicContentRouter.get("/published", async (_req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(`
      SELECT id, slug, title, excerpt, group_id, meta_description, sections, related, published_at
      FROM content_articles
      WHERE status = 'published'
      ORDER BY published_at DESC
    `);
    const articles = rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      group: r.group_id,
      metaDescription: r.meta_description,
      sections: r.sections,
      related: r.related,
      publishedAt: r.published_at,
    }));
    res.json({ articles });
  } catch (err) {
    logger.error({ err }, "[Content] Failed to fetch published articles");
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// ─── INTERNAL ENDPOINTS (auth applied by index.ts) ───────────────────────────

// GET /api/internal/content/topics
router.get("/topics", (_req, res) => {
  res.json({ clusters: TOPIC_CLUSTERS });
});

// GET /api/internal/content/articles
router.get("/articles", async (_req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(`
      SELECT id, slug, title, excerpt, group_id, status, published_at, created_at, updated_at
      FROM content_articles
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json({ articles: rows });
  } catch (err) {
    logger.error({ err }, "[Content] Failed to list articles");
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// GET /api/internal/content/articles/:id
// Returns full article including sections and meta_description for the editor.
router.get("/articles/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT id, slug, title, excerpt, group_id, meta_description, sections, related, status, published_at
       FROM content_articles WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Article not found" });
    const r = rows[0];
    res.json({
      article: {
        id: r.id,
        slug: r.slug,
        title: r.title,
        excerpt: r.excerpt,
        group: r.group_id,
        metaDescription: r.meta_description,
        sections: r.sections,
        related: r.related,
        status: r.status,
        publishedAt: r.published_at,
      },
    });
  } catch (err) {
    logger.error({ err }, "[Content] Failed to fetch article by id");
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

// POST /api/internal/content/draft
// Body: { topic: string }
// Calls Anthropic and returns a structured article draft.
router.post("/draft", async (req, res) => {
  const { topic } = req.body as { topic?: string };
  if (!topic || typeof topic !== "string" || topic.trim().length < 5) {
    return res.status(400).json({ error: "topic is required" });
  }

  try {
    const client = getAnthropicClient();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: WHC_VOICE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Write an Insights article for West Hills Capital on this topic: ${topic.trim()}`,
        },
      ],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error({ text }, "[Content] Anthropic response did not contain JSON");
      return res.status(500).json({ error: "AI returned an unexpected format" });
    }

    const draft = JSON.parse(jsonMatch[0]);
    res.json({ draft });
  } catch (err) {
    logger.error({ err }, "[Content] Draft generation failed");
    res.status(500).json({ error: "Draft generation failed" });
  }
});

// POST /api/internal/content/articles
// Saves a draft article.
router.post("/articles", async (req, res) => {
  const { slug, title, excerpt, group, metaDescription, sections, related } = req.body as {
    slug?: string;
    title?: string;
    excerpt?: string;
    group?: string;
    metaDescription?: string;
    sections?: unknown;
    related?: unknown;
  };

  if (!slug || !title || !excerpt || !group || !metaDescription || !sections) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO content_articles (slug, title, excerpt, group_id, meta_description, sections, related, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
       ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title,
             excerpt = EXCLUDED.excerpt,
             group_id = EXCLUDED.group_id,
             meta_description = EXCLUDED.meta_description,
             sections = EXCLUDED.sections,
             related = EXCLUDED.related,
             updated_at = NOW()
       RETURNING id, slug, status`,
      [slug, title, excerpt, group, metaDescription, JSON.stringify(sections), JSON.stringify(related ?? [])]
    );
    res.json({ article: rows[0] });
  } catch (err) {
    logger.error({ err }, "[Content] Failed to save article");
    res.status(500).json({ error: "Failed to save article" });
  }
});

// PATCH /api/internal/content/articles/:id
// Updates an existing article's fields.
router.patch("/articles/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { slug, title, excerpt, group, metaDescription, sections, related } = req.body as {
    slug?: string;
    title?: string;
    excerpt?: string;
    group?: string;
    metaDescription?: string;
    sections?: unknown;
    related?: unknown;
  };

  try {
    const db = getDb();
    const { rows } = await db.query(
      `UPDATE content_articles
       SET slug = COALESCE($2, slug),
           title = COALESCE($3, title),
           excerpt = COALESCE($4, excerpt),
           group_id = COALESCE($5, group_id),
           meta_description = COALESCE($6, meta_description),
           sections = COALESCE($7, sections),
           related = COALESCE($8, related),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, slug, title, status`,
      [id, slug, title, excerpt, group, metaDescription,
       sections ? JSON.stringify(sections) : null,
       related ? JSON.stringify(related) : null]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Article not found" });
    res.json({ article: rows[0] });
  } catch (err) {
    logger.error({ err }, "[Content] Failed to update article");
    res.status(500).json({ error: "Failed to update article" });
  }
});

// POST /api/internal/content/articles/:id/publish
// Marks an article as published.
router.post("/articles/:id/publish", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const db = getDb();
    const { rows } = await db.query(
      `UPDATE content_articles
       SET status = 'published', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
       WHERE id = $1
       RETURNING id, slug, title, status`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Article not found" });
    res.json({ article: rows[0] });
  } catch (err) {
    logger.error({ err }, "[Content] Failed to publish article");
    res.status(500).json({ error: "Failed to publish" });
  }
});

// POST /api/internal/content/articles/:id/unpublish
router.post("/articles/:id/unpublish", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const db = getDb();
    const { rows } = await db.query(
      `UPDATE content_articles SET status = 'draft', updated_at = NOW()
       WHERE id = $1 RETURNING id, slug, title, status`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Article not found" });
    res.json({ article: rows[0] });
  } catch (err) {
    logger.error({ err }, "[Content] Failed to unpublish article");
    res.status(500).json({ error: "Failed to unpublish" });
  }
});

// DELETE /api/internal/content/articles/:id
router.delete("/articles/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const db = getDb();
    await db.query("DELETE FROM content_articles WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[Content] Failed to delete article");
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
