import { Link } from "wouter";
import { ArrowRight, Clock } from "lucide-react";
import { INSIGHTS, INSIGHT_GROUPS, getArticlesByGroup, type InsightArticle } from "@/data/insights";

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
  return (
    <div className="w-full bg-background min-h-screen pt-12 pb-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* HERO */}
        <div className="max-w-2xl mb-16">
          <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-4">
            West Hills Capital Insights
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold mb-6 leading-tight">
            Insights
          </h1>
          <p className="text-lg text-foreground/80 leading-relaxed mb-3 font-medium">
            Most people do not need more noise about gold and silver. They need clarity.
          </p>
          <p className="text-base text-foreground/65 leading-relaxed">
            This section is designed to help buyers understand pricing, products, ownership, and how to avoid costly mistakes — so they can make informed decisions with confidence.
          </p>
        </div>

        {/* ARTICLE COUNT */}
        <p className="text-sm text-foreground/50 mb-14 border-t border-border/30 pt-5">
          {INSIGHTS.length} articles across {INSIGHT_GROUPS.length} topics
        </p>

        {/* GROUPS */}
        <div className="space-y-20">
          {INSIGHT_GROUPS.map((group) => {
            const articles = getArticlesByGroup(group.id);
            return (
              <section key={group.id} aria-labelledby={`group-${group.id}`}>

                {/* Group header */}
                <div className="mb-8 pb-5 border-b border-border/40">
                  <h2
                    id={`group-${group.id}`}
                    className="text-2xl font-serif font-semibold mb-2"
                  >
                    {group.title}
                  </h2>
                  <p className="text-[15px] text-foreground/65 leading-relaxed">
                    {group.description}
                  </p>
                </div>

                {/* Article cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {articles.map((article) => {
                    const readTime = estimateReadTime(article);
                    return (
                      <Link key={article.slug} href={`/insights/${article.slug}`}>
                        <article className="group h-full bg-white border border-border/40 rounded-xl p-6 hover:shadow-md hover:border-border/60 transition-all duration-200 cursor-pointer flex flex-col">
                          <h3 className="text-[15px] font-semibold text-foreground leading-snug mb-3 group-hover:text-primary transition-colors">
                            {article.title}
                          </h3>
                          <p className="text-[14px] text-foreground/68 leading-[1.7] flex-1">
                            {article.excerpt}
                          </p>
                          <div className="flex items-center justify-between mt-5">
                            <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                              Read article
                              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-foreground/35">
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
        <div className="mt-24 max-w-2xl mx-auto text-center border-t border-border/30 pt-14">
          <h2 className="text-2xl font-serif font-semibold mb-4">
            Need help thinking it through?
          </h2>
          <p className="text-[15px] text-foreground/68 leading-relaxed mb-8">
            If you have questions about pricing, products, or how to structure a purchase, we are happy to walk you through it clearly. No pressure. No gimmicks. Just straightforward answers.
          </p>
          <Link href="/schedule">
            <button className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
              Schedule a Conversation
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <p className="mt-5 text-xs text-foreground/45">
            Or call us at{" "}
            <a href="tel:8008676768" className="hover:text-primary transition-colors">
              (800) 867-6768
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
