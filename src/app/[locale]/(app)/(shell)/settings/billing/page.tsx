import type { Metadata } from "next";
import { CreditCardIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { AI_CREDITS_QUOTA_ID } from "@/features/ai/config/credits";
import { appPageMetadata, getShell } from "@/features/app-shell";
import { requireWorkspace } from "@/features/auth/organization/workspace";
import { firstOf } from "@/features/auth/search-params";
import { CancelZone, ResumeButton } from "@/features/billing/components/cancel-zone";
import { ChangePlanDialog } from "@/features/billing/components/change-plan-dialog";
import { CheckoutReturnNotice } from "@/features/billing/components/checkout-return-notice";
import { CreditsCard } from "@/features/billing/components/credits-card";
import { InvoiceList } from "@/features/billing/components/invoice-list";
import { PlanCard } from "@/features/billing/components/plan-card";
import { PortalButton } from "@/features/billing/components/portal-button";
import { listInvoices } from "@/features/billing/invoices";
import { getBillingOverview, getCredits } from "@/features/billing/overview";
import { canCancelSubscription, canManageBilling } from "@/features/billing/permissions";
import { getPaidPlans, isPaidPlan, PLANS } from "@/features/billing/plans";
import { pricingMoney } from "@/features/billing/pricing-view";
import { PageHeader } from "@/shared/components/data/page-header";
import { QuotaCard } from "@/shared/components/data/quota-card";
import { SettingsNav } from "@/shared/components/shell/settings-nav";
import { Button } from "@/shared/components/ui/button";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { Link } from "@/shared/lib/i18n-navigation";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings.billing" });

  return appPageMetadata(t("title"));
}

// The subscription of the workspace of the session: the page takes it from
// `requireWorkspace()`, never from the URL. The header says the plan the
// workspace is on, as the account menu does (both read it by `effectivePlan`). What
// a person sees follows their role, and the server decides again in every action: a
// member sees the plan, its dates, the quotas and the credits; an admin also the
// invoices, the payment method, and the change of plan; only the owner the
// cancellation. One alert at most, the one that matters most: a payment that failed,
// then a cancellation that is scheduled, then a trial that is running.
export default async function BillingSettingsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const { workspace } = await requireWorkspace();
  const canManage = canManageBilling(workspace.role);
  const canCancel = canCancelSubscription(workspace.role);

  const [t, tAccount, format, overview, credits, { view }] = await Promise.all([
    getTranslations({ locale, namespace: "settings.billing" }),
    getTranslations({ locale, namespace: "account" }),
    getFormatter({ locale }),
    getBillingOverview(workspace.id),
    getCredits(workspace.id),
    getShell(),
  ]);
  const invoices = canManage && overview.subscribed ? await listInvoices(overview.stripeCustomerId) : undefined;
  const money = pricingMoney();
  const date = (value: Date) => format.dateTime(value, { dateStyle: "long" });

  // What the workspace holds, by limit key: what a plan with lower limits would leave over it
  const usage = Object.fromEntries(view.quotas.filter((quota) => quota.id in (overview.plan.limits)).map((quota) => [quota.id, quota.used]));
  const now = new Date();
  const nextGrant = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  let alert: React.ReactNode = null;
  // The way back from a cancellation is in the alert of the cancellation; when another alert takes the place, it is in the plan card
  let resumeInCard = false;
  if (overview.status === "past_due") {
    resumeInCard = canCancel && overview.cancelAtPeriodEnd;
    alert = (
      <PageAlert
        tone="warning"
        title={t("pastDueTitle")}
        action={canManage ? <PortalButton orgId={workspace.id} label={t("pastDueAction")} /> : undefined}
      >
        {canManage ? t("pastDue") : t("pastDueMember")}
      </PageAlert>
    );
  } else if (overview.cancelAtPeriodEnd && overview.periodEnd) {
    alert = (
      <PageAlert
        tone="info"
        title={t("cancelScheduledTitle", { plan: overview.plan.name })}
        action={canCancel ? <ResumeButton orgId={workspace.id} /> : undefined}
      >
        {t("cancelScheduled", { date: date(overview.periodEnd) })}
      </PageAlert>
    );
  } else if (overview.trialEnd) {
    alert = (
      <PageAlert tone="info" title={t("trialTitle", { plan: overview.plan.name })}>
        {t(canCancel ? "trial" : "trialNotOwner", { date: date(overview.trialEnd) })}
      </PageAlert>
    );
  }

  const quotaCards = view.quotas.filter((quota) => quota.id !== AI_CREDITS_QUOTA_ID);
  const paidPlans = getPaidPlans();

  let primaryAction: React.ReactNode = null;
  if (canManage && overview.subscribed && overview.interval) {
    primaryAction = (
      <ChangePlanDialog
        orgId={workspace.id}
        plans={paidPlans}
        currentPlanId={overview.plan.id}
        currentInterval={overview.interval}
        currency={money.currency}
        usage={usage}
      />
    );
  } else if (canManage && PLANS.some(isPaidPlan)) {
    primaryAction = (
      <Button asChild>
        <Link href="/choose-plan">{t("choosePlan")}</Link>
      </Button>
    );
  }

  return (
    <div className="space-y-6">
      {typeof firstOf(query.checkout) === "string" && ["success", "credits"].includes(firstOf(query.checkout) ?? "") ? (
        <CheckoutReturnNotice checkout={firstOf(query.checkout) === "credits" ? "credits" : "success"} />
      ) : null}
      <PageHeader
        icon={CreditCardIcon}
        title={t("title")}
        context={tAccount("planLabel", { plan: overview.plan.name })}
        primaryAction={primaryAction}
        alert={alert}
        tabs={<SettingsNav />}
      />

      <PlanCard overview={overview} orgId={workspace.id} currency={money.currency} canManage={canManage} resume={resumeInCard ? <ResumeButton orgId={workspace.id} /> : undefined} />

      <section aria-labelledby="usage-title" className="space-y-3">
        <h2 id="usage-title" className="text-section text-ink">
          {t("usageTitle")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quotaCards.map((quota) => (
            <QuotaCard key={quota.id} quota={quota} />
          ))}
          <CreditsCard credits={credits} orgId={workspace.id} currency={money.currency} canTopUp={canManage} nextGrant={nextGrant} topUpOpen={firstOf(query.topup) === "1"} />
        </div>
      </section>

      {invoices !== undefined ? <InvoiceList invoices={invoices} /> : null}

      {canCancel && overview.subscribed && !overview.cancelAtPeriodEnd ? (
        <CancelZone orgId={workspace.id} planName={overview.plan.name} endsAt={overview.trialEnd ?? overview.periodEnd} />
      ) : null}
    </div>
  );
}
