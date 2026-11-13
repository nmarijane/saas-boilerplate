/** The path of a link, without its query, its fragment or its trailing slash. The root stays a slash. */
export function pathOf(href: string): string {
  const path = href.split(/[?#]/, 1)[0] ?? "";

  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/**
 * Whether the page at `pathname` is the page `target` stands for, or one under
 * it: the same path, or the path of the target followed by a slash, so whole
 * segments only (`/settings` is not the path of `/settings-old`). Query,
 * fragment and trailing slash do not count, on either side. The root is the
 * path of the root page alone: it is not the path of every page.
 */
export function isActivePath(pathname: string, target: string): boolean {
  const page = pathOf(pathname);
  const path = pathOf(target);

  return page === path || (path !== "/" && page.startsWith(`${path}/`));
}

/** What `activeHref` reads of a link: where it goes, and whether it stands for that page alone. */
interface ActiveLink {
  href: string;
  /** The link is the current one on this page only, not on the pages under it: the overview of an entity, whose other tabs live below it. */
  exact?: boolean;
}

/**
 * The href of the link that stands for the page: the one whose path is the
 * page, or (unless it is `exact`) the one the page is under (the rule is
 * `isActivePath`, the one matcher of the app). When several fit, the most
 * specific wins, so that one link at most is the current one. It is here, and
 * not in the component of the tabs, so that a Server Component may call it: this
 * module has no `"use client"` above it, and imports nothing.
 */
export function activeHref(
  links: readonly ActiveLink[],
  pathname: string | null,
): string | undefined {
  if (!pathname) {
    return undefined;
  }

  const page = pathOf(pathname);
  let best: { href: string; length: number } | undefined;

  for (const { href, exact } of links) {
    const path = pathOf(href);
    const matches = exact ? page === path : isActivePath(page, href);

    if (matches && path.length > (best?.length ?? -1)) {
      best = { href, length: path.length };
    }
  }

  return best?.href;
}

/**
 * A path with the query of the page it stands for: `/projects` and `tab=billing`
 * give `/projects?tab=billing`. A page with no query leaves the path as it is.
 * The router gives a page's query as an object that says its text, and
 * `URLSearchParams` does too: this takes either, as the language switch does to
 * stay on the same page, filters and all.
 */
export function withSearch(
  pathname: string,
  search: { toString: () => string },
): string {
  const query = search.toString();

  return query ? `${pathname}?${query}` : pathname;
}
