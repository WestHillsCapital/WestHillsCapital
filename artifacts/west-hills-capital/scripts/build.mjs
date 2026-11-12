import { build, loadConfigFromFile } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Build the client first, retaining its unrendered shell for all other SPA routes.
await build({ configFile: "vite.config.ts" });
const publicDir = path.resolve("dist/public");
const shell = await readFile(path.join(publicDir, "index.html"), "utf8");
await writeFile(path.join(publicDir, "spa.html"), shell);

const loaded = await loadConfigFromFile({ command: "build", mode: "production" }, "vite.config.ts");
if (!loaded) throw new Error("Could not load Vite build configuration");
const config = loaded.config;
await build({
  ...config,
  configFile: false,
  publicDir: false,
  build: {
    ...config.build,
    ssr: path.resolve("src/prerender.tsx"),
    outDir: path.resolve("dist/prerender"),
    emptyOutDir: true,
    rollupOptions: { output: { format: "es", entryFileNames: "render.mjs" } },
  },
});
const { prerenderRoutes, renderMarketingPage } = await import(
  pathToFileURL(path.resolve("dist/prerender/render.mjs")).href
);

function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function injectMeta(html, name, value, property = false) {
  const attribute = property ? "property" : "name";
  const tag = `<meta ${attribute}="${name}" content="${escapeAttribute(value)}" />`;
  const pattern = new RegExp(`<meta ${attribute}="${name}"[^>]*>`);
  return pattern.test(html) ? html.replace(pattern, () => tag) : html.replace("</head>", `${tag}\n</head>`);
}

for (const route of prerenderRoutes) {
  const { html: body, meta, organization } = renderMarketingPage(route);
  let html = shell.replace(/<title>.*?<\/title>/s, () => `<title>${escapeAttribute(meta.title)}</title>`)
    .replace(/<link rel="canonical"[^>]*>/, () => `<link rel="canonical" href="${escapeAttribute(meta.canonical)}" />`)
    .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
  if (html === shell || !body.includes("<h1")) throw new Error(`Empty prerender output: ${route}`);
  for (const [key, value, property] of [
    ["description", meta.description, false],
    ["og:title", meta.ogTitle ?? meta.title, true],
    ["og:description", meta.ogDescription ?? meta.description, true],
    ["og:url", meta.canonical, true],
    ["twitter:card", "summary_large_image", false],
    ["twitter:title", meta.ogTitle ?? meta.title, false],
    ["twitter:description", meta.ogDescription ?? meta.description, false],
    ...(meta.ogImage ? [["og:image", meta.ogImage, true], ["twitter:image", meta.ogImage, false]] : []),
  ]) html = injectMeta(html, key, value, property);
  const json = JSON.stringify(organization).replaceAll("<", "\\u003c");
  html = html.replace("</head>", `<script type="application/ld+json">${json}</script>\n</head>`);
  const directory = path.join(publicDir, route.slice(1));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "index.html"), html);
  console.log(`[prerender] ${route}: ${body.length} characters, ${meta.canonical}`);
}
