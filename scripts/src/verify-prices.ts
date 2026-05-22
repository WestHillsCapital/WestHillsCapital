import { getStripeClient } from "./stripeClient.js";

async function main() {
  const stripe = await getStripeClient();
  const priceIds = [
    "price_1TVIj0GonhD1dXny0sNIM0e0",
    "price_1TVIj1GonhD1dXnyqFZGSYWy",
    "price_1TVIj2GonhD1dXny6Mrn3O1S",
    "price_1TVIj3GonhD1dXnyAFfA0vtC",
  ];
  for (const id of priceIds) {
    const p = await stripe.prices.retrieve(id);
    const prod = await stripe.products.retrieve(p.product as string);
    console.log(`${prod.name} — ${p.recurring?.interval} — $${(p.unit_amount! / 100)}`);
  }
}
main().catch(console.error);
