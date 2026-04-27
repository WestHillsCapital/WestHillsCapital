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
 * Key behaviours:
 * - CDN paths (/npm/*): no auth headers sent — Clerk would redirect them back
 *   through the proxy URL causing an infinite redirect loop.
 * - FAPI paths (/v1/*, etc.): Clerk-Proxy-Url + Clerk-Secret-Key forwarded.
 * - Redirects are followed server-side, respecting cross-domain hops.
 *
 * IMPORTANT:
 * - Only active when NODE_ENV=production and CLERK_SECRET_KEY is set.
 * - Must be mounted BEFORE express.json() middleware.
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
 * Pipe a request to Clerk (FAPI or CDN), following redirects across domains
 * and forwarding the request body stream.
 */
function pipeToClerk(
  hostname: string,
  method: string,
  subPath: string,
  extraHeaders: Record<string, string>,
  req: Request,
  res: Response,
  depth = 0,
): void {
  if (depth > 5) {
    if (!res.headersSent) res.status(502).end();
    return;
  }

  const outHeaders: Record<string, string | string[]> = {
    host: hostname,
    "user-agent": "clerk-proxy/1.0",
    ...extraHeaders,
  };

  // Forward relevant client headers
  for (const h of ["content-type", "content-length", "authorization", "cookie", "origin", "referer"]) {
    const v = req.headers[h];
    if (v) outHeaders[h] = v as string;
  }

  let proxyReq: ReturnType<typeof https.request>;
  try {
    proxyReq = https.request(
      { hostname, path: subPath, method, headers: outHeaders },
      (upstream) => {
        const location = upstream.headers["location"];
        if (
          upstream.statusCode &&
          upstream.statusCode >= 300 &&
          upstream.statusCode < 400 &&
          location
        ) {
          upstream.resume();
          // Follow redirect — resolve against current host so absolute redirects
          // to other Clerk domains (e.g. npm.clerk.dev) work correctly.
          const redirectUrl = new URL(location, `https://${hostname}`);
          // Strip auth headers when redirected away from FAPI host — CDN domains
          // don't expect Clerk-Secret-Key.
          const nextHeaders = redirectUrl.hostname === CLERK_FAPI_HOST ? extraHeaders : {};
          pipeToClerk(redirectUrl.hostname, method, redirectUrl.pathname + redirectUrl.search, nextHeaders, req, res, depth + 1);
          return;
        }

        res.status(upstream.statusCode ?? 502);

        // Forward safe response headers
        for (const h of ["content-type", "cache-control", "etag", "last-modified", "vary"]) {
          const v = upstream.headers[h];
          if (v) res.setHeader(h, v);
        }

        upstream.on("error", () => {
          if (!res.headersSent) res.status(502).end();
        });
        upstream.pipe(res);
      },
    );
  } catch {
    // https.request throws synchronously if header values contain invalid chars
    if (!res.headersSent) res.status(502).end();
    return;
  }

  proxyReq.on("error", () => {
    if (!res.headersSent) res.status(502).end();
  });

  // Pipe the request body for POST/PUT/PATCH — skip for GET/HEAD
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

  // Strip any non-printable/non-ASCII chars that can sneak in when pasting keys
  // in Railway's UI (e.g. zero-width spaces, carriage returns, curly quotes).
  // Valid HTTP header value chars are tab, space, and 0x21-0x7E.
  const secretKey = (process.env.CLERK_SECRET_KEY ?? "")
    .replace(/[^\t\x20-\x7E]/g, "")
    .trim();
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  return (req, res, next) => {
    // req.url has path + query with the mount prefix already stripped by Express
    const subPath = req.url;
    if (!subPath || subPath === "/") return next();

    // Build FAPI auth headers
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

    // CDN paths (/npm/*) must NOT receive Clerk auth headers — if Clerk-Proxy-Url
    // is present, Clerk redirects the version-resolution request back through the
    // proxy URL, creating an infinite redirect loop that ends in 502.
    const headersToSend = subPath.startsWith("/npm/") ? {} : extraHeaders;
    pipeToClerk(CLERK_FAPI_HOST, req.method, subPath, headersToSend, req, res);
  };
}
