import { LockIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { TextLink } from "@/shared/components/ui/text-link";
import { Link } from "@/shared/lib/i18n-navigation";
import { cn } from "@/shared/utils/cn";

interface PlanLockProps {
  /**
   * `card` sits in a grid, `line` inside a form or a dialog, `page` replaces a
   * page whose whole feature the plan does not include.
   */
  variant: "card" | "line" | "page";
  /**
   * The plan that includes what is locked ("Pro"). Without it the sentence says
   * the plan does not include it, for a workspace that is on the highest.
   */
  planName?: string;
  /** What is locked, in a few words ("More projects", "Inviting teammates"): the title of a card or a page. */
  feature: string;
  /** One sentence on why, under the title of a card or a page. */
  description?: string;
  /** Where the plan is changed. Without it there is nothing to offer: a role that may not buy is told to ask. */
  href?: string | null;
  /** What is said in place of the link when there is none, instead of "ask an admin" (where the person can do nothing yet). */
  note?: string;
  /** The tag of the title of a `page`: 1 when nothing above it holds the page's heading. */
  headingLevel?: 1 | 2;
  className?: string;
}

// One answer to "this is not in your plan", in three sizes. It never says what
// the plan costs (the pages that sell do): it says which plan includes the
// feature, and leads to the right place to change plan. The button is the one of
// its zone; a line has a link instead, which is quieter in a form. A role that
// cannot buy has no `href` and is told to ask instead.
export function PlanLock({ variant, planName, feature, description, href, note, headingLevel = 2, className }: PlanLockProps) {
  const t = useTranslations("planLock");
  const title = planName ? t("included", { plan: planName }) : t("notIncluded");

  if (variant === "line") {
    return (
      <p
        data-slot="plan-lock"
        className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-muted", className)}
      >
        <LockIcon aria-hidden="true" className="size-4 shrink-0" />
        <span>
          <span className="font-medium text-ink">{feature}</span> · {title}
        </span>
        {href ? (
          <TextLink asChild className="tap-target">
            <Link href={href}>{t("upgrade")}</Link>
          </TextLink>
        ) : (
          <span>{note ?? t("askAdmin")}</span>
        )}
      </p>
    );
  }

  if (variant === "card") {
    return (
      <Card data-slot="plan-lock" className={cn("h-full", className)}>
        <CardContent className="flex h-full flex-col gap-4">
          <div className="flex items-center gap-3">
            <IconTile icon={LockIcon} tone="neutral" />
            <div className="min-w-0 flex-1">
              <h3 className="text-section wrap-break-word text-ink">{feature}</h3>
              <p className="text-meta text-ink-muted">{title}</p>
            </div>
          </div>
          {description ? <p className="text-body text-ink-muted">{description}</p> : null}
          {href ? (
            <Button asChild variant="outline" className="mt-auto self-start">
              <Link href={href}>{t("upgrade")}</Link>
            </Button>
          ) : (
            <p className="mt-auto text-meta text-ink-muted">{note ?? t("askAdmin")}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const Heading = `h${headingLevel}` as const;

  return (
    <div
      data-slot="plan-lock"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-hairline bg-surface p-8 text-center",
        className,
      )}
    >
      <IconTile icon={LockIcon} size="lg" tone="neutral" />
      <Heading className="mt-4 text-section text-balance wrap-anywhere text-ink">{feature}</Heading>
      <p className="mt-1 max-w-sm text-body wrap-anywhere text-ink-muted">{description ?? title}</p>
      {description ? <p className="mt-1 text-meta text-ink-muted">{title}</p> : null}
      {href ? (
        <Button asChild className="mt-6">
          <Link href={href}>{t("upgrade")}</Link>
        </Button>
      ) : (
        <p className="mt-6 text-meta text-ink-muted">{note ?? t("askAdmin")}</p>
      )}
    </div>
  );
}
