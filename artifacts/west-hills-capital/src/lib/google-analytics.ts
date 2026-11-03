export const GOOGLE_ANALYTICS_ID = "G-CL0N3NWYHM";
export const CONSENT_CHANGED_EVENT = "whc:cookie-consent-changed";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
} & Partial<Record<`ga-disable-${string}`, boolean>>;

const scriptId = "whc-google-analytics";
let configured = false;

export function hasAnalyticsConsent(): boolean {
  return document.cookie.split(";").some(
    (cookie) => cookie.trim() === "whc_cookie_consent=granted",
  );
}

export function isAnalyticsPage(path: string): boolean {
  const publicPages = [
    "/", "/pricing", "/schedule", "/buy", "/ira", "/about", "/disclosures",
    "/privacy", "/terms", "/faq", "/insights", "/radio", "/coins", "/custodians",
    "/depositories", "/ira-rollovers", "/gold-ira", "/learn",
  ];
  return publicPages.includes(path) ||
    ["/insights/", "/coins/", "/custodians/", "/depositories/", "/ira-rollovers/", "/gold-ira/", "/learn/"]
      .some((prefix) => path.startsWith(prefix));
}

export function trackPageView(path: string): void {
  const analyticsWindow = window as unknown as AnalyticsWindow;
  const permitted = hasAnalyticsConsent() && isAnalyticsPage(path);
  analyticsWindow[`ga-disable-${GOOGLE_ANALYTICS_ID}`] = !permitted;
  if (!permitted) return;

  analyticsWindow.dataLayer ??= [];
  analyticsWindow.gtag ??= function () {
    // Google's loader expects Arguments entries, matching the supplied snippet.
    analyticsWindow.dataLayer!.push(arguments);
  };
  const gtag = analyticsWindow.gtag;
  if (!configured) {
    gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    gtag("js", new Date());
    gtag("config", GOOGLE_ANALYTICS_ID, {
      send_page_view: false,
      page_location: `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`,
      page_referrer: "",
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    configured = true;
  }

  if (!document.getElementById(scriptId)) {
    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
    script.onerror = () => script.remove(); // Permit retry if a later navigation succeeds.
    document.head.appendChild(script);
  }

  // Never include query strings, fragments, form values, or signing tokens.
  gtag("event", "page_view", {
    send_to: GOOGLE_ANALYTICS_ID,
    page_location: `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`,
    page_referrer: "",
  });
}
