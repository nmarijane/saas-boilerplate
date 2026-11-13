import * as React from "react";

import { cn } from "@/shared/utils/cn";

interface TableProps extends React.ComponentProps<"table"> {
  /**
   * The id of the element that titles the table. It makes the box the table
   * scrolls in a named region that a tab reaches. A table that holds a control
   * (a sort button, an action in a row) does not need it: the control takes the
   * focus, and the box scrolls to it. A table that can hold none has nothing
   * to focus, and a box that scrolls is out of the keyboard's reach.
   */
  scrollLabelledBy?: string;
}

// The table of the family: rows of 48 px at least, divided by a hairline and
// never striped, headers in muted 13 px text, figures in tabular numbers so
// that a column of them lines up. A table keeps the width of its columns (a
// cell does not wrap): when they do not fit, the box it sits in scrolls
// sideways, and the page never does.
function Table({ className, scrollLabelledBy, ...props }: TableProps) {
  const reachable = scrollLabelledBy !== undefined;

  return (
    <div
      data-slot="table-container"
      className="relative w-full max-w-full overflow-x-auto"
      role={reachable ? "region" : undefined}
      aria-labelledby={scrollLabelledBy}
      tabIndex={reachable ? 0 : undefined}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-body tabular-nums", className)}
        {...props}
      />
    </div>
  );
}

// The rows of a header are not something to point at: they take no highlight.
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b [&_tr]:hover:bg-transparent", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

// On a row, `height` is a floor: a cell that needs more makes the row taller.
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "h-12 border-b border-hairline transition-colors hover:bg-accent data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-4 text-left align-middle text-meta font-medium whitespace-nowrap text-ink-muted [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-meta text-ink-muted", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
