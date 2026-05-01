import { useState, useEffect } from "react";

const COOKIE_NAME = "whc_cookie_consent";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

type ConsentValue = "granted" | "denied";

function getStoredConsent(): ConsentValue | null {
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${COOKIE_NAME}=`));
    if (!match) return null;
    const value = match.split("=")[1];
    if (value === "granted" || value === "denied") return value;
  } catch {
  }
  return null;
}

function setStoredConsent(value: ConsentValue): void {
  document.cookie = `${COOKIE_NAME}=${value}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getStoredConsent();
    if (existing === null) {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    setStoredConsent("granted");
    setVisible(false);
  }

  function handleDecline() {
    setStoredConsent("denied");
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
        We use cookies to understand how visitors use our site. If you submit
        our contact form, your email address is stored to send you the guides
        you requested. Your data stays private and is never sold.{" "}
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
