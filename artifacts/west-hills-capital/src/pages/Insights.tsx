import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { ArrowRight, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { INSIGHTS, INSIGHT_GROUPS, getFoundersPerspectiveArticle, type InsightArticle } from "@/data/insights";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function useAllArticles(): InsightArticle[] {
  const { data } = useQuery<{ articles: InsightArticle[] }>({
    queryKey: ["published-articles"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/content/published`);
      if (!res.ok) return { articles: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const staticSlugs = new Set(INSIGHTS.map((a) => a.slug));
  const dynamicArticles = (data?.articles ?? []).filter((a) => !staticSlugs.has(a.slug));
  return [...INSIGHTS, ...dynamicArticles];
}

function getArticlesByGroupDynamic(articles: InsightArticle[], groupId: string): InsightArticle[] {
  return articles.filter((a) => a.group === groupId);
}

// ─── READ TIME ─────────────────────────────────────────────────────────────────

function estimateReadTime(article: InsightArticle): number {
  const wordCount = article.sections
    .flatMap((s) => s.paragraphs)
    .join(" ")
    .split(/\s+/).length;
  return Math.max(1, Math.round(wordCount / 200));
}

// ─── PAGE ──────────────────────────────────────────────────────────────────────

export default function Insights() {
  usePageMeta({
    title: "Insights | West Hills Capital",
    description: "Practical education on gold, silver, and self-directed IRAs — written for investors who want clarity, not noise. Explore our guides, market commentary, and founder's perspective.",
    ogImage: "https://westhillscapital.com/opengraph.jpg",
    canonical: "https://westhillscapital.com/insights",
  });

  const allArticles = useAllArticles();
  const founderArticle = getFoundersPerspectiveArticle();

  return (
    <div className="w-full bg-background min-h-screen pt-14 pb-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* HERO */}
        <div className="border-b border-border/30 pb-10 mb-10">
          <p className="text-[11px] text-primary font-semibold uppercase tracking-[0.18em] mb-5">
            West Hills Capital — Insights
          </p>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <h1 className="text-5xl lg:text-6xl font-serif font-semibold leading-tight">
              Insights
            </h1>
            <p className="text-[15px] text-foreground/60 leading-relaxed lg:max-w-sm lg:text-right">
              Clarity over noise — pricing, products, ownership, and how to avoid costly mistakes.
            </p>
          </div>
        </div>

        {/* ARTICLE COUNT */}
        <p className="text-[12px] text-foreground/40 font-medium tracking-wide mb-10 uppercase">
          {allArticles.length} articles &nbsp;·&nbsp; {INSIGHT_GROUPS.length} topics
        </p>

        {/* FOUNDER'S PERSPECTIVE FEATURE */}
        {founderArticle && (
          <div className="mb-14">
            <Link href={`/insights/${founderArticle.slug}`}>
              <article className="group relative bg-white border border-border/50 rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-200 cursor-pointer">
                {/* Top accent bar */}
                <div className="h-[3px] bg-primary/80" />
                <div className="p-8 sm:p-10 flex flex-col sm:flex-row sm:items-start gap-8">
                  {/* Left: label + title + excerpt */}
                  <div className="flex-1 min-w-0">
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.18em] text-primary bg-primary/8 border border-primary/20 rounded-full px-3 py-1 mb-5">
                      Founder's Perspective
                    </span>
                    <h2 className="text-xl sm:text-2xl font-serif font-semibold text-foreground leading-snug mb-4 group-hover:text-primary transition-colors duration-150">
                      {founderArticle.title}
                    </h2>
                    <p className="text-[14.5px] text-foreground/60 leading-[1.8]">
                      {founderArticle.excerpt}
                    </p>
                  </div>
                  {/* Right: read cta + read time */}
                  <div className="sm:pt-1 sm:shrink-0 sm:flex sm:flex-col sm:items-end sm:justify-between sm:self-stretch">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                      Read article
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-foreground/35 tabular-nums mt-4 sm:mt-0">
                      <Clock className="w-3 h-3" />
                      {estimateReadTime(founderArticle)} min
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          </div>
        )}

        {/* GROUPS */}
        <div className="space-y-16">
          {INSIGHT_GROUPS.map((group, idx) => {
            const articles = getArticlesByGroupDynamic(allArticles, group.id);
            const groupNum = String(idx + 1).padStart(2, "0");
            return (
              <section key={group.id} aria-labelledby={`group-${group.id}`}>

                {/* Group header */}
                <div className="flex items-start gap-5 mb-7 pb-5 border-b border-border/35">
                  <span className="text-[11px] font-semibold text-primary/50 tabular-nums mt-1.5 shrink-0 tracking-widest">
                    {groupNum}
                  </span>
                  <div>
                    <h2
                      id={`group-${group.id}`}
                      className="text-xl font-serif font-semibold mb-1 leading-snug"
                    >
                      {group.title}
                    </h2>
                    <p className="text-[14px] text-foreground/55 leading-relaxed">
                      {group.description}
                    </p>
                  </div>
                </div>

                {/* Article cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {articles.filter((a) => !a.foundersPerspective).map((article) => {
                    const readTime = estimateReadTime(article);
                    return (
                      <Link key={article.slug} href={`/insights/${article.slug}`}>
                        <article className="group h-full bg-white border border-border/40 rounded-xl p-6 hover:shadow-md hover:border-primary/25 transition-all duration-200 cursor-pointer flex flex-col">
                          <h3 className="text-[15px] font-semibold text-foreground leading-snug mb-3 group-hover:text-primary transition-colors duration-150">
                            {article.title}
                          </h3>
                          <p className="text-[13.5px] text-foreground/60 leading-[1.75] flex-1">
                            {article.excerpt}
                          </p>
                          <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/25">
                            <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                              Read article
                              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-foreground/30 tabular-nums">
                              <Clock className="w-3 h-3" />
                              {readTime} min
                            </div>
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>

              </section>
            );
          })}
        </div>

        {/* BOTTOM CTA */}
        <div className="mt-20 max-w-xl mx-auto text-center border-t border-border/30 pt-14">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Need help thinking it through?
          </h2>
          <p className="text-[15px] text-foreground/60 leading-relaxed mb-8">
            If you have questions about pricing, products, or how to structure a purchase, we're happy to walk you through it — clearly, with no pressure.
          </p>
          <Link href="/schedule">
            <button className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
              Schedule a Conversation
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <p className="mt-5 text-xs text-foreground/40">
            Or call{" "}
            <a href="tel:8008676768" className="hover:text-primary transition-colors">
              (800) 867-6768
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
