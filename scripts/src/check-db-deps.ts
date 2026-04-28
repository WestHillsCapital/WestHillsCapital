import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const DB_PKG_JSON = join(WORKSPACE_ROOT, "lib/db/package.json");
const DB_SRC_DIR = join(WORKSPACE_ROOT, "lib/db/src");

const TRACKED_PACKAGES = ["drizzle-zod", "zod"];

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (extname(full) === ".ts") {
      results.push(full);
    }
  }
  return results;
}

function stripComments(src: string): string {
  return src
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function getImportedPackages(files: string[]): Set<string> {
  const found = new Set<string>();
  const importRe = /from\s+['"]([^'"]+)['"]/g;
  for (const file of files) {
    const src = stripComments(readFileSync(file, "utf8"));
    for (const match of src.matchAll(importRe)) {
      const specifier = match[1];
      for (const pkg of TRACKED_PACKAGES) {
        if (specifier === pkg || specifier.startsWith(`${pkg}/`)) {
          found.add(pkg);
        }
      }
    }
  }
  return found;
}

function getDeclaredPackages(): Set<string> {
  const pkg = JSON.parse(readFileSync(DB_PKG_JSON, "utf8"));
  const declared = new Set<string>();
  for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
    for (const name of Object.keys(pkg[section] ?? {})) {
      if (TRACKED_PACKAGES.includes(name)) {
        declared.add(name);
      }
    }
  }
  return declared;
}

const files = collectTsFiles(DB_SRC_DIR);
const imported = getImportedPackages(files);
const declared = getDeclaredPackages();

const missing = [...imported].filter((p) => !declared.has(p));
const unused = [...declared].filter((p) => !imported.has(p));

let failed = false;

if (missing.length > 0) {
  console.error(
    `\nERROR: The following packages are imported in lib/db but not declared in lib/db/package.json:\n`
  );
  for (const pkg of missing) {
    console.error(`  - ${pkg}`);
  }
  console.error(
    `\nFix: run  pnpm --filter @workspace/db add ${missing.join(" ")}  to add them.\n`
  );
  failed = true;
}

if (unused.length > 0) {
  console.warn(
    `\nWARNING: The following packages are declared in lib/db/package.json but not imported anywhere in lib/db/src:\n`
  );
  for (const pkg of unused) {
    console.warn(`  - ${pkg}`);
  }
  console.warn(
    `\nConsider removing them with  pnpm --filter @workspace/db remove ${unused.join(" ")}\n`
  );
}

if (!failed && unused.length === 0) {
  console.log("lib/db dependency check passed.");
}

if (failed) {
  process.exit(1);
}
