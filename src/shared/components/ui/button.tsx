import type { VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import * as React from "react";

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
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:opacity-100",
    // An icon component draws its svg as a direct child: while busy, the
    // spinner takes its place.
    "aria-busy:[&>svg]:hidden",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_-2px_0_var(--btn-primary-edge)] hover:bg-(--btn-primary-hover) active:bg-(--btn-primary-active) motion-safe:active:translate-y-(--btn-press)",
        // Hover and press mix in --ink, which is dark in light mode and light
        // in dark mode: the label keeps its contrast on the on-danger color.
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[color-mix(in_oklab,var(--danger)_90%,var(--ink))] active:bg-[color-mix(in_oklab,var(--danger)_82%,var(--ink))]",
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

/** The children without a leading svg element, which the spinner replaces. */
function withoutLeadingIcon(children: React.ReactNode) {
  const [first, ...rest] = React.Children.toArray(children);

  return React.isValidElement(first) && first.type === "svg" ? rest : children;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingText,
  disabledReason,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner, sets `aria-busy` and disables the button. */
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

  // An icon-only button has room for the spinner alone; a text button swaps
  // its leading icon for it.
  const iconOnly = size === "icon" || size === "icon-sm";
  let content: React.ReactNode = children;
  if (loading) {
    content = iconOnly ? (
      <Spinner label={loadingText} />
    ) : (
      <>
        {/* The loading text already tells assistive technology what is going on. */}
        <Spinner label={loadingText ? "" : undefined} />
        {loadingText ?? withoutLeadingIcon(children)}
      </>
    );
  }

  const button = (
    <button
      data-slot="button"
      className={classes}
      aria-busy={loading || undefined}
      {...props}
      disabled={props.disabled || loading}
      aria-describedby={describedBy}
    >
      {content}
    </button>
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
