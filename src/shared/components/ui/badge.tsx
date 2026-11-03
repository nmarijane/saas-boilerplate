import type { VariantProps } from "class-variance-authority";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/shared/utils/cn";

// Filled tones (brand, danger) carry their own on-color; the tinted ones
// (success, warning) and the neutral ones stay quiet. `[a&]` styles a badge
// rendered as a link.
const tones = {
  neutral:
    "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
  brand:
    "border-transparent bg-brand text-brand-on [a&]:hover:bg-(--btn-primary-hover)",
  success: "border-transparent bg-success-bg text-success-text",
  warning: "border-transparent bg-warning-bg text-warning-text",
  danger:
    "border-transparent bg-danger text-destructive-foreground [a&]:hover:bg-[color-mix(in_oklab,var(--danger)_90%,var(--ink))]",
  outline:
    "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
} as const;

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border font-semibold whitespace-nowrap transition-colors duration-150 ease-expo [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        ...tones,
        // The shadcn names the existing call sites use.
        default: tones.brand,
        secondary: tones.neutral,
        destructive: tones.danger,
      },
      // Both sizes keep the 12 px text: `md` only gives the badge more room.
      size: {
        sm: "min-h-5.5 px-2 text-caption",
        md: "min-h-6 px-2.5 text-caption",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

function Badge({
  className,
  variant,
  size,
  dot = false,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    /** A small dot before the label, so a status is never told by color alone. */
    dot?: boolean;
  }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      ) : null}
      {asChild ? <Slottable>{children}</Slottable> : children}
    </Comp>
  );
}

export { Badge, badgeVariants };
