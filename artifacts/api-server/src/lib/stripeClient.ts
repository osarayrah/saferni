import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

type StripeCredentials = { secretKey: string; webhookSecret?: string };

async function getStripeCredentials(): Promise<StripeCredentials> {
  // Vercel does not provide Replit connector identity variables. Its sandbox
  // Stripe credential is configured directly in the Vercel project instead.
  const hostedSecretKey = process.env.STRIPE_SECRET_KEY;
  if (hostedSecretKey) {
    return {
      secretKey: hostedSecretKey,
      ...(process.env.STRIPE_WEBHOOK_SECRET ? { webhookSecret: process.env.STRIPE_WEBHOOK_SECRET } : {}),
    };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;

  if (!hostname || !token) {
    throw new Error("Stripe is unavailable because its Replit connection credentials are missing.");
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: token },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Could not load Stripe connection credentials (${response.status}).`);
  }

  const payload = await response.json() as {
    items?: Array<{
      settings?: {
        secret?: string;
        secret_key?: string;
        api_key?: string;
        secretKey?: string;
        webhook_secret?: string;
      };
    }>;
  };
  const settings = payload.items?.[0]?.settings;
  // Replit's Stripe connector exposes the credential as `secret`. Retain
  // alternate spellings for compatibility with older connector payloads.
  const secretKey = settings?.secret ?? settings?.secret_key ?? settings?.api_key ?? settings?.secretKey;
  if (!secretKey) {
    throw new Error("Stripe is connected but has no usable secret key.");
  }
  return { secretKey, webhookSecret: settings?.webhook_secret };
}

/** Returns a fresh client because the Replit connection token may rotate. */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for Stripe synchronization.");
  const { secretKey, webhookSecret } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? "",
  });
}