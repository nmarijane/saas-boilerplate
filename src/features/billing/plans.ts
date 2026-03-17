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
    },
    limits: {
      members: 1,
      projects: 3,
      storage: 100, // MB
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
    },
    limits: {
      members: 10,
      projects: 50,
      storage: 10_000, // MB
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
    },
    limits: {
      members: -1, // unlimited
      projects: -1,
      storage: -1,
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
};

export const LIMIT_LABELS: Record<string, string> = {
  members: "Team Members",
  projects: "Projects",
  storage: "Storage (MB)",
};

export function getPlanById(planId: string): PlanConfig | undefined {
  return PLANS.find((p) => p.id === planId);
}

export function getFreePlan(): PlanConfig {
  return PLANS[0]!;
}
