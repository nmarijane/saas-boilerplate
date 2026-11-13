import type { BillingOverview } from "../overview";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { isPaidPlan } from "../plans";
import { PlanBadge } from "./plan-badge";
import { PortalButton } from "./portal-button";

interface PlanCardProps {
  overview: BillingOverview;
  orgId: string;
  currency: string;
  /** Whether the person may open the portal (an admin at least). */
  canManage: boolean;
  /** The button that takes a scheduled cancellation back, when the page shows it here and not in its alert (the owner's). */
  resume?: React.ReactNode;
}

// The plan the workspace is on and where its subscription stands: the price and
// its period, the next renewal or the end of the trial or of the plan, and where
// the payment method is kept (the provider's portal, for those who may open it).
// A member sees the plan and its dates and is told who manages it.
export function PlanCard({ overview, orgId, currency, canManage, resume }: PlanCardProps) {
  const t = useTranslations("billing");
  const format = useFormatter();
  const { plan, status, interval, periodEnd, trialEnd, cancelAtPeriodEnd, subscribed } = overview;
  const date = (value: Date) => (
    <time dateTime={value.toISOString()}>{format.dateTime(value, { dateStyle: "long" })}</time>
  );
  const price = interval ? plan.price[interval] : 0;
  const money = format.number(price, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
  });

  const rows: { label: string; value: React.ReactNode }[] = [];
  if (subscribed && interval) {
    rows.push({ label: t("price"), value: `${money} ${interval === "monthly" ? t("perMonthShort") : t("perYearShort")}` });
  }
  if (trialEnd) {
    rows.push({ label: t("trialEnds"), value: date(trialEnd) });
  } else if (periodEnd && subscribed) {
    rows.push({ label: cancelAtPeriodEnd ? t("endsOn") : t("renewsOn"), value: date(periodEnd) });
  }

  return (
    <Card data-slot="plan-card">
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-section text-ink">{t("currentPlan")}</h2>
            <p className="text-body text-ink-muted">{canManage ? t("manageDescription") : t("memberDescription")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PlanBadge planId={plan.id} />
            {status === "trialing" ? <Badge variant="brand">{t("statuses.trialing")}</Badge> : null}
            {status === "past_due" ? <Badge variant="warning">{t("statuses.past_due")}</Badge> : null}
          </div>
        </div>

        {rows.length > 0 ? (
          <dl className="grid gap-3 border-t border-hairline pt-4 text-body sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="space-y-0.5">
                <dt className="text-meta text-ink-muted">{row.label}</dt>
                <dd className="font-medium text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {resume ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4"><p className="text-body text-ink-muted">{t("cancelledNote")}</p>{resume}</div> : null}

        {!isPaidPlan(plan) ? <p className="border-t border-hairline pt-4 text-body text-ink-muted">{t("freeNote")}</p> : null}

        {canManage && subscribed ? (
          <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body text-ink-muted">{t("paymentMethodNote")}</p>
            <PortalButton orgId={orgId} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
