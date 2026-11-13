import type { LimitInfo } from "@/shared/lib/action-refusal";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { Link } from "@/shared/lib/i18n-navigation";

// What a form says when the server refused it for a limit of the plan
// (`PlanLimitError`, handed to the page as `limit` by `safeAction`): a warning,
// announced when it appears (the button that was pressed has stopped turning, and
// nothing else would say why), with the plan that includes what was refused and the
// way to the plans, or, for a role that cannot take it, who to ask. `feature` is
// what was refused, in a few words ("More projects").
export function LimitNotice({ limit, feature }: { limit: LimitInfo; feature: string }) {
  const t = useTranslations("planLock");

  return (
    <PageAlert
      tone="warning"
      title={feature}
      action={
        limit.upgradeHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={limit.upgradeHref}>{t("upgrade")}</Link>
          </Button>
        ) : undefined
      }
    >
      {limit.includedIn ? t("included", { plan: limit.includedIn }) : t("notIncluded")}
      {limit.upgradeHref ? "" : ` · ${t("askAdmin")}`}
    </PageAlert>
  );
}
