import * as React from "react";

import { Link } from "@/shared/lib/i18n-navigation";
import { cn } from "@/shared/utils/cn";

// Rows divided by a hairline. Inside a Card, put it in CardContent: the rows
// then line up with the title above them. `role="list"` gives back the list
// that Safari drops from a list with no bullets. It is a `ul`; where the order
// of the rows is the point (the steps of a setup), `as="ol"` makes it an
// ordered list, with the same rows, role and hairlines. It takes no `ref`: a
// `ul` and an `ol` are two elements, and a ref cannot be typed for both.
function List({
  as: Tag = "ul",
  className,
  ...props
}: Omit<React.ComponentProps<"ul">, "ref"> & { as?: "ul" | "ol" }) {
  return (
    <Tag
      data-slot="list"
      role="list"
      className={cn("divide-y divide-hairline", className)}
      {...props}
    />
  );
}

interface ListRowProps extends Omit<
  React.ComponentProps<"li">,
  "children" | "title"
> {
  /** An IconTile, an avatar or a status dot, before the title. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** A second line under the title, in muted text. */
  meta?: React.ReactNode;
  /**
   * A time, an amount or a badge, at the end of the row. In a linked row it
   * stays plain, as `leading` and `meta` do: the row is one anchor, and an
   * anchor cannot hold a button or another link.
   */
  trailing?: React.ReactNode;
  /**
   * Turns the whole row into a link, on the locale-aware Link of the app. The
   * link reaches 12 px past the list on each side, so that its highlight has
   * room round the text, which stays where it was: keep the list inside side
   * padding (a CardContent has 20 px), or the highlight is cut or the page
   * scrolls sideways.
   */
  href?: string;
}

const rowLayout = "flex min-h-14 items-center gap-3 py-2";

// `-mx-3 px-3` is the reach of the highlight: see `href` above.
const linkRow =
  "-mx-3 rounded-md px-3 transition-colors duration-150 ease-expo hover:bg-accent focus-visible:focus-ring";

function ListRow({
  leading,
  title,
  meta,
  trailing,
  href,
  className,
  ...props
}: ListRowProps) {
  const content = (
    <>
      {/* A flex box, so that an inline tile or avatar leaves no gap under it. */}
      {leading ? <div className="flex shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="text-body font-medium wrap-break-word text-ink">
          {title}
        </div>
        {meta ? (
          <div className="text-meta wrap-break-word text-ink-muted">{meta}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="shrink-0 text-meta text-ink-muted">{trailing}</div>
      ) : null}
    </>
  );

  return (
    <li data-slot="list-row" className={className} {...props}>
      {href ? (
        <Link href={href} className={cn(rowLayout, linkRow)}>
          {content}
        </Link>
      ) : (
        <div className={rowLayout}>{content}</div>
      )}
    </li>
  );
}

export { List, ListRow };
export type { ListRowProps };
