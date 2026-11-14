// The packs of AI credits a workspace can buy once, in addition to what its plan
// grants each month. A pack is a one-off purchase (Checkout `mode: payment`),
// its credits never expire and are spent after the monthly allocation. A project
// that does not sell packs empties this list (and removes `STRIPE_PRICE_CREDITS_*`);
// the page then shows no "Top up". Plain module: a client component reads it too.

interface CreditPack {
  id: string;
  credits: number;
  /** In the major unit of `BILLING_CURRENCY`: what the Stripe price of the catalog charges. */
  price: number;
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: "credits-1000", credits: 1000, price: 10 },
  { id: "credits-5000", credits: 5000, price: 40 },
];

export function getCreditPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === packId);
}
