import type { PlanConfig } from "../plans";
import { CheckIcon, MinusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";

// Every plan side by side: the limits first, then the features, one row each, the
// plans in columns. It is a real table, read row by row by a screen reader: a
// cell says "Included" or "Not included" in words that only a screen reader sees,
// and a figure is a figure. On a phone it scrolls inside its box (`Table`), never
// the page; the box takes the focus, so the keyboard reaches what is off screen.
export function PricingComparison({ plans }: { plans: PlanConfig[] }) {
  const t = useTranslations("pricing");
  const tBilling = useTranslations("billing");
  const limitKeys = [...new Set(plans.flatMap((plan) => Object.keys(plan.limits)))];
  const featureKeys = [...new Set(plans.flatMap((plan) => Object.keys(plan.features)))];

  const limitName = (key: string) => (tBilling.has(`limits.${key}`) ? tBilling(`limits.${key}`) : key);
  const featureName = (key: string) => (tBilling.has(`featureLabels.${key}`) ? tBilling(`featureLabels.${key}`) : key);

  return (
    <section className="space-y-6">
      <h2 id="comparison-title" className="text-center font-display text-page font-semibold text-ink">
        {t("compare")}
      </h2>
      <div className="rounded-lg border border-hairline bg-surface">
        <Table scrollLabelledBy="comparison-title" className="min-w-[36rem]">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">
                <span className="sr-only">{t("feature")}</span>
              </TableHead>
              {plans.map((plan) => (
                <TableHead key={plan.id} scope="col" className="text-ink">
                  {plan.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {limitKeys.map((key) => (
              <TableRow key={`limit-${key}`}>
                <TableHead scope="row" className="font-normal text-ink-soft">
                  {limitName(key)}
                </TableHead>
                {plans.map((plan) => {
                  const value = plan.limits[key];
                  return (
                    <TableCell key={plan.id}>
                      {value === undefined ? (
                        <>
                          <MinusIcon aria-hidden="true" className="size-4 text-ink-muted" />
                          <span className="sr-only">{t("notIncluded")}</span>
                        </>
                      ) : value < 0 ? (
                        t("unlimited")
                      ) : (
                        tBilling("limitValue", { count: value })
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {featureKeys.map((key) => (
              <TableRow key={`feature-${key}`}>
                <TableHead scope="row" className="font-normal text-ink-soft">
                  {featureName(key)}
                </TableHead>
                {plans.map((plan) => (
                  <TableCell key={plan.id}>
                    {plan.features[key] ? (
                      <>
                        <CheckIcon aria-hidden="true" className="size-4 text-success-text" />
                        <span className="sr-only">{t("included")}</span>
                      </>
                    ) : (
                      <>
                        <MinusIcon aria-hidden="true" className="size-4 text-ink-muted" />
                        <span className="sr-only">{t("notIncluded")}</span>
                      </>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
