import type { VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/shared/utils/cn";

// Inline, as in a sentence (WCAG 2.5.8): a link on a line of its own adds className="tap-target".
const textLinkVariants = cva(
  "inline rounded-xs font-medium box-decoration-clone underline-offset-4 transition-colors duration-150 ease-expo focus-visible:focus-ring has-[>svg]:inline-flex has-[>svg]:items-center has-[>svg]:gap-1 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      intent: {
        default: "text-brand",
        muted: "text-ink-muted hover:text-ink",
        danger: "text-danger-text",
      },
      underline: {
        hover: "hover:underline",
        // A solid line at rest tells a link from its text by more than color.
        always: "underline decoration-1 decoration-current hover:decoration-2",
      },
    },
    defaultVariants: {
      intent: "default",
      underline: "always",
    },
  },
);

// A plain anchor. For a locale-aware link, render the Link of
// `@/shared/lib/i18n-navigation` with `asChild`.
function TextLink({
  className,
  intent,
  underline,
  asChild = false,
  ...props
}: React.ComponentProps<"a"> &
  VariantProps<typeof textLinkVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      data-slot="text-link"
      className={cn(textLinkVariants({ intent, underline }), className)}
      {...props}
    />
  );
}

export { TextLink, textLinkVariants };
