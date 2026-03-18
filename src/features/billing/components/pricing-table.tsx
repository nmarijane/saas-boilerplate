"use client";

import type {PlanConfig} from "../plans";
import { useState } from "react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { cn } from "@/shared/utils/cn";
import { capitalize } from "@/shared/utils/helpers";
import { FEATURE_LABELS,  PLANS } from "../plans";

type BillingInterval = "monthly" | "yearly";

interface PricingTableProps {
  currentPlanId?: string;
  orgId?: string;
  onSelectPlan?: (plan: PlanConfig, interval: BillingInterval) => void;
}

function CheckIcon() {
  return (
    <svg
      className="size-4 shrink-0 text-green-600 dark:text-green-400"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="size-4 shrink-0 text-muted-foreground/40"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export function PricingTable({
  currentPlanId,
  onSelectPlan,
}: PricingTableProps) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  return (
    <div className="w-full">
      {/* Billing interval toggle */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            interval === "monthly"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setInterval("monthly")}
        >
          Monthly
        </button>
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            interval === "yearly"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setInterval("yearly")}
        >
          Yearly
          <Badge variant="secondary" className="ml-1.5 text-xs">
            Save 17%
          </Badge>
        </button>
      </div>

      {/* Plans grid */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const price = plan.price[interval];
          const isCurrent = currentPlanId === plan.id;

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col",
                plan.highlighted && "border-primary shadow-md"
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge>Most Popular</Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="mb-6">
                  <span className="text-4xl font-bold">
                    ${price}
                  </span>
                  {price > 0 && (
                    <span className="text-muted-foreground text-sm">
                      /{interval === "monthly" ? "mo" : "yr"}
                    </span>
                  )}
                </div>

                <ul className="space-y-2.5 text-sm">
                  {Object.entries(plan.features).map(([key, enabled]) => (
                    <li key={key} className="flex items-center gap-2">
                      {enabled ? <CheckIcon /> : <XIcon />}
                      <span
                        className={cn(!enabled && "text-muted-foreground/60")}
                      >
                        {FEATURE_LABELS[key] ?? key}
                      </span>
                    </li>
                  ))}
                  {Object.entries(plan.limits).map(([key, value]) => (
                    <li key={key} className="flex items-center gap-2">
                      <CheckIcon />
                      <span>
                        {value === -1 ? "Unlimited" : value}{" "}
                        {key === "storage" && value !== -1 ? "MB " : ""}
                        {capitalize(key)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    variant={plan.highlighted ? "default" : "outline"}
                    className="w-full"
                    onClick={() => onSelectPlan?.(plan, interval)}
                    disabled={plan.id === "free" && !currentPlanId}
                  >
                    {plan.id === "free"
                      ? "Downgrade"
                      : price === 0
                        ? "Get Started"
                        : "Upgrade"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
