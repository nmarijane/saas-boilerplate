import type { LucideIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { Link } from "@/shared/lib/i18n-navigation";
import { cn } from "@/shared/utils/cn";

// A handler or a link, never both: each member forbids the key of the other.
type EmptyStateAction =
  | { label: string; onClick: () => void; href?: never }
  | { label: string; href: string; onClick?: never };

// An illustration or a tinted tile, never a bare icon: one of the two is
// required, and both are allowed, the illustration then wins.
type EmptyStatePicture =
  | {
      /** Drawn in a tinted tile, never bare. An `illustration` takes its place. */
      icon: LucideIcon;
      illustration?: NonNullable<React.ReactNode>;
    }
  | {
      /**
       * Art the project supplies (an svg, an image), where the tile would be.
       * It is decoration by contract, hidden from assistive technology: the
       * title says what the state is about.
       */
      illustration: NonNullable<React.ReactNode>;
      icon?: LucideIcon;
    };

interface EmptyStateBaseProps {
  title: string;
  /** One sentence. */
  description: string;
  /**
   * The one button of the state. With `href` it is a link, on the
   * locale-aware Link of the app, which a server page can render; an `onClick`
   * handler needs a client component to hold it, as a function cannot cross
   * from a Server Component.
   */
  action?: EmptyStateAction;
  /**
   * The tag of the title: `h3` by default, `h1` or `h2` where nothing above it
   * holds a heading. The look is the same at every level.
   */
  headingLevel?: 1 | 2 | 3;
  className?: string;
}

type EmptyStateProps = EmptyStateBaseProps & EmptyStatePicture;

function ActionButton({ action }: { action: EmptyStateAction }) {
  if (action.href !== undefined) {
    return (
      <Button asChild className="mt-6">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }

  // The handler is called with nothing: the click event is not its business.
  return (
    <Button type="button" className="mt-6" onClick={() => action.onClick()}>
      {action.label}
    </Button>
  );
}

// A picture, a title, one sentence and at most one button, on a surface. The
// error state sits on the same surface (error-state.tsx), so that either can
// take the place of the other. The title and the sentence wrap anywhere: in a
// centered column they are boxes that size to their content, and `break-word`
// would leave a long token its whole width, past the card.
export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  headingLevel = 3,
  className,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;

  let picture: React.ReactNode = null;
  if (illustration) {
    picture = (
      <div
        data-slot="empty-state-illustration"
        aria-hidden="true"
        className="flex"
      >
        {illustration}
      </div>
    );
  } else if (icon) {
    picture = <IconTile icon={icon} size="lg" />;
  }

  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-hairline bg-surface p-8 text-center",
        className,
      )}
    >
      {picture}
      <Heading className="mt-4 text-section text-balance wrap-anywhere text-ink">
        {title}
      </Heading>
      <p className="mt-1 max-w-sm text-body wrap-anywhere text-ink-muted">
        {description}
      </p>
      {action ? <ActionButton action={action} /> : null}
    </div>
  );
}
