/**
 * create-session.ts
 *
 * Demonstrates the complete Docuplete SDK flow:
 *   1. List available packages
 *   2. Create an interview session
 *   3. Print the interview URL
 *   4. Poll until the session is completed
 *
 * Usage:
 *   DOCUPLETE_API_KEY=sk_live_... npx tsx examples/create-session.ts
 *   DOCUPLETE_API_KEY=sk_live_... DOCUPLETE_BASE_URL=http://localhost:3000 npx tsx examples/create-session.ts
 */

import { Docuplete, DocupleteError } from "../src/index.js";

const apiKey   = process.env.DOCUPLETE_API_KEY;
const baseUrl  = process.env.DOCUPLETE_BASE_URL;

if (!apiKey) {
  console.error("Error: DOCUPLETE_API_KEY environment variable is required.");
  console.error("  export DOCUPLETE_API_KEY=sk_live_...");
  process.exit(1);
}

const client = new Docuplete({ apiKey, baseUrl });

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log("Docuplete SDK — create-session example\n");

  // 1. Verify account
  const account = await client.account.get();
  console.log(`Authenticated as: ${account.email} (${account.accountName})`);
  console.log(`Role: ${account.role}\n`);

  // 2. List packages
  const packages = await client.packages.list();

  if (packages.length === 0) {
    console.log("No packages found. Create a package in the Docuplete dashboard first.");
    return;
  }

  console.log(`Found ${packages.length} package(s):`);
  for (const pkg of packages) {
    console.log(`  [${pkg.id}] ${pkg.name} — ${pkg.active ? "active" : "inactive"}`);
  }

  const pkg = packages.find((p) => p.active) ?? packages[0];
  console.log(`\nUsing package: "${pkg.name}" (id=${pkg.id})\n`);

  // 3. Create session
  const { session, token, interviewUrl } = await client.sessions.create({
    packageId: pkg.id,
    prefill: {
      client_name:    "Jane Smith",
      account_number: "ACC-12345",
    },
    source: "sdk-example",
  });

  console.log("Session created:");
  console.log(`  Token:        ${token}`);
  console.log(`  Status:       ${session.status}`);
  console.log(`  Expires:      ${session.expires_at}`);
  console.log(`  Interview URL: ${interviewUrl}\n`);

  // 4. Poll for completion
  console.log("Polling for completion (press Ctrl-C to stop)...");
  let dots = 0;
  while (true) {
    await sleep(5000);
    const current = await client.sessions.get(token);
    dots++;
    process.stdout.write(`\r  ${".".repeat(dots % 4 + 1)}   status: ${current.status}    `);

    if (current.status === "generated") {
      console.log("\n\nSession completed!");
      const fieldCount = Object.keys(current.answers).length;
      console.log(`  Answers: ${fieldCount} field(s) submitted`);
      for (const [key, value] of Object.entries(current.answers).slice(0, 5)) {
        console.log(`    ${key}: ${String(value)}`);
      }
      if (fieldCount > 5) console.log(`    ... and ${fieldCount - 5} more`);
      break;
    }
  }
}

main().catch((err: unknown) => {
  if (err instanceof DocupleteError) {
    console.error(`\nDocuplete API error (${err.status}): ${err.message}`);
  } else {
    console.error("\nUnexpected error:", err);
  }
  process.exit(1);
});
