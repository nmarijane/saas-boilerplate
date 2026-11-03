import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Children, cloneElement, isValidElement } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
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

// The header of a page: a tile, a title and its context line, one action.
// Each line stands in a box as tall as the line it stands for. Under 30rem the
// tile and the title step down, as they do in PageHeader.
function PageHeaderSkeleton({ announce = true, className }: SkeletonProps) {
  return (
    <div
      data-slot="page-header-skeleton"
      aria-busy="true"
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {announce ? <LoadingLabel /> : null}
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
  );
}

const AUTO_FIT = "grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]";

/** Whether a class list sets the columns of a grid, at any breakpoint. */
function setsColumns(className?: string) {
  return (className ?? "")
    .split(/\s+/)
    .some((name) => /(?:^|:)grid-cols-/.test(name));
}

// A row of stat cards, as many as asked. Each card is a `StatCard` without a
// trend: 92 px tall, where one with a trend is 114 px. By default the grid
// wraps by itself, 14 rem a card at the least. A page whose cards sit on columns
// of its own passes them, at any breakpoint, as `className`, and they replace
// the default: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` is the dashboard's.
function CardsRowSkeleton({
  count = 3,
  announce = true,
  className,
}: SkeletonProps & { count?: number }) {
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
        <Card key={card}>
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
  ListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
};
