import { Router, type IRouter } from "express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

// Lazy Anthropic client — only constructed when a draft is requested so the
// module loads cleanly even if env vars haven't been set yet.
// Supports two credential paths:
//   1. Replit AI proxy (dev): AI_INTEGRATIONS_ANTHROPIC_BASE_URL + AI_INTEGRATIONS_ANTHROPIC_API_KEY
//   2. Direct Anthropic key (Railway / production): ANTHROPIC_API_KEY
function isValidUrl(s: string): boolean {
  try { new URL(s); return true; } catch { return false; }
}

function getAnthropicClient(): Anthropic {
  const proxyUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const proxyKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  // Only use the Replit proxy path if the base URL is actually a valid URL
  if (proxyUrl && proxyKey && isValidUrl(proxyUrl)) {
    return new Anthropic({ apiKey: proxyKey, baseURL: proxyUrl });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  throw new Error(
    "No Anthropic credentials configured. Set ANTHROPIC_API_KEY in Railway environment variables.",
  );
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

ANSWER-FIRST RULE (critical for AI search visibility):
The lede section (first section, no heading) must open with a direct, declarative sentence that answers the question or states the core claim of the title. No warmup. No "Many people wonder..." No "It depends." State the answer plainly in the very first sentence, then build from there. Example: if the title is "What spot price really means," the first sentence should be something like: "Spot price is the financial market's reference price for an ounce of gold — but it is not what physical buyers actually pay." Every subsequent section should build on or deepen that opening answer.

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
  ],
  "faqs": [
    { "q": "string — exact question a reader would type into an AI assistant", "a": "string — 1-3 sentence direct answer, self-contained and quotable" }
  ]
}

