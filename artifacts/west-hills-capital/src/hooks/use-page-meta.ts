import { useEffect } from "react";

interface PageMeta {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  canonical?: string;
}

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

export function usePageMeta({ title, description, ogTitle, ogDescription, canonical }: PageMeta) {
  useEffect(() => {
    const prevCanonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "";

    const prev = {
      title: document.title,
      description: getMetaContent("description"),
      ogTitle: getMetaContent("og:title", true),
      ogDescription: getMetaContent("og:description", true),
      twitterTitle: getMetaContent("twitter:title"),
      twitterDescription: getMetaContent("twitter:description"),
    };

    document.title = title;
    setMetaTag("description", description);
    setMetaTag("og:title", ogTitle ?? title, true);
    setMetaTag("og:description", ogDescription ?? description, true);
    setMetaTag("twitter:title", ogTitle ?? title);
    setMetaTag("twitter:description", ogDescription ?? description);
    if (canonical) {
      setCanonical(canonical);
    }

    return () => {
      document.title = prev.title;
      setMetaTag("description", prev.description);
      setMetaTag("og:title", prev.ogTitle, true);
      setMetaTag("og:description", prev.ogDescription, true);
      setMetaTag("twitter:title", prev.twitterTitle);
      setMetaTag("twitter:description", prev.twitterDescription);
      if (canonical && prevCanonical) {
        setCanonical(prevCanonical);
      }
    };
  }, [title, description, ogTitle, ogDescription, canonical]);
}
