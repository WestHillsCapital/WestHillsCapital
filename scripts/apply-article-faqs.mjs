import { readFileSync, writeFileSync } from "fs";

const faqData  = JSON.parse(readFileSync("scripts/article-faqs.json", "utf-8"));
const faqMap   = Object.fromEntries(faqData.filter(d => d.faqs.length > 0).map(d => [d.slug, d.faqs]));

let src = readFileSync("artifacts/west-hills-capital/src/data/insights.ts", "utf-8");

// Skip the template article slug
const skipSlugs = new Set(["your-article-slug-here"]);
let applied = 0, skipped = 0;

for (const [slug, faqs] of Object.entries(faqMap)) {
  if (skipSlugs.has(slug)) { skipped++; continue; }

  // Find the article block: slug: "..." up to the next slug or end
  const slugPattern = `slug: "${slug}"`;
  const slugIdx = src.indexOf(slugPattern);
  if (slugIdx === -1) { console.warn(`  WARN: slug not found: ${slug}`); skipped++; continue; }

  // Find the `related:` array that belongs to this article
  // (the first `related:` after our slug position)
  const relatedIdx = src.indexOf("\n    related:", slugIdx);
  if (relatedIdx === -1) { console.warn(`  WARN: no related field for: ${slug}`); skipped++; continue; }

  // Check whether faqs already exist for this article
  // Look between slugIdx and relatedIdx
  const blockBeforeRelated = src.slice(slugIdx, relatedIdx);
  if (blockBeforeRelated.includes("faqs:")) {
    console.log(`  SKIP (already has faqs): ${slug}`);
    skipped++;
    continue;
  }

  // Build the faqs field string
  const faqLines = faqs.map(({ q, a }) => {
    const qEsc = q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const aEsc = a.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `      { q: "${qEsc}", a: "${aEsc}" }`;
  }).join(",\n");

  const faqsField = `\n    faqs: [\n${faqLines},\n    ],`;

  // Insert faqs field right before `related:`
  const insertAt = relatedIdx + 1; // after the \n
  src = src.slice(0, insertAt) + faqsField + src.slice(insertAt);

  console.log(`  ✓ ${slug}: injected ${faqs.length} FAQs`);
  applied++;
}

writeFileSync("artifacts/west-hills-capital/src/data/insights.ts", src);
console.log(`\nDone. Applied: ${applied}, Skipped: ${skipped}`);
