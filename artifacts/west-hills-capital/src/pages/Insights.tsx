import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { INSIGHTS, INSIGHT_GROUPS, getArticlesByGroup } from "@/data/insights";

export default function Insights() {
  return (
    <div className="w-full bg-background min-h-screen pt-12 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* HERO */}
        <div className="max-w-2xl mb-16">
          <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-4">
            West Hills Capital Insights
          </p>
          <h1 className="text-4xl lg:text-5xl font-serif font-semibold mb-6 leading-tight">
            Insights
          </h1>
          <p className="text-lg text-foreground/60 leading-relaxed mb-3">
            Most people do not need more noise about gold and silver. They need clarity.
          </p>
          <p className="text-base text-foreground/50 leading-relaxed">
            This section is designed to help buyers understand pricing, products, ownership, and how to avoid costly mistakes — so they can make informed decisions with confidence.
          </p>
        </div>

        {/* ARTICLE COUNT */}
        <p className="text-sm text-foreground/35 mb-14 border-t border-border/30 pt-5">
          {INSIGHTS.length} articles across {INSIGHT_GROUPS.length} topics
        </p>

        {/* GROUPS */}
        <div className="space-y-16">
          {INSIGHT_GROUPS.map((group) => {
            const articles = getArticlesByGroup(group.id);
            return (
              <section key={group.id} aria-labelledby={`group-${group.id}`}>
                {/* Group header */}
                <div className="mb-7 pb-4 border-b border-border/30">
                  <h2
                    id={`group-${group.id}`}
                    className="text-xl font-serif font-semibold mb-1.5"
                  >
                    {group.title}
                  </h2>
                  <p className="text-sm text-foreground/50">{group.description}</p>
                </div>

                {/* Article cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {articles.map((article) => (
                    <Link key={article.slug} href={`/insights/${article.slug}`}>
                      <article className="group h-full bg-white border border-border/40 rounded-xl p-6 hover:shadow-md hover:border-border/70 transition-all duration-200 cursor-pointer flex flex-col">
                        <h3 className="text-base font-semibold text-foreground leading-snug mb-3 group-hover:text-primary transition-colors">
                          {article.title}
                        </h3>
                        <p className="text-sm text-foreground/55 leading-relaxed flex-1">
                          {article.excerpt}
                        </p>
                        <div className="flex items-center gap-1 mt-5 text-xs font-medium text-primary">
                          Read article
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* BOTTOM CTA */}
        <div className="mt-20 max-w-2xl mx-auto text-center border-t border-border/30 pt-14">
          <h2 className="text-2xl font-serif font-semibold mb-3">
            Need help thinking it through?
          </h2>
          <p className="text-foreground/55 leading-relaxed mb-7">
            If you have questions about pricing, products, or how to structure a purchase, we are happy to walk you through it clearly. No pressure. No gimmicks. Just straightforward answers.
          </p>
          <Link href="/schedule">
            <button className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
              Schedule a Conversation
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}
