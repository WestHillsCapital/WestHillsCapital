import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Google Analytics consent and routing", () => {
  beforeEach(() => {
    vi.resetModules();
    document.cookie = "whc_cookie_consent=; max-age=0; path=/";
    document.getElementById("whc-google-analytics")?.remove();
    delete (window as unknown as Record<string, unknown>).gtag;
    delete (window as unknown as Record<string, unknown>).dataLayer;
  });

  it("does not load the tag before consent or after decline", async () => {
    const { trackPageView } = await import("@/lib/google-analytics");
    trackPageView("/");
    expect(document.getElementById("whc-google-analytics")).toBeNull();
    document.cookie = "whc_cookie_consent=denied; path=/";
    trackPageView("/buy");
    expect(document.getElementById("whc-google-analytics")).toBeNull();
  });

  it("loads the requested tag once and tracks client-side pages after acceptance", async () => {
    document.cookie = "whc_cookie_consent=granted; path=/";
    const { trackPageView } = await import("@/lib/google-analytics");
    trackPageView("/");
    trackPageView("/buy");
    expect(document.querySelectorAll("#whc-google-analytics")).toHaveLength(1);
    expect(document.getElementById("whc-google-analytics")?.getAttribute("src"))
      .toBe("https://www.googletagmanager.com/gtag/js?id=G-CL0N3NWYHM");
    const entries = (window as unknown as { dataLayer: IArguments[] }).dataLayer.map((entry) => Array.from(entry));
    expect(entries.filter((entry) => entry[0] === "config")).toHaveLength(1);
    expect(entries.filter((entry) => entry[1] === "page_view")).toHaveLength(2);
    expect(entries.at(-1)?.[2]).toMatchObject({ page_referrer: "" });
  });

  it("excludes private and signing routes even when consent is granted", async () => {
    document.cookie = "whc_cookie_consent=granted; path=/";
    const { trackPageView } = await import("@/lib/google-analytics");
    for (const path of ["/internal", "/app", "/docuplete/public/secret", "/verify/secret", "/sandbox"]) {
      trackPageView(path);
    }
    expect(document.getElementById("whc-google-analytics")).toBeNull();
  });

  it("disables an already loaded tag on private routes or withdrawn consent", async () => {
    document.cookie = "whc_cookie_consent=granted; path=/";
    const { trackPageView } = await import("@/lib/google-analytics");
    trackPageView("/");
    trackPageView("/internal");
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-CL0N3NWYHM"]).toBe(true);
    document.cookie = "whc_cookie_consent=denied; path=/";
    trackPageView("/buy");
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-CL0N3NWYHM"]).toBe(true);
  });
});
