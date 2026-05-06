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

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    sendDefaultPii: false,
  });
}

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
