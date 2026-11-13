import { useTranslations } from "next-intl";

interface SkipLinkProps {
  /** The id of what the link skips to: the `main` of the page. */
  targetId?: string;
}

// The first thing a keyboard user reaches: a link past the navigation, to the
// content. It stays above the page, out of sight, until it has the focus, and
// then shows over the sticky bars (z-40, one above them). Its focus ring is the
// one of the project (`focus-visible:focus-ring`, as the buttons have it), and it
// has no shadow of its own: a `shadow-*` utility is in a later layer than the
// ring that global.css gives every link, and would take its place.
export function SkipLink({ targetId = "main-content" }: SkipLinkProps) {
  const t = useTranslations("shell");

  return (
    <a
      href={`#${targetId}`}
      className="absolute -top-24 left-4 z-40 inline-flex min-h-11 items-center rounded-md bg-surface px-4 font-semibold text-ink focus:top-4 focus-visible:focus-ring"
    >
      {t("skipToContent")}
    </a>
  );
}
