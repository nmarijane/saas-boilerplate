import { LayersIcon } from "lucide-react";
import { Link } from "@/shared/lib/i18n-navigation";
import { cn } from "@/shared/utils/cn";

interface ShellLogoProps {
  /** The name of the product, drawn next to the mark. */
  productName: string;
  /** Where the logo leads: the home of the app. `null` draws it without a link, where there is nowhere to go yet (onboarding). */
  href?: string | null;
  className?: string;
}

// The mark of the product: a tile in the signature gradient with a glyph, then
// its name. A project replaces the glyph (or the whole tile) with its own.
// The tile is a picture, hidden from assistive technology: the name is what the
// link is called. It is a graphic on the gradient, never text (the gradient
// holds 3:1, not 4.5:1).
export function ShellLogo({
  productName,
  href = "/dashboard",
  className,
}: ShellLogoProps) {
  const classes = cn(
    "inline-flex min-h-11 min-w-0 items-center gap-2.5 rounded-sm font-display text-section tracking-tight text-ink",
    className,
  );
  const mark = (
    <>
      <span
        aria-hidden="true"
        className="inline-grid size-8 shrink-0 place-items-center rounded-sm bg-signature text-brand-on"
      >
        <LayersIcon className="size-4.5" strokeWidth={2.25} />
      </span>
      <span className="truncate">{productName}</span>
    </>
  );

  if (href === null) {
    return <span className={classes}>{mark}</span>;
  }

  return (
    <Link href={href} className={classes}>
      {mark}
    </Link>
  );
}
