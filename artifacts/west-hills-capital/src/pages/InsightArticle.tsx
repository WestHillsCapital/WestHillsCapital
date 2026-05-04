import { Link, useParams } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { EmailCapture } from "@/components/EmailCapture";
import {
  getArticleBySlug,
  getRelatedArticles,
  INSIGHT_GROUPS,
  type InsightArticle as InsightArticleType,
} from "@/data/insights";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function useDynamicArticle(slug: string, skip: boolean) {
  return useQuery<{ articles: InsightArticleType[] }>({
    queryKey: ["published-articles"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/content/published`);
      if (!res.ok) return { articles: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !skip,
    select: (data) => ({
      articles: data.articles.filter((a) => a.slug === slug),
    }),
  });
}

// ─── READING PROGRESS BAR ─────────────────────────────────────────────────────

function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const el = document.documentElement;
      const scrollTop = el.scrollTop || document.body.scrollTop;
      const height = el.scrollHeight - el.clientHeight;
      setProgress(height > 0 ? Math.min(100, (scrollTop / height) * 100) : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-transparent">
      <div
        className="h-full bg-primary transition-[width] duration-75 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ─── READ TIME ESTIMATE ───────────────────────────────────────────────────────

function estimateReadTime(sections: { paragraphs: string[] }[]): number {
  const wordCount = sections
    .flatMap((s) => s.paragraphs)
    .join(" ")
    .split(/\s+/).length;
  return Math.max(1, Math.round(wordCount / 200));
}

// ─── ARTICLE CTA ──────────────────────────────────────────────────────────────

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

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function InsightArticle() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const staticArticle = getArticleBySlug(slug);
  const { data: dynamicData, isLoading: dynamicLoading } = useDynamicArticle(slug, !!staticArticle);
  const article = staticArticle ?? dynamicData?.articles?.[0];

  usePageMeta({
    title: article
      ? `${article.title} | West Hills Capital`
      : "Article Not Found | West Hills Capital",
    description: article?.metaDescription ?? "Explore insights on gold, silver, and precious metals investing from West Hills Capital.",
    ogImage: "https://westhillscapital.com/og-insights.jpg",
    canonical: slug ? `https://westhillscapital.com/insights/${slug}` : undefined,
  });

  if (!staticArticle && dynamicLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
  const readTime = estimateReadTime(article.sections);

  // Article JSON-LD for search engines and LLMs
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.metaDescription,
    "author": {
      "@type": "Organization",
      "name": "West Hills Capital",
      "url": "https://westhillscapital.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "West Hills Capital",
      "logo": {
        "@type": "ImageObject",
        "url": "https://westhillscapital.com/images/logo.webp"
      }
    },
    "url": `https://westhillscapital.com/insights/${article.slug}`,
    "mainEntityOfPage": `https://westhillscapital.com/insights/${article.slug}`,
    "articleSection": group?.title ?? "Insights",
    "keywords": ["gold", "silver", "precious metals", "physical gold", "gold IRA"],
  };

  return (
    <>
      <ReadingProgressBar />

      {/* Per-article structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
          <header className="mb-0">
            {group && (
              <p className="text-[11px] font-semibold text-primary uppercase tracking-[0.16em] mb-5">
                {group.title}
              </p>
            )}
            <h1 className="text-3xl lg:text-[2.5rem] font-serif font-semibold leading-tight mb-4">
              {article.title}
            </h1>
            <div className="flex items-center gap-3 text-xs text-foreground/35 mb-6">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{readTime} min read</span>
              </div>
              {article.publishedAt && (
                <>
                  <span className="text-foreground/20">·</span>
                  <span>
                    {new Date(article.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </>
              )}
            </div>
            <p className="text-[17px] text-foreground/68 leading-[1.8] pb-8 border-b border-border/40">
              {article.excerpt}
            </p>
          </header>

          {/* ARTICLE BODY */}
          <article className="mt-10 space-y-0">
            {article.sections.map((section, i) => (
              <section
                key={i}
                className={i > 0 ? "mt-12 pt-10 border-t border-border/15" : "mt-0"}
              >
                {section.heading && (
                  <h2 className="text-[1.2rem] font-serif font-semibold text-foreground leading-snug mb-5">
                    {section.heading}
                  </h2>
                )}
                <div className="space-y-5">
                  {section.paragraphs.map((para, j) => (
                    <p
                      key={j}
                      className={
                        i === 0 && j === 0
                          ? "text-[18px] text-foreground/85 leading-[1.85] font-[450]"
                          : "text-[16px] text-foreground/72 leading-[1.85]"
                      }
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

          {/* EMAIL CAPTURE */}
          <EmailCapture />

          {/* BOTTOM CTA */}
          <ArticleCTA />

        </div>
      </div>
    </>
  );
}
