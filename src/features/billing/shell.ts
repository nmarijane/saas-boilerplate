import type { FeatureShell } from "@/shared/shell/contract";
import { CreditCardIcon } from "lucide-react";
import { cancelWorkspaceSubscription } from "./helpers";
import { getWorkspacePlans } from "./queries";

export const billingShell: FeatureShell = {
  id: "billing",
  plans: getWorkspacePlans,
  // A workspace that is deleted stops being billed: its subscription is
  // cancelled first, and a refusal of the provider keeps the workspace. When a
  // later step keeps it, the person is told the subscription is gone already.
  onWorkspaceDelete: {
    order: 10,
    run: async (orgId) => ((await cancelWorkspaceSubscription(orgId)) ? "billing.subscriptionCancelled" : null),
    failureKey: "billing.deleteWorkspaceFailed",
  },
  settings: [
    {
      id: "billing",
      href: "/settings/billing",
      labelKey: "settings.nav.billing",
      icon: CreditCardIcon,
      order: 30,
    },
  ],
  account: [
    {
      id: "billing",
      href: "/settings/billing",
      labelKey: "account.links.billing",
      icon: CreditCardIcon,
      order: 20,
    },
  ],
};
