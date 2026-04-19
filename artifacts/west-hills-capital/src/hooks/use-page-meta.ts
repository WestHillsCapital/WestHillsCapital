import { useEffect } from "react";

interface PageMeta {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
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

export function usePageMeta({ title, description, ogTitle, ogDescription }: PageMeta) {
  useEffect(() => {
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

    return () => {
      document.title = prev.title;
      setMetaTag("description", prev.description);
      setMetaTag("og:title", prev.ogTitle, true);
      setMetaTag("og:description", prev.ogDescription, true);
      setMetaTag("twitter:title", prev.twitterTitle);
      setMetaTag("twitter:description", prev.twitterDescription);
    };
  }, [title, description, ogTitle, ogDescription]);
}
