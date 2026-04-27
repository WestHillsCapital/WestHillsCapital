/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies all Clerk requests through your domain, enabling Clerk authentication
 * on custom domains without requiring CNAME DNS configuration.
 *
 * Two path types handled:
 *   /npm/...  → fetched directly from frontend-api.clerk.dev following redirects
 *              (Clerk returns a 307 for version resolution — we resolve it server-side)
 *   everything else → proxied via http-proxy-middleware to frontend-api.clerk.dev
 *                     with Clerk-Proxy-Url and Clerk-Secret-Key headers attached
 *
 * AUTH CONFIGURATION: To manage users, enable/disable login providers
 * (Google, GitHub, etc.), change app branding, or configure OAuth credentials,
 * use the Auth pane in the workspace toolbar. There is no external Clerk
 * dashboard — all auth configuration is done through the Auth pane.
 *
 * IMPORTANT:
 * - Only active in production (Clerk proxying doesn't work for dev instances)
 * - Must be mounted BEFORE express.json() middleware
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import https from "node:https";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { RequestHandler } from "express";

const CLERK_FAPI = "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

/**
 * Fetch a URL following redirects and pipe the final response into an Express
 * response object.  Used for the /npm/... CDN path where Clerk returns a 307
 * version-resolution redirect before serving the actual JS bundle.
 */
function pipeClerkCdn(subPath: string, res: import("express").Response): void {
  const url = new URL(`${CLERK_FAPI}${subPath}`);

  function request(target: URL): void {
    https.get(
      {
        hostname: target.hostname,
        path: target.pathname + target.search,
        headers: { "User-Agent": "clerk-proxy/1.0" },
      },
      (upstream) => {
        const location = upstream.headers["location"];
        if (
          upstream.statusCode &&
          upstream.statusCode >= 300 &&
          upstream.statusCode < 400 &&
          location
        ) {
          // Follow redirect (always on the same host for Clerk's CDN)
          upstream.resume();
          request(new URL(location, `https://${target.hostname}`));
          return;
        }

        res.status(upstream.statusCode ?? 502);
        const ct = upstream.headers["content-type"];
        if (ct) res.setHeader("Content-Type", ct);
        res.setHeader("Cache-Control", "public, max-age=86400, immutable");
        upstream.pipe(res);
      },
    ).on("error", () => {
      if (!res.headersSent) res.status(502).end();
    });
  }

  request(url);
}

export function clerkProxyMiddleware(): RequestHandler {
  // Only run proxy in production — Clerk proxying doesn't work for dev instances
  if (process.env.NODE_ENV !== "production") {
    return (_req, _res, next) => next();
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  // Proxy for Clerk Frontend API auth calls (everything except the npm CDN)
  const fapiProxy = createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers.host || "";
        const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;

        proxyReq.setHeader("Clerk-Proxy-Url", proxyUrl);
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);

        const xff = req.headers["x-forwarded-for"];
        const clientIp =
          (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          "";
        if (clientIp) {
          proxyReq.setHeader("X-Forwarded-For", clientIp);
        }
      },
    },
  }) as RequestHandler;

  return (req, res, next) => {
    // /npm/... is the Clerk JS bundle CDN path.  Clerk resolves @major versions
    // via a 307 redirect before serving the file, so we handle it with a direct
    // HTTPS fetch that follows redirects natively instead of relying on the proxy.
    if (req.path.startsWith("/npm/")) {
      pipeClerkCdn(req.path, res);
      return;
    }
    return fapiProxy(req, res, next);
  };
}
