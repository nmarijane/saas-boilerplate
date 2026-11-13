"use client";

import type { BillingInterval, PlanConfig } from "../plans";
import type { PlanCta } from "./plan-cta";
import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/shared/utils/cn";
import { isPaidPlan } from "../plans";
import { includedLines } from "./included-lines";
import { PlanButton } from "./plan-button";
import { RollingPrice } from "./rolling-price";
import { useMoney } from "./use-money";

interface PlanCardsProps {
  plans: PlanConfig[];
  /** What each plan's button does, by plan id. A plan with none has no button. */
  ctas: Record<string, PlanCta>;
  interval: BillingInterval;
  currency: string;
  /** Prices are quoted without VAT (Stripe Tax is on): the card says so. */
  taxExcluded: boolean;
  /** The plan to recommend over the one the product highlights: the one a visitor picked before signing up. */
  chosenPlanId?: string | null;
  /** The plans whose free trial this person can still have. All the plans that have one when left out. */
  trialPlanIds?: string[];
}

// The plans as cards. One is recommended: a brand ring, no wash. Each card holds
// its price (which rolls when the period changes), one button before the list of
// what is included, and the list. The recommended card is the one the product
// marks `highlighted`, or the one the visitor picked before signing up.
export function PlanCards({ plans, ctas, interval, currency, taxExcluded, chosenPlanId, trialPlanIds }: PlanCardsProps) {
  const t = useTranslations("pricing");
  const tBilling = useTranslations("billing");
  const money = useMoney(currency);

  const lineLabel = (line: ReturnType<typeof includedLines>[number]) => {
    if (line.kind === "feature") {
      return tBilling.has(`featureLabels.${line.key}`) ? tBilling(`featureLabels.${line.key}`) : line.key;
    }

    return tBilling.has(`limitLines.${line.key}`)
      ? tBilling(`limitLines.${line.key}`, { count: line.count ?? 0 })
      : tBilling("limitLines.other", { count: line.count ?? 0, name: line.key });
  };

  return (
    <ul className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
      {plans.map((plan) => {
        const recommended = chosenPlanId ? plan.id === chosenPlanId : plan.highlighted === true;
        const price = plan.price[interval];
        const paid = isPaidPlan(plan);
        const cta = ctas[plan.id];
        const trial = Boolean(plan.trialDays) && (trialPlanIds === undefined || trialPlanIds.includes(plan.id));
        const description = tBilling.has(`plans.${plan.id}.description`) ? tBilling(`plans.${plan.id}.description`) : plan.description;
        const note =
          paid && interval === "yearly"
            ? t("yearlyEquivalent", { price: money(Math.round((plan.price.yearly / 12) * 100) / 100) })
            : "";

        return (
          <li key={plan.id} className="flex">
            <Card
              className={cn("w-full", recommended && "border-primary ring-1 ring-primary")}
              data-slot="plan-card"
              data-recommended={recommended || undefined}
            >
              <CardContent className="flex h-full flex-col gap-5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-panel font-semibold text-ink">{plan.name}</h3>
                    {recommended ? <Badge>{t("recommended")}</Badge> : null}
                  </div>
                  <p className="text-body text-ink-muted">{description}</p>
                </div>

                <div className="space-y-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-key font-semibold tabular-nums text-ink">
                      <RollingPrice value={money(price)} />
                    </span>
                    {paid ? <span className="text-meta text-ink-muted">{interval === "monthly" ? t("perMonth") : t("perYear")}</span> : null}
                  </p>
                  {/* The two small lines keep their room on every card, so that the buttons of a row stand on one line */}
                  <div className="min-h-10 space-y-0.5">
                    <p className="min-h-5 text-meta text-ink-muted">{[note, paid && taxExcluded ? t("exclVat") : ""].filter(Boolean).join(" · ")}</p>
                    {paid && trial ? <p className="text-meta font-medium text-brand-tint-ink">{t("trial", { days: plan.trialDays ?? 0 })}</p> : null}
                  </div>
                </div>

                {cta ? <PlanButton plan={plan} cta={cta} interval={interval} recommended={recommended} trial={trial} /> : null}

                <div className="space-y-3 border-t border-hairline pt-4">
                  <p className="text-meta font-medium text-ink">{t("included")}</p>
                  <ul className="space-y-2.5 text-body">
                    {includedLines(plan).map((line) => (
                      <li key={`${line.kind}-${line.key}`} className="flex items-start gap-2.5 text-ink-soft">
                        <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-text" />
                        <span>{lineLabel(line)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
