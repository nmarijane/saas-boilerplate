"use client";

import { useFormatter, useTranslations } from "next-intl";
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
import { toast } from "@/shared/components/ui/sonner";
import { reportHandledError } from "@/shared/utils/report-error";
import { createCheckoutSessionAction, createPortalSessionAction } from "../actions";
import { openBillingPage } from "../billing-flows";
import { getPlanById, LIMIT_LABELS } from "../plans";
import { PlanBadge } from "./plan-badge";

interface BillingSettingsProps {
  orgId: string;
  planId: string;
  status: string;
  currentPeriodEnd?: Date | null;
  /** Whether the person may change the plan and open the billing portal (`canManageBilling`): the server asks the role again. */
  canManage: boolean;
}

// The subscription of the workspace: its plan, status, price and limits, for
// everyone in it. The buttons that change it (the billing portal, the upgrade)
// are drawn for those who may use them alone: a member sees the plan and is told
// who manages it. A button whose page does not open says so with a toast.
export function BillingSettings({
  orgId,
  planId,
  status,
  currentPeriodEnd,
  canManage,
}: BillingSettingsProps) {
  const t = useTranslations("billing");
  const format = useFormatter();
  const [loading, setLoading] = useState<string | null>(null);
  const plan = getPlanById(planId);
  const isFreePlan = planId === "free";

  async function handleManageBilling() {
    setLoading("portal");
    await openBillingPage({
      open: () => createPortalSessionAction(orgId),
      go: (url) => window.location.assign(url),
      fail: () => toast.error(t("portalFailed")),
      report: reportHandledError,
    });
    setLoading(null);
  }

  async function handleUpgrade(priceId: string) {
    setLoading("upgrade");
    await openBillingPage({
      open: () => createCheckoutSessionAction(orgId, priceId),
      go: (url) => window.location.assign(url),
      fail: () => toast.error(t("checkoutFailed")),
      report: reportHandledError,
    });
    setLoading(null);
  }

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle as="h2">{t("currentPlan")}</CardTitle>
              <CardDescription>
                {canManage ? t("manageDescription") : t("memberDescription")}
              </CardDescription>
            </div>
            <PlanBadge planId={planId} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("status")}</span>
              <span className="font-medium">
                {t.has(`statuses.${status}`) ? (
                  t(`statuses.${status}`)
                ) : (
                  // A status the messages do not know is the raw word of the provider, in lower case
                  <span className="capitalize">{status}</span>
                )}
              </span>
            </div>
            {currentPeriodEnd && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("periodEnds")}</span>
                <span className="font-medium">
                  <time dateTime={new Date(currentPeriodEnd).toISOString()}>
                    {format.dateTime(new Date(currentPeriodEnd), {
                      dateStyle: "medium",
                    })}
                  </time>
                </span>
              </div>
            )}
            {plan && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("price")}</span>
                  <span className="font-medium">
                    {plan.price.monthly === 0
                      ? t("free")
                      : t("pricePerMonth", { price: plan.price.monthly })}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
        {canManage && !isFreePlan && (
          <CardFooter>
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={loading === "portal"}
            >
              {loading === "portal" ? t("redirecting") : t("manageBilling")}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Plan limits */}
      {plan && (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("planLimits")}</CardTitle>
            <CardDescription>{t("planLimitsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {Object.entries(plan.limits).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.has(`limits.${key}`)
                      ? t(`limits.${key}`)
                      : (LIMIT_LABELS[key] ?? key)}
                  </span>
                  <span className="font-medium">
                    {value === -1 ? t("unlimited") : value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade CTA for free plan */}
      {canManage && isFreePlan && (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("upgradeTitle")}</CardTitle>
            <CardDescription>{t("upgradeDescription")}</CardDescription>
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
                    ? t("redirecting")
                    : t("upgradeTo", {
                        plan: proPlan.name,
                        price: proPlan.price.monthly,
                      })}
                </Button>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