ARTICLE REQUIREMENTS:
- Title: what would someone type into Google to find this article?
- Slug: derived from the title, all lowercase, words separated by hyphens
- Excerpt: plain prose, no first-person, sets up what the article covers
- metaDescription: 140–160 characters exactly. Informative, plain, no clickbait
- Sections: 8–12 sections total. First section often has no heading (the lede). Each section has 2–4 paragraphs.
- Group: pick the group that fits best
- Paragraphs: each paragraph is a complete, standalone sentence or set of sentences. Aim for 2–5 sentences per paragraph.
- FAQs: 5–7 questions a real reader would ask an AI assistant about this topic. Each answer must be a standalone, citable statement — no "it depends," no references to "this article." Write them as if Perplexity will quote them directly.`;

// ─── PUBLIC ENDPOINT ──────────────────────────────────────────────────────────

// GET /api/content/published
// No auth required — returns published articles for the public Insights page.
export const publicContentRouter: IRouter = Router();

publicContentRouter.get("/published", async (_req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(`
      SELECT id, slug, title, excerpt, group_id, meta_description, sections, related, faqs, published_at
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
      faqs: r.faqs ?? [],
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
router.get("/articles/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT id, slug, title, excerpt, group_id, meta_description, sections, related, faqs, status, published_at
       FROM content_articles WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) { res.status(404).json({ error: "Article not found" }); return; }
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
        faqs: r.faqs ?? [],
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
// Streams SSE events while Anthropic generates, then emits sections one-by-one
// before a final "done" event. Keeps Railway proxy alive throughout.
// Events: { type: "meta", ... } | { type: "section", index, total, section }
//       | { type: "done", draft } | { type: "error", error }
router.post("/draft", async (req, res): Promise<void> => {
  const { topic } = req.body as { topic?: string };
  if (!topic || typeof topic !== "string" || topic.trim().length < 5) {
    res.status(400).json({ error: "topic is required" }); return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const keepalive = setInterval(() => res.write(": keepalive\n\n"), 5000);

  try {
    const client = getAnthropicClient();

    const stream = client.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 3000,
      system: WHC_VOICE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Write an Insights article for West Hills Capital on this topic: ${topic.trim()}`,
        },
      ],
    });

    let fullText = "";
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        fullText += chunk.delta.text;
      }
    }

    clearInterval(keepalive);

    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error({ fullText }, "[Content] Anthropic response did not contain JSON");
      send({ type: "error", error: "AI returned an unexpected format" });
      res.end(); return;
    }

    let draft: Record<string, unknown>;
    try {
      draft = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch (parseErr) {
      logger.error({ parseErr, json: jsonMatch[0].slice(0, 200) }, "[Content] Draft generation failed — invalid JSON from Anthropic");
      send({ type: "error", error: "AI returned malformed JSON — check server logs for details." });
      res.end(); return;
    }

    // Emit article metadata first so the UI can show the title immediately
    send({
      type: "meta",
      title: draft.title,
      slug: draft.slug,
      excerpt: draft.excerpt,
      group: draft.group,
      metaDescription: draft.metaDescription,
    });

    // Stream sections one-by-one with a brief delay so the reader can follow along
    const sections = Array.isArray(draft.sections) ? draft.sections : [];
    for (let i = 0; i < sections.length; i++) {
      await new Promise((r) => setTimeout(r, 80));
      send({ type: "section", index: i, total: sections.length, section: sections[i] });
    }

    send({ type: "done", draft });
    res.end();
  } catch (err) {
    clearInterval(keepalive);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No Anthropic credentials configured") || msg.includes("AI_INTEGRATIONS_ANTHROPIC")) {
      logger.error({ err }, "[Content] Anthropic AI not configured — draft generation will fail");
      send({ type: "error", error: "AI integration is not configured on this server. Set ANTHROPIC_API_KEY in Railway environment variables." });
    } else {
      const status = (err as Record<string, unknown>)["status"];
      logger.error({ err, status, msg }, "[Content] Draft generation failed");
      send({ type: "error", error: status ? `Anthropic API error (HTTP ${status}): ${msg}` : `Draft generation failed: ${msg}` });
    }
    res.end();
  }
});

// POST /api/internal/content/articles
// Saves a draft article.
router.post("/articles", async (req, res): Promise<void> => {
  const { slug, title, excerpt, group, metaDescription, sections, related, faqs } = req.body as {
    slug?: string;
    title?: string;
    excerpt?: string;
    group?: string;
    metaDescription?: string;
    sections?: unknown;
    related?: unknown;
    faqs?: unknown;
  };

  if (!slug || !title || !excerpt || !group || !metaDescription || !sections) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }

  try {
    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO content_articles (slug, title, excerpt, group_id, meta_description, sections, related, faqs, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
       ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title,
             excerpt = EXCLUDED.excerpt,
             group_id = EXCLUDED.group_id,
             meta_description = EXCLUDED.meta_description,
             sections = EXCLUDED.sections,
             related = EXCLUDED.related,
             faqs = EXCLUDED.faqs,
             updated_at = NOW()
       RETURNING id, slug, status`,
      [slug, title, excerpt, group, metaDescription, JSON.stringify(sections), JSON.stringify(related ?? []), JSON.stringify(faqs ?? [])]
    );
    res.json({ article: rows[0] });
  } catch (err) {
    logger.error({ err }, "[Content] Failed to save article");
    res.status(500).json({ error: "Failed to save article" });
  }
});

// PATCH /api/internal/content/articles/:id
// Updates an existing article's fields.
router.patch("/articles/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { slug, title, excerpt, group, metaDescription, sections, related, faqs } = req.body as {
    slug?: string;
    title?: string;
    excerpt?: string;
    group?: string;
    metaDescription?: string;
    sections?: unknown;
    related?: unknown;
    faqs?: unknown;
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
           faqs = COALESCE($9, faqs),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, slug, title, status`,
      [id, slug, title, excerpt, group, metaDescription,
       sections ? JSON.stringify(sections) : null,
       related ? JSON.stringify(related) : null,
       faqs ? JSON.stringify(faqs) : null]
    );
    if (rows.length === 0) { res.status(404).json({ error: "Article not found" }); return; }
    res.json({ article: rows[0] });
  } catch (err) {
    logger.error({ err }, "[Content] Failed to update article");
    res.status(500).json({ error: "Failed to update article" });
  }
});

// POST /api/internal/content/articles/:id/publish
// Marks an article as published. Returns the canonical live URL.
router.post("/articles/:id/publish", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const db = getDb();
    const { rows } = await db.query(
      `UPDATE content_articles
       SET status = 'published', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
       WHERE id = $1
       RETURNING id, slug, title, status, published_at`,
      [id]
    );
    if (rows.length === 0) { res.status(404).json({ error: "Article not found" }); return; }
    const article = rows[0];
    const liveUrl = `https://westhillscapital.com/insights/${article.slug}`;
    res.json({ article: { ...article, liveUrl } });
  } catch (err) {
    logger.error({ err }, "[Content] Failed to publish article");
    res.status(500).json({ error: "Failed to publish" });
  }
});

