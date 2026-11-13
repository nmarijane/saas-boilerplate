import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { appPageMetadata } from "@/features/app-shell";
import { requireWorkspace } from "@/features/auth/organization/workspace";
import { getCheckoutSession } from "@/features/billing/checkout-status";
import { CheckoutExpired } from "@/features/billing/components/checkout-expired";
import { CheckoutSummary } from "@/features/billing/components/checkout-summary";
import { EmbeddedCheckout } from "@/features/billing/components/embedded-checkout";
import { pricingMoney } from "@/features/billing/pricing-view";
import { Button } from "@/shared/components/ui/button";
import { env } from "@/shared/lib/env";
import { Link, redirect } from "@/shared/lib/i18n-navigation";

interface Props {
  params: Promise<{ locale: string; sessionId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });

  return appPageMetadata(t("title"));
}

// The payment of a plan or of a pack of credits: what is bought on the left, the
// form of the provider on the right. The session is read at the provider by the id
// in the address, and it is the workspace of the person's own (not another's, not
// one that does not exist: both are a not-found, so that an address says nothing
// about which sessions exist) and for an admin at least (`getCheckoutSession`
// sends the others away). A session already paid goes to the return page, one that
// lapsed says so.
export default async function CheckoutPage({ params }: Props) {
  const { locale, sessionId } = await params;
  const { workspace } = await requireWorkspace();
  const session = await getCheckoutSession(sessionId, "admin");
  if (!session || session.orgId !== workspace.id) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "checkout" });
  if (session.status === "complete") {
    redirect({ href: `/checkout/return?session_id=${encodeURIComponent(session.id)}`, locale });
  }

  const money = pricingMoney();
  const back = session.kind === "credit_pack" ? "/settings/billing" : "/choose-plan";
  if (session.status === "expired" || !session.clientSecret) {
    return <CheckoutExpired href={back} />;
  }

  return (
    <div className="space-y-8 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-page font-semibold tracking-tight text-ink">{t("heading")}</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href={back}>{session.kind === "credit_pack" ? t("backToBilling") : t("backToPlans")}</Link>
        </Button>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <CheckoutSummary session={session} currency={money.currency} taxExcluded={money.taxExcluded} />
        <EmbeddedCheckout clientSecret={session.clientSecret} publishableKey={env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} sessionId={session.id} />
      </div>
    </div>
  );
}
