import Stripe from "stripe";
import { env } from "@/shared/lib/env";

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined;
};

function createStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required. Set it in your .env file.");
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
  });
}

export function getStripe(): Stripe {
  if (!globalForStripe.stripe) {
    globalForStripe.stripe = createStripeClient();
  }
  return globalForStripe.stripe;
}
