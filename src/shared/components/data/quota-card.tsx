import type { ShellQuota } from "@/shared/shell/view";
import { TriangleAlertIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { ProgressBar } from "@/shared/components/ui/progress-bar";
import { TextLink } from "@/shared/components/ui/text-link";
import { Link } from "@/shared/lib/i18n-navigation";

// How much of a limit of the plan a workspace uses: the quota's tile and name,
// the figure with what it is out of, and a bar that says it by eye. The bar
// turns warning from 80 % and danger at the limit, and the state is told in
// words beside the figure, so that the color is never alone. A quota with no
// limit has no bar and says "Unlimited": the shell writes it -1, which is never
// shown. The way up (Upgrade) is offered only to a quota that needs it, and
// only when the plan has something above it.
//
// It is a Server Component: the figures are formatted once, on the server,
// where the language of the page is known. The tile takes the icon the shell
// drew, in the tone the feature chose, so that the cards of a row are told
// apart without a legend. The card fills the cell it is put in, so that the
// cards of a row are as tall as the tallest.
export function QuotaCard({ quota }: { quota: ShellQuota }) {
  const t = useTranslations("quotas");
  const format = useFormatter();

  // A figure carries its unit: a bare 3,200 does not say what it counts.
  const figure = (value: number) =>
    format.number(
      value,
      quota.unit ? { style: "unit", unit: quota.unit } : undefined,
    );
  const used = figure(quota.used);
  // No limit to write: the shell says -1, and the card says "Unlimited".
  const limit = quota.status === "unlimited" ? null : figure(quota.limit);
  const upgradeHref =
    quota.status === "warning" || quota.status === "limit"
      ? quota.upgradeHref
      : null;

  return (
    <Card className="h-full">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <IconTile tone={`t${quota.tone}`}>{quota.icon}</IconTile>
          <h3 className="min-w-0 flex-1 text-section wrap-break-word text-ink">
            {quota.label}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-page font-medium tabular-nums wrap-break-word text-ink">
              {used}
            </span>
            <span className="text-meta text-ink-muted">
              {limit === null ? t("unlimited") : t("of", { limit })}
            </span>
          </p>
          {quota.status === "limit" ? (
            <Badge variant="danger">{t("limitReached")}</Badge>
          ) : null}
          {quota.status === "warning" ? (
            <Badge variant="warning">
              <TriangleAlertIcon />
              {t("runningLow")}
            </Badge>
          ) : null}
        </div>
        {limit === null ? null : (
          <ProgressBar
            value={quota.used}
            max={quota.limit}
            label={quota.label}
            valueText={t("valueText", { used, limit })}
          />
        )}
        {upgradeHref ? (
          // Alone on its line: a 44 px target, as wide as its words and no wider.
          <TextLink asChild className="tap-target self-start">
            <Link href={upgradeHref}>{t("upgrade")}</Link>
          </TextLink>
        ) : null}
      </CardContent>
    </Card>
  );
}
