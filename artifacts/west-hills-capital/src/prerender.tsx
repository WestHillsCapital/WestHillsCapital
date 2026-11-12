import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";
import { PageMetaCollector, type PageMeta } from "@/hooks/use-page-meta";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-url";
import Home from "@/pages/Home";
import LivePricing from "@/pages/LivePricing";
import IRA from "@/pages/IRA";
import FAQ from "@/pages/FAQ";
import Buy from "@/pages/Buy";

const pages = { "/": Home, "/pricing": LivePricing, "/ira": IRA, "/faq": FAQ, "/buy": Buy };
export const prerenderRoutes = Object.keys(pages);

export function renderMarketingPage(route: string) {
  const Page = pages[route as keyof typeof pages];
  if (!Page) throw new Error(`Refusing to prerender a non-public route: ${route}`);
  // No build-time network requests and no stale prices, customer/session data,
  // authentication, analytics, or persisted browser state in generated HTML.
  const client = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false, gcTime: 0 } },
  });
  let meta: PageMeta | undefined;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const html = renderToStaticMarkup(
    <PageMetaCollector.Provider value={(value) => { meta = value; }}>
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <Router base={base} ssrPath={`${base}${route}`}>
            <Layout><Page /></Layout>
          </Router>
        </TooltipProvider>
      </QueryClientProvider>
    </PageMetaCollector.Provider>,
  );
  client.clear();
  if (!meta?.canonical || !meta.title) throw new Error(`Missing page metadata: ${route}`);
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${PUBLIC_SITE_ORIGIN}/#organization`,
    name: "West Hills Capital",
    url: `${PUBLIC_SITE_ORIGIN}/`,
    telephone: "+1-800-867-6768",
  };
  return { html, meta, organization };
}
