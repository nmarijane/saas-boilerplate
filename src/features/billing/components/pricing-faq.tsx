import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const QUESTIONS = ["cancel", "change", "trial", "payment", "vat"] as const;

// The questions a buyer asks before paying, as native disclosures: a `<details>`
// opens with the keyboard and a screen reader reads it, with no script. The
// answers are in the messages, so a project rewrites them in its own words.
export function PricingFaq() {
  const t = useTranslations("pricing.faq");

  return (
    <section aria-labelledby="faq-title" className="mx-auto max-w-3xl space-y-6">
      <h2 id="faq-title" className="text-center font-display text-page font-semibold text-ink">
        {t("title")}
      </h2>
      <div className="divide-y divide-hairline rounded-lg border border-hairline bg-surface">
        {QUESTIONS.map((key) => (
          <details key={key} className="group px-5">
            <summary className="tap-target flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-section text-ink focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
              {t(`${key}.question`)}
              <ChevronDownIcon aria-hidden="true" className="size-5 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <p className="pb-4 text-body text-ink-muted">{t(`${key}.answer`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
