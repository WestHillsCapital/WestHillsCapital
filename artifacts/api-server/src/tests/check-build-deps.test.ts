/**
 * Tests for scripts/check-build-deps.mjs
 *
 * Covers:
 * 1. collectSpecifiers — extracts static, dynamic, and require() imports
 * 2. pkgName — resolves bare specifiers to package names, ignores builtins
 * 3. Pipeline simulation — passing state, devDep-only detection, missing-dep detection
 * 4. End-to-end smoke test — the real script exits 0 against the actual codebase
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Import the pure functions from the shared lib so we avoid the script's
// top-level side-effects (file reads, process.exit calls).
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";

import {
  collectSpecifiers,
  pkgName,
  collectScriptFiles,
  SCRIPT_EXTENSIONS,
} from "../../scripts/check-build-deps-lib.mjs";

const artifactDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

// ── 1. collectSpecifiers ──────────────────────────────────────────────────────

describe("collectSpecifiers", () => {
  it("picks up a static ESM import", () => {
    const src = `import express from "express";`;
    const specs = collectSpecifiers(src);
    assert.ok(specs.has("express"), "should detect static import");
  });

  it("picks up multiple static imports", () => {
    const src = [
      `import express from "express";`,
      `import { Pool } from "pg";`,
      `import path from "node:path";`,
    ].join("\n");
    const specs = collectSpecifiers(src);
    assert.ok(specs.has("express"));
    assert.ok(specs.has("pg"));
    assert.ok(specs.has("node:path"));
  });

  it("picks up dynamic import()", () => {
    const src = `const mod = await import("some-pkg");`;
    const specs = collectSpecifiers(src);
    assert.ok(specs.has("some-pkg"));
  });

  it("picks up require() calls", () => {
    const src = `const x = require("legacy-pkg");`;
    const specs = collectSpecifiers(src);
    assert.ok(specs.has("legacy-pkg"));
  });

  it("picks up scoped package imports", () => {
    const src = `import { foo } from "@scope/pkg";`;
    const specs = collectSpecifiers(src);
    assert.ok(specs.has("@scope/pkg"));
  });

  it("picks up relative import paths", () => {
    const src = `import { bar } from "./lib/util.js";`;
    const specs = collectSpecifiers(src);
    assert.ok(specs.has("./lib/util.js"));
  });

  it("returns an empty set for source with no imports", () => {
    const src = `const x = 1 + 2;\nconsole.log(x);`;
    const specs = collectSpecifiers(src);
    assert.equal(specs.size, 0);
  });

  it("is idempotent — calling twice returns the same results", () => {
    const src = `import foo from "foo-pkg";\nimport bar from "bar-pkg";`;
    const first = [...collectSpecifiers(src)].sort();
    const second = [...collectSpecifiers(src)].sort();
    assert.deepEqual(first, second);
  });

  it("does not produce false positives from 'import' in a JSDoc comment with a later apostrophe", () => {
    const src = [
      `/**`,
      ` * Exported so tests can import without triggering the script's`,
      ` * top-level side-effects.`,
      ` */`,
      `import express from "express";`,
    ].join("\n");
    const specs = collectSpecifiers(src);
    assert.ok(specs.has("express"), "should still detect the real import");
    assert.equal(specs.size, 1, "should not produce extra false-positive specifiers from the comment");
  });
});

// ── 2. pkgName ────────────────────────────────────────────────────────────────

describe("pkgName", () => {
  it("returns the package name for a bare specifier", () => {
    assert.equal(pkgName("express"), "express");
  });

  it("returns the scoped name for a scoped specifier", () => {
    assert.equal(pkgName("@clerk/express"), "@clerk/express");
  });

  it("returns the root package for a sub-path import", () => {
    assert.equal(pkgName("lodash/fp"), "lodash");
  });

  it("returns the scoped root for a scoped sub-path import", () => {
    assert.equal(pkgName("@scope/pkg/subpath"), "@scope/pkg");
  });

  it("returns null for a relative specifier", () => {
    assert.equal(pkgName("./relative"), null);
  });

  it("returns null for an absolute path specifier", () => {
    assert.equal(pkgName("/absolute/path"), null);
  });

  it("returns null for a node: prefixed specifier", () => {
    assert.equal(pkgName("node:fs"), null);
  });

  it("returns null for a bare Node.js builtin (fs)", () => {
    assert.equal(pkgName("fs"), null);
  });

  it("returns null for a bare Node.js builtin (path)", () => {
    assert.equal(pkgName("path"), null);
  });
});

// ── 3. Pipeline simulation ────────────────────────────────────────────────────
//
// These tests replicate the core check logic inline so we can exercise all
// three outcomes (pass, devDep-only, missing) without touching the filesystem
// or spawning child processes.

function runPipeline(
  src: string,
  prodDeps: Set<string>,
  devDeps: Set<string>
): { wronglyInDevDeps: string[]; missingFromDeps: string[] } {
  const specifiers = collectSpecifiers(src);
  const wronglyInDevDeps: string[] = [];
  const missingFromDeps: string[] = [];

  for (const specifier of specifiers) {
    const name = pkgName(specifier);
    if (!name) continue;

    if (devDeps.has(name) && !prodDeps.has(name)) {
      wronglyInDevDeps.push(name);
    } else if (!prodDeps.has(name) && !devDeps.has(name)) {
      missingFromDeps.push(name);
    }
  }

  return { wronglyInDevDeps, missingFromDeps };
}

describe("dependency check pipeline", () => {
  it("passes when all imported packages are in dependencies", () => {
    const src = `import express from "express";\nimport { Pool } from "pg";`;
    const prodDeps = new Set(["express", "pg"]);
    const devDeps = new Set<string>();

    const { wronglyInDevDeps, missingFromDeps } = runPipeline(src, prodDeps, devDeps);

    assert.equal(wronglyInDevDeps.length, 0, "no devDep-only packages expected");
    assert.equal(missingFromDeps.length, 0, "no missing packages expected");
  });

  it("detects a package that is only in devDependencies", () => {
    const src = `import esbuild from "esbuild";`;
    const prodDeps = new Set<string>();
    const devDeps = new Set(["esbuild"]);

    const { wronglyInDevDeps, missingFromDeps } = runPipeline(src, prodDeps, devDeps);

    assert.ok(
      wronglyInDevDeps.includes("esbuild"),
      "esbuild should be flagged as devDep-only"
    );
    assert.equal(missingFromDeps.length, 0);
  });

  it("detects a package that is completely absent from package.json", () => {
    const src = `import mystery from "mystery-pkg";`;
    const prodDeps = new Set<string>();
    const devDeps = new Set<string>();

    const { wronglyInDevDeps, missingFromDeps } = runPipeline(src, prodDeps, devDeps);

    assert.ok(
      missingFromDeps.includes("mystery-pkg"),
      "mystery-pkg should be flagged as missing"
    );
    assert.equal(wronglyInDevDeps.length, 0);
  });

  it("does not flag Node.js builtins as missing", () => {
    const src = `import { readFileSync } from "node:fs";\nimport path from "path";`;
    const prodDeps = new Set<string>();
    const devDeps = new Set<string>();

    const { wronglyInDevDeps, missingFromDeps } = runPipeline(src, prodDeps, devDeps);

    assert.equal(wronglyInDevDeps.length, 0);
    assert.equal(missingFromDeps.length, 0);
  });

  it("does not flag relative imports as missing", () => {
    const src = `import { helper } from "./utils/helper.js";`;
    const prodDeps = new Set<string>();
    const devDeps = new Set<string>();

    const { wronglyInDevDeps, missingFromDeps } = runPipeline(src, prodDeps, devDeps);

    assert.equal(wronglyInDevDeps.length, 0);
    assert.equal(missingFromDeps.length, 0);
  });

  it("correctly handles a mix of valid, devDep-only, and missing imports", () => {
    const src = [
      `import express from "express";`,
      `import esbuild from "esbuild";`,
      `import ghost from "ghost-pkg";`,
    ].join("\n");
    const prodDeps = new Set(["express"]);
    const devDeps = new Set(["esbuild"]);

    const { wronglyInDevDeps, missingFromDeps } = runPipeline(src, prodDeps, devDeps);

    assert.ok(!wronglyInDevDeps.includes("express"), "express should pass");
    assert.ok(wronglyInDevDeps.includes("esbuild"), "esbuild should be flagged");
    assert.ok(missingFromDeps.includes("ghost-pkg"), "ghost-pkg should be flagged");
  });

  it("a package in both dependencies and devDependencies is not flagged", () => {
    const src = `import dual from "dual-listed";`;
    const prodDeps = new Set(["dual-listed"]);
    const devDeps = new Set(["dual-listed"]);

    const { wronglyInDevDeps, missingFromDeps } = runPipeline(src, prodDeps, devDeps);

    assert.equal(wronglyInDevDeps.length, 0);
    assert.equal(missingFromDeps.length, 0);
  });
});

// ── 4. collectScriptFiles ─────────────────────────────────────────────────────
//
// These tests verify that collectScriptFiles discovers .mjs, .js, and .ts
// files (and skips all other extensions) by writing temporary fixture files
// into a fresh temp directory.

describe("collectScriptFiles", () => {
  it("SCRIPT_EXTENSIONS covers .mjs, .js, and .ts", () => {
    assert.ok(SCRIPT_EXTENSIONS.has(".mjs"), "must include .mjs");
    assert.ok(SCRIPT_EXTENSIONS.has(".js"),  "must include .js");
    assert.ok(SCRIPT_EXTENSIONS.has(".ts"),  "must include .ts");
  });

  it("collects .mjs, .js, and .ts files and skips other extensions", () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "check-build-deps-test-"));
    const fixtures: Record<string, boolean> = {
      "script.mjs": true,
      "script.js":  true,
      "script.ts":  true,
      "script.json": false,
      "script.txt":  false,
      "script.cjs":  false,
    };
    for (const name of Object.keys(fixtures)) {
      writeFileSync(path.join(tmpDir, name), "");
    }

    const found = new Set(collectScriptFiles(tmpDir).map((f) => path.basename(f)));
    for (const [name, shouldBeFound] of Object.entries(fixtures)) {
      if (shouldBeFound) {
        assert.ok(found.has(name), `expected ${name} to be collected`);
      } else {
        assert.ok(!found.has(name), `expected ${name} to be skipped`);
      }
    }
  });

  it("recurses into subdirectories", () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "check-build-deps-test-"));
    const subDir = path.join(tmpDir, "sub");
    mkdirSync(subDir);
    writeFileSync(path.join(tmpDir, "top.mjs"), "");
    writeFileSync(path.join(subDir, "nested.ts"), "");

    const found = collectScriptFiles(tmpDir).map((f) => path.basename(f));
    assert.ok(found.includes("top.mjs"), "should find top-level .mjs");
    assert.ok(found.includes("nested.ts"), "should find nested .ts");
  });

  it("returns an empty array for a directory with no matching files", () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "check-build-deps-test-"));
    writeFileSync(path.join(tmpDir, "README.md"), "");
    writeFileSync(path.join(tmpDir, "data.json"), "");

    const found = collectScriptFiles(tmpDir);
    assert.equal(found.length, 0, "no script files expected");
  });

  it("returns an empty array for a non-existent directory", () => {
    const found = collectScriptFiles("/tmp/__does_not_exist_xyz__");
    assert.equal(found.length, 0);
  });

  it("discovers init-test-db.ts in the real scripts/ directory", () => {
    const scriptsDir = path.join(artifactDir, "scripts");
    const found = collectScriptFiles(scriptsDir).map((f) => path.basename(f));
    assert.ok(found.includes("init-test-db.ts"), "init-test-db.ts should be discovered");
  });
});

// ── 5. End-to-end smoke test ──────────────────────────────────────────────────

describe("check-build-deps.mjs end-to-end", () => {
  it("exits 0 against the real codebase (passing state)", () => {
    const scriptPath = path.join(artifactDir, "scripts", "check-build-deps.mjs");
    const result = spawnSync("node", [scriptPath], {
      encoding: "utf8",
      cwd: artifactDir,
    });

    assert.equal(
      result.status,
      0,
      `Script should exit 0 but got ${result.status}.\nstderr: ${result.stderr}\nstdout: ${result.stdout}`
    );
    assert.ok(
      result.stdout.includes("[check-build-deps] OK"),
      "stdout should contain OK message"
    );
  });
});
