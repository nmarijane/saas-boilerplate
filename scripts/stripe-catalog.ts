import Stripe from "stripe";
import { planCatalog, portalDrift, portalFeatures } from "../src/features/billing/catalog";
import { CREDIT_PACKS } from "../src/features/billing/credit-packs";
import { getPaidPlans } from "../src/features/billing/plans";
// The `.env*` files are read the way Next does. None of the imports above reads the
// environment when it loads, so this is in time
import "./load-env";

// Creates the Stripe catalog of the app (one product per paid plan and per pack
// of credits, with their prices) and the configuration of the customer portal,
// in a TEST account, and prints the lines to paste in `.env.local`:
//
//   STRIPE_SECRET_KEY=<a test key> npm run stripe:catalog
//
// It is idempotent: a product is made with a fixed id, a price is found by its
// lookup key, the portal by its metadata, and what exists is left as it is. With
// a LIVE key it creates nothing: it checks that every price is there with the
// amount of `PLANS`, and exits with an error when one is missing or differs. A
// price at Stripe cannot be edited: to change an amount, change `PLANS`, create
// the new price (a lookup key moves to it with `transfer_lookup_key`) by hand, and
// run this again.
//
// It is documented in docs/SETUP.md (Stripe) and is run by a person with their own
// key, never by the app or the CI.

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set. Use a TEST key: npm run stripe:catalog");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
const testMode = /^[rs]k_test_/.test(key);
const currency = (process.env.BILLING_CURRENCY || "usd").toLowerCase();
const taxEnabled = /^(?:1|true|yes|on)$/i.test(process.env.STRIPE_TAX_ENABLED ?? "");
const problems: string[] = [];
const envLines: string[] = [];

async function ensureProduct(product: ReturnType<typeof planCatalog>[number]) {
  try {
    await stripe.products.retrieve(product.id);
    return;
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeInvalidRequestError) || error.code !== "resource_missing") {
      throw error;
    }
  }

  if (!testMode) {
    problems.push(`Product ${product.id} is missing`);
    return;
  }
  await stripe.products.create({ id: product.id, name: product.name, metadata: product.metadata });
  console.log(`Created product ${product.id}`);
}

async function ensurePrice(product: ReturnType<typeof planCatalog>[number], price: ReturnType<typeof planCatalog>[number]["prices"][number]) {
  const [found] = (await stripe.prices.list({ lookup_keys: [price.lookupKey], active: true, limit: 1 })).data;
  if (found) {
    const sameAmount = found.unit_amount === price.unitAmount && found.currency === currency;
    const sameRecurrence = (found.recurring?.interval ?? null) === price.recurring;
    if (!sameAmount || !sameRecurrence) {
      problems.push(`Price ${price.lookupKey} is ${found.unit_amount} ${found.currency} at Stripe, and PLANS says ${price.unitAmount} ${currency}`);
    }
    envLines.push(`${price.envVar}=${found.id}`);
    return;
  }

  if (!testMode) {
    problems.push(`Price ${price.lookupKey} is missing`);
    return;
  }
  const created = await stripe.prices.create({
    product: product.id,
    currency,
    unit_amount: price.unitAmount,
    lookup_key: price.lookupKey,
    tax_behavior: taxEnabled ? "exclusive" : "unspecified",
    ...(price.recurring ? { recurring: { interval: price.recurring } } : {}),
  });
  console.log(`Created price ${price.lookupKey}`);
  envLines.push(`${price.envVar}=${created.id}`);
}

/** The portal where a customer updates the card and reads the invoices. Cancelling and changing plan are the app's (and the owner's): the portal offers neither. The id is printed for `STRIPE_PORTAL_CONFIGURATION_ID`. */
async function ensurePortal() {
  const existing = (await stripe.billingPortal.configurations.list({ limit: 100 })).data.find((configuration) => configuration.metadata?.catalog === "app");
  if (existing) {
    // A portal that offers what the app keeps for itself (cancelling, changing plan) is put right, or the script says it is not
    const drift = portalDrift({ ...existing.features });
    if (drift.length > 0 && testMode) {
      await stripe.billingPortal.configurations.update(existing.id, { features: portalFeatures() });
      console.log(`Updated the customer portal configuration (${drift.join(", ")})`);
    } else if (drift.length > 0) {
      problems.push(`The customer portal configuration differs from the app's (${drift.join(", ")}): update it in the dashboard`);
    }
    envLines.push(`STRIPE_PORTAL_CONFIGURATION_ID=${existing.id}`);
    return;
  }
  if (!testMode) {
    problems.push("The customer portal configuration is missing");
    return;
  }

  const created = await stripe.billingPortal.configurations.create({
    metadata: { catalog: "app" },
    business_profile: { headline: "Manage your payment method and invoices" },
    features: portalFeatures(),
  });
  console.log("Created the customer portal configuration");
  envLines.push(`STRIPE_PORTAL_CONFIGURATION_ID=${created.id}`);
}

async function main() {
  console.log(`${testMode ? "Test" : "Live (check only)"} account, currency ${currency}`);
  console.log(`${getPaidPlans().length} paid plans, ${CREDIT_PACKS.length} credit packs`);

  for (const product of planCatalog()) {
    await ensureProduct(product);
    for (const price of product.prices) {
      await ensurePrice(product, price);
    }
  }
  await ensurePortal();

  if (envLines.length > 0) {
    console.log("\nAdd these lines to .env.local:\n");
    console.log(envLines.join("\n"));
  }
  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
