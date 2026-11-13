import type { PlanSummary } from "@/shared/shell/contract";
import { BILLING_MIN_ROLE } from "./permissions";

export interface PlanConfig {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  stripePriceId: {
    monthly: string;
    yearly: string;
  };
  features: Record<string, boolean>;
  limits: Record<string, number>;
  highlighted?: boolean;
}

export const PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Free",
    description: "For individuals getting started",
    price: {
      monthly: 0,
      yearly: 0,
    },
    stripePriceId: {
      monthly: "",
      yearly: "",
    },
    features: {
      basicAnalytics: true,
      emailSupport: true,
      apiAccess: false,
      prioritySupport: false,
      customBranding: false,
      advancedAnalytics: false,
      aiChat: true,
    },
    limits: {
      members: 1,
      projects: 3,
      storage: 100, // MB
      aiCredits: 100,
    },
  },
  {
    id: "pro",
    name: "Pro",
    description: "For growing teams",
    price: {
      monthly: 29,
      yearly: 290,
    },
    stripePriceId: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
    },
    features: {
      basicAnalytics: true,
      emailSupport: true,
      apiAccess: true,
      prioritySupport: true,
      customBranding: false,
      advancedAnalytics: true,
      aiChat: true,
    },
    limits: {
      members: 10,
      projects: 50,
      storage: 10_000, // MB
      aiCredits: 5000,
    },
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations",
    price: {
      monthly: 99,
      yearly: 990,
    },
    stripePriceId: {
      monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? "",
      yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY ?? "",
    },
    features: {
      basicAnalytics: true,
      emailSupport: true,
      apiAccess: true,
      prioritySupport: true,
      customBranding: true,
      advancedAnalytics: true,
      aiChat: true,
    },
    limits: {
      members: -1, // unlimited
      projects: -1,
      storage: -1,
      aiCredits: -1,
    },
  },
];

export const FEATURE_LABELS: Record<string, string> = {
  basicAnalytics: "Basic Analytics",
  emailSupport: "Email Support",
  apiAccess: "API Access",
  prioritySupport: "Priority Support",
  customBranding: "Custom Branding",
  advancedAnalytics: "Advanced Analytics",
  aiChat: "AI Chat",
};

export const LIMIT_LABELS: Record<string, string> = {
  members: "Team Members",
  projects: "Projects",
  storage: "Storage (MB)",
  aiCredits: "AI Credits / month",
};

export function getPlanById(planId: string): PlanConfig | undefined {
  return PLANS.find((p) => p.id === planId);
}

export function getFreePlan(): PlanConfig {
  return PLANS[0]!;
}

const UPGRADE_HREF = "/settings/billing";

/**
 * The plan a workspace is on, as the shell shows it, from its subscription. A
 * subscription gives its plan while it is live (`active` or `trialing`); a
 * workspace that never subscribed, or whose subscription is over, is on the
 * free plan, as is one whose plan the configuration no longer knows. The limits
 * are those of `PLANS`, where -1 is unlimited, and the plan last in `PLANS` has
 * nothing above it to upgrade to. The upgrade is offered to the roles that may
 * take it, as the billing page is. The shell and the billing page both read the
 * plan here, so that they cannot disagree.
 */
export function planOfSubscription(planId: string, status: string): PlanSummary {
  const live = status === "active" || status === "trialing";
  const plan = (live ? getPlanById(planId) : undefined) ?? getFreePlan();
  const highest = PLANS.at(-1);

  return {
    id: plan.id,
    name: plan.name,
    limits: { ...plan.limits },
    upgradeHref: plan.id === highest?.id ? null : UPGRADE_HREF,
    upgradeMinRole: BILLING_MIN_ROLE,
  };
}
