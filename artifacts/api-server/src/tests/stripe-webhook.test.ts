/**
 * Stripe webhook handler unit tests
 *
 * Tests the error-detection surface in verifyAndParseWebhook and
 * WebhookHandlers.processWebhook — the two entry-points that gate every
 * inbound Stripe event before it touches the database.
 *
 * Covers:
 * 1. verifyAndParseWebhook — throws a descriptive error when
 *    STRIPE_WEBHOOK_SECRET is not configured (misconfigured deploy).
 * 2. verifyAndParseWebhook — propagates Stripe's signature error when
 *    the payload/signature don't match (tampered request).
 * 3. WebhookHandlers.processWebhook — throws immediately when payload is not
 *    a Buffer (route ordering bug: express.json() applied before raw body read).
 *
 * Full event handling (subscription.created, invoice.paid, etc.) is owned by
 * the stripe-replit-sync library and is covered by its own test suite.
 * These tests focus on the defensive wrapper code in this codebase.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { verifyAndParseWebhook, WebhookHandlers } from "../lib/stripeWebhookHandlers.js";

// Save and restore STRIPE_WEBHOOK_SECRET around each group so tests are isolated.
let savedSecret: string | undefined;
before(() => { savedSecret = process.env.STRIPE_WEBHOOK_SECRET; });
after(() => {
  if (savedSecret !== undefined) {
    process.env.STRIPE_WEBHOOK_SECRET = savedSecret;
  } else {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

// ── verifyAndParseWebhook ────────────────────────────────────────────────────

describe("verifyAndParseWebhook — STRIPE_WEBHOOK_SECRET guard", () => {
  it("throws with a clear message when STRIPE_WEBHOOK_SECRET is not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    await assert.rejects(
      () => verifyAndParseWebhook(Buffer.from("{}"), "t=123,v1=abc"),
      (err: Error) => {
        assert.ok(
          err.message.includes("STRIPE_WEBHOOK_SECRET is not configured"),
          `Expected 'STRIPE_WEBHOOK_SECRET is not configured' in: ${err.message}`,
        );
        return true;
      },
    );
  });

  it("error message includes actionable instructions (Dashboard → Developers → Webhooks)", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    await assert.rejects(
      () => verifyAndParseWebhook(Buffer.from("{}"), "t=123,v1=abc"),
      (err: Error) => {
        assert.ok(
          err.message.includes("Stripe Dashboard"),
          `Expected 'Stripe Dashboard' hint in error: ${err.message}`,
        );
        return true;
      },
    );
  });
});

describe("verifyAndParseWebhook — signature verification", () => {
  it("throws when STRIPE_WEBHOOK_SECRET is set but signature is invalid", async () => {
    // Use a realistic but deliberately wrong whsec_ key
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_dGVzdHNlY3JldDEyMzQ1Njc4OTBhYmNkZWY=";

    // A real Stripe payload format; the signature won't match the dummy secret
    const payload = Buffer.from(JSON.stringify({ id: "evt_test", type: "payment_intent.created" }));
    const badSignature = "t=1700000000,v1=badsignature";

    await assert.rejects(
      () => verifyAndParseWebhook(payload, badSignature),
      // Stripe throws "No signatures found matching the expected signature for payload."
      // or "Webhook signature verification failed." depending on the SDK version
      /signature/i,
    );
  });
});

// ── WebhookHandlers.processWebhook ───────────────────────────────────────────

describe("WebhookHandlers.processWebhook — payload type guard", () => {
  it("throws immediately when payload is a plain string (not a Buffer)", async () => {
    await assert.rejects(
      () => WebhookHandlers.processWebhook("not-a-buffer" as unknown as Buffer, "t=123,v1=abc"),
      (err: Error) => {
        assert.ok(
          err.message.includes("STRIPE WEBHOOK ERROR") || err.message.includes("Payload must be a Buffer"),
          `Expected Buffer type error, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  it("throws immediately when payload is a parsed JSON object (not a Buffer)", async () => {
    await assert.rejects(
      () => WebhookHandlers.processWebhook({ type: "invoice.paid" } as unknown as Buffer, "t=123,v1=abc"),
      (err: Error) => {
        assert.ok(
          err.message.includes("STRIPE WEBHOOK ERROR") || err.message.includes("Payload must be a Buffer"),
          `Expected Buffer type error, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  it("throws immediately when payload is null (not a Buffer)", async () => {
    await assert.rejects(
      () => WebhookHandlers.processWebhook(null as unknown as Buffer, "t=123,v1=abc"),
      (err: Error) => {
        assert.ok(
          err.message.includes("STRIPE WEBHOOK ERROR") || err.message.includes("Payload must be a Buffer"),
          `Expected Buffer type error, got: ${err.message}`,
        );
        return true;
      },
    );
  });
});
