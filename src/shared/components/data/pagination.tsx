import { Button } from "@/shared/components/ui/button";
import { Link } from "@/shared/lib/i18n-navigation";
import { cn } from "@/shared/utils/cn";

interface PaginationProps {
  /** The page that is drawn, from 1. */
  page: number;
  totalPages: number;
  /** The address of a page of the list: the first has no page in it. */
  hrefOf: (page: number) => string;
  /** Where the person is, in the language of the page: "Page 2 of 5". */
  label: string;
  previousLabel: string;
  nextLabel: string;
  className?: string;
}

// The foot of a list that is read a page at a time (the waiting list of the admin,
// the projects): where the person is, and the links to the page before and to the
// one after. They are links, with an address each, so that a page can be shared and
// reached with the back button, and read by a crawler or a script that follows
// links. A link is absent at its end of the list, not disabled, and a list that fits
// one page draws nothing. 36 px buttons, 8 px apart: their 44 px targets touch and do
// not overlap, as in the pages of a data table.
export function Pagination({
  page,
  totalPages,
  hrefOf,
  label,
  previousLabel,
  nextLabel,
  className,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div
      data-slot="pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-3",
        className,
      )}
    >
      <p className="text-meta text-ink-muted tabular-nums">{label}</p>
      <div className="flex items-center gap-2">
        {page > 1 && (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefOf(page - 1)}>{previousLabel}</Link>
          </Button>
        )}
        {page < totalPages && (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefOf(page + 1)}>{nextLabel}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
