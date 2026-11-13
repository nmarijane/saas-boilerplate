import type { VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import * as React from "react";

import { LoadingButton } from "@/shared/components/ui/loading-button";
import { Spinner } from "@/shared/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/utils/cn";

// The primary treatment (hover, press, bottom edge) comes from the --btn-*
// tokens of theme.css, so a theme can change it without touching this file.
const buttonVariants = cva(
  [
    "tap-target inline-flex shrink-0 items-center justify-center rounded-md font-semibold whitespace-nowrap",
    "transition-[background-color,color,border-color,box-shadow,opacity,translate] duration-150 ease-expo",
    "focus-visible:focus-ring",
    "disabled:pointer-events-none disabled:opacity-50",
    // A loading button is not disabled: it keeps its focus and its look. An
    // icon component draws its svg as a direct child, and while the button
    // loads the spinner takes its place.
    "data-loading:[&>svg]:hidden",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_-2px_0_var(--btn-primary-edge)] hover:bg-(--btn-primary-hover) active:bg-(--btn-primary-active) motion-safe:active:translate-y-(--btn-press)",
        // Hover and press come from the --btn-danger-* tokens of theme.css,
        // which mix in --ink: the label keeps its contrast on the on-danger color.
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-(--btn-danger-hover) active:bg-(--btn-danger-active)",
        outline:
          "border border-input bg-surface text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 gap-2 px-4 text-body has-[>svg]:px-3",
        sm: "h-9 gap-1.5 px-3 text-meta has-[>svg]:px-2.5",
        lg: "h-12 gap-2 px-6 text-section has-[>svg]:px-4",
        icon: "size-10 text-body",
        "icon-sm": "size-9 text-body",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading,
  loadingText,
  disabledReason,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * Shows a spinner and holds the clicks. The button stays where it is and
     * keeps its focus: it says `aria-disabled`, and carries `data-loading`
     * (`disabled` would take the focus from the one who just pressed it). Its
     * click, and the submit of its form, do nothing until it stops loading.
     *
     * Drop `disabled` when you pass `loading`: a button that is both is dimmed
     * and takes no focus, which is what `loading` is there to avoid.
     *
     * Pass a boolean every time (`loading={pending}`), and not `undefined`
     * while it is idle. A button that is given `loading`, true or false, is
     * drawn by the one client component that holds the click
     * (loading-button.tsx), so that it keeps its node, and the focus on it, as
     * it starts and stops loading; a button that is not given it stays a plain
     * `<button>`. It works in a Server Component: the function that holds the
     * click is made on the client, and Button hands that component data only.
     */
    loading?: boolean;
    /** Replaces the label while `loading`; an icon button only speaks it. */
    loadingText?: string;
    /** Why the button is disabled: a tooltip for sighted users, a description for screen readers. */
    disabledReason?: string;
  }) {
  const reasonId = React.useId();
  const classes = cn(buttonVariants({ variant, size }), className);

  // The child is the element, and it does its own loading and disabling.
  if (asChild) {
    return (
      <Slot data-slot="button" className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  const showReason =
    Boolean(disabledReason) && Boolean(props.disabled) && !loading;
  const describedBy =
    [props["aria-describedby"], showReason ? reasonId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  // An icon-only button has room for the spinner alone; a text button puts it
  // before its label, where the icon of the label was: `data-loading` hides
  // that icon, which stays in the markup.
  const iconOnly = size === "icon" || size === "icon-sm";
  let content: React.ReactNode = children;
  if (loading) {
    content = iconOnly ? (
      <Spinner label={loadingText} />
    ) : (
      <>
        {/* The loading text already tells assistive technology what is going on. */}
        <Spinner label={loadingText ? "" : undefined} />
        {loadingText ?? children}
      </>
    );
  }

  // Button is rendered from Server Components, where a function cannot cross to
  // the page: it makes no handler. A button that is given `loading` is the
  // client leaf, which makes the one that holds the click (see its file); any
  // other is a plain `<button>`, as it was before `loading` existed. The leaf is
  // used for `loading={false}` too, so that the node stays when loading starts.
  // `aria-busy` is left out on purpose: a button has no busy state to announce,
  // and the spinner is a status that says it.
  const button =
    loading === undefined ? (
      <button
        data-slot="button"
        className={classes}
        {...props}
        aria-describedby={describedBy}
      >
        {content}
      </button>
    ) : (
      <LoadingButton
        data-slot="button"
        className={classes}
        {...props}
        loading={loading}
        aria-describedby={describedBy}
      >
        {content}
      </LoadingButton>
    );

  if (!showReason) {
    return button;
  }

  // A disabled button takes neither focus nor hover: the wrapper carries both.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-describedby={reasonId}
          className="inline-flex rounded-md focus-visible:focus-ring"
        >
          {button}
          <span className="sr-only" id={reasonId}>
            {disabledReason}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  );
}

export { Button, buttonVariants };
