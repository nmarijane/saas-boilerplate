import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { appPageMetadata } from "@/features/app-shell";
import { firstOf } from "@/features/auth/search-params";
import { CheckoutReturn } from "@/features/billing/components/checkout-return";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });

  return appPageMetadata(t("returnTitle"));
}

// Where the provider sends the buyer back to, with the id of the session: the
// page waits until the app has the payment (the webhook writes it), then goes to
// the billing page with the news. It reads the id and nothing else from the
// address, and the server checks the session belongs to the buyer's workspace.
export default async function CheckoutReturnPage({ searchParams }: Props) {
  const sessionId = firstOf((await searchParams).session_id);
  if (!sessionId) {
    notFound();
  }

  return <CheckoutReturn sessionId={sessionId} />;
}
