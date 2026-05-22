import Stripe from "stripe";

async function getCredentials(): Promise<{ secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) return { secretKey };
    throw new Error("STRIPE_SECRET_KEY not set and Replit connector not available.");
  }

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", "development");

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`Connector API: ${resp.status} ${resp.statusText}`);

  const data = await resp.json() as { items?: Array<{ settings: { secret?: string } }> };
  const secret = data.items?.[0]?.settings?.secret;
  if (!secret) throw new Error("Stripe integration not connected or missing secret key.");
  return { secretKey: secret };
}

export async function getStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
}
