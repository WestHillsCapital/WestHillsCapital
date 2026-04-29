/**
 * check-build-deps.mjs
 *
 * Verifies that every third-party package imported by build.mjs is listed in
 * `dependencies` (not just `devDependencies`) of package.json.
 *
 * Build tooling that lives only in devDependencies will be absent in production
 * installs (e.g. Railway with NODE_ENV=production), causing ERR_MODULE_NOT_FOUND
 * at build time. Running this script before the actual build surfaces the problem
 * immediately with a clear error message.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";

const artifactDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const buildFile = path.join(artifactDir, "build.mjs");
const pkgFile = path.join(artifactDir, "package.json");

const buildSrc = readFileSync(buildFile, "utf8");
const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));

const prodDeps = new Set(Object.keys(pkg.dependencies ?? {}));
const devDeps = new Set(Object.keys(pkg.devDependencies ?? {}));

// Use the runtime's own list so the check stays accurate across Node versions.
const nodeBuiltins = new Set(builtinModules);

// Collect all static import specifiers from build.mjs.
// Matches:  import ... from "pkg"  |  import("pkg")  |  require("pkg")
const importRe = /(?:^|\s)import\s[^'"]*['"]([^'"]+)['"]/gm;
const dynamicRe = /import\(['"]([^'"]+)['"]\)/g;
const requireRe = /\brequire\(['"]([^'"]+)['"]\)/g;

const specifiers = new Set();
for (const re of [importRe, dynamicRe, requireRe]) {
  let m;
  while ((m = re.exec(buildSrc)) !== null) {
    specifiers.add(m[1]);
  }
}

// Resolve a bare specifier to its package name (handles scoped packages).
function pkgName(specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null; // relative/absolute path
  if (specifier.startsWith("node:")) return null; // built-in (node: prefix)
  const top = specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0];
  if (nodeBuiltins.has(top)) return null; // bare built-in (e.g. "path", "fs")
  return top;
}

const missingFromDeps = [];
const wronglyInDevDeps = [];

for (const specifier of specifiers) {
  const name = pkgName(specifier);
  if (!name) continue;

  if (devDeps.has(name) && !prodDeps.has(name)) {
    wronglyInDevDeps.push(name);
  } else if (!prodDeps.has(name) && !devDeps.has(name)) {
    missingFromDeps.push(name);
  }
}

let failed = false;

if (wronglyInDevDeps.length > 0) {
  console.error(
    "\n[check-build-deps] ERROR: The following package(s) are imported by build.mjs " +
    "but are listed only in devDependencies.\n" +
    "They will be absent in production installs and will cause build failures.\n" +
    "Move them to dependencies:\n\n" +
    wronglyInDevDeps.map((p) => `  - ${p}`).join("\n") +
    "\n"
  );
  failed = true;
}

if (missingFromDeps.length > 0) {
  console.error(
    "\n[check-build-deps] ERROR: The following package(s) are imported by build.mjs " +
    "but are not listed in package.json at all.\n" +
    "Add them to dependencies:\n\n" +
    missingFromDeps.map((p) => `  - ${p}`).join("\n") +
    "\n"
  );
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log("[check-build-deps] OK — all build.mjs imports are in dependencies.");
