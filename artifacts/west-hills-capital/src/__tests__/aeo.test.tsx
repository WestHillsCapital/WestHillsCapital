import { describe, expect, it, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import FAQ from "@/pages/FAQ";
import { canonicalSiteUrl } from "@/lib/site-url";
import { PricingExplainer } from "@/components/education/PricingExplainer";
import { IraEssentials } from "@/components/education/IraEssentials";

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
