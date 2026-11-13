import type { LucideIcon } from "lucide-react";
import type { PageHeaderAction } from "@/shared/components/data/more-actions";
import { MoreActions } from "@/shared/components/data/more-actions";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { cn } from "@/shared/utils/cn";

interface PageHeaderProps {
  /** The one `h1` of the page. */
  title: string;
  /** The line under the title: the workspace and the plan, a count, a date. */
  context?: React.ReactNode;
  /** Drawn in a 56 px tinted tile, never bare. An `illustration` takes its place. */
  icon?: LucideIcon;
  /**
   * Art the project supplies, where the tile would be. It is decoration by
   * contract, hidden from assistive technology: the title says what the page
   * is about.
   */
  illustration?: React.ReactNode;
  /** The one button of the page. Every other action goes in `moreActions`. */
  primaryAction?: React.ReactNode;
  /**
   * The other actions, in a « ⋯ » menu after the primary action. A header that
   * has them needs a client component: the handlers are functions, and a
   * function cannot cross from a Server Component.
   */
  moreActions?: PageHeaderAction[];
  /** One alert under the header, a `PageAlert`. */
  alert?: React.ReactNode;
  /** Under the alert: the `TabsList` of the page, or its links. */
  tabs?: React.ReactNode;
  className?: string;
}

// The header of a page: a tile, the title and its context line, then the
// actions, with the alert and the tabs below. It stacks on a phone and sits on
// one row from `sm`, like its skeleton (PageHeaderSkeleton), which is drawn to
// the same size. The text shrinks beside the tile and breaks a long word, and
// the actions wrap, so that nothing leaves the row at 320 px. Under 30rem
// (480 px) the tile is 40 px and the title 20 px; IconTile has no responsive
// size, so the small one is a set of classes on the same tile.
// The context is a div, not a paragraph: it may hold any node.
export function PageHeader({
  title,
  context,
  icon,
  illustration,
  primaryAction,
  moreActions = [],
  alert,
  tabs,
  className,
}: PageHeaderProps) {
  let picture: React.ReactNode = null;
  if (illustration) {
    picture = (
      <div
        data-slot="page-header-illustration"
        aria-hidden="true"
        className="flex shrink-0"
      >
        {illustration}
      </div>
    );
  } else if (icon) {
    picture = (
      <IconTile
        icon={icon}
        tone="brand"
        size="lg"
        className="max-[30rem]:size-10 max-[30rem]:rounded-md max-[30rem]:[&>svg]:size-5"
      />
    );
  }

  return (
    <div
      data-slot="page-header"
      className={cn("flex flex-col gap-4", className)}
    >
      <div
        data-slot="page-header-row"
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {picture}
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="font-display text-page max-[30rem]:text-panel font-semibold tracking-tight text-balance wrap-break-word text-ink">
              {title}
            </h1>
            {context ? (
              <div
                data-slot="page-header-context"
                className="text-meta wrap-break-word text-ink-muted"
              >
                {context}
              </div>
            ) : null}
          </div>
        </div>
        {primaryAction || moreActions.length > 0 ? (
          <div
            data-slot="page-header-actions"
            className="flex flex-wrap items-center gap-x-2 gap-y-3"
          >
            {primaryAction}
            {moreActions.length > 0 ? (
              <MoreActions actions={moreActions} />
            ) : null}
          </div>
        ) : null}
      </div>
      {alert}
      {tabs}
    </div>
  );
}
