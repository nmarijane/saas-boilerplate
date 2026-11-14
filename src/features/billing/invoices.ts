import { unstable_rethrow } from "next/navigation";
import { env } from "@/shared/lib/env";
import { getStripe } from "./stripe";
import "server-only";

/** An invoice as the billing page lists it: what it was, how much, where it stands, and where to read it. */
export interface InvoiceRow {
  id: string;
  /** The number the provider gave it ("A1B2-0001"); null for a draft. */
  number: string | null;
  createdAt: Date;
  /** In minor units (cents) of `currency`. */
  amount: number;
  currency: string;
  status: "draft" | "open" | "paid" | "uncollectible" | "void";
  /** The page of the provider that shows it, with the receipt and the PDF. */
  url: string | null;
}

/**
 * The latest invoices of a customer, read at the provider (the app keeps none of
 * their content). Null when they cannot be read (no key, a refusal, the network):
 * the page then says so in a line of its own, and the rest of it still works.
 */
export async function listInvoices(stripeCustomerId: string | null, limit = 12): Promise<InvoiceRow[] | null> {
  if (!stripeCustomerId) {
    return [];
  }
  if (!env.STRIPE_SECRET_KEY) {
    return null;
  }

  try {
    const { data } = await getStripe().invoices.list({ customer: stripeCustomerId, limit });

    return data.map((invoice) => ({
      id: invoice.id ?? "",
      number: invoice.number,
      createdAt: new Date(invoice.created * 1000),
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: invoice.status ?? "draft",
      url: invoice.hosted_invoice_url ?? null,
    }));
  } catch (error) {
    unstable_rethrow(error);
    console.error("Billing: the invoices could not be read", error);
    return null;
  }
}
