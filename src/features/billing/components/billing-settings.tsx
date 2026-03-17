"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { createCheckoutSession, createPortalSession } from "../helpers";
import { getPlanById, LIMIT_LABELS } from "../plans";
import { PlanBadge } from "./plan-badge";

interface BillingSettingsProps {
  orgId: string;
  planId: string;
  status: string;
  currentPeriodEnd?: Date | null;
}

export function BillingSettings({
  orgId,
  planId,
  status,
  currentPeriodEnd,
}: BillingSettingsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const plan = getPlanById(planId);
  const isFreePlan = planId === "free";

  async function handleManageBilling() {
    setLoading("portal");
    try {
      const session = await createPortalSession(orgId);
      window.location.href = session.url;
    } catch {
      // Will show error in toast via error boundary
    } finally {
      setLoading(null);
    }
  }

  async function handleUpgrade(priceId: string) {
    setLoading("upgrade");
    try {
      const session = await createCheckoutSession(orgId, priceId);
      if (session.url) {
        window.location.href = session.url;
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                Manage your subscription and billing
              </CardDescription>
            </div>
            <PlanBadge planId={planId} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{status}</span>
            </div>
            {currentPeriodEnd && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Current period ends
                </span>
                <span className="font-medium">
                  {new Date(currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            )}
            {plan && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium">
                    {plan.price.monthly === 0
                      ? "Free"
                      : `$${plan.price.monthly}/mo`}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
        {!isFreePlan && (
          <CardFooter>
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={loading === "portal"}
            >
              {loading === "portal"
                ? "Redirecting..."
                : "Manage Billing"}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Plan limits */}
      {plan && (
        <Card>
          <CardHeader>
            <CardTitle>Plan Limits</CardTitle>
            <CardDescription>
              Your current plan includes the following limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {Object.entries(plan.limits).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {LIMIT_LABELS[key] ?? key}
                  </span>
                  <span className="font-medium">
                    {value === -1 ? "Unlimited" : value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade CTA for free plan */}
      {isFreePlan && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade your plan</CardTitle>
            <CardDescription>
              Get more features and higher limits with a paid plan
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            {(() => {
              const proPlan = getPlanById("pro");
              if (!proPlan) return null;
              return (
                <Button
                  onClick={() =>
                    handleUpgrade(proPlan.stripePriceId.monthly)
                  }
                  disabled={
                    loading === "upgrade" || !proPlan.stripePriceId.monthly
                  }
                >
                  {loading === "upgrade"
                    ? "Redirecting..."
                    : `Upgrade to Pro — $${proPlan.price.monthly}/mo`}
                </Button>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