// POST /api/internal/content/articles/:id/unpublish
router.post("/articles/:id/unpublish", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const db = getDb();
    const { rows } = await db.query(
      `UPDATE content_articles SET status = 'draft', updated_at = NOW()
       WHERE id = $1 RETURNING id, slug, title, status`,
      [id]
    );
    if (rows.length === 0) { res.status(404).json({ error: "Article not found" }); return; }
    res.json({ article: rows[0] });
  } catch (err) {
    logger.error({ err }, "[Content] Failed to unpublish article");
    res.status(500).json({ error: "Failed to unpublish" });
  }
});

// POST /api/internal/content/rewrite-article
// Body: { draft: DraftArticle, direction: string }
// Takes the full current draft and a direction note, then rewrites the entire
// article for coherence and alignment. Streams SSE: meta → section × N → done.
router.post("/rewrite-article", async (req, res): Promise<void> => {
  const { draft, direction } = req.body as {
    draft?: Record<string, unknown>;
    direction?: string;
  };

  if (!draft || typeof draft !== "object") {
    res.status(400).json({ error: "draft is required" }); return;
  }
  if (!direction || typeof direction !== "string" || direction.trim().length < 3) {
    res.status(400).json({ error: "direction is required" }); return;
  }

  const sections = Array.isArray(draft.sections) ? draft.sections as { heading?: string; paragraphs: string[] }[] : [];
  if (sections.length === 0) {
    res.status(400).json({ error: "draft has no sections" }); return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const keepalive = setInterval(() => res.write(": keepalive\n\n"), 5000);

  const sectionText = (s: { heading?: string; paragraphs: string[] }) =>
    [s.heading ? `### ${s.heading}` : "", ...s.paragraphs].filter(Boolean).join("\n\n");

  const currentArticle = sections
    .map((s, i) => `SECTION ${i + 1}:\n${sectionText(s)}`)
    .join("\n\n---\n\n");

  const prompt = `The editor has written the following article titled: "${draft.title ?? "untitled"}"

CURRENT ARTICLE:
${currentArticle}

---

DIRECTION NOTE FROM EDITOR:
${direction.trim()}

---

Rewrite the entire article so every section aligns with the direction note. The narrative, tone, and emphasis must be consistent from first paragraph to last — no section should contradict or ignore the new direction. Preserve the same number of sections and their approximate focus, but rewrite the content freely. The title, slug, excerpt, and group may be updated if the direction changes the angle significantly.

Return ONLY a valid JSON object — no markdown, no explanation, no code fences — with this exact shape:
{
  "title": "string",
  "slug": "string — lowercase, hyphens only",
  "excerpt": "string — 2-3 sentences of plain prose",
  "group": "one of: understanding-pricing | making-smart-decisions | ownership-and-practicality | choosing-who-to-trust",
  "metaDescription": "string — 140–160 chars",
  "sections": [
    { "heading": "string or null", "paragraphs": ["string", "string"] }
  ]
}`;

  try {
    const client = getAnthropicClient();

    const stream = client.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 4000,
      system: WHC_VOICE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    let fullText = "";
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        fullText += chunk.delta.text;
      }
    }

    clearInterval(keepalive);

    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error({ fullText }, "[Content] Rewrite-article: no JSON in response");
      send({ type: "error", error: "AI returned an unexpected format" });
      res.end(); return;
    }

    let rewritten: Record<string, unknown>;
    try {
      rewritten = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      send({ type: "error", error: "AI returned malformed JSON" });
      res.end(); return;
    }

    send({
      type: "meta",
      title: rewritten.title,
      slug: rewritten.slug,
      excerpt: rewritten.excerpt,
      group: rewritten.group,
      metaDescription: rewritten.metaDescription,
    });

    const newSections = Array.isArray(rewritten.sections) ? rewritten.sections : [];
    for (let i = 0; i < newSections.length; i++) {
      await new Promise((r) => setTimeout(r, 80));
      send({ type: "section", index: i, total: newSections.length, section: newSections[i] });
    }

    send({ type: "done", draft: rewritten });
    res.end();
  } catch (err) {
    clearInterval(keepalive);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No Anthropic credentials configured")) {
      send({ type: "error", error: "AI integration is not configured on this server." });
    } else {
      logger.error({ err }, "[Content] Rewrite-article failed");
      send({ type: "error", error: `Rewrite failed: ${msg}` });
    }
    res.end();
  }
});

