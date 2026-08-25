// Must be first: populates process.env from .env before any module reads it.
import "./lib/loadEnv";
import app from "./app";
import { logger } from "./lib/logger";
import { startOutboxProcessor } from "./lib/bookingOutbox";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./lib/stripeClient";
import { startPaymentRecoveryProcessor } from "./lib/paymentRecovery";

async function initializeStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for Stripe.");
  await runMigrations({ databaseUrl });
  const sync = await getStripeSync();
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (!domain) throw new Error("REPLIT_DOMAINS is required to configure Stripe webhooks.");
  await sync.findOrCreateManagedWebhook(`https://${domain}/api/stripe/webhook`);
  await sync.syncBackfill();
}

if (process.env.NODE_ENV !== "test") {
  try {
    await initializeStripe();
  } catch (err) {
    // Keep search and itinerary features available, but fail closed for
    // bookings until Stripe's server credential is available.
    logger.error({ err }, "Stripe unavailable; customer booking checkout is disabled");
  }
}
startOutboxProcessor();
startPaymentRecoveryProcessor();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
