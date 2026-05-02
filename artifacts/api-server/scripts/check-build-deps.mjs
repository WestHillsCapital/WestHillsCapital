/**
 * check-build-deps.mjs
 *
 * Verifies that every third-party package imported by build.mjs or any
 * .mjs, .js, or .ts script under scripts/ is listed in `dependencies`
 * (not just `devDependencies`) of package.json.
 *
 * Build tooling that lives only in devDependencies will be absent in
 * production installs (e.g. Railway with NODE_ENV=production), causing
 * ERR_MODULE_NOT_FOUND at build time. Running this script before the
 * actual build surfaces the problem immediately with a clear error message.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectSpecifiers, pkgName, collectScriptFiles } from "./check-build-deps-lib.mjs";

const artifactDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scriptsDir = path.join(artifactDir, "scripts");
const pkgFile = path.join(artifactDir, "package.json");

const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));

const prodDeps = new Set(Object.keys(pkg.dependencies ?? {}));
const devDeps = new Set(Object.keys(pkg.devDependencies ?? {}));

// Build the list of files to check: build.mjs is required; scripts/ files are
// discovered dynamically. The checker itself and its support library are
// excluded to avoid false positives from their own source text.
const selfPath = fileURLToPath(import.meta.url);
const libPath = fileURLToPath(new URL("./check-build-deps-lib.mjs", import.meta.url));

const filesToCheck = [
  // build.mjs is a required input — fail fast if it's unreadable.
  { filePath: path.join(artifactDir, "build.mjs"), required: true },
];

const excluded = new Set([selfPath, libPath]);

for (const filePath of collectScriptFiles(scriptsDir)) {
  if (!excluded.has(filePath)) {
    filesToCheck.push({ filePath, required: false });
  }
}

// findings collected per file.
const findings = [];

for (const { filePath, required } of filesToCheck) {
  let src;
  try {
    src = readFileSync(filePath, "utf8");
  } catch (err) {
    if (required) {
      console.error(
        `\n[check-build-deps] ERROR: Could not read required file ${path.relative(artifactDir, filePath)}: ${err.message}\n`
      );
      process.exit(1);
    }
    // Optional script files that are unreadable are skipped.
    continue;
  }

  const specifiers = collectSpecifiers(src);
  const wronglyInDevDeps = [];
  const missingFromDeps = [];

  for (const specifier of specifiers) {
    const name = pkgName(specifier);
    if (!name) continue;

    if (devDeps.has(name) && !prodDeps.has(name)) {
      wronglyInDevDeps.push(name);
    } else if (!prodDeps.has(name) && !devDeps.has(name)) {
      missingFromDeps.push(name);
    }
  }

  if (wronglyInDevDeps.length > 0 || missingFromDeps.length > 0) {
    findings.push({ filePath, wronglyInDevDeps, missingFromDeps });
  }
}

let failed = false;

for (const { filePath, wronglyInDevDeps, missingFromDeps } of findings) {
  const rel = path.relative(artifactDir, filePath);

  if (wronglyInDevDeps.length > 0) {
    console.error(
      `\n[check-build-deps] ERROR in ${rel}: The following package(s) are imported ` +
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
      `\n[check-build-deps] ERROR in ${rel}: The following package(s) are imported ` +
      "but are not listed in package.json at all.\n" +
      "Add them to dependencies:\n\n" +
      missingFromDeps.map((p) => `  - ${p}`).join("\n") +
      "\n"
    );
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

const checkedFiles = filesToCheck.map(({ filePath }) => path.relative(artifactDir, filePath)).join(", ");
console.log(`[check-build-deps] OK — all imports are in dependencies. (checked: ${checkedFiles})`);
