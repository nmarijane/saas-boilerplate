"use client";

import type { BillingInterval, PlanConfig } from "../plans";
import { useFormatter, useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { OptionCards } from "@/shared/components/ui/option-cards";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { toast } from "@/shared/components/ui/sonner";
import { Spinner } from "@/shared/components/ui/spinner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { changePlanAction, previewPlanChangeAction } from "../actions";
import { minorToMajor } from "../money-units";
import { overLimits } from "../over-limits";
import { useMoney } from "./use-money";

type Preview =
  | { kind: "trial"; startsAt: string }
  | { kind: "proration"; dueNow: number; currency: string; prorationDate: number; nextRenewal: string | null };

interface ChangePlanDialogProps {
  orgId: string;
  /** The paid plans, in the order of the product. */
  plans: PlanConfig[];
  currentPlanId: string;
  currentInterval: BillingInterval;
  currency: string;
  /** What the workspace holds, by limit key: what a plan with a lower limit would leave over it. */
  usage: Record<string, number>;
}

// "Change plan", in a dialog of cards, with what it costs before it is done. A
// subscription is changed where it stands (no new payment page): the provider
// invoices the days left of the change at once, and the dialog shows that figure
// first, read from the provider for the day it will be done. In a trial nothing is
// charged: the new plan starts when the trial ends. A plan that would leave the
// workspace above one of its limits says so before it is confirmed: nothing is
// deleted, but nothing can be added until the workspace is under.
export function ChangePlanDialog({ orgId, plans, currentPlanId, currentInterval, currency, usage }: ChangePlanDialogProps) {
  const t = useTranslations("billing.change");
  const tBilling = useTranslations("billing");
  const tPricing = useTranslations("pricing");
  const format = useFormatter();
  const money = useMoney(currency);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState(currentPlanId);
  const [interval, setInterval] = useState<BillingInterval>(currentInterval);
  const [preview, setPreview] = useState<Preview | "loading" | "failed" | null>(null);
  const [pending, setPending] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const unchanged = planId === currentPlanId && interval === currentInterval;
  const target = plans.find((plan) => plan.id === planId);
  const over = useMemo(() => (target ? overLimits(target, usage) : []), [target, usage]);

  // Asks what the change costs each time the choice does: a stale answer is dropped
  useEffect(() => {
    if (!open || unchanged) {
      setPreview(null);
      return;
    }

    let current = true;
    setPreview("loading");
    previewPlanChangeAction({ orgId, planId, interval })
      .then((result) => {
        if (current) {
          setPreview(result.success && result.data ? result.data : "failed");
        }
      })
      .catch((error: unknown) => {
        unstable_rethrow(error);
        reportHandledError(error);
        if (current) {
          setPreview("failed");
        }
      });

    return () => {
      current = false;
    };
  }, [open, unchanged, orgId, planId, interval, refresh]);

  async function confirm() {
    if (!preview || preview === "loading" || preview === "failed") {
      return;
    }
    setPending(true);
    try {
      const result = await changePlanAction({
        orgId,
        planId,
        interval,
        prorationDate: preview.kind === "proration" ? preview.prorationDate : undefined,
      });
      if (!result.success && result.error === "stale_preview") {
        // The preview is too old to be charged on: it is asked again, and the person confirms what it says now
        toast.error(t("stale"));
        setRefresh((n) => n + 1);
        return;
      }
      if (!result.success) {
        throw new Error(result.error);
      }
      toast.success(t("done"));
      setOpen(false);
      router.refresh();
    } catch (error) {
      unstable_rethrow(error);
      reportHandledError(error);
      toast.error(t("failed"));
    } finally {
      setPending(false);
    }
  }

  const ready = preview !== null && preview !== "loading" && preview !== "failed";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">{t("trigger")}</Button>
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <SegmentedControl<BillingInterval>
          label={tPricing("period")}
          value={interval}
          onValueChange={setInterval}
          options={[
            { value: "monthly", label: tPricing("monthly") },
            { value: "yearly", label: tPricing("yearly") },
          ]}
        />
        <OptionCards
          name="plan"
          label={t("title")}
          value={planId}
          onValueChange={setPlanId}
          options={plans.map((plan) => ({
            value: plan.id,
            label: plan.id === currentPlanId ? t("currentPlan", { plan: plan.name }) : plan.name,
            description: `${money(plan.price[interval])} ${interval === "monthly" ? tPricing("perMonth") : tPricing("perYear")}`,
          }))}
        />

        <div aria-live="polite" className="space-y-3">
          {preview === "loading" ? (
            <p className="flex items-center gap-2 text-body text-ink-muted">
              <Spinner label="" />
              {t("previewing")}
            </p>
          ) : null}
          {preview === "failed" ? (
            <PageAlert
              tone="danger"
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => setRefresh((n) => n + 1)}>
                  {t("retry")}
                </Button>
              }
            >
              {t("previewFailed")}
            </PageAlert>
          ) : null}
          {ready && preview.kind === "trial" ? (
            <PageAlert tone="info">{t("trialChange", { date: format.dateTime(new Date(preview.startsAt), { dateStyle: "long" }) })}</PageAlert>
          ) : null}
          {ready && preview.kind === "proration" ? (
            <PageAlert tone="info">
              {preview.dueNow > 0
                ? t("dueNow", { amount: money(minorToMajor(preview.dueNow, preview.currency)) })
                : preview.dueNow < 0
                  ? t("credit", { amount: money(minorToMajor(Math.abs(preview.dueNow), preview.currency)) })
                  : t("nothingNow")}
              {preview.nextRenewal ? ` ${t("renewal", { date: format.dateTime(new Date(preview.nextRenewal), { dateStyle: "long" }) })}` : ""}
            </PageAlert>
          ) : null}
          {over.length > 0 && !unchanged ? (
            <PageAlert tone="warning" title={t("overTitle")}>
              <ul className="list-disc pl-5">
                {over.map(({ key, used, limit }) => (
                  <li key={key}>
                    {tBilling.has(`limits.${key}`) ? tBilling(`limits.${key}`) : key}: {t("overLine", { used: format.number(used), limit: format.number(limit) })}
                  </li>
                ))}
              </ul>
              <p className="mt-1">{t("overNote")}</p>
            </PageAlert>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("cancel")}
            </Button>
          </DialogClose>
          {/* While the cost is asked again the button loads rather than disables: it holds the focus of who just pressed it */}
          <Button type="button" loading={pending || preview === "loading"} disabled={unchanged || preview === "failed" || preview === null} disabledReason={unchanged ? t("pickAnother") : undefined} onClick={() => void confirm()}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