// POST /api/internal/content/rewrite-section
// Body: { articleTitle, instructions, currentSection, prevSection?, nextSection? }
// Returns: { section: ArticleSection }
router.post("/rewrite-section", async (req, res): Promise<void> => {
  const { articleTitle, instructions, currentSection, prevSection, nextSection } = req.body as {
    articleTitle?: string;
    instructions?: string;
    currentSection?: { heading?: string; paragraphs: string[] };
    prevSection?: { heading?: string; paragraphs: string[] } | null;
    nextSection?: { heading?: string; paragraphs: string[] } | null;
  };

  if (!instructions || typeof instructions !== "string" || instructions.trim().length < 3) {
    res.status(400).json({ error: "instructions is required" }); return;
  }
  if (!currentSection || !Array.isArray(currentSection.paragraphs)) {
    res.status(400).json({ error: "currentSection is required" }); return;
  }

  const sectionText = (s: { heading?: string; paragraphs: string[] }) =>
    [s.heading ? `### ${s.heading}` : "", ...s.paragraphs].filter(Boolean).join("\n\n");

  const contextBlocks: string[] = [];
  if (prevSection) contextBlocks.push(`PRECEDING SECTION (read-only — for flow context):\n${sectionText(prevSection)}`);
  contextBlocks.push(`SECTION TO REWRITE:\n${sectionText(currentSection)}`);
  if (nextSection) contextBlocks.push(`FOLLOWING SECTION (read-only — for flow context):\n${sectionText(nextSection)}`);

  const prompt = `Article title: "${articleTitle ?? "untitled"}"

${contextBlocks.join("\n\n---\n\n")}

---

REWRITE INSTRUCTIONS FROM EDITOR:
${instructions.trim()}

Rewrite only the "SECTION TO REWRITE" according to the instructions. Preserve the heading if it is still appropriate, or update it if the rewrite changes the focus significantly. Maintain the same paragraph-prose style (no bullet lists). Match the WHC voice.

Return ONLY a valid JSON object with this exact shape — no markdown, no explanation:
{ "heading": "string or null", "paragraphs": ["string", "string"] }`;

  try {
    const client = getAnthropicClient();

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      system: WHC_VOICE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }, { timeout: 30000 });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error({ text }, "[Content] Rewrite-section: no JSON in response");
      res.status(500).json({ error: "AI returned an unexpected format" }); return;
    }

    let section: unknown;
    try {
      section = JSON.parse(jsonMatch[0]);
    } catch {
      res.status(500).json({ error: "AI returned malformed JSON" }); return;
    }

    res.json({ section });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No Anthropic credentials configured")) {
      res.status(500).json({ error: "AI integration is not configured on this server." }); return;
    }
    logger.error({ err }, "[Content] Rewrite-section failed");
    res.status(500).json({ error: `Rewrite failed: ${msg}` });
  }
});

// DELETE /api/internal/content/articles/:id
router.delete("/articles/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

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
