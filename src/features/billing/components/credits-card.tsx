import type { CreditState } from "@/features/ai/service";
import { ZapIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Card, CardContent } from "@/shared/components/ui/card";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { ProgressBar } from "@/shared/components/ui/progress-bar";
import { TopUpDialog } from "./top-up-dialog";

interface CreditsCardProps {
  credits: CreditState;
  orgId: string;
  currency: string;
  /** Offers to buy a pack (an admin at least). */
  canTopUp: boolean;
  /** The first of next month, UTC: when the allocation starts over. */
  nextGrant: Date;
  /** Opens the packs at once (`?topup=1`, from the chat's refusal). */
  topUpOpen?: boolean;
}

// What is left of the AI credits: "4,120 of 5,000" is what remains of this
// month's credits, which do not carry over, and a second line says what was
// bought (those never expire and are spent after). The bar fills as the credits are
// spent, and the figure says which unit it counts. An unlimited plan says so and
// has nothing to top up.
export function CreditsCard({ credits, orgId, currency, canTopUp, nextGrant, topUpOpen }: CreditsCardProps) {
  const t = useTranslations("billing.credits");
  const format = useFormatter();
  const used = credits.monthly - credits.allocation;

  return (
    <Card data-slot="credits-card" className="h-full">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-3">
          <IconTile icon={ZapIcon} tone="t2" />
          <h3 className="min-w-0 flex-1 text-section text-ink">{t("title")}</h3>
        </div>

        {credits.unlimited ? (
          <p className="font-mono text-page font-medium text-ink">{t("unlimited")}</p>
        ) : (
          <>
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-page font-medium tabular-nums text-ink">{format.number(credits.allocation)}</span>
              <span className="text-meta text-ink-muted">{t("leftOf", { total: format.number(credits.monthly) })}</span>
            </p>
            <ProgressBar
              value={Math.max(0, used)}
              max={Math.max(1, credits.monthly)}
              label={t("title")}
              valueText={t("valueText", { left: format.number(credits.allocation), total: format.number(credits.monthly) })}
            />
            <p className="text-meta text-ink-muted">
              {t("renews", { date: format.dateTime(nextGrant, { dateStyle: "long", timeZone: "UTC" }) })}
            </p>
            {credits.packs > 0 ? <p className="text-meta text-ink-muted">{t("packs", { count: format.number(credits.packs) })}</p> : null}
          </>
        )}

        {canTopUp && !credits.unlimited ? (
          <div className="mt-auto">
            <TopUpDialog orgId={orgId} currency={currency} defaultOpen={topUpOpen} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
