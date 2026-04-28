"use strict";

/**
 * Validates all Make.com connector JSON files for structural correctness.
 *
 * Checks:
 * - All JSON files parse without errors
 * - app.json has required fields (name, label, version)
 * - connection.json has required fields (parameters, communication)
 * - Each module has required fields (name, label, type, connection, url, method)
 * - Each RPC has required fields (name, url, method, response)
 * - All module types are valid Make.com types (trigger, action, search)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`  ERROR: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  WARN:  ${msg}`);
  warnings++;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    fail(`${filePath}: invalid JSON — ${e.message}`);
    return null;
  }
}

// ── app.json ─────────────────────────────────────────────────────────────────
console.log("\nChecking app.json...");
const app = readJson(path.join(ROOT, "app.json"));
if (app) {
  for (const field of ["name", "label", "version", "description"]) {
    if (!app[field]) fail(`app.json: missing field "${field}"`);
  }
}

// ── base.json ─────────────────────────────────────────────────────────────────
console.log("Checking base.json...");
const base = readJson(path.join(ROOT, "base.json"));
if (base) {
  if (!base.baseUrl) fail('base.json: missing "baseUrl"');
  if (!base.headers) fail('base.json: missing "headers"');
}

// ── connection.json ───────────────────────────────────────────────────────────
console.log("Checking connection.json...");
const connection = readJson(path.join(ROOT, "connection.json"));
if (connection) {
  if (!Array.isArray(connection.parameters)) fail('connection.json: "parameters" must be an array');
  if (!connection.communication) fail('connection.json: missing "communication"');
  if (connection.communication && !connection.communication.url)
    fail('connection.json: communication.url is required');
}

// ── Modules ───────────────────────────────────────────────────────────────────
const VALID_TYPES = new Set(["trigger", "action", "search", "responder", "universal"]);
const modulesDir = path.join(ROOT, "modules");

for (const file of fs.readdirSync(modulesDir).filter((f) => f.endsWith(".json"))) {
  const filePath = path.join(modulesDir, file);
  console.log(`Checking modules/${file}...`);
  const mod = readJson(filePath);
  if (!mod) continue;

  for (const field of ["name", "label", "type", "connection", "url", "method"]) {
    if (!mod[field]) fail(`modules/${file}: missing field "${field}"`);
  }

  if (mod.type && !VALID_TYPES.has(mod.type)) {
    fail(`modules/${file}: invalid type "${mod.type}" (must be one of: ${[...VALID_TYPES].join(", ")})`);
  }

  if (!mod.interface) warn(`modules/${file}: no "interface" declared — output fields won't be typed`);
  if (!mod.sample) warn(`modules/${file}: no "sample" declared — Make.com requires a sample for each module`);
  if (!mod.response) fail(`modules/${file}: missing "response" — module won't return any data`);
}

// ── RPCs ──────────────────────────────────────────────────────────────────────
const rpcsDir = path.join(ROOT, "rpcs");

for (const file of fs.readdirSync(rpcsDir).filter((f) => f.endsWith(".json"))) {
  const filePath = path.join(rpcsDir, file);
  console.log(`Checking rpcs/${file}...`);
  const rpc = readJson(filePath);
  if (!rpc) continue;

  for (const field of ["name", "url", "method", "response"]) {
    if (!rpc[field]) fail(`rpcs/${file}: missing field "${field}"`);
  }

  if (rpc.response && !rpc.response.output) {
    fail(`rpcs/${file}: response.output is required (must have "label" and "value")`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\nValidation complete: ${errors} error(s), ${warnings} warning(s)\n`);

if (errors > 0) {
  process.exit(1);
}
