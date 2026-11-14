import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { appPageMetadata } from "@/features/app-shell";
import { requireWorkspace } from "@/features/auth/organization/workspace";
import { firstOf } from "@/features/auth/search-params";
import { PricingPlans } from "@/features/billing/components/pricing-plans";
import { ResumeCheckout } from "@/features/billing/components/resume-checkout";
import { decodePlanChoice, PLAN_CHOICE_COOKIE } from "@/features/billing/plan-choice";
import { bestYearlySavingsPercent, parsePlanChoice, PLANS } from "@/features/billing/plans";
import { ctasFor, getPricingViewer, pricingMoney, trialPlanIdsFor } from "@/features/billing/pricing-view";
import { Button } from "@/shared/components/ui/button";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { Link, redirect } from "@/shared/lib/i18n-navigation";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "chooseYourPlan" });

  return appPageMetadata(t("title"));
}

// The choice of a plan for a workspace, right after it is made (the end of the
// onboarding) or when a free workspace upgrades. The workspace comes from the
// session. A workspace that already pays goes to its billing page; a member is
// told that only an admin can pay. A plan the person picked before signing up
// (the cookie of the proxy, or the address) is resumed at once: the payment
// opens without a second choice, and "Choose another plan" is what is left when it
// should not.
export default async function ChoosePlanPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "chooseYourPlan" });
  const { workspace } = await requireWorkspace();
  const viewer = await getPricingViewer();

  if (viewer.kind === "subscriber") {
    redirect({ href: "/settings/billing", locale });
  }
  // Coming from the onboarding, a member joined a workspace that is not theirs to pay for: nothing to say there
  if (viewer.kind === "member" && firstOf(query.from) === "onboarding") {
    redirect({ href: "/dashboard", locale });
  }

  if (viewer.kind !== "payer") {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-12 text-center">
        <h1 className="font-display text-page font-semibold text-ink">{t("memberTitle")}</h1>
        <PageAlert tone="info">{t("memberNotice")}</PageAlert>
        <Button asChild>
          <Link href="/dashboard">{t("backToApp")}</Link>
        </Button>
      </div>
    );
  }

  const stored = decodePlanChoice((await cookies()).get(PLAN_CHOICE_COOKIE)?.value);
  const asked = parsePlanChoice(firstOf(query.plan), firstOf(query.interval) ?? "monthly");
  const choice = asked ?? stored;
  const money = pricingMoney();

  return (
    <div className="space-y-10 pt-4">
      <div className="space-y-3 text-center">
        <h1 className="font-display text-page font-semibold tracking-tight text-balance text-ink">{t("heading", { workspace: workspace.name })}</h1>
        <p className="mx-auto max-w-2xl text-body text-ink-muted">{t("subtitle")}</p>
      </div>

      {choice ? <ResumeCheckout orgId={workspace.id} planId={choice.planId} interval={choice.interval} /> : null}

      <PricingPlans
        plans={PLANS}
        ctas={ctasFor(viewer, { choosing: true })}
        currency={money.currency}
        taxExcluded={money.taxExcluded}
        yearlySavings={bestYearlySavingsPercent()}
        trialPlanIds={await trialPlanIdsFor(viewer)}
        initialInterval={choice?.interval}
        chosenPlanId={choice?.planId}
      />
    </div>
  );
}
