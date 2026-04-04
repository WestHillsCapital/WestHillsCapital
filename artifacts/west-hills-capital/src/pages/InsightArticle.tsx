import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  getArticleBySlug,
  getRelatedArticles,
  INSIGHT_GROUPS,
} from "@/data/insights";

function ArticleCTA() {
  return (
    <div className="mt-16 border-t border-border/30 pt-12 text-center">
      <h2 className="text-2xl font-serif font-semibold mb-4">
        Need help thinking it through?
      </h2>
      <p className="text-[15px] text-foreground/70 leading-relaxed max-w-xl mx-auto mb-8">
        If you have questions about pricing, products, or how to structure a
        purchase, we are happy to walk you through it clearly.{" "}
        <span className="text-foreground/80 font-medium">
          No pressure. No gimmicks. Just straightforward answers.
        </span>
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
  );
}

export default function InsightArticle() {
  const params = useParams<{ slug: string }>();
  const article = getArticleBySlug(params.slug ?? "");

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pb-24">
        <h1 className="text-4xl font-serif font-semibold mb-4">
          Article Not Found
        </h1>
        <p className="text-foreground/65 mb-8">
          This article does not exist or may have moved.
        </p>
        <Link href="/insights">
          <button className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to Insights
          </button>
        </Link>
      </div>
    );
  }

  const group = INSIGHT_GROUPS.find((g) => g.id === article.group);
  const related = getRelatedArticles(article.related);

  return (
    <div className="w-full bg-background min-h-screen pt-10 pb-28">
      <div className="max-w-[680px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* BACK LINK */}
        <Link href="/insights">
          <span className="inline-flex items-center gap-1.5 text-xs text-foreground/55 hover:text-primary transition-colors mb-10 font-medium cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" />
            Insights
          </span>
        </Link>

        {/* ARTICLE HEADER */}
        <header className="mb-10">
          {group && (
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">
              {group.title}
            </p>
          )}
          <h1 className="text-3xl lg:text-[2.4rem] font-serif font-semibold leading-tight mb-5">
            {article.title}
          </h1>
          <p className="text-[17px] text-foreground/70 leading-[1.75] border-b border-border/30 pb-8">
            {article.excerpt}
          </p>
        </header>

        {/* ARTICLE BODY */}
        <article className="space-y-10">
          {article.sections.map((section, i) => (
            <section key={i} className="space-y-4">
              {section.heading && (
                <h2 className="text-[1.2rem] font-serif font-semibold text-foreground leading-snug pt-2">
                  {section.heading}
                </h2>
              )}
              <div className="space-y-5">
                {section.paragraphs.map((para, j) => (
                  <p
                    key={j}
                    className="text-[16px] text-foreground/78 leading-[1.8]"
                  >
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>

        {/* RELATED ARTICLES */}
        {related.length > 0 && (
          <div className="mt-16 border-t border-border/30 pt-10">
            <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest mb-6">
              Continue Reading
            </p>
            <div className="space-y-3">
              {related.map((rel) => (
                <Link key={rel.slug} href={`/insights/${rel.slug}`}>
                  <div className="group flex items-start justify-between gap-5 bg-white border border-border/40 rounded-xl p-5 sm:p-6 hover:shadow-sm hover:border-border/60 transition-all cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors leading-snug mb-1.5">
                        {rel.title}
                      </p>
                      <p className="text-[13px] text-foreground/62 leading-relaxed line-clamp-2">
                        {rel.excerpt}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-foreground/35 shrink-0 mt-0.5 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* BOTTOM CTA */}
        <ArticleCTA />

      </div>
    </div>
  );
}
