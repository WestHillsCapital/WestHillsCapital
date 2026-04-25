import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { INSIGHTS } from "./src/data/insights";

// PORT and BASE_PATH are required in Replit but optional elsewhere (e.g. Vercel).
// Defaults allow `vite build` to succeed without those env vars being set.
const rawPort = process.env.PORT;
const port = rawPort && !Number.isNaN(Number(rawPort)) ? Number(rawPort) : 3000;

const basePath = process.env.BASE_PATH ?? "/";

// In development, force VITE_API_URL to empty so all /api calls use the Vite
// dev-server proxy (→ localhost:8080). In production (Vercel/Railway builds),
// the env var keeps its value and the browser calls Railway directly.
const apiUrl =
  process.env.NODE_ENV === "development"
    ? ""
    : (process.env.VITE_API_URL ?? "");

const SITE_BASE = "https://westhillscapital.com";

const STATIC_PAGES = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/faq", changefreq: "monthly", priority: "0.8" },
  { loc: "/about", changefreq: "monthly", priority: "0.8" },
  { loc: "/pricing", changefreq: "daily", priority: "0.9" },
  { loc: "/ira", changefreq: "monthly", priority: "0.8" },
  { loc: "/schedule", changefreq: "monthly", priority: "0.9" },
  { loc: "/insights", changefreq: "weekly", priority: "0.8" },
  { loc: "/disclosures", changefreq: "yearly", priority: "0.3" },
  { loc: "/terms", changefreq: "yearly", priority: "0.3" },
  { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
];

function buildSitemapXml(): string {
  const articlePages = INSIGHTS.map((a) => ({
    loc: `/insights/${a.slug}`,
    changefreq: "yearly",
    priority: "0.7",
  }));

  const allPages = [...STATIC_PAGES, ...articlePages];

  const urlEntries = allPages
    .map(
      ({ loc, changefreq, priority }) =>
        `  <url>\n    <loc>${SITE_BASE}${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n  <!-- Core pages + static insight articles. In production, /sitemap.xml is\n       rewritten to the API server (vercel.json) which includes DB articles. -->\n${urlEntries}\n\n</urlset>\n`;
}

function sitemapPlugin(): Plugin {
  return {
    name: "vite-plugin-sitemap",
    closeBundle() {
      const outDir = path.resolve(import.meta.dirname, "dist/public");
      if (fs.existsSync(outDir)) {
        fs.writeFileSync(
          path.join(outDir, "sitemap.xml"),
          buildSitemapXml(),
          "utf-8",
        );
      }
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    sitemapPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom", "@clerk/react", "@clerk/shared"],
  },
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(apiUrl),
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React runtime — always loaded
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          // Routing
          if (id.includes("node_modules/wouter")) return "vendor-router";
          // Data fetching
          if (id.includes("node_modules/@tanstack")) return "vendor-query";
          // Animation — heavy, rarely needed on first paint
          if (id.includes("node_modules/framer-motion")) return "vendor-motion";
          // Charts — only used on LivePricing page
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) return "vendor-charts";
          // Radix UI + form libs
          if (id.includes("node_modules/@radix-ui") || id.includes("node_modules/react-hook-form") || id.includes("node_modules/zod")) {
            return "vendor-ui";
          }
          // Icons
          if (id.includes("node_modules/lucide-react") || id.includes("node_modules/react-icons")) {
            return "vendor-icons";
          }
          // Google OAuth
          if (id.includes("node_modules/@react-oauth")) return "vendor-auth";
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/sitemap.xml": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
