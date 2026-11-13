import type { Metadata } from "next";
import { CreditCardIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { appPageMetadata } from "@/features/app-shell";
import { requireWorkspace } from "@/features/auth/organization/workspace";
import { BillingSettings } from "@/features/billing/components/billing-settings";
import { getSubscriptionForOrg } from "@/features/billing/helpers";
import { canManageBilling } from "@/features/billing/permissions";
import { planOfSubscription } from "@/features/billing/plans";
import { PageHeader } from "@/shared/components/data/page-header";
import { SettingsNav } from "@/shared/components/shell/settings-nav";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings.billing" });

  return appPageMetadata(t("title"));
}

// The subscription of the workspace of the session: the page takes it from
// `requireWorkspace()`, never from the URL. The header says the plan the
// workspace is on, as the account menu does: both take the name from the same
// rule (`planOfSubscription`), and the page takes it from the subscription it
// reads anyway, not from a second read of every plan. The cards are those of `BillingSettings`, with their buttons for the
// roles that may use them: a member sees the plan, the server decides again.
export default async function BillingSettingsPage({ params }: Props) {
  const { locale } = await params;
  const { workspace } = await requireWorkspace();
  const [t, tAccount, { planId, status, subscription }] = await Promise.all([
    getTranslations({ locale, namespace: "settings.billing" }),
    getTranslations({ locale, namespace: "account" }),
    getSubscriptionForOrg(workspace.id),
  ]);

  const plan = planOfSubscription(planId, status).name;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CreditCardIcon}
        title={t("title")}
        context={tAccount("planLabel", { plan })}
        tabs={<SettingsNav />}
      />
      <BillingSettings
        orgId={workspace.id}
        planId={planId}
        status={status}
        currentPeriodEnd={subscription?.currentPeriodEnd}
        canManage={canManageBilling(workspace.role)}
      />
    </div>
  );
}
