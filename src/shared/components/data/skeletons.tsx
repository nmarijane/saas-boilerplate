import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Children, cloneElement, isValidElement } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { tabStripStyles } from "@/shared/components/ui/tab-strip";
import { cn } from "@/shared/utils/cn";

// The loading states of a page, drawn to the size of what will replace them so
// that the page does not move when it arrives. Each one is a busy region that
// says "Loading" to screen readers only (see `announce`); the bars carry no
// text. They all use the one color of `Skeleton`.

interface SkeletonProps {
  /**
   * Says "Loading" to screen readers, once, as the default. Pass `false` for a
   * skeleton inside a region that already says it, so that a page made of
   * several skeletons announces once (see `LoadingRegion`). The skeleton stays
   * busy either way.
   */
  announce?: boolean;
  /** A class of yours, merged over the layout of the skeleton. */
  className?: string;
}

/** The numbers 0 to count - 1: the rows or the columns to draw. */
function range(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}

// A few widths, handed out in turn, so that the lines do not look stamped.
const WIDTHS = ["w-4/5", "w-3/5", "w-2/3", "w-1/2"] as const;

function LoadingLabel() {
  const t = useTranslations("common");

  return <span className="sr-only">{t("loading")}</span>;
}

// A few widths for the labels of the tabs, handed out in turn like the lines of
// a list (WIDTHS): a strip of equal bars looks stamped.
const TAB_WIDTHS = ["w-16", "w-12", "w-24", "w-20", "w-14"] as const;

