import { getStripeSync } from "./stripeClient";

export async function processStripeWebhook(payload: Buffer, signature: string): Promise<void> {
  if (!Buffer.isBuffer(payload)) {
    throw new Error("Stripe webhook payload must be a Buffer.");
  }
  const sync = await getStripeSync();
  await sync.processWebhook(payload, signature);
}