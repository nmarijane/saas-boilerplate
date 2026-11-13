"use client";

import type { ComponentProps } from "react";
import type { ShellLink } from "@/shared/shell/view";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/shared/lib/i18n-navigation";
import {
  currentLinkId,
  isAppPath,
  isWebAddress,
  navRowStyles,
} from "./nav-row";

type ShellAnchorProps = Omit<ComponentProps<"a">, "href"> & { link: ShellLink };

/**
 * The anchor of a link of the shell. A page of the app goes through the
 * locale-aware Link, which adds the language and prefetches. A link that leaves
 * the app (Help, which is a `mailto:` or a web address) must not: the language
 * would be put in front of it. It is a plain anchor, in a new tab for a web
 * address, and a web address says so to assistive technology, in words only
 * they read: nothing else tells that the link will not stay in this tab. The
 * sidebar, the drawer and the tab bar all draw their links with it.
 */
export function ShellAnchor({ link, children, ...props }: ShellAnchorProps) {
  const t = useTranslations("shell");

  if (isAppPath(link.href)) {
    return (
      <Link href={link.href} {...props}>
        {children}
      </Link>
    );
  }

  const web = isWebAddress(link.href);

  return (
    <a
      href={link.href}
      target={web ? "_blank" : undefined}
      rel={web ? "noopener noreferrer" : undefined}
      {...props}
    >
      {children}
      {web ? <span className="sr-only">{t("opensInNewTab")}</span> : null}
    </a>
  );
}

interface NavListProps {
  items: ShellLink[];
  /** What the navigation is, for assistive technology: it is a landmark among others. */
  label: string;
  /** Called when a link is clicked: the drawer closes on it. */
  onNavigate?: () => void;
  /**
   * The id of the one link of the whole menu that stands for the page, which the
   * menu decides once over all its lists (`currentLinkId`): a link of this list
   * is current only if it is that one. `null` says no link is. Left out, the
   * list decides among its own links, which is right for a list that stands alone.
   */
  currentId?: string | null;
}

// A list of the links of the shell: the main pages, the admin pages, Settings
// and Help. It is drawn in the sidebar and in the drawer, which is the same
// list at two sizes of screen.
export function NavList({
  items,
  label,
  onNavigate,
  currentId,
}: NavListProps) {
  const pathname = usePathname();

  if (items.length === 0) {
    return null;
  }

  const current =
    currentId === undefined ? currentLinkId(items, pathname) : currentId;

  return (
    <nav aria-label={label}>
      <ul role="list" className="flex flex-col gap-0.5">
        {items.map((link) => (
          <li key={link.id}>
            <ShellAnchor
              link={link}
              aria-current={link.id === current ? "page" : undefined}
              onClick={onNavigate}
              className={navRowStyles}
            >
              {link.icon}
              <span className="truncate">{link.label}</span>
            </ShellAnchor>
          </li>
        ))}
      </ul>
    </nav>
  );
}