// The header of a page: a tile, a title and its context line, one action, and
// under them as many tabs as `tabs` says (none by default), for the pages that
// have a strip of them, as the settings do (SettingsNav). It is a column of the
// row and the strip, as PageHeader is, so that the strip sits as far below the
// row as the tabs do. Each line stands in a box as tall as the line it stands
// for. Under 30rem the tile and the title step down, as they do in PageHeader.
// The strip is the real one (`tabStripStyles`, which Tabs and TabLinks share),
// 44 px high, the height of a tab: its hairline and its gaps are not copied
// here. It does not scroll, as a placeholder that a keyboard stops at would be
// one too many: `overflow-hidden` replaces the scrolling of the real one.
function PageHeaderSkeleton({
  tabs = 0,
  announce = true,
  className,
}: SkeletonProps & { tabs?: number }) {
  return (
    <div
      data-slot="page-header-skeleton"
      aria-busy="true"
      className={cn("flex flex-col gap-4", className)}
    >
      {announce ? <LoadingLabel /> : null}
      <div
        data-slot="page-header-skeleton-row"
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Skeleton className="size-14 shrink-0 rounded-lg max-[30rem]:size-10 max-[30rem]:rounded-md" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex h-8.5 items-center max-[30rem]:h-7">
              <Skeleton className="h-6 w-full max-w-56" />
            </div>
            <div className="flex h-4.5 items-center">
              <Skeleton className="h-3 w-full max-w-40" />
            </div>
          </div>
        </div>
        <Skeleton className="h-10 w-28 shrink-0" />
      </div>
      {tabs > 0 ? (
        <div
          data-slot="page-header-skeleton-tabs"
          className={cn(tabStripStyles, "h-11 overflow-hidden")}
        >
          {range(tabs).map((tab) => (
            <div
              key={tab}
              data-slot="page-header-skeleton-tab"
              className="flex h-11 shrink-0 items-center px-3"
            >
              <Skeleton className={cn("h-3.5", TAB_WIDTHS[tab % TAB_WIDTHS.length])} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// The header of an entity page (EntityHeader): the breadcrumb, a title and the
// line under it, one action. Each line stands in a box as tall as the line it
// stands for: 18 px for the breadcrumb (`text-meta`), 32 px for the title
// (`text-entity`) and 20 px for the description (`text-body`). The layout is the
// one of the header, a column that becomes a row from `sm`.
function EntityHeaderSkeleton({ announce = true, className }: SkeletonProps) {
  return (
    <div
      data-slot="entity-header-skeleton"
      aria-busy="true"
      className={cn("flex flex-col gap-4", className)}
    >
      {announce ? <LoadingLabel /> : null}
      <div className="flex h-4.5 items-center">
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex h-8 items-center">
            <Skeleton className="h-6 w-full max-w-64" />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-full max-w-96" />
          </div>
        </div>
        <Skeleton className="h-10 w-28 shrink-0" />
      </div>
    </div>
  );
}

const AUTO_FIT = "grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]";

/** Whether a class list sets the columns of a grid, at any breakpoint. */
function setsColumns(className?: string) {
  return (className ?? "")
    .split(/\s+/)
    .some((name) => /(?:^|:)grid-cols-/.test(name));
}

// A `StatCard` without a trend: its name and its figure, and its tile at the
// end. 92 px tall, where one with a trend is 114 px.
function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex h-4.5 items-center">
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex h-7 items-center">
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
        <Skeleton className="size-10 shrink-0 rounded-md" />
      </CardContent>
    </Card>
  );
}

// A `QuotaCard` in its ordinary state, the one of a quota with a limit: the
// tile and the name, the figure, the bar. Each line stands in a box as tall as
// the line it stands for (`text-section` is 24 px, `text-page` 34 px, the bar
// 8 px), so the card is 156 px tall, borders included, as the real one. From
// `xl`, where the home puts its four cards across, the longest name of the
// quotas (the credits of the assistant) wraps onto a second line: the box of
// the name is two lines tall there, and the card 164 px, as the real one. A
// quota that is running low or at its limit has a badge beside its figure and
// the way up under its bar, which makes its card 36 px taller, and an unlimited
// quota has no bar, which makes it shorter (132 px); that is what arrives with
// the data. The card fills the cell it is in, as the real one does, so that a
// row is as tall as its tallest.
function QuotaCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-md" />
          <div className="flex h-6 min-w-0 flex-1 items-center xl:h-12">
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="flex h-8.5 items-center">
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </CardContent>
    </Card>
  );
}

// A row of cards, as many as asked: stat cards by default, the quota cards of
// the home with `variant="quota"`. By default the grid wraps by itself, 14 rem a
// card at the least. A page whose cards sit on columns of its own passes them, at
// any breakpoint, as `className`, and they replace the default:
// `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` is the home's.
function CardsRowSkeleton({
  count = 3,
  variant = "stat",
  announce = true,
  className,
}: SkeletonProps & { count?: number; variant?: "stat" | "quota" }) {
  const CardSkeleton = variant === "quota" ? QuotaCardSkeleton : StatCardSkeleton;

  return (
    <div
      data-slot="cards-row-skeleton"
      aria-busy="true"
      className={cn(
        "grid gap-4",
        setsColumns(className) ? null : AUTO_FIT,
        className,
      )}
    >
      {announce ? <LoadingLabel /> : null}
      {range(count).map((card) => (
        <CardSkeleton key={card} />
      ))}
    </div>
  );
}

// The rows of a list, 56 px each and divided by hairlines. A list usually sits
// in a card (see List), and so does this.
function ListSkeleton({
  rows = 4,
  announce = true,
  className,
}: SkeletonProps & { rows?: number }) {
  return (
    <div data-slot="list-skeleton" aria-busy="true" className={className}>
      {announce ? <LoadingLabel /> : null}
      <div
        data-slot="list-skeleton-rows"
        className="divide-y divide-hairline"
      >
        {range(rows).map((row) => (
          <div
            key={row}
            data-slot="list-skeleton-row"
            className="flex min-h-14 items-center gap-3 py-2"
          >
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={cn("h-3.5", WIDTHS[row % WIDTHS.length])} />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-3 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// A data table: its surface, a header of 44 px and rows of 46 px, as measured
// on the table (a row is 44 px of content and the 2 px that its collapsed
// borders add). The grid lines the columns up from the header down; it is not a
// table, which a screen reader would read out cell by cell.
function TableSkeleton({
  rows = 5,
  columns = 4,
  announce = true,
  className,
}: SkeletonProps & {
  rows?: number;
  columns?: number;
}) {
  const grid = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };

  return (
    <div
      data-slot="table-skeleton"
      aria-busy="true"
      className={cn(
        "overflow-hidden rounded-lg border border-hairline bg-card shadow-card",
        className,
      )}
    >
      {announce ? <LoadingLabel /> : null}
      <div
        data-slot="table-skeleton-header"
        style={grid}
        className="grid h-11 items-center gap-4 border-b border-hairline px-4"
      >
        {range(columns).map((column) => (
          <Skeleton key={column} className="h-3 w-3/5" />
        ))}
      </div>
      <div className="divide-y divide-hairline">
        {range(rows).map((row) => (
          <div
            key={row}
            data-slot="table-skeleton-row"
            style={grid}
            className="grid h-11.5 items-center gap-4 px-4"
          >
            {range(columns).map((column) => (
              <Skeleton
                key={column}
                className={cn("h-3.5", WIDTHS[(row + column) % WIDTHS.length])}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const SKELETONS = new Set<unknown>([
  PageHeaderSkeleton,
  EntityHeaderSkeleton,
  CardsRowSkeleton,
  ListSkeleton,
  TableSkeleton,
]);

interface LoadingRegionProps {
  children: ReactNode;
  /** A class of yours, for the spacing of the page: `space-y-6`. */
  className?: string;
}

// One busy region for a page made of several skeletons, as a route's
// loading.tsx has them: it says "Loading" once, and the skeletons that are its
// direct children keep quiet (it hands them `announce={false}`). A skeleton
// nested deeper, in a wrapper of yours, still says it itself: pass it
// `announce={false}`. It is not a live region on purpose: a live region inside
// a busy one is never spoken.
function LoadingRegion({ children, className }: LoadingRegionProps) {
  return (
    <div data-slot="loading-region" aria-busy="true" className={className}>
      <LoadingLabel />
      {Children.map(children, (child) =>
        isValidElement<SkeletonProps>(child) && SKELETONS.has(child.type)
          ? cloneElement(child, { announce: false })
          : child,
      )}
    </div>
  );
}

export {
  CardsRowSkeleton,
  EntityHeaderSkeleton,
  ListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
};
