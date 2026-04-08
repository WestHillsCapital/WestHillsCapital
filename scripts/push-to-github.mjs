/**
 * Push specified files (or all tracked changes) to the Railway-connected GitHub repo.
 * Railway watches: WestHillsCapital/WestHillsCapital  (branch: main)
 *
 * Usage:  node scripts/push-to-github.mjs "commit message" [file1 file2 ...]
 * If no files are listed, ALL files below are pushed.
 */
import { readFileSync } from "fs";

const PAT   = process.env.GITHUB_PAT;
const OWNER = "WestHillsCapital";
const REPO  = "WestHillsCapital";   // ← Railway watches THIS repo (not west-hills-capital)
const BRANCH = "main";

const DEFAULT_FILES = [
  "lib/api-zod/src/generated/api.ts",
  "artifacts/api-server/src/db.ts",
  "artifacts/api-server/src/lib/ratelimit.ts",
  "artifacts/api-server/src/lib/email.ts",
  "artifacts/api-server/src/lib/logger.ts",
  "artifacts/api-server/src/routes/scheduling.ts",
  "artifacts/api-server/src/routes/leads.ts",
  "artifacts/api-server/src/routes/pricing.ts",
  "artifacts/api-server/src/routes/index.ts",
  "artifacts/api-server/src/app.ts",
  "artifacts/api-server/src/index.ts",
  "artifacts/west-hills-capital/src/hooks/use-scheduling.ts",
  "artifacts/west-hills-capital/src/hooks/use-pricing.ts",
];

const h = {
  Authorization: `token ${PAT}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
  "User-Agent": "whc-push",
};

async function gh(path, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, { headers: h, ...opts });
  const d = await r.json();
  if (!r.ok) throw new Error(`${path}: ${r.status} ${JSON.stringify(d)}`);
  return d;
}

const [,, message = "chore: update", ...argFiles] = process.argv;
const files = argFiles.length ? argFiles : DEFAULT_FILES;

const branch = await gh(`/branches/${BRANCH}`);
const baseSha = branch.commit.sha;
const baseTreeSha = branch.commit.commit.tree.sha;

const treeItems = [];
for (const f of files) {
  try {
    const blob = await gh("/git/blobs", {
      method: "POST",
      body: JSON.stringify({ content: readFileSync(f, "utf8"), encoding: "utf-8" }),
    });
    treeItems.push({ path: f, mode: "100644", type: "blob", sha: blob.sha });
    console.log("  ✓", f);
  } catch (err) {
    console.warn("  ✗ skipped (not found):", f);
  }
}

if (!treeItems.length) { console.error("No files to push."); process.exit(1); }

const tree   = await gh("/git/trees",   { method: "POST", body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }) });
const commit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] }) });
await gh(`/git/refs/heads/${BRANCH}`,   { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });

console.log(`\nPushed to ${OWNER}/${REPO}@${BRANCH}: ${commit.sha.slice(0, 10)}`);
console.log("Railway will auto-deploy from this commit.");
