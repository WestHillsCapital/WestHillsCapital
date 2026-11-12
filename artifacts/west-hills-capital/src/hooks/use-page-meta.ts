import { createContext, useContext, useEffect } from "react";
import { canonicalSiteUrl } from "@/lib/site-url";

export interface PageMeta {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonical?: string;
}

// Build-only renderer collects the actual page's metadata, not a duplicate map.
export const PageMetaCollector = createContext<((meta: PageMeta) => void) | null>(null);

function getMetaContent(name: string, property = false): string {
  const attr = property ? "property" : "name";
  const el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  return el?.getAttribute("content") ?? "";
}

function setMetaTag(name: string, content: string, property = false) {
  const attr = property ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function usePageMeta({ title, description, ogTitle, ogDescription, ogImage, canonical }: PageMeta) {
  const collect = useContext(PageMetaCollector);
  canonical = canonical ? canonicalSiteUrl(canonical) : undefined;
  collect?.({ title, description, ogTitle, ogDescription, ogImage, canonical });

  useEffect(() => {
    const prevCanonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "";

    const prev = {
      title: document.title,
      description: getMetaContent("description"),
      ogTitle: getMetaContent("og:title", true),
      ogDescription: getMetaContent("og:description", true),
      ogImage: getMetaContent("og:image", true),
      ogUrl: getMetaContent("og:url", true),
      twitterTitle: getMetaContent("twitter:title"),
      twitterDescription: getMetaContent("twitter:description"),
      twitterImage: getMetaContent("twitter:image"),
    };

    document.title = title;
    setMetaTag("description", description);
    setMetaTag("og:title", ogTitle ?? title, true);
    setMetaTag("og:description", ogDescription ?? description, true);
    if (ogImage) {
      setMetaTag("og:image", ogImage, true);
      setMetaTag("twitter:image", ogImage);
    }
    setMetaTag("twitter:title", ogTitle ?? title);
    setMetaTag("twitter:description", ogDescription ?? description);
    if (canonical) {
      setCanonical(canonical);
      setMetaTag("og:url", canonical, true);
    }

    return () => {
      document.title = prev.title;
      setMetaTag("description", prev.description);
      setMetaTag("og:title", prev.ogTitle, true);
      setMetaTag("og:description", prev.ogDescription, true);
      if (ogImage) {
        setMetaTag("og:image", prev.ogImage, true);
        setMetaTag("twitter:image", prev.twitterImage);
      }
      setMetaTag("twitter:title", prev.twitterTitle);
      setMetaTag("twitter:description", prev.twitterDescription);
      if (canonical && prevCanonical) {
        setCanonical(prevCanonical);
      }
      setMetaTag("og:url", prev.ogUrl, true);
    };
  }, [title, description, ogTitle, ogDescription, ogImage, canonical]);
}
