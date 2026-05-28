import { readFileSync, writeFileSync } from "fs";

const BASE_URL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const API_KEY  = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

if (!BASE_URL) { console.error("Missing AI_INTEGRATIONS_ANTHROPIC_BASE_URL"); process.exit(1); }

const raw = readFileSync("artifacts/west-hills-capital/src/data/insights.ts", "utf-8");

const slugPositions = [...raw.matchAll(/slug:\s*"([^"]+)"/g)];
const articles = [];

for (let i = 0; i < slugPositions.length; i++) {
  const start = slugPositions[i].index;
  const end = i + 1 < slugPositions.length ? slugPositions[i + 1].index : raw.length;
  const block = raw.slice(start, end);

  const titleM = block.match(/title:\s*"([^"]+)"/);
  if (!titleM) continue;

  const paragraphs = [];
  const pRe = /paragraphs:\s*\[([^\]]*)\]/gs;
  let pm;
  while ((pm = pRe.exec(block)) !== null) {
    const strRe = /"((?:[^"\\]|\\.)*)"/g;
    let sm;
    while ((sm = strRe.exec(pm[1])) !== null) paragraphs.push(sm[1]);
  }
  if (paragraphs.length < 3) continue;

  articles.push({ slug: slugPositions[i][1], title: titleM[1], text: paragraphs.join(" ") });
}

console.log(`Found ${articles.length} real articles`);

const genFaqs = async (article) => {
  const resp = await fetch(`${BASE_URL}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      system: `You write FAQ pairs for West Hills Capital, a physical precious metals dealer focused on long-term buyers.
Generate exactly 5 FAQ pairs.

Rules:
- Questions are EXACTLY what someone would type into Perplexity or ChatGPT
- Answers are 1–3 sentences, self-contained, quotable verbatim by an AI assistant
- Voice: direct, plain English, no hedging, no filler phrases — sounds like a 15-year industry veteran who respects the reader's intelligence
- Never reference "this article", "Joe says", or "West Hills Capital says"
- Output ONLY a valid JSON array: [{"q":"...","a":"..."},...]`,
      messages: [{
        role: "user",
        content: `Article title: "${article.title}"\n\nArticle content:\n${article.text.slice(0, 3000)}\n\nGenerate 5 FAQ pairs as a JSON array.`
      }]
    })
  });

  const data = await resp.json();
  if (data.error) { console.error(`  ERROR ${article.slug}:`, data.error.message); return { slug: article.slug, faqs: [] }; }
  const txt = data.content?.[0]?.text ?? "[]";
  try {
    const m = txt.match(/\[[\s\S]*\]/);
    const faqs = m ? JSON.parse(m[0]) : [];
    console.log(`  ✓ ${article.slug}: ${faqs.length} FAQs`);
    return { slug: article.slug, faqs };
  } catch (e) {
    console.error(`  Parse error ${article.slug}:`, e.message);
    return { slug: article.slug, faqs: [] };
  }
};

// Fire all in parallel — haiku handles it fine
const results = await Promise.all(articles.map(genFaqs));

writeFileSync("scripts/article-faqs.json", JSON.stringify(results, null, 2));
console.log(`\nWrote scripts/article-faqs.json`);
