"use client";

import type { BillingInterval, PlanConfig } from "../plans";
import type { PlanCta } from "./plan-cta";
import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { toast } from "@/shared/components/ui/sonner";
import { Link, useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { continueOnFreeAction, startCheckoutAction } from "../actions";
import { goToCheckout } from "../checkout-flows";

interface PlanButtonProps {
  plan: PlanConfig;
  cta: PlanCta;
  interval: BillingInterval;
  recommended: boolean;
  /** The free trial is on offer: the button says so. */
  trial: boolean;
}

// The one button of a plan card. The recommended card has the primary button
// and the others the outline one, so that a row of three has one main action.
// What it does is what the page chose (`PlanCta`); a visitor's button is a link
// that keeps the plan and the period in the address (the proxy remembers them),
// a payment button asks the server, which answers where to pay.
export function PlanButton({ plan, cta, interval, recommended, trial }: PlanButtonProps) {
  const t = useTranslations("pricing");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const variant = recommended ? "default" : "outline";
  const query = `plan=${encodeURIComponent(plan.id)}&interval=${interval}`;

  if (cta.kind === "none") {
    return null;
  }

  if (cta.kind === "signup") {
    return (
      <Button asChild variant={variant} className="w-full">
        {/* Not prefetched: the proxy remembers the plan when the page is asked for, which a prefetch would do for a plan nobody chose */}
        <Link href={`/sign-up?${query}`} prefetch={false}>{trial ? t("startTrial") : t("choose", { plan: plan.name })}</Link>
      </Button>
    );
  }

  if (cta.kind === "free-signup") {
    return (
      <Button asChild variant="outline" className="w-full">
        <Link href="/sign-up">{t("startFree")}</Link>
      </Button>
    );
  }

  if (cta.kind === "change") {
    return (
      <Button asChild variant="outline" className="w-full">
        <Link href="/settings/billing">{t("changePlan")}</Link>
      </Button>
    );
  }

  if (cta.kind === "current") {
    return cta.href ? (
      <Button asChild variant="outline" className="w-full">
        <Link href={cta.href}>{t("yourPlan")}</Link>
      </Button>
    ) : (
      <Button variant="outline" className="w-full" disabled>
        {t("yourPlan")}
      </Button>
    );
  }

  if (cta.kind === "continue-free") {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full"
        loading={pending}
        onClick={async () => {
          setPending(true);
          try {
            await continueOnFreeAction();
            router.push("/dashboard");
          } catch (error) {
            unstable_rethrow(error);
            reportHandledError(error);
            toast.error(t("failed"));
            setPending(false);
          }
        }}
      >
        {t("continueFree", { plan: plan.name })}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      className="w-full"
      loading={pending}
      onClick={async () => {
        setPending(true);
        const went = await goToCheckout({
          start: () => startCheckoutAction({ orgId: cta.orgId, planId: plan.id, interval }),
          push: (path) => router.push(path),
          assign: (url) => window.location.assign(url),
          fail: (code) => toast.error(t(`checkoutErrors.${code}`)),
          report: reportHandledError,
        });
        if (!went) {
          setPending(false);
        }
      }}
    >
      {trial ? t("startTrial") : t("choose", { plan: plan.name })}
    </Button>
  );
}
