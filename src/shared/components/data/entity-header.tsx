import type { PageHeaderAction } from "@/shared/components/data/more-actions";
import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { MoreActions } from "@/shared/components/data/more-actions";
import { textLinkVariants } from "@/shared/components/ui/text-link";
import { Link } from "@/shared/lib/i18n-navigation";
import { cn } from "@/shared/utils/cn";

interface BreadcrumbItem {
  label: string;
  /** Where the crumb goes. The last crumb is the current page and never links, whatever it holds. */
  href?: string;
}

interface EntityHeaderProps {
  /**
   * The trail from the list the entity belongs to, in order. Every crumb but
   * the last links to its page; the last is the entity itself, marked as the
   * current page. With no crumb, no trail is drawn.
   */
  breadcrumb: BreadcrumbItem[];
  /** The one `h1` of the page: the name of the entity. */
  title: string;
  /** One short sentence under the title. */
  description?: string;
  /** Under the description: a status, a date, a few badges. */
  meta?: React.ReactNode;
  /** The one button of the page. Every other action goes in `moreActions`. */
  primaryAction?: React.ReactNode;
  /**
   * The other actions, in a « ⋯ » menu after the primary action. A header that
   * has them needs a client component: the handlers are functions, and a
   * function cannot cross from a Server Component.
   */
  moreActions?: PageHeaderAction[];
  /** Under the header: the `TabLinks` of the entity. */
  tabs?: React.ReactNode;
  className?: string;
}

// The trail to the entity. The last crumb is the page the reader is on: not a
// link, and marked `aria-current="page"` on its item, as the other items are
// links to the pages above it. The chevrons between the crumbs are decoration,
// hidden from assistive technology: the list already says there are several.
// The trail wraps when it is long, and the last crumb is cut to one line (the
// title under it says the whole name). The links are 44 px targets.
function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const t = useTranslations("common");

  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label={t("breadcrumb")} data-slot="entity-header-breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-meta text-ink-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;

          return (
            <li
              key={`${item.href ?? ""}|${item.label}`}
              aria-current={last ? "page" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-1.5",
                last && "font-medium text-ink",
              )}
            >
              {!last && item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    textLinkVariants({ intent: "muted", underline: "hover" }),
                    "tap-target wrap-break-word",
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span className={cn(last && "truncate")}>{item.label}</span>
              )}
              {last ? null : (
                <ChevronRightIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// The header of the page of an entity (a project, a member...): the trail that
// leads to it, its name as the one h1, a short description and its meta, then
// the actions, with the tabs below. It is the other family of headers, next to
// PageHeader: that one heads a page of the app, this one the page of a thing
// that lives in a list, so its title is smaller (24 px, bold) and it has no
// tile. The two never mix on a page. The actions sit as PageHeader's do, and
// the skeleton (EntityHeaderSkeleton) is drawn to the same size.
export function EntityHeader({
  breadcrumb,
  title,
  description,
  meta,
  primaryAction,
  moreActions = [],
  tabs,
  className,
}: EntityHeaderProps) {
  return (
    <div
      data-slot="entity-header"
      className={cn("flex flex-col gap-4", className)}
    >
      <Breadcrumb items={breadcrumb} />
      <div
        data-slot="entity-header-row"
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="font-display text-entity font-bold tracking-tight text-balance wrap-break-word text-ink">
            {title}
          </h1>
          {description ? (
            <p
              data-slot="entity-header-description"
              className="text-body wrap-break-word text-ink-muted"
            >
              {description}
            </p>
          ) : null}
          {meta ? (
            <div
              data-slot="entity-header-meta"
              className="flex flex-wrap items-center gap-2 pt-1"
            >
              {meta}
            </div>
          ) : null}
        </div>
        {primaryAction || moreActions.length > 0 ? (
          <div
            data-slot="entity-header-actions"
            className="flex flex-wrap items-center gap-x-2 gap-y-3"
          >
            {primaryAction}
            {moreActions.length > 0 ? (
              <MoreActions actions={moreActions} />
            ) : null}
          </div>
        ) : null}
      </div>
      {tabs}
    </div>
  );
}
