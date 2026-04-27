import { useState, useEffect } from "react";

const GA_ID = "G-T4W23SEQCN";
const STORAGE_KEY = "whc_cookie_consent";

type ConsentValue = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function getStoredConsent(): ConsentValue | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "granted" || stored === "denied") return stored;
  } catch {
  }
  return null;
}

function loadGoogleAnalytics() {
  if (document.getElementById("ga-script")) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);

  const script = document.createElement("script");
  script.id = "ga-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getStoredConsent();
    if (existing === "granted") {
      loadGoogleAnalytics();
    } else if (existing === null) {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, "granted");
    loadGoogleAnalytics();
    setVisible(false);
  }

  function handleDecline() {
    localStorage.setItem(STORAGE_KEY, "denied");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 bg-[#1A1A1A] px-5 py-4 shadow-lg sm:px-8"
    >
      <p className="text-sm text-[#D4D4D4] leading-snug max-w-prose">
        We use cookies to understand how visitors use our site. Your data stays
        private and is never sold.{" "}
        <a
          href="/privacy"
          className="underline text-[#C49A38] hover:text-[#d4aa48] transition-colors"
        >
          Privacy&nbsp;Policy
        </a>
      </p>

      <div className="flex shrink-0 gap-2">
        <button
          onClick={handleDecline}
          className="rounded border border-[#555] px-4 py-2 text-sm text-[#D4D4D4] hover:border-[#888] hover:text-white transition-colors"
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          className="rounded bg-[#C49A38] px-4 py-2 text-sm font-medium text-white hover:bg-[#d4aa48] transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
