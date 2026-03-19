import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { BillingSettings } from "@/features/billing/components/billing-settings";
import { getSubscriptionForOrg } from "@/features/billing/helpers";

export const metadata: Metadata = {
  title: "Billing",
  description: "Manage your subscription and billing settings.",
};

export default async function BillingPage() {
  const orgId = await getActiveOrgId();
  if (!orgId) redirect("/dashboard");

  const { planId, status, subscription } = await getSubscriptionForOrg(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">
          Manage your subscription and billing details
        </p>
      </div>
      <BillingSettings
        orgId={orgId}
        planId={planId}
        status={status}
        currentPeriodEnd={subscription?.currentPeriodEnd}
      />
    </div>
  );
}
