import Stripe from "stripe";

async function getCredentials(): Promise<{ secretKey: string; publishableKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Stripe integration not configured. " +
      "Ensure REPLIT_CONNECTORS_HOSTNAME is set and the Stripe integration is connected."
    );
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as { items?: Array<{ settings: { secret?: string; publishable?: string } }> };
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret) {
    throw new Error(
      "Stripe integration not connected or missing secret key. " +
      "Connect Stripe via the Integrations tab first."
    );
  }

  return {
    secretKey:      settings.secret,
    publishableKey: settings.publishable ?? "",
  };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (Stripe as any)(secretKey, { apiVersion: "2025-08-27.basil" }) as Stripe;
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSync() {
  const { StripeSync } = await import("stripe-replit-sync");
  const { secretKey } = await getCredentials();
  return new StripeSync({
    poolConfig: { connectionString: process.env.DATABASE_URL!, max: 2 },
    stripeSecretKey: secretKey,
  });
}
