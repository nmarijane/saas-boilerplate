"use client";

import type { BillingInterval, PlanConfig } from "../plans";
import type { PlanCta } from "./plan-cta";
import { RefreshCwIcon, ShieldCheckIcon, XCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { PlanCards } from "./plan-cards";

interface PricingPlansProps {
  plans: PlanConfig[];
  ctas: Record<string, PlanCta>;
  currency: string;
  taxExcluded: boolean;
  /** What the yearly price saves, in percent, read from the plans: 0 hides the note. */
  yearlySavings: number;
  initialInterval?: BillingInterval;
  /** The plans whose free trial this person can still have; the trial is not announced on the others. All the plans that have one when left out (a visitor). */
  trialPlanIds?: string[];
  chosenPlanId?: string | null;
}

// The plans with the toggle that prices them: monthly or yearly, the discount
// written from the plans themselves, and the three things that reassure a buyer.
// Used by the public prices, by the choice of a plan after sign-up, and by the
// section that a landing page can embed.
export function PricingPlans({ plans, ctas, currency, taxExcluded, yearlySavings, initialInterval = "monthly", chosenPlanId, trialPlanIds }: PricingPlansProps) {
  const t = useTranslations("pricing");
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const anyPaid = plans.some((plan) => plan.price.monthly > 0);
  const reassurances = [
    { icon: XCircleIcon, text: t("reassurance.cancel") },
    { icon: RefreshCwIcon, text: t("reassurance.change") },
    { icon: ShieldCheckIcon, text: t("reassurance.secure") },
  ];

  return (
    <div className="space-y-8">
      {anyPaid ? (
        <div className="flex justify-center">
          <SegmentedControl<BillingInterval>
            label={t("period")}
            value={interval}
            onValueChange={setInterval}
            options={[
              { value: "monthly", label: t("monthly") },
              { value: "yearly", label: t("yearly"), badge: yearlySavings > 0 ? t("save", { percent: yearlySavings }) : undefined },
            ]}
          />
        </div>
      ) : null}

      <PlanCards plans={plans} ctas={ctas} interval={interval} currency={currency} taxExcluded={taxExcluded} chosenPlanId={chosenPlanId} trialPlanIds={trialPlanIds} />

      <ul className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-x-8 gap-y-3 text-body text-ink-muted sm:flex-row">
        {reassurances.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2">
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
