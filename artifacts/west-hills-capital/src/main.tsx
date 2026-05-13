// Polyfill Map.prototype.getOrInsertComputed — used by pdfjs-dist 5.x internally.
// Required for Chrome < 131 and some headless/test browsers that ship without it.
if (typeof Map !== "undefined" && !("getOrInsertComputed" in Map.prototype)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Map.prototype as any).getOrInsertComputed = function <K, V>(
    key: K,
    callbackFn: (key: K) => V
  ): V {
    if (this.has(key)) return this.get(key) as V;
    const value = callbackFn(key);
    this.set(key, value);
    return value;
  };
}

import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

// Only initialize in production — avoids DSN validation noise during local dev
// and ensures local errors never pollute the production Sentry project.
if (SENTRY_DSN && import.meta.env.PROD) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
  });
}

// When the dev/prod server restarts, previously cached lazy-chunk URLs become
// stale (content hash changes). Vite fires "vite:preloadError" when a dynamic
// import fails for this reason. Reloading the page fetches the fresh manifest
// and restores navigation without the user seeing a blank screen.
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
