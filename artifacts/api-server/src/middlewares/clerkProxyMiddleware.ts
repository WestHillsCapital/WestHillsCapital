/**
 * Clerk Frontend API + NPM CDN Proxy Middleware
 *
 * Proxies Clerk requests through your domain, enabling Clerk authentication
 * on custom domains without requiring CNAME DNS configuration.
 *
 * Two different upstream targets are needed:
 *   /api/__clerk/npm/... → https://npm.clerk.dev  (clerk.browser.js + assets)
 *   /api/__clerk/...     → https://frontend-api.clerk.dev  (auth API calls)
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

import { createProxyMiddleware } from "http-proxy-middleware";
import type { RequestHandler } from "express";

const CLERK_FAPI    = "https://frontend-api.clerk.dev";
const CLERK_NPM_CDN = "https://npm.clerk.dev";

export const CLERK_PROXY_PATH = "/api/__clerk";

export function clerkProxyMiddleware(): RequestHandler {
  // Only run proxy in production — Clerk proxying doesn't work for dev instances
  if (process.env.NODE_ENV !== "production") {
    return (_req, _res, next) => next();
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  // Proxy for NPM CDN assets (clerk.browser.js, chunks, etc.)
  const npmProxy = createProxyMiddleware({
    target: CLERK_NPM_CDN,
    changeOrigin: true,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
  }) as RequestHandler;

  // Proxy for Clerk Frontend API (auth calls, FAPI, etc.)
  const fapiProxy = createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
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
    const subPath = req.path;
    if (subPath.startsWith("/npm/")) {
      return npmProxy(req, res, next);
    }
    return fapiProxy(req, res, next);
  };
}
