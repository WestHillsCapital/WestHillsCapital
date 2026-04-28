/**
 * Full content-hash sync: compares every watched source file against GitHub
 * using git blob SHA1 hashes, then pushes anything stale or missing in one commit.
 *
 * Usage:
 *   node scripts/sync-to-github.mjs             # dry-run — prints what would be pushed
 *   node scripts/sync-to-github.mjs --push      # actually push
 *   node scripts/sync-to-github.mjs --push "optional commit message"
 */

import { readFileSync, statSync, readdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const PAT    = process.env.GITHUB_PAT;
const OWNER  = "WestHillsCapital";
const REPO   = "WestHillsCapital";
const BRANCH = "main";

const WATCH_DIRS = [
  "artifacts/api-server/src",
  "artifacts/west-hills-capital/src",
];

const WATCH_ROOT_FILES = [
  "artifacts/west-hills-capital/package.json",
  "artifacts/west-hills-capital/vitest.config.ts",
  "artifacts/west-hills-capital/vite.config.ts",
  "artifacts/west-hills-capital/tsconfig.json",
  "artifacts/api-server/package.json",
  "pnpm-lock.yaml",
  "package.json",
];

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "coverage", ".vite"]);

const h = {
  Authorization: `token ${PAT}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
  "User-Agent": "whc-sync",
};

async function gh(path, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, { headers: h, ...opts });
  const d = await r.json();
  if (!r.ok) throw new Error(`${path}: ${r.status} ${JSON.stringify(d)}`);
  return d;
}

/** Compute the same SHA1 git uses for a blob. */
function gitBlobSha(localPath) {
  const data = readFileSync(localPath);
  const header = Buffer.from(`blob ${data.length}\0`);
  return createHash("sha1").update(Buffer.concat([header, data])).digest("hex");
}

/** Recursively list all files under a local directory. */
function walkDir(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkDir(full, out);
    } else {
      out.push(full.replace(/\\/g, "/"));
    }
  }
  return out;
}

// ── main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const doPush = args.includes("--push");
const message = args.filter(a => !a.startsWith("--")).join(" ") || "chore: sync local source files to GitHub";

console.log(`\n${doPush ? "🔄 Sync" : "🔍 Dry-run"} — comparing local vs WestHillsCapital/${REPO}@${BRANCH}\n`);

// Fetch the full GitHub tree once (recursive = no paging for most repos)
const branch  = await gh(`/branches/${BRANCH}`);
const headSha = branch.commit.sha;
const treeSha = branch.commit.commit.tree.sha;

const treeData = await gh(`/git/trees/${treeSha}?recursive=1`);
const ghBlobs  = {};
for (const item of treeData.tree) {
  if (item.type === "blob") ghBlobs[item.path] = item.sha;
}

// Collect local files
const localFiles = [];
for (const dir of WATCH_DIRS) {
  try { walkDir(dir).forEach(f => localFiles.push(f)); } catch {}
}
for (const f of WATCH_ROOT_FILES) {
  try { statSync(f); localFiles.push(f); } catch {}
}

// Compare
const toSync = [];
for (const localPath of localFiles) {
  const localSha = gitBlobSha(localPath);
  const ghSha    = ghBlobs[localPath];
  if (!ghSha) {
    console.log(`  + MISSING  ${localPath}`);
    toSync.push(localPath);
  } else if (ghSha !== localSha) {
    console.log(`  ~ STALE    ${localPath}`);
    toSync.push(localPath);
  }
}

if (toSync.length === 0) {
  console.log("  ✓ Everything is up to date — nothing to push.\n");
  process.exit(0);
}

console.log(`\nFound ${toSync.length} file(s) to sync.`);

if (!doPush) {
  console.log('\nRe-run with --push to actually sync them:\n');
  console.log(`  node scripts/sync-to-github.mjs --push "${message}"\n`);
  process.exit(0);
}

// Push
const treeItems = [];
for (const f of toSync) {
  const blob = await gh("/git/blobs", {
    method: "POST",
    body: JSON.stringify({ content: readFileSync(f, "utf8"), encoding: "utf-8" }),
  });
  treeItems.push({ path: f, mode: "100644", type: "blob", sha: blob.sha });
  console.log(`  ✓ ${f}`);
}

const newTree   = await gh("/git/trees",   { method: "POST", body: JSON.stringify({ base_tree: treeSha, tree: treeItems }) });
const newCommit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }) });
await gh(`/git/refs/heads/${BRANCH}`,      { method: "PATCH", body: JSON.stringify({ sha: newCommit.sha }) });

console.log(`\nPushed to ${OWNER}/${REPO}@${BRANCH}: ${newCommit.sha.slice(0, 10)}`);
console.log("Railway will auto-deploy from this commit.\n");
