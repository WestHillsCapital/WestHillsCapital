/**
 * check-build-deps-lib.mjs
 *
 * Pure utility functions shared between check-build-deps.mjs and its test
 * suite. Exported so tests can import without triggering the script's
 * top-level side-effects.
 */

import { readdirSync } from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";

const nodeBuiltins = new Set(builtinModules);

// Collect all static import specifiers from a source string.
// Matches:  import ... from "pkg"  |  import("pkg")  |  require("pkg")
const importRe = /(?:^|\s)import\s[^'"\n]*['"]([^'"\n]+)['"]/gm;
const dynamicRe = /import\(['"]([^'"\n]+)['"]\)/g;
const requireRe = /\brequire\(['"]([^'"\n]+)['"]\)/g;

export function collectSpecifiers(src) {
  const specifiers = new Set();
  for (const re of [importRe, dynamicRe, requireRe]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      specifiers.add(m[1]);
    }
  }
  return specifiers;
}

// Resolve a bare specifier to its package name (handles scoped packages).
export function pkgName(specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("node:")) return null;
  const top = specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0];
  if (nodeBuiltins.has(top)) return null;
  return top;
}

export const SCRIPT_EXTENSIONS = new Set([".mjs", ".js", ".ts"]);

// Recursively collect all script files under a directory.
export function collectScriptFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectScriptFiles(full));
    } else if (entry.isFile() && SCRIPT_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}
