import { matchesSearch } from "@/shared/utils/helpers";

/**
 * What cmdk asks of each row of the workspace list: a score, and 0 hides the
 * row. A workspace is found by its name (the keyword of its row), in any case
 * and without its accents. The value of a row is the id of its workspace, which
 * nobody types: it is never searched, or a letter of an id would find rows that
 * have nothing to do with it.
 */
export function byName(
  _id: string,
  search: string,
  keywords?: string[],
): number {
  return matchesSearch(keywords?.[0] ?? "", search) ? 1 : 0;
}
