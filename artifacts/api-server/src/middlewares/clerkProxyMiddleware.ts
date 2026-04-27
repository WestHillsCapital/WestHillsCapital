/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies all Clerk requests through your domain, enabling Clerk authentication
 * on custom domains without requiring CNAME DNS configuration.
 *
 * Uses Node's native https module for both CDN assets and FAPI calls.
 * http-proxy-middleware is intentionally avoided because node-http-proxy uses
 * HTTP/1.1 for backend connections while Clerk's endpoints require HTTP/2,
 * causing 502 errors on FAPI calls.
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
import type { RequestHandler, Request, Response } from "express";

const CLERK_FAPI_HOST = "frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

/**
 * Pipe a request to Clerk's FAPI, following redirects and forwarding the
 * body stream. Works for both CDN asset fetches and FAPI auth calls.
 */
function pipeToClerk(
  method: string,
  subPath: string,
  extraHeaders: Record<string, string>,
  req: Request,
  res: Response,
  depth = 0,
): void {
  if (depth > 5) {
    res.status(502).end();
    return;
  }

  const outHeaders: Record<string, string | string[]> = {
    host: CLERK_FAPI_HOST,
    "user-agent": "clerk-proxy/1.0",
    ...extraHeaders,
  };

  // Forward relevant client headers
  for (const h of ["content-type", "content-length", "authorization", "cookie", "origin", "referer"]) {
    const v = req.headers[h];
    if (v) outHeaders[h] = v as string;
  }

  const proxyReq = https.request(
    {
      hostname: CLERK_FAPI_HOST,
      path: subPath,
      method,
      headers: outHeaders,
    },
    (upstream) => {
      const location = upstream.headers["location"];
      if (
        upstream.statusCode &&
        upstream.statusCode >= 300 &&
        upstream.statusCode < 400 &&
        location
      ) {
        upstream.resume();
        // Follow redirect (resolve relative Location against FAPI host)
        const resolved = new URL(location, `https://${CLERK_FAPI_HOST}`);
        pipeToClerk(method, resolved.pathname + resolved.search, extraHeaders, req, res, depth + 1);
        return;
      }

      res.status(upstream.statusCode ?? 502);

      // Forward safe response headers
      for (const h of ["content-type", "cache-control", "etag", "last-modified", "vary"]) {
        const v = upstream.headers[h];
        if (v) res.setHeader(h, v);
      }

      upstream.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    if (!res.headersSent) res.status(502).end();
  });

  // Pipe the request body for POST/PUT/PATCH
  if (method !== "GET" && method !== "HEAD") {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
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

  return (req, res, next) => {
    // req.url already has path + query string with the mount prefix stripped by Express
    const subPath = req.url;
    if (!subPath || subPath === "/") return next();

    // Build extra headers for FAPI calls
    const protocol = (req.headers["x-forwarded-proto"] as string | undefined) || "https";
    const host = req.headers.host || "";
    const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;

    const extraHeaders: Record<string, string> = {
      "clerk-proxy-url": proxyUrl,
      "clerk-secret-key": secretKey,
    };

    const xff = req.headers["x-forwarded-for"];
    const clientIp =
      (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "";
    if (clientIp) extraHeaders["x-forwarded-for"] = clientIp;

    pipeToClerk(req.method, subPath, extraHeaders, req, res);
  };
}
