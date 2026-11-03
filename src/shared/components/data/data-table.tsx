"use client";

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { cn } from "@/shared/utils/cn";

export interface Column<T> {
  key: string;
  header: string;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  className?: string;
}

type SortDirection = "asc" | "desc" | null;

/** What assistive technology is told of a sortable column: its arrow is hidden from it. */
export function ariaSort(direction: SortDirection) {
  if (direction === "asc") {
    return "ascending";
  }
  return direction === "desc" ? "descending" : "none";
}

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === null) {
    return <ArrowUpDownIcon aria-hidden="true" className="size-3.5" />;
  }
  const Icon = direction === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return <Icon aria-hidden="true" className="size-3.5" />;
}

// For a handful of items, cards or a List read better than a table: it earns
// its place from about a dozen rows, or when columns are there to compare.
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  searchKey,
  searchPlaceholder,
  pageSize: initialPageSize = 10,
  className,
}: DataTableProps<T>) {
  const t = useTranslations("common");
  const rowsLabelId = useId();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const placeholder = searchPlaceholder ?? t("table.searchPlaceholder");
  // The size the caller starts with (5, 25...) is one of the choices: without
  // it, the select would show none.
  const pageSizes = [...new Set([initialPageSize, 10, 20, 50, 100])].sort(
    (a, b) => a - b,
  );

  // Filter
  const filtered = searchKey
    ? data.filter((row) => {
        const val = row[searchKey];
        return String(val ?? "")
          .toLowerCase()
          .includes(search.toLowerCase());
      })
    : data;

  // Sort
  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        const cmp = String(aVal ?? "").localeCompare(String(bVal ?? ""), undefined, { numeric: true });
        return sortDir === "desc" ? -cmp : cmp;
      })
    : filtered;

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortKey(null);
        setSortDir(null);
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  return (
    <div data-slot="data-table" className={cn("space-y-4", className)}>
      {searchKey && (
        <Input
          placeholder={placeholder}
          aria-label={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="max-w-sm"
        />
      )}

      <div
        data-slot="data-table-surface"
        className="overflow-hidden rounded-lg border border-hairline bg-card shadow-card"
      >
        <Table className="text-body">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => {
                const direction = sortKey === col.key ? sortDir : null;
                return (
                  <TableHead
                    key={col.key}
                    aria-sort={col.sortable ? ariaSort(direction) : undefined}
                    className={cn("h-11 px-4 text-meta text-ink-muted", col.className)}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        className="tap-target inline-flex items-center gap-1 rounded-xs transition-colors duration-150 ease-expo hover:text-ink focus-visible:focus-ring"
                        onClick={() => handleSort(col.key)}
                      >
                        {col.header}
                        <SortIcon direction={direction} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-ink-muted"
                >
                  {t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row, i) => (
                <TableRow key={i} className="hover:bg-accent">
                  {columns.map((col) => {
                    const value = row[col.key];
                    return (
                      <TableCell
                        key={col.key}
                        // Figures keep their width, so that a column lines up.
                        className={cn(
                          "px-4 py-3",
                          !col.cell && typeof value === "number" && "font-mono tabular-nums",
                          col.className,
                        )}
                      >
                        {col.cell ? col.cell(row) : String(value ?? "")}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div
        data-slot="data-table-footer"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
      >
        <p className="text-meta text-ink-muted tabular-nums">
          {t("table.results", { count: sorted.length })}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-2">
            <span id={rowsLabelId} className="text-meta text-ink-muted">
              {t("table.rows")}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(0);
              }}
            >
              {/* No fixed width: padding, gap and chevron take 50 px, and "100" needs 28 px more at 16 px. */}
              <SelectTrigger
                size="sm"
                className="min-w-20"
                aria-labelledby={rowsLabelId}
              >
                {/* Written out, so that the server draws it too: the list of choices only fills in once it has mounted. */}
                <SelectValue>{pageSize}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 36 px buttons, 8 px apart: their 44 px targets touch and do not overlap. */}
          <div data-slot="data-table-pages" className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("table.firstPage")}
              disabled={page === 0}
              onClick={() => setPage(0)}
            >
              <ChevronsLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("table.previousPage")}
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="px-2 font-mono text-meta tabular-nums text-ink">
              {`${page + 1} / ${totalPages}`}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("table.nextPage")}
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("table.lastPage")}
              disabled={page >= totalPages - 1}
              onClick={() => setPage(totalPages - 1)}
            >
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
