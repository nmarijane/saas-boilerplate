import type { InvoiceRow } from "../invoices";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { TextLink } from "@/shared/components/ui/text-link";
import { minorToMajor } from "../money-units";

const STATUS_TONE = { paid: "success", open: "warning", uncollectible: "danger", void: "neutral", draft: "neutral" } as const;

// The invoices of the subscription, read at the provider, newest first: the
// date and the number, what it came to, where it stands, and a link to the page of
// the provider that shows it (and its PDF). A few cards of rows, not a table: there
// are few of them. When they cannot be read the section says so in a line and the
// rest of the page is untouched.
export function InvoiceList({ invoices }: { invoices: InvoiceRow[] | null }) {
  const t = useTranslations("billing.invoices");
  const format = useFormatter();

  return (
    <section aria-labelledby="invoices-title" className="space-y-3">
      <h2 id="invoices-title" className="text-section text-ink">
        {t("title")}
      </h2>
      {invoices === null ? (
        <PageAlert tone="warning">{t("failed")}</PageAlert>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-body text-ink-muted">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y divide-hairline">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">
                      <time dateTime={invoice.createdAt.toISOString()}>{format.dateTime(invoice.createdAt, { dateStyle: "medium" })}</time>
                    </p>
                    {invoice.number ? <p className="text-meta text-ink-muted">{invoice.number}</p> : null}
                  </div>
                  <p className="font-medium tabular-nums text-ink">
                    {format.number(minorToMajor(invoice.amount, invoice.currency), { style: "currency", currency: invoice.currency.toUpperCase() })}
                  </p>
                  <Badge variant={STATUS_TONE[invoice.status]}>{t(`statuses.${invoice.status}`)}</Badge>
                  {invoice.url ? (
                    <TextLink asChild className="tap-target">
                      <a href={invoice.url} target="_blank" rel="noopener noreferrer">
                        {t("view")}
                        <span className="sr-only"> {invoice.number ?? ""} {t("opensInNewTab")}</span>
                      </a>
                    </TextLink>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
