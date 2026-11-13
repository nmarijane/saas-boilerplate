import type { CheckoutSessionView } from "../checkout-status";
import { CheckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Card, CardContent } from "@/shared/components/ui/card";
import { getCreditPack } from "../credit-packs";
import { getPlanById } from "../plans";
import { includedLines } from "./included-lines";

interface CheckoutSummaryProps {
  session: CheckoutSessionView;
  currency: string;
  taxExcluded: boolean;
}

// What is being bought, before the form: the plan and the period, what is
// charged today, what follows and when, and what is included. Every figure comes
// from `PLANS` (or the credit packs) and is written in the language of the page:
// the form on the right is the provider's, this is ours. A trial is stated in
// days and in the date it ends, with today's price at zero.
export function CheckoutSummary({ session, currency, taxExcluded }: CheckoutSummaryProps) {
  const t = useTranslations("checkout");
  const tBilling = useTranslations("billing");
  const format = useFormatter();
  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 });

  if (session.kind === "credit_pack") {
    const pack = getCreditPack(session.packId ?? "");
    if (!pack) {
      return null;
    }

    return (
      <Card data-slot="checkout-summary">
        <CardContent className="space-y-5">
          <h2 className="text-section text-ink">{t("summary")}</h2>
          <div className="space-y-1">
            <p className="text-panel font-semibold text-ink">{t("pack", { credits: format.number(pack.credits) })}</p>
            <p className="text-body text-ink-muted">{t("packNote")}</p>
          </div>
          <dl className="space-y-2 border-t border-hairline pt-4 text-body">
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-ink">{t("today")}</dt>
              <dd className="font-medium tabular-nums text-ink">{money(pack.price)}</dd>
            </div>
          </dl>
          {taxExcluded ? <p className="text-meta text-ink-muted">{t("exclVat")}</p> : null}
        </CardContent>
      </Card>
    );
  }

  const plan = getPlanById(session.planId ?? "");
  if (!plan || !session.interval) {
    return null;
  }

  const price = plan.price[session.interval];
  const per = session.interval === "monthly" ? t("perMonth") : t("perYear");
  const trialEnds = session.trialDays ? new Date(Date.now() + session.trialDays * 86_400_000) : null;

  return (
    <Card data-slot="checkout-summary">
      <CardContent className="space-y-5">
        <h2 className="text-section text-ink">{t("summary")}</h2>
        <div className="space-y-1">
          <p className="text-panel font-semibold text-ink">{t("planLine", { plan: plan.name })}</p>
          <p className="text-body text-ink-muted">{session.interval === "monthly" ? t("billedMonthly") : t("billedYearly")}</p>
        </div>

        <dl className="space-y-2 border-t border-hairline pt-4 text-body">
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-ink">{t("today")}</dt>
            <dd className="font-medium tabular-nums text-ink">{money(trialEnds ? 0 : price)}</dd>
          </div>
          {trialEnds ? (
            <div className="flex justify-between gap-4 text-ink-muted">
              <dt>{t("then", { date: format.dateTime(trialEnds, { dateStyle: "long" }) })}</dt>
              <dd className="tabular-nums">
                {money(price)} {per}
              </dd>
            </div>
          ) : (
            <div className="flex justify-between gap-4 text-ink-muted">
              <dt>{t("renews")}</dt>
              <dd className="tabular-nums">
                {money(price)} {per}
              </dd>
            </div>
          )}
        </dl>
        {trialEnds ? <p className="text-meta text-ink-muted">{t("trialNote", { days: session.trialDays ?? 0 })}</p> : null}
        {taxExcluded ? <p className="text-meta text-ink-muted">{t("exclVat")}</p> : null}

        <div className="space-y-3 border-t border-hairline pt-4">
          <p className="text-meta font-medium text-ink">{t("included")}</p>
          <ul className="space-y-2 text-body">
            {includedLines(plan).map((line) => (
              <li key={`${line.kind}-${line.key}`} className="flex items-start gap-2.5 text-ink-soft">
                <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-text" />
                <span>
                  {line.kind === "limit"
                    ? tBilling.has(`limitLines.${line.key}`)
                      ? tBilling(`limitLines.${line.key}`, { count: line.count ?? 0 })
                      : tBilling("limitLines.other", { count: line.count ?? 0, name: line.key })
                    : tBilling.has(`featureLabels.${line.key}`)
                      ? tBilling(`featureLabels.${line.key}`)
                      : line.key}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
