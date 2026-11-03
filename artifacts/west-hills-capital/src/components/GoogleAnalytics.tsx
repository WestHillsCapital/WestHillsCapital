import { useEffect } from "react";
import { useLocation } from "wouter";
import { CONSENT_CHANGED_EVENT, trackPageView } from "@/lib/google-analytics";

export function GoogleAnalytics() {
  const [location] = useLocation();

  useEffect(() => {
    const update = () => trackPageView(location.split(/[?#]/)[0]);
    update();
    window.addEventListener(CONSENT_CHANGED_EVENT, update);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, update);
  }, [location]);

  return null;
}
