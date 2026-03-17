import type { Metadata } from "next";
import { BillingSettings } from "@/features/billing/components/billing-settings";
import { getSubscriptionForOrg } from "@/features/billing/helpers";

export const metadata: Metadata = {
  title: "Billing",
  description: "Manage your subscription and billing settings.",
};

// TODO: Replace with actual org ID from session/context when auth is wired
async function getCurrentOrgId(): Promise<string> {
  return "placeholder-org-id";
}

export default async function BillingPage() {
  const orgId = await getCurrentOrgId();
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
