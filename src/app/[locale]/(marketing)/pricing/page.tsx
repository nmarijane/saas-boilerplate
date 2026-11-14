import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PricingComparison } from "@/features/billing/components/pricing-comparison";
import { PricingFaq } from "@/features/billing/components/pricing-faq";
import { PricingPlans } from "@/features/billing/components/pricing-plans";
import { bestYearlySavingsPercent, PLANS } from "@/features/billing/plans";
import { ctasFor, getPricingViewer, pricingMoney, trialPlanIdsFor } from "@/features/billing/pricing-view";
import { PageAlert } from "@/shared/components/ui/page-alert";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });

  return { title: t("title"), description: t("description") };
}

// The public prices. The plans come from `PLANS` and the buttons from who is
// looking (`ctasFor`): a visitor goes to sign-up with the plan kept, a signed-in
// admin to payment, a subscriber to their plan. The page reads the session, so it
// is drawn for each request, never frozen at build.
export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  const viewer = await getPricingViewer();
  const money = pricingMoney();

  return (
    <div className="container mx-auto max-w-6xl space-y-16 px-4 py-16">
      <div className="space-y-4 text-center">
        <h1 className="font-display text-page font-semibold tracking-tight text-balance text-ink sm:text-key">{t("heading")}</h1>
        <p className="mx-auto max-w-2xl text-section font-normal text-ink-muted">{t("subtitle")}</p>
      </div>

      {viewer.kind === "member" ? <PageAlert tone="info">{t("memberNotice")}</PageAlert> : null}

      <PricingPlans
        plans={PLANS}
        ctas={ctasFor(viewer, { choosing: false })}
        currency={money.currency}
        taxExcluded={money.taxExcluded}
        yearlySavings={bestYearlySavingsPercent()}
        trialPlanIds={await trialPlanIdsFor(viewer)}
      />
      <PricingComparison plans={PLANS} />
      <PricingFaq />
    </div>
  );
}
