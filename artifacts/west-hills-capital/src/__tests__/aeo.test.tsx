import { describe, expect, it, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import FAQ from "@/pages/FAQ";
import { canonicalSiteUrl } from "@/lib/site-url";
import { PricingExplainer } from "@/components/education/PricingExplainer";
import { IraEssentials } from "@/components/education/IraEssentials";
import { renderToStaticMarkup } from "react-dom/server";
import Terms from "@/pages/Terms";
import Disclosures from "@/pages/Disclosures";
import About from "@/pages/About";
import Radio from "@/pages/Radio";
import { PURCHASE_CHANNELS, NON_IRA_DELIVERY, SELF_SERVE_PRICE_LOCK } from "@/lib/purchase-policy";

afterEach(cleanup);

describe("FAQ crawlability", () => {
  it("keeps every answer mounted while its native disclosure is closed", () => {
    const { container } = render(<FAQ />);
    const disclosures = Array.from(container.querySelectorAll("details"));
    expect(disclosures.length).toBeGreaterThan(15);
    const schema = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(schema.mainEntity).toHaveLength(disclosures.length);
    for (const [index, details] of disclosures.entries()) {
      expect(details.open).toBe(false);
      expect(details.querySelector("div")!.textContent!.trim().length).toBeGreaterThan(20);
      expect(schema.mainEntity[index].name).toBe(details.querySelector("summary")!.textContent);
      expect(schema.mainEntity[index].acceptedAnswer.text.length).toBeGreaterThan(20);
    }
    disclosures[0].open = true;
    expect(disclosures[0].open).toBe(true);
    expect(disclosures[1].open).toBe(false);
  });
});

describe("public build output", () => {
  const routes = ["", "pricing", "ira", "faq", "buy"];
  // A clean checkout has no build output; test:aeo builds before running this check.
  it.skipIf(!existsSync("dist/public/spa.html"))("includes route-specific content and metadata without running JavaScript", () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const route of routes) {
      const html = readFileSync(`dist/public/${route ? `${route}/` : ""}index.html`, "utf8");
      const document = new DOMParser().parseFromString(html, "text/html");
      expect(document.querySelectorAll("h1")).toHaveLength(1);
      expect(document.querySelector("#root")!.textContent!.length).toBeGreaterThan(1000);
      expect(document.querySelectorAll("a[href]").length).toBeGreaterThan(10);
      const canonical = `https://www.westhillscapital.com/${route}`;
      expect(document.querySelector('link[rel="canonical"]')!.getAttribute("href")).toBe(canonical);
      expect(document.querySelector('meta[property="og:url"]')!.getAttribute("content")).toBe(canonical);
      titles.add(document.title);
      descriptions.add(document.querySelector('meta[name="description"]')!.getAttribute("content")!);
      const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map((script) => JSON.parse(script.textContent!));
      expect(schemas.some((schema) => schema["@type"] === "Organization")).toBe(true);
    }
    expect(titles.size).toBe(5);
    expect(descriptions.size).toBe(5);
    const shell = readFileSync("dist/public/spa.html", "utf8");
    expect(shell).toContain('<div id="root"></div>');
    const sitemap = readFileSync("dist/public/sitemap.xml", "utf8");
    expect(sitemap).toContain("<loc>https://www.westhillscapital.com/buy</loc>");
    expect(sitemap).not.toContain("<loc>https://westhillscapital.com");
  });

  it("rejects private routes and does not fetch data during prerender", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Build must not fetch"));
    try {
      const { renderMarketingPage } = await import("@/prerender");
      expect(() => renderMarketingPage("/internal")).toThrow("non-public route");
      expect(() => renderMarketingPage("/docuplete/public/secret")).toThrow("non-public route");
      for (const route of ["/", "/pricing", "/ira", "/faq", "/buy"]) {
        expect(renderMarketingPage(route).html).toContain("<h1");
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("canonical host normalization", () => {
  it("uses the live www host without query parameters", () => {
    expect(canonicalSiteUrl("https://westhillscapital.com/faq?source=ad#answer"))
      .toBe("https://www.westhillscapital.com/faq");
    expect(canonicalSiteUrl("/pricing")).toBe("https://www.westhillscapital.com/pricing");
    expect(canonicalSiteUrl("https://example.com/faq")).toBe("https://example.com/faq");
  });
});

describe("sourced buyer education", () => {
  it("distinguishes commission from premium using explicitly hypothetical numbers", () => {
    const { container } = render(<PricingExplainer />);
    expect(container.textContent).toContain("Illustrative calculation — not a quote");
    expect(container.textContent).toContain("$2,142");
    expect(container.textContent).toContain("7.1%");
    expect(2100 * 1.02).toBe(2142);
    expect((2142 - 2000) / 2000 * 100).toBeCloseTo(7.1);
    expect(container.querySelector('a[href^="https://www.cftc.gov/"]')).not.toBeNull();
  });

  it("explains the IRA roles, transfer differences, storage and risks with primary sources", () => {
    const { container } = render(<IraEssentials />);
    for (const text of ["metals dealer", "custodian", "depository", "60 days", "one-IRA-rollover-per-year", "taxes or penalties", "Neither an IRA nor physical ownership guarantees a return"]) {
      expect(container.textContent).toContain(text);
    }
    expect(container.querySelectorAll('a[href^="https://www.irs.gov/"]')).toHaveLength(2);
    for (const link of container.querySelectorAll("a")) {
      expect(link.rel).toContain("noopener");
      expect(link.rel).toContain("noreferrer");
    }
  });

  it.skipIf(!existsSync("dist/public/ira/index.html"))("includes the explanations and citations in initial HTML", () => {
    const pricing = readFileSync("dist/public/pricing/index.html", "utf8");
    const ira = readFileSync("dist/public/ira/index.html", "utf8");
    expect(pricing).toContain('id="pricing-explained"');
    expect(pricing).toContain("Metals10Things.html");
    expect(ira).toContain('id="ira-essentials"');
    expect(ira).toContain("qualified-plan-accounts");
    expect(ira).not.toContain("initiate a tax-free rollover");
    expect(ira).not.toContain("are not commingled with other accounts");
    expect(readFileSync("dist/public/robots.txt", "utf8"))
      .toContain("Sitemap: https://www.westhillscapital.com/sitemap.xml");
  });
});

describe("owner-approved purchase policies", () => {
  it.each([
    "../api-server/src/lib/generatePurchaseAgreementPdf.ts",
    "../api-server/src/scripts/exportDocupleteTemplate.ts",
    "../api-server/src/scripts/seedPurchaseAgreementPackage.ts",
  ])("keeps the PDF agreement source aligned: %s", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).toContain("PURCHASE_AGREEMENT_PRICE_TERMS");
    expect(source).toContain("PURCHASE_AGREEMENT_PICKUP_NOTICE");
    expect(source).not.toContain("Final price is confirmed at trade execution");
    expect(source).not.toContain("Prices may vary slightly at execution");
  });

  const textOf = (html: string) => new DOMParser().parseFromString(html, "text/html").body.textContent!;

  it("publishes both purchase channels and staffed pickup on Home and FAQ", async () => {
    const { renderMarketingPage } = await import("@/prerender");
    for (const route of ["/", "/faq"]) {
      const text = textOf(renderMarketingPage(route).html);
      expect(text).toContain(PURCHASE_CHANNELS);
      expect(text).toContain(NON_IRA_DELIVERY);
      expect(text).toContain(SELF_SERVE_PRICE_LOCK);
      expect(text).not.toContain("Every purchase begins with a private call");
      expect(text).not.toContain("we don't take orders online");
      expect(text).not.toContain("delivery to your home");
    }
  });

  it("uses the approved answers in FAQ structured data as well as visible copy", () => {
    const { container } = render(<FAQ />);
    const schema = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
    const questions = schema.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(questions.find(q => q.name === "Can I buy without a phone call?")!.acceptedAnswer.text).toContain(PURCHASE_CHANNELS);
    expect(questions.find(q => q.name === "When is pricing locked in?")!.acceptedAnswer.text).toContain(SELF_SERVE_PRICE_LOCK);
    expect(questions.find(q => q.name === "Can non-IRA purchases be shipped to my home?")!.acceptedAnswer.text).toContain(NON_IRA_DELIVERY);
  });

  it("removes call-only and post-payment price-lock claims from legal and supporting pages", () => {
    for (const Page of [Terms, Disclosures, About, Radio]) {
      const text = textOf(renderToStaticMarkup(<Page />));
      expect(text).not.toContain("Every purchase begins with a private call");
      expect(text).not.toContain("Every commitment is confirmed verbally");
      expect(text).not.toContain("prices are locked, only after full payment");
      expect(text).not.toContain("delivery to your home");
      expect(text.toLowerCase()).toContain("self-serve");
      expect(text).toContain("FedEx");
    }
  });

  it("preserves distinct IRA rules and clarifies signing rather than sending or paying", async () => {
    const { renderMarketingPage } = await import("@/prerender");
    expect(textOf(renderMarketingPage("/ira").html)).toContain("No trade is executed before funds are fully settled");
    const source = readFileSync("src/pages/Buy.tsx", "utf8");
    expect(source).toContain("it does not");
    expect(source).toContain("itself make the purchase binding");
    expect(source).not.toContain("Prices may vary slightly at execution");
    expect(source).not.toContain("Wire funds by end of next business day to lock your price");
    expect(source).toContain("{SELF_SERVE_PRICE_LOCK}");
    const staff = readFileSync("../api-server/src/routes/buy.ts", "utf8");
    expect(staff).toContain("do not reprice the signed order");
  });
});
