import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

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

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
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
    dedupe: ["react", "react-dom"],
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
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
