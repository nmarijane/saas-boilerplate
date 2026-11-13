import type { ShellLink } from "@/shared/shell/view";
import { activeHref } from "@/shared/utils/paths";

// The look and the rules of a row of the navigation, apart from the components
// that draw it (nav-list.tsx, tab-bar.tsx). This file has no "use client", and
// neither has what it imports: a Server Component that needs the classes of a row
// or the current link gets the string and the functions themselves, where from a
// client module it would get references that cannot be called. Keep it so: no
// component, no hook, and no import of a client module in here.

/**
 * One row of the navigation, and what the rows of the sidebar actions (the
 * feedback button) look like too: 44 px high, with the radius of a field, a
 * 20 px icon in muted ink and a label that is cut when it is too long. The
 * pointer lightens it, and the current page gets the accent background, a
 * heavier label and its icon in ink. Forced-colors mode drops every background
 * but a system color: there the current page takes the highlight of the system,
 * as a selected row does, with its text and icon in the color made for it.
 */
export const navRowStyles = [
  "flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-body font-medium text-ink",
  "transition-colors duration-150 ease-expo hover:bg-sidebar-hover active:bg-sidebar-accent",
  "[&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-ink-muted",
  "aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:[&_svg]:text-ink",
  "forced-colors:aria-[current=page]:bg-[color:Highlight] forced-colors:aria-[current=page]:text-[color:HighlightText] forced-colors:aria-[current=page]:[&_svg]:text-[color:HighlightText]",
].join(" ");

// A page of the app is a path ("/projects"); anything else leaves it: a
// `mailto:` link, a web address, and "//host/path", which is a host and not a
// page. A browser also reads "/\host" as "//host" and drops tabs and line
// breaks ("/\t/host"), so a path counts as a page only if a browser would
// resolve it on the app's own origin. Only a web address (http or https)
// opens in a new tab.
const APP_ORIGIN = "http://app.invalid";
const WEB_ADDRESS_RE = /^https?:\/\//i;

/** Whether a link goes to a page of the app, which the locale-aware Link draws. */
export function isAppPath(href: string): boolean {
  if (!href.startsWith("/")) return false;
  try {
    return new URL(href, APP_ORIGIN).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

/** Whether a link goes to a web address (http or https): a new tab, and a word for assistive technology about it. */
export function isWebAddress(href: string): boolean {
  return WEB_ADDRESS_RE.test(href);
}

/**
 * The id of the one link that stands for the page, or undefined. The rule is
 * the one of the app (`isActivePath`, through `activeHref`): the link whose
 * path is the page or the page is under, `match` before `href`, and when
 * several fit the most specific wins, so that one link is current at most. A
 * link that leaves the app is never the page. Give it the links of the whole
 * menu (main, admin and secondary together): it is across all of them that one
 * link at most is current, and not in each list on its own.
 */
export function currentLinkId(
  links: readonly ShellLink[],
  pathname: string | null,
): string | undefined {
  const inApp = links.filter(({ href }) => isAppPath(href));
  const target = (link: ShellLink) => link.match ?? link.href;
  const current = activeHref(
    inApp.map((link) => ({ href: target(link) })),
    pathname,
  );

  return current === undefined
    ? undefined
    : inApp.find((link) => target(link) === current)?.id;
}
