/**
 * create-session.ts
 *
 * Demonstrates the complete Docuplete SDK flow:
 *   1. Verify your API key and account
 *   2. List available packages
 *   3. Create an interview session with prefill
 *   4. Print the interview URL (send or redirect your client here)
 *   5. Poll until the session is completed
 *   6. (Bonus) Try the public sandbox — no API key needed
 *
 * Usage:
 *   DOCUPLETE_API_KEY=dp_live_... npx tsx examples/create-session.ts
 *   DOCUPLETE_API_KEY=dp_live_... DOCUPLETE_BASE_URL=http://localhost:3000 npx tsx examples/create-session.ts
 */

import { Docuplete, DocupleteError } from "../src/index.js";

const apiKey  = process.env.DOCUPLETE_API_KEY;
const baseUrl = process.env.DOCUPLETE_BASE_URL;

if (!apiKey) {
  console.error("Error: DOCUPLETE_API_KEY environment variable is required.");
  console.error("  export DOCUPLETE_API_KEY=dp_live_...");
  process.exit(1);
}

const client = new Docuplete({ apiKey, baseUrl });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log("Docuplete SDK — create-session example\n");

  // ── 1. Verify account ─────────────────────────────────────────────────────
  const account = await client.account.get();
  console.log(`Authenticated as: ${account.email ?? "(api key)"} (${account.accountName})`);
  console.log(`Role: ${account.role}\n`);

  // ── 2. List packages ───────────────────────────────────────────────────────
  const packages = await client.packages.list();

  if (packages.length === 0) {
    console.log("No packages found. Create a package in the Docuplete dashboard first.");
    return;
  }

  console.log(`Found ${packages.length} package(s):`);
  for (const pkg of packages) {
    const label = pkg.active ? "active" : "inactive";
    console.log(`  [${pkg.id}] ${pkg.name} — ${label}`);
  }

  const pkg = packages.find((p) => p.active) ?? packages[0];
  console.log(`\nUsing package: "${pkg.name}" (id=${pkg.id})\n`);

  // ── 3. Create a session (prefill uses field source keys) ───────────────────
  const { sessionToken, interviewUrl, expiresAt } = await client.sessions.create({
    packageId: pkg.id,
    prefill: {
      firstName: "Jane",
      lastName:  "Smith",
      email:     "jane@example.com",
    },
    linkExpiryDays: 7,
  });

  console.log("Session created:");
  console.log(`  Token:         ${sessionToken}`);
  console.log(`  Expires:       ${expiresAt ?? "never"}`);
  console.log(`  Interview URL: ${interviewUrl}\n`);

  // ── 4. Send the link by email (optional) ──────────────────────────────────
  // const sent = await client.sessions.sendLink(sessionToken, {
  //   recipientEmail: "jane@example.com",
  //   recipientName:  "Jane Smith",
  //   customMessage:  "Please complete at your earliest convenience.",
  // });
  // console.log(`Link sent to: ${sent.sentTo}`);

  // ── 5. Poll for completion ─────────────────────────────────────────────────
  console.log("Polling for completion (press Ctrl-C to stop)...");
  let dots = 0;
  while (true) {
    await sleep(5_000);
    const current = await client.sessions.get(sessionToken);
    dots++;
    process.stdout.write(`\r  ${".".repeat(dots % 4 + 1)}   status: ${current.status}    `);

    if (current.status === "generated") {
      console.log("\n\nSession completed! Triggering PDF generation...");
      const genResult = await client.sessions.generate(sessionToken);

      if (genResult.status === "generated") {
        console.log(`  PDF ready (sync): ${genResult.downloadUrl}`);
      } else {
        // Background job — poll generate-status
        const { jobId } = genResult;
        process.stdout.write("  Generating");
        let ready = false;
        while (!ready) {
          await sleep(2_000);
          const s = await client.sessions.getGenerateStatus(sessionToken, jobId);
          process.stdout.write(".");
          if (s.status === "ready") {
            console.log(`\n  PDF ready: ${s.downloadUrl}`);
            ready = true;
          } else if (s.status === "failed") {
            throw new DocupleteError(s.error ?? "PDF generation failed", 500);
          }
        }
      }

      const fieldCount = Object.keys(current.answers).length;
      console.log(`  Answers: ${fieldCount} field(s) submitted`);
      for (const [key, value] of Object.entries(current.answers).slice(0, 5)) {
        console.log(`    ${key}: ${String(value)}`);
      }
      if (fieldCount > 5) console.log(`    ... and ${fieldCount - 5} more`);
      break;
    }

    if (current.status === "voided") {
      console.log("\n\nSession was voided.");
      break;
    }
  }

  // ── Bonus: sandbox (no API key needed) ────────────────────────────────────
  console.log("\n--- Sandbox demo ---");
  const sandbox = await client.sandbox.start({
    firstName: "Demo",
    email:     "demo@example.com",
  });
  console.log(`Sandbox session: ${sandbox.sessionToken}`);
  console.log(`Sandbox URL:     ${sandbox.interviewUrl}`);
  console.log(`Expires:         ${sandbox.expiresAt}`);
}

main().catch((err: unknown) => {
  if (err instanceof DocupleteError) {
    console.error(`\nDocuplete API error (${err.status}): ${err.message}`);
    if (err.issues?.length) {
      for (const issue of err.issues) console.error(`  • ${issue}`);
    }
  } else {
    console.error("\nUnexpected error:", err);
  }
  process.exit(1);
});
